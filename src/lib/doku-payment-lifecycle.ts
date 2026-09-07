import { DOKU_PAYMENT_CHANNELS } from "./doku-config.ts";
import { buildStockRestorationStatements } from "./order-lifecycle.ts";
import { prepareSettledDokuMetaPurchase } from "./accepted-order-meta.ts";

export type DokuNotificationFact = {
  providerReference: string;
  merchantInvoice: string;
  amountSen: number;
  channel: string;
  providerStatus: string;
  providerState: string;
  orderStatus?: string;
  eventKey: string;
};

export type DokuPaymentConfigIdentity = {
  id: number;
  environment: "sandbox" | "production";
  configRevision: number;
};

export type DokuLocalPaymentStatus =
  | "created"
  | "pending"
  | "paid"
  | "failed"
  | "expired"
  | "attention_required";

export type DokuPaymentEventSource = "notification" | "status" | "reconciliation";

export class DokuPaymentLifecycleError extends Error {
  readonly code:
    | "DOKU_ATTEMPT_NOT_FOUND"
    | "DOKU_PAYMENT_MISMATCH"
    | "DOKU_LOCAL_TRANSITION_FAILED";

  constructor(code: DokuPaymentLifecycleError["code"]) {
    super(code);
    this.name = "DokuPaymentLifecycleError";
    this.code = code;
  }
}

type AttemptState = {
  attempt_id: string;
  order_id: number;
  provider_config_id: number;
  environment: string;
  config_revision: number;
  provider_reference: string | null;
  channel: string | null;
  merchant_invoice: string;
  amount_sen: number;
  local_status: DokuLocalPaymentStatus;
  payment_method: string;
  payment_status: string;
  shipping_status: string;
  stock_restored_at: string | null;
};

const TERMINAL = new Set<DokuLocalPaymentStatus>(["paid", "failed", "expired"]);
const RELEASED_PAYMENT = new Set(["cancelled", "refunded", "failed"]);

export function mapDokuNotificationStatus(input: {
  providerStatus: string;
  providerState: string;
  orderStatus?: string;
}): DokuLocalPaymentStatus {
  const status = input.providerStatus;
  const state = input.providerState;
  const orderStatus = input.orderStatus;
  const successSignal = status === "SUCCESS" || state === "COMPLETED";
  const failedSignal = status === "FAILED" || state === "FAILED";
  const expiredSignal =
    status === "EXPIRED" ||
    state === "EXPIRED" ||
    orderStatus === "ORDER_EXPIRED";

  if (status === "SUCCESS" && state === "COMPLETED" && !expiredSignal) return "paid";
  if (successSignal && (failedSignal || expiredSignal)) return "attention_required";
  if (failedSignal) return "failed";
  if (expiredSignal) return "expired";
  if (
    status === "PENDING" &&
    ["INIT", "INITIATE", "PENDING", "PROCESSING"].includes(state) &&
    orderStatus !== "ORDER_EXPIRED"
  ) {
    return "pending";
  }
  return "attention_required";
}

async function loadAttempt(database: D1Database, merchantInvoice: string) {
  return database
    .prepare(`
      SELECT
        pa.id AS attempt_id, pa.order_id, pa.provider_config_id,
        pa.environment, pa.config_revision, pa.provider_reference, pa.channel,
        pa.merchant_invoice, pa.amount_sen, pa.local_status,
        o.payment_method, o.payment_status, o.shipping_status,
        o.stock_restored_at
      FROM payment_attempts pa
      JOIN orders o ON o.id = pa.order_id
      WHERE pa.provider = 'doku' AND pa.merchant_invoice = ?
      LIMIT 1
    `)
    .bind(merchantInvoice)
    .first<AttemptState>();
}

function orderAlreadyReleased(attempt: AttemptState) {
  return (
    Boolean(attempt.stock_restored_at) ||
    RELEASED_PAYMENT.has(attempt.payment_status) ||
    ["cancelled", "returned"].includes(attempt.shipping_status)
  );
}

function attemptUpdate(
  database: D1Database,
  attempt: AttemptState,
  notification: DokuNotificationFact,
  target: DokuLocalPaymentStatus,
  nowIso: string,
) {
  const terminal = TERMINAL.has(target);
  return database.prepare(`
    UPDATE payment_attempts SET
      channel = ?, provider_status = ?, provider_state = ?,
      local_status = ?, error_class = NULL,
      paid_at = CASE WHEN ? = 'paid' THEN COALESCE(paid_at, ?) ELSE paid_at END,
      terminal_at = CASE WHEN ? = 1 THEN COALESCE(terminal_at, ?) ELSE terminal_at END,
      updated_at = ?
    WHERE id = ?
      AND local_status NOT IN ('paid', 'failed', 'expired')
      AND (
        ? NOT IN ('paid', 'failed', 'expired')
        OR (? = 'paid' AND EXISTS (
          SELECT 1 FROM orders o
          WHERE o.id = payment_attempts.order_id
            AND o.stock_restored_at IS NULL
            AND o.payment_status NOT IN ('cancelled', 'refunded', 'failed')
            AND o.shipping_status NOT IN ('cancelled', 'returned')
        ))
        OR (? IN ('failed', 'expired') AND EXISTS (
          SELECT 1 FROM orders o
          WHERE o.id = payment_attempts.order_id
            AND o.payment_status NOT IN ('paid', 'settled', 'success')
        ))
      )
  `).bind(
    notification.channel,
    notification.providerStatus,
    notification.providerState,
    target,
    target,
    nowIso,
    terminal ? 1 : 0,
    nowIso,
    nowIso,
    attempt.attempt_id,
    target,
    target,
    target,
  );
}

export async function applyDokuPaymentFact(
  database: D1Database,
  config: DokuPaymentConfigIdentity,
  notification: DokuNotificationFact,
  source: DokuPaymentEventSource,
): Promise<{ attemptId: string; orderId: number; status: DokuLocalPaymentStatus }> {
  const attempt = await loadAttempt(database, notification.merchantInvoice);
  if (!attempt) throw new DokuPaymentLifecycleError("DOKU_ATTEMPT_NOT_FOUND");
  if (
    attempt.provider_config_id !== config.id ||
    attempt.environment !== config.environment ||
    attempt.config_revision !== config.configRevision ||
    attempt.provider_reference !== notification.providerReference ||
    attempt.merchant_invoice !== notification.merchantInvoice ||
    attempt.amount_sen !== notification.amountSen ||
    !DOKU_PAYMENT_CHANNELS.some((channel) => channel === attempt.channel) ||
    attempt.channel !== notification.channel ||
    attempt.payment_method !== "doku"
  ) {
    throw new DokuPaymentLifecycleError("DOKU_PAYMENT_MISMATCH");
  }

  let target = mapDokuNotificationStatus(notification);
  if (target === "paid" && orderAlreadyReleased(attempt)) {
    target = "attention_required";
  }
  if (target === "attention_required" && TERMINAL.has(attempt.local_status)) {
    target = attempt.local_status;
  }
  let metaPurchase = null;
  if (target === "paid") {
    try {
      metaPurchase = await prepareSettledDokuMetaPurchase(database, attempt.order_id);
    } catch {
      console.error("doku-paid-meta-prepare", {
        attemptId: attempt.attempt_id,
        orderId: attempt.order_id,
      });
    }
  }
  const nowIso = new Date().toISOString();
  const statements: D1PreparedStatement[] = [
    attemptUpdate(database, attempt, notification, target, nowIso),
  ];
  if (target === "paid") {
    statements.push(database.prepare(`
      UPDATE orders SET payment_status = 'paid'
      WHERE id = ?
        AND stock_restored_at IS NULL
        AND payment_status NOT IN ('cancelled', 'refunded', 'failed')
        AND shipping_status NOT IN ('cancelled', 'returned')
        AND EXISTS (
          SELECT 1 FROM payment_attempts
          WHERE id = ? AND local_status = 'paid'
        )
    `).bind(attempt.order_id, attempt.attempt_id));
    if (metaPurchase) {
      statements.push(database.prepare(`
        INSERT OR IGNORE INTO capi_event_outbox
          (event_name, event_id, payload_json, status, attempts, next_retry_at, created_at, updated_at)
        SELECT 'Purchase', ?, ?, 'pending', 0, ?, ?, ?
        FROM orders o
        WHERE o.id = ? AND o.payment_status IN ('paid', 'settled', 'success')
          AND EXISTS (
            SELECT 1 FROM payment_attempts pa
            WHERE pa.id = ? AND pa.local_status = 'paid'
          )
      `).bind(
        metaPurchase.eventId,
        JSON.stringify(metaPurchase.payload),
        nowIso,
        nowIso,
        nowIso,
        attempt.order_id,
        attempt.attempt_id,
      ));
    }
  }
  if (target === "failed" || target === "expired") {
    statements.push(
      database.prepare(`
        UPDATE orders SET payment_status = 'failed'
        WHERE id = ?
          AND payment_status NOT IN ('paid', 'settled', 'success')
          AND EXISTS (
            SELECT 1 FROM payment_attempts
            WHERE id = ? AND local_status IN ('failed', 'expired')
          )
      `).bind(attempt.order_id, attempt.attempt_id),
      ...buildStockRestorationStatements(database, [attempt.order_id], true),
    );
  }
  statements.push(database.prepare(`
    INSERT OR IGNORE INTO payment_events (
      payment_attempt_id, source, event_key, provider_status,
      provider_state, resulting_status, received_at
    )
    SELECT id, ?, ?, ?, ?, local_status, ?
    FROM payment_attempts WHERE id = ?
  `).bind(
    source,
    notification.eventKey,
    notification.providerStatus,
    notification.providerState,
    nowIso,
    attempt.attempt_id,
  ));

  try {
    await database.batch(statements);
  } catch {
    throw new DokuPaymentLifecycleError("DOKU_LOCAL_TRANSITION_FAILED");
  }
  const current = await loadAttempt(database, notification.merchantInvoice);
  if (!current) throw new DokuPaymentLifecycleError("DOKU_LOCAL_TRANSITION_FAILED");
  return {
    attemptId: current.attempt_id,
    orderId: current.order_id,
    status: current.local_status,
  };
}

export async function applyDokuNotification(
  database: D1Database,
  config: DokuPaymentConfigIdentity,
  notification: DokuNotificationFact,
): Promise<{ attemptId: string; orderId: number; status: DokuLocalPaymentStatus }> {
  return applyDokuPaymentFact(database, config, notification, "notification");
}
