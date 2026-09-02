import type { AdminRole } from "./auth.ts";
import { getDokuConfigStatus } from "./doku-config.ts";

const SAFE_ORDER_FIELDS = [
  "id", "store_id", "order_number", "customer_name", "customer_phone",
  "customer_email", "address", "province", "city", "district", "postal_code",
  "total_amount", "shipping_cost", "payment_method", "payment_status",
  "shipping_status", "stock_restored_at", "seller_bank_account_id",
  "seller_bank_code", "seller_bank_name", "seller_account_holder",
  "seller_account_number", "shipping_zone_code", "shipping_rate_rule_id",
  "shipping_amount_sen", "shipping_queued_at", "created_at", "location_id",
  "shipping_zone", "quoted_shipping_amount",
] as const;

const TERMINAL = new Set(["paid", "failed", "expired"]);
const SAFE_STATE = /^[A-Z][A-Z0-9_]{1,63}$/;
const SAFE_ERROR_CLASSES = new Set([
  "configuration", "authentication", "signature", "timeout", "provider", "local_transition",
]);

type AttemptRow = {
  id: string;
  environment: string;
  config_revision: number;
  provider_reference: string | null;
  amount_sen: number;
  channel: string | null;
  provider_status: string | null;
  provider_state: string | null;
  local_status: string;
  error_class: string | null;
  reconcile_attempts: number;
  expires_at: string | null;
  initiated_at: string | null;
  paid_at: string | null;
  terminal_at: string | null;
  stock_released_at: string | null;
  created_at: string;
  updated_at: string;
  lease_until: string | null;
  next_reconcile_at: string | null;
  provider_config_id: number;
};

type EventRow = {
  id: number;
  payment_attempt_id: string;
  source: string;
  provider_status: string | null;
  provider_state: string | null;
  resulting_status: string;
  received_at: string;
};

export type RedactedPaymentEvent = {
  id: number;
  source: "checkout" | "return" | "notification" | "status" | "reconciliation" | "retry";
  provider_status: string | null;
  provider_state: string | null;
  resulting_status: string;
  received_at: string;
};

export type RedactedPaymentAttempt = {
  correlation_id: string;
  environment: "sandbox" | "production";
  config_revision: number;
  provider_reference_masked: string | null;
  amount_sen: number;
  channel: string | null;
  provider_status: string | null;
  provider_state: string | null;
  local_status: string;
  error_class: string | null;
  reconcile_attempts: number;
  created_at: string;
  initiated_at: string | null;
  expires_at: string | null;
  updated_at: string;
  paid_at: string | null;
  terminal_at: string | null;
  stock_released_at: string | null;
  last_automatic_check_at: string | null;
  last_manual_check_at: string | null;
  next_reconcile_at: string | null;
  automatic_check_running_until: string | null;
  events: RedactedPaymentEvent[];
};

export type PaymentOperations = {
  provider: "DOKU";
  config_health: "ready" | "disabled" | "changed" | "problem";
  environment: "sandbox" | "production" | null;
  can_view_payment_operations: boolean;
  reconcile_action_visible: boolean;
  can_reconcile: boolean;
  reconcile_block_reason: string | null;
  attempts: RedactedPaymentAttempt[];
};

function safeProviderValue(value: string | null) {
  return value && SAFE_STATE.test(value) ? value : null;
}

function maskReference(value: string | null) {
  if (!value) return null;
  const suffix = value.slice(-8);
  return `••••${suffix}`;
}

function isEventSource(value: string): value is RedactedPaymentEvent["source"] {
  return ["checkout", "return", "notification", "status", "reconciliation", "retry"].includes(value);
}

export function sanitizeAdminOrder(order: Record<string, unknown>) {
  const safe: Record<string, unknown> = {};
  for (const field of SAFE_ORDER_FIELDS) {
    if (field in order) safe[field] = order[field];
  }
  return safe;
}

function configHealth(
  config: { id: number; environment: string; config_revision: number; is_enabled: number } | null,
  inspected: Awaited<ReturnType<typeof getDokuConfigStatus>>,
  latest: AttemptRow | undefined,
): PaymentOperations["config_health"] {
  if (!config || inspected.health !== "ready") return "problem";
  if (!config.is_enabled || !inspected.enabled) return "disabled";
  if (
    latest &&
    (latest.provider_config_id !== config.id || latest.environment !== config.environment || latest.config_revision !== config.config_revision)
  ) return "changed";
  return "ready";
}

export async function loadPaymentOperations(
  database: D1Database,
  orderId: number,
  role: AdminRole,
  rootSecret: string,
): Promise<PaymentOperations | null> {
  const order = await database.prepare("SELECT payment_method, shipping_status FROM orders WHERE id = ? LIMIT 1")
    .bind(orderId).first<{ payment_method: string; shipping_status: string }>();
  if (!order || order.payment_method !== "doku") return null;
  const [attemptResult, eventResult, config, inspectedConfig] = await Promise.all([
    database.prepare(`
      SELECT id, environment, config_revision, provider_reference, amount_sen,
        channel, provider_status, provider_state, local_status, error_class,
        reconcile_attempts, expires_at, initiated_at, paid_at, terminal_at,
        stock_released_at, created_at, updated_at, lease_until,
        next_reconcile_at, provider_config_id
      FROM payment_attempts
      WHERE order_id = ? AND provider = 'doku'
      ORDER BY created_at DESC, id DESC LIMIT 20
    `).bind(orderId).all<AttemptRow>(),
    database.prepare(`
      SELECT pe.id, pe.payment_attempt_id, pe.source, pe.provider_status,
        pe.provider_state, pe.resulting_status, pe.received_at
      FROM payment_events pe
      JOIN payment_attempts pa ON pa.id = pe.payment_attempt_id
      WHERE pa.order_id = ? AND pa.provider = 'doku'
      ORDER BY pe.received_at, pe.id
      LIMIT 200
    `).bind(orderId).all<EventRow>(),
    database.prepare(`
      SELECT id, environment, config_revision, is_enabled
      FROM payment_provider_configs WHERE provider = 'doku' ORDER BY id LIMIT 1
    `).first<{ id: number; environment: string; config_revision: number; is_enabled: number }>(),
    getDokuConfigStatus(database, rootSecret),
  ]);
  const rows = attemptResult.results || [];
  const eventRows = eventResult.results || [];
  const eventsByAttempt = new Map<string, RedactedPaymentEvent[]>();
  for (const event of eventRows) {
    if (!isEventSource(event.source)) continue;
    const safeEvent: RedactedPaymentEvent = {
      id: Number(event.id),
      source: event.source,
      provider_status: safeProviderValue(event.provider_status),
      provider_state: safeProviderValue(event.provider_state),
      resulting_status: String(event.resulting_status),
      received_at: String(event.received_at),
    };
    const existing = eventsByAttempt.get(event.payment_attempt_id) || [];
    existing.push(safeEvent);
    eventsByAttempt.set(event.payment_attempt_id, existing);
  }
  const now = Date.now();
  const attempts = rows.map<RedactedPaymentAttempt>((attempt) => {
    const events = eventsByAttempt.get(attempt.id) || [];
    const lastAutomatic = [...events].reverse().find((event) => event.source === "reconciliation")?.received_at || null;
    const lastManual = [...events].reverse().find((event) => event.source === "status")?.received_at || null;
    const leaseUntil = attempt.lease_until && Date.parse(attempt.lease_until) > now ? attempt.lease_until : null;
    return {
      correlation_id: attempt.id,
      environment: attempt.environment === "production" ? "production" : "sandbox",
      config_revision: Number(attempt.config_revision),
      provider_reference_masked: maskReference(attempt.provider_reference),
      amount_sen: Number(attempt.amount_sen),
      channel: safeProviderValue(attempt.channel),
      provider_status: safeProviderValue(attempt.provider_status),
      provider_state: safeProviderValue(attempt.provider_state),
      local_status: String(attempt.local_status),
      error_class: attempt.error_class && SAFE_ERROR_CLASSES.has(attempt.error_class) ? attempt.error_class : null,
      reconcile_attempts: Number(attempt.reconcile_attempts),
      created_at: String(attempt.created_at),
      initiated_at: attempt.initiated_at,
      expires_at: attempt.expires_at,
      updated_at: String(attempt.updated_at),
      paid_at: attempt.paid_at,
      terminal_at: attempt.terminal_at,
      stock_released_at: attempt.stock_released_at,
      last_automatic_check_at: lastAutomatic,
      last_manual_check_at: lastManual,
      next_reconcile_at: attempt.next_reconcile_at,
      automatic_check_running_until: leaseUntil,
      events,
    };
  });
  const latest = rows[0];
  const health = configHealth(config || null, inspectedConfig, latest);
  const privileged = role === "owner" || role === "admin";
  const active = latest && !TERMINAL.has(latest.local_status) && Boolean(latest.provider_reference);
  const leased = Boolean(latest?.lease_until && Date.parse(latest.lease_until) > now);
  const coolingDown = Boolean(latest?.next_reconcile_at && Date.parse(latest.next_reconcile_at) > now);
  const forbiddenOrderState = ["cancelled", "returned"].includes(order.shipping_status);
  let blockReason: string | null = null;
  if (!privileged) blockReason = "Pemeriksaan ke DOKU hanya dapat dijalankan Owner atau Admin.";
  else if (!latest || TERMINAL.has(latest.local_status)) blockReason = "Status terminal tidak perlu diperiksa lagi.";
  else if (!latest.provider_reference) blockReason = "Referensi DOKU belum tersedia.";
  else if (health !== "ready") blockReason = "Konfigurasi DOKU tidak siap atau tidak sesuai percobaan ini.";
  else if (leased) blockReason = "Status sedang diperiksa oleh proses lain.";
  else if (coolingDown) blockReason = `Pemeriksaan berikutnya dijadwalkan ${latest?.next_reconcile_at}.`;
  else if (forbiddenOrderState) blockReason = "Lifecycle order tidak mengizinkan pemeriksaan pembayaran.";
  return {
    provider: "DOKU",
    config_health: health,
    environment: latest?.environment === "production" ? "production" : latest ? "sandbox" : null,
    can_view_payment_operations: true,
    reconcile_action_visible: Boolean(privileged && active),
    can_reconcile: Boolean(privileged && active && health === "ready" && !leased && !coolingDown && !forbiddenOrderState),
    reconcile_block_reason: blockReason,
    attempts,
  };
}
