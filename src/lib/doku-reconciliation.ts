import { DokuClient, DokuClientError } from "./doku-client.ts";
import { getEnabledDokuConfig } from "./doku-config.ts";
import { getEnvValue } from "./env.ts";
import {
  applyDokuPaymentFact,
  DokuPaymentLifecycleError,
  type DokuNotificationFact,
  type DokuPaymentConfigIdentity,
  type DokuPaymentEventSource,
} from "./doku-payment-lifecycle.ts";
import { buildStockRestorationStatements } from "./order-lifecycle.ts";

const DUE_BATCH_LIMIT = 10;
const LEASE_MS = 60_000;
const MAX_RECONCILE_ATTEMPTS = 8;
const BACKOFF_SECONDS = [60, 300, 900, 3_600, 10_800, 21_600, 43_200, 86_400] as const;
const DUE_ATTEMPT_SQL = `(
  (local_status = 'created' AND provider_reference IS NULL
    AND expires_at IS NOT NULL AND expires_at <= ?)
  OR
  (provider_reference IS NOT NULL
    AND (next_reconcile_at <= ? OR (next_reconcile_at IS NULL AND reconcile_attempts = 0)))
)`;

type AttemptRow = {
  id: string;
  order_id: number;
  provider_config_id: number;
  environment: "sandbox" | "production";
  config_revision: number;
  merchant_invoice: string;
  provider_reference: string | null;
  amount_sen: number;
  expires_at: string | null;
  local_status: "created" | "pending" | "attention_required";
  reconcile_attempts: number;
  lease_until: string | null;
  next_reconcile_at: string | null;
};

type StatusResponse = {
  id?: unknown;
  order?: { amount?: unknown; currency?: unknown; invoice_number?: unknown; status?: unknown };
  payment?: { amount?: unknown; currency?: unknown; channel?: unknown; status?: unknown; state?: unknown };
};

export type DokuReconcileOutcome = {
  attemptId: string;
  orderId: number;
  outcome: "paid" | "failed" | "expired" | "pending" | "attention_required" | "skipped";
  source: "manual" | "scheduled";
};

export class DokuReconciliationError extends Error {
  readonly code: "NOT_FOUND" | "NOT_ELIGIBLE" | "LEASED" | "COOLDOWN" | "UNAVAILABLE" | "PROVIDER_FAILED";
  readonly status: number;

  constructor(code: DokuReconciliationError["code"], status = 409) {
    super(code);
    this.name = "DokuReconciliationError";
    this.code = code;
    this.status = status;
  }
}

function safeUpper(value: unknown, pattern = /^[A-Z][A-Z0-9_]{1,63}$/): string | null {
  return typeof value === "string" && pattern.test(value) ? value : null;
}

function majorMyrToSen(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  const sen = Math.round(value * 100);
  return Number.isSafeInteger(sen) && Math.abs(value * 100 - sen) < 1e-7 ? sen : null;
}

function parseStatusFact(data: StatusResponse, attempt: AttemptRow): DokuNotificationFact {
  const providerReference = typeof data.id === "string" && /^[A-Za-z0-9_-]{1,255}$/.test(data.id)
    ? data.id
    : null;
  const merchantInvoice = typeof data.order?.invoice_number === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(data.order.invoice_number)
    ? data.order.invoice_number
    : null;
  const providerStatus = safeUpper(data.payment?.status);
  const providerState = safeUpper(data.payment?.state);
  const channel = safeUpper(data.payment?.channel) || "UNKNOWN";
  const orderStatus = safeUpper(data.order?.status) || undefined;
  if (
    !attempt.provider_reference ||
    providerReference !== attempt.provider_reference ||
    merchantInvoice !== attempt.merchant_invoice ||
    data.order?.currency !== "MYR" ||
    data.payment?.currency !== "MYR" ||
    majorMyrToSen(data.order?.amount) !== attempt.amount_sen ||
    majorMyrToSen(data.payment?.amount) !== attempt.amount_sen ||
    !providerStatus ||
    !providerState
  ) {
    throw new DokuReconciliationError("PROVIDER_FAILED", 502);
  }
  return {
    providerReference,
    merchantInvoice,
    amountSen: attempt.amount_sen,
    channel,
    providerStatus,
    providerState,
    orderStatus,
    eventKey: [
      "reconcile",
      providerReference,
      merchantInvoice,
      String(attempt.amount_sen),
      channel,
      providerStatus,
      providerState,
      orderStatus || "",
    ].join(":"),
  };
}

function failureClass(error: unknown): "configuration" | "authentication" | "signature" | "timeout" | "provider" | "local_transition" {
  if (error instanceof DokuPaymentLifecycleError) return "local_transition";
  if (error instanceof DokuClientError) {
    if (error.status === 401 || error.status === 403) return "authentication";
    if (["DOKU_RESPONSE_HEADERS", "DOKU_RESPONSE_SIGNATURE", "DOKU_AMOUNT_MISMATCH"].includes(error.code)) return "signature";
    if (error.code === "DOKU_TIMEOUT") return "timeout";
    if (error.code === "DOKU_CONFIGURATION") return "configuration";
  }
  if (error instanceof DokuReconciliationError && error.code === "UNAVAILABLE") return "configuration";
  return "provider";
}

async function loadAttempt(database: D1Database, attemptId: string): Promise<AttemptRow | null> {
  return database.prepare(`
    SELECT id, order_id, provider_config_id, environment, config_revision,
      merchant_invoice, provider_reference, amount_sen, expires_at,
      local_status, reconcile_attempts, lease_until, next_reconcile_at
    FROM payment_attempts
    WHERE id = ? AND provider = 'doku'
    LIMIT 1
  `).bind(attemptId).first<AttemptRow>();
}

async function leaseAttempt(
  database: D1Database,
  attemptId: string,
  source: "manual" | "scheduled",
  now: Date,
): Promise<{ attempt: AttemptRow; token: string }> {
  const token = crypto.randomUUID();
  const nowIso = now.toISOString();
  const leaseUntil = new Date(now.getTime() + LEASE_MS).toISOString();
  const dueGuard = source === "scheduled"
    ? `AND ${DUE_ATTEMPT_SQL}`
    : "AND (next_reconcile_at IS NULL OR next_reconcile_at <= ?)";
  const values = source === "scheduled"
    ? [token, leaseUntil, nowIso, attemptId, nowIso, nowIso, nowIso]
    : [token, leaseUntil, nowIso, attemptId, nowIso, nowIso];
  const updated = await database.prepare(`
    UPDATE payment_attempts SET
      lease_token = ?, lease_until = ?, reconcile_attempts = reconcile_attempts + 1,
      updated_at = ?
    WHERE id = ? AND provider = 'doku'
      AND local_status IN ('created', 'pending', 'attention_required')
      AND (lease_until IS NULL OR lease_until <= ?)
      ${dueGuard}
  `).bind(...values).run();
  if (!updated.meta?.changes) {
    const current = await loadAttempt(database, attemptId);
    if (!current) throw new DokuReconciliationError("NOT_FOUND", 404);
    if (source === "manual") {
      if (current.lease_until && Date.parse(current.lease_until) > now.getTime()) {
        throw new DokuReconciliationError("LEASED");
      }
      if (current.next_reconcile_at && Date.parse(current.next_reconcile_at) > now.getTime()) {
        throw new DokuReconciliationError("COOLDOWN");
      }
    }
    throw new DokuReconciliationError("NOT_ELIGIBLE");
  }
  const attempt = await database.prepare(`
    SELECT id, order_id, provider_config_id, environment, config_revision,
      merchant_invoice, provider_reference, amount_sen, expires_at,
      local_status, reconcile_attempts, lease_until, next_reconcile_at
    FROM payment_attempts WHERE id = ? AND lease_token = ? LIMIT 1
  `).bind(attemptId, token).first<AttemptRow>();
  if (!attempt) throw new DokuReconciliationError("LEASED");
  return { attempt, token };
}

async function expireUninitiatedAttempt(database: D1Database, attempt: AttemptRow, token: string, now: Date) {
  const nowIso = now.toISOString();
  const statements = [
    database.prepare(`
      UPDATE payment_attempts SET
        local_status = 'expired', error_class = NULL,
        terminal_at = COALESCE(terminal_at, ?), stock_released_at = COALESCE(stock_released_at, ?),
        lease_token = NULL, lease_until = NULL, next_reconcile_at = NULL, updated_at = ?
      WHERE id = ? AND lease_token = ? AND local_status = 'created'
        AND provider_reference IS NULL AND expires_at IS NOT NULL AND expires_at <= ?
    `).bind(nowIso, nowIso, nowIso, attempt.id, token, nowIso),
    database.prepare(`
      UPDATE orders SET payment_status = 'failed'
      WHERE id = ? AND payment_method = 'doku'
        AND payment_status NOT IN ('paid', 'settled', 'success')
        AND EXISTS (SELECT 1 FROM payment_attempts WHERE id = ? AND local_status = 'expired')
    `).bind(attempt.order_id, attempt.id),
    ...buildStockRestorationStatements(database, [attempt.order_id], true),
    database.prepare(`
      INSERT OR IGNORE INTO payment_events (
        payment_attempt_id, source, event_key, resulting_status, received_at
      ) SELECT id, 'reconciliation', ?, 'expired', ?
        FROM payment_attempts WHERE id = ? AND local_status = 'expired'
    `).bind(`local-expiry:${attempt.id}`, nowIso, attempt.id),
  ];
  const results = await database.batch(statements);
  if (!results[0]?.meta?.changes) throw new DokuReconciliationError("NOT_ELIGIBLE");
}

function nextBackoff(now: Date, attempts: number) {
  const index = Math.min(Math.max(attempts - 1, 0), BACKOFF_SECONDS.length - 1);
  return new Date(now.getTime() + BACKOFF_SECONDS[index] * 1_000).toISOString();
}

async function releaseLease(
  database: D1Database,
  attempt: AttemptRow,
  token: string,
  now: Date,
  status: string,
) {
  const terminal = ["paid", "failed", "expired"].includes(status);
  await database.prepare(`
    UPDATE payment_attempts SET
      lease_token = NULL, lease_until = NULL,
      next_reconcile_at = ?, updated_at = ?
    WHERE id = ? AND lease_token = ?
  `).bind(terminal ? null : nextBackoff(now, attempt.reconcile_attempts), now.toISOString(), attempt.id, token).run();
}

async function recordFailure(database: D1Database, attempt: AttemptRow, token: string, now: Date, error: unknown) {
  const exhausted = attempt.reconcile_attempts >= MAX_RECONCILE_ATTEMPTS;
  const nowIso = now.toISOString();
  const klass = failureClass(error);
  await database.batch([
    database.prepare(`
      UPDATE payment_attempts SET
        local_status = CASE WHEN ? = 1 THEN 'attention_required' ELSE local_status END,
        error_class = ?, lease_token = NULL, lease_until = NULL,
        next_reconcile_at = ?, updated_at = ?
      WHERE id = ? AND lease_token = ?
        AND local_status IN ('created', 'pending', 'attention_required')
    `).bind(exhausted ? 1 : 0, klass, exhausted ? null : nextBackoff(now, attempt.reconcile_attempts), nowIso, attempt.id, token),
    database.prepare(`
      INSERT OR IGNORE INTO payment_events (
        payment_attempt_id, source, event_key, resulting_status, received_at
      ) SELECT id, 'reconciliation', ?, 'attention_required', ?
        FROM payment_attempts WHERE id = ? AND local_status = 'attention_required'
    `).bind(`reconcile-exhausted:${attempt.reconcile_attempts}`, nowIso, attempt.id),
  ]);
}

async function reconcileLeasedAttempt(
  database: D1Database,
  rootSecret: string,
  leased: { attempt: AttemptRow; token: string },
  source: "manual" | "scheduled",
  options: { fetch?: typeof fetch; now: Date },
): Promise<DokuReconcileOutcome> {
  const { attempt, token } = leased;
  if (!attempt.provider_reference) {
    if (!attempt.expires_at || Date.parse(attempt.expires_at) > options.now.getTime()) {
      await releaseLease(database, attempt, token, options.now, attempt.local_status);
      return { attemptId: attempt.id, orderId: attempt.order_id, outcome: "skipped", source };
    }
    await expireUninitiatedAttempt(database, attempt, token, options.now);
    return { attemptId: attempt.id, orderId: attempt.order_id, outcome: "expired", source };
  }

  const config = await getEnabledDokuConfig(database, rootSecret);
  if (
    !config ||
    config.environment !== attempt.environment ||
    config.configRevision !== attempt.config_revision
  ) {
    throw new DokuReconciliationError("UNAVAILABLE", 503);
  }
  const client = new DokuClient({
    environment: config.environment,
    clientId: config.clientId,
    apiKey: config.apiKey,
    secretKey: config.secretKey,
    fetch: options.fetch,
    now: () => options.now,
  });
  const response = await client.retrieveCheckout<StatusResponse>({
    checkoutId: attempt.provider_reference,
    expectedAmountSen: attempt.amount_sen,
  });
  const fact = parseStatusFact(response.data, attempt);
  const identity: DokuPaymentConfigIdentity = {
    id: attempt.provider_config_id,
    environment: attempt.environment,
    configRevision: attempt.config_revision,
  };
  const eventSource: DokuPaymentEventSource = source === "manual" ? "status" : "reconciliation";
  const result = await applyDokuPaymentFact(database, identity, fact, eventSource);
  await releaseLease(database, attempt, token, options.now, result.status);
  return {
    attemptId: attempt.id,
    orderId: attempt.order_id,
    outcome: result.status === "created" ? "skipped" : result.status,
    source,
  };
}

async function runAttempt(
  database: D1Database,
  rootSecret: string,
  attemptId: string,
  source: "manual" | "scheduled",
  options: { fetch?: typeof fetch; now?: () => Date } = {},
) {
  const now = options.now?.() ?? new Date();
  const leased = await leaseAttempt(database, attemptId, source, now);
  try {
    return await reconcileLeasedAttempt(database, rootSecret, leased, source, {
      fetch: options.fetch,
      now,
    });
  } catch (error) {
    await recordFailure(database, leased.attempt, leased.token, now, error);
    if (error instanceof DokuReconciliationError) throw error;
    throw new DokuReconciliationError("PROVIDER_FAILED", 502);
  }
}

export async function reconcileDokuOrder(
  database: D1Database,
  rootSecret: string,
  orderId: number,
  options: { fetch?: typeof fetch; now?: () => Date } = {},
): Promise<DokuReconcileOutcome> {
  const attempt = await database.prepare(`
    SELECT id FROM payment_attempts
    WHERE order_id = ? AND provider = 'doku'
      AND local_status IN ('created', 'pending', 'attention_required')
      AND provider_reference IS NOT NULL
    ORDER BY created_at DESC, id DESC LIMIT 1
  `).bind(orderId).first<{ id: string }>();
  if (!attempt) throw new DokuReconciliationError("NOT_ELIGIBLE");
  return runAttempt(database, rootSecret, attempt.id, "manual", options);
}

export async function reconcileDueDokuPayments(
  env: Env,
  options: { fetch?: typeof fetch; now?: () => Date; limit?: number } = {},
): Promise<DokuReconcileOutcome[]> {
  const database = env.OMS_DB as D1Database | undefined;
  const rootSecret = getEnvValue("AUTH_SECRET", env as unknown as Record<string, unknown>);
  if (!database?.prepare || !rootSecret) return [];
  const now = options.now?.() ?? new Date();
  const limit = Math.min(Math.max(options.limit ?? DUE_BATCH_LIMIT, 1), DUE_BATCH_LIMIT);
  const due = await database.prepare(`
    SELECT id FROM payment_attempts
    WHERE provider = 'doku'
      AND local_status IN ('created', 'pending', 'attention_required')
      AND ${DUE_ATTEMPT_SQL}
      AND (lease_until IS NULL OR lease_until <= ?)
    ORDER BY COALESCE(next_reconcile_at, expires_at, initiated_at, created_at), id
    LIMIT ?
  `).bind(now.toISOString(), now.toISOString(), now.toISOString(), limit).all<{ id: string }>();
  const outcomes: DokuReconcileOutcome[] = [];
  for (const row of due.results || []) {
    try {
      const result = await runAttempt(database, rootSecret, row.id, "scheduled", {
        fetch: options.fetch,
        now: () => now,
      });
      outcomes.push(result);
      console.info("doku-reconciliation", {
        attempt_id: result.attemptId,
        source: result.source,
        outcome: result.outcome,
      });
    } catch (error) {
      const code = error instanceof DokuReconciliationError ? error.code : "PROVIDER_FAILED";
      console.warn("doku-reconciliation", {
        attempt_id: row.id,
        source: "scheduled",
        outcome: "retryable_failure",
        error_class: code,
      });
    }
  }
  return outcomes;
}
