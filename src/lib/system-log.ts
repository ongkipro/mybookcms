import { SYSTEM_EVENT_LABELS, type SystemEventAction } from "./system-events.ts";
import { getSchemaVersionStatus } from "./schema-version.ts";

/**
 * One read-only operator view over the system events the runtime already
 * persists.
 *
 * The operator can see an order and a payment attempt, but nothing tells them
 * what the install *did* between two orders: whether the scheduled CAPI drain
 * is delivering, whether a payment reconciliation is looping, whether a headless
 * key is being rate-limited, whether the schema is behind. Those facts are all
 * in D1 already; they were simply never surfaced. This merges them.
 *
 * Two rules shape every projection below.
 *
 * It adds no table and writes nothing. Anything that exists only as a Worker
 * log — a `console.error` label — is out of reach here on purpose, because
 * inventing a store for it is a different, larger change (A-226).
 *
 * And it builds every label from structured columns, never from stored prose.
 * `notifications.body` carries the customer's name by design, so this never
 * selects it; the label is composed from `type` and `order_number` instead.
 * The same reasoning excludes `capi_event_outbox.payload_json` (hashed customer
 * identity), `payment_attempts.checkout_url` (a provider session address),
 * `idempotency_key`, `request_fingerprint`, and `provider_reference`. A future
 * source must clear the same bar: if a column can carry a person, a secret, or
 * a provider body, it does not appear here.
 */

export type SystemLogSource = "schema" | "ads" | "payment" | "order" | "api" | "audit";
export type SystemLogSeverity = "info" | "warning" | "error";

export type SystemLogEntry = {
  /** Validated audit principal; absent for legacy diagnostic sources. */
  actor?: string;
  source: SystemLogSource;
  severity: SystemLogSeverity;
  /** Indonesian operator copy, composed here from structured columns only. */
  label: string;
  /** ISO-8601. */
  occurred_at: string;
  /**
   * A value the operator can carry to another surface — an order number, a
   * canonical advertising event id, a payment attempt id, an API key id. Never
   * a token, a URL, a fingerprint, or a customer field.
   */
  correlation: string;
  /** The admin surface that owns this event, or null when none does. */
  href: string | null;
};

/** Newest-first, and never more than this many. */
export const SYSTEM_LOG_MAX_ENTRIES = 200;
/** Nothing older than this is listed, whatever its source retains. */
export const SYSTEM_LOG_WINDOW_DAYS = 30;

/** Schema, ads, payment, order, api, audit. */
const SOURCE_COUNT = 6;

/**
 * Per-source ceiling, sized so the final slice can never drop anything.
 *
 * It first equalled the total, which meant a burst of API-audit rows filled the
 * response and pushed every schema, payment, order and advertising entry out —
 * the exact crowding the comment claimed to prevent. Over-correcting to an
 * eighth was worse in a quieter way: the response could not exceed 101 of its
 * 200 entries, and an operator chasing a reconciliation loop saw 25 payment
 * events instead of a month of them.
 *
 * Dividing by the source count is the honest bound. `SOURCE_COUNT * this` is
 * bounded by the total, so every source keeps its full share and no source
 * can take another's. Integer division may leave fewer than six slots unused.
 */
const PER_SOURCE_LIMIT = Math.floor(SYSTEM_LOG_MAX_ENTRIES / SOURCE_COUNT);

function windowStart(now: Date): string {
  return new Date(now.getTime() - SYSTEM_LOG_WINDOW_DAYS * 24 * 60 * 60_000).toISOString();
}

/**
 * D1 timestamps in this schema are ISO strings, except `payment_events`, whose
 * `received_at` defaults to SQLite `CURRENT_TIMESTAMP` — `YYYY-MM-DD HH:MM:SS`
 * in UTC with no zone marker. Sorting those two shapes as raw text puts the
 * space-separated form in the wrong place, so everything is normalized once.
 */
function toIso(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const raw = value.trim();
  const candidate = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)
    ? `${raw.replace(" ", "T")}Z`
    : raw;
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** Bounds a value that reaches the browser, and strips anything but safe text. */
function safeToken(value: unknown, max = 80): string {
  if (typeof value !== "string") return "";
  return value.replace(/[^\w:@.\-]/g, "").slice(0, max);
}

/**
 * One source failing must not take the panel down. A store on an older schema
 * legitimately lacks a table here, and an operator investigating an incident is
 * exactly the person who cannot afford a blank page.
 */
async function collect(
  label: string,
  read: () => Promise<SystemLogEntry[]>,
): Promise<SystemLogEntry[]> {
  try {
    // Capped here as well as in SQL. The `LIMIT` is the efficient bound; this is
    // the one that actually holds the property, because it does not depend on
    // the source honouring it. Without it a single noisy source can still fill
    // the merged result and push every other source out of the final slice.
    return (await read()).slice(0, PER_SOURCE_LIMIT);
  } catch (error) {
    console.error("system-log-source-failed", {
      source: label,
      error_class: error instanceof Error ? error.name : "unknown",
    });
    return [];
  }
}

async function readSchema(locals: App.Locals, now: Date): Promise<SystemLogEntry[]> {
  const status = await getSchemaVersionStatus(locals);
  // `match` is the only healthy state; every other one means the running code
  // and the database disagree about the schema, which the operator must see.
  const ok = status.state === "match";
  return [
    {
      source: "schema",
      severity: ok ? "info" : "error",
      label: ok
        ? `Skema database sepadan pada versi ${status.applied ?? status.expected}.`
        : `Skema database tidak sepadan (${status.state}${status.errorCode ? `, ${status.errorCode}` : ""}). Diharapkan versi ${status.expected}, terpasang ${status.applied ?? "tidak diketahui"}.`,
      occurred_at: now.toISOString(),
      correlation: `schema:${status.expected}`,
      href: null,
    },
  ];
}

const CAPI_SEVERITY: Record<string, SystemLogSeverity> = {
  delivered: "info",
  pending: "info",
  failed: "error",
};

async function readAds(database: D1Database, since: string): Promise<SystemLogEntry[]> {
  const rows = await database
    .prepare(
      `SELECT event_name, event_id, status, attempts, updated_at
         FROM capi_event_outbox
        WHERE updated_at >= ?
        ORDER BY updated_at DESC, id DESC
        LIMIT ?`,
    )
    .bind(since, PER_SOURCE_LIMIT)
    .all<{
      event_name: string;
      event_id: string;
      status: string;
      attempts: number;
      updated_at: string;
    }>();

  const entries: SystemLogEntry[] = [];
  for (const row of rows.results ?? []) {
    const occurred = toIso(row.updated_at);
    if (!occurred) continue;
    const status = safeToken(row.status, 20);
    const retries =
      row.attempts > 1 ? ` setelah ${row.attempts} percubaan` : "";
    entries.push({
      source: "ads",
      severity: CAPI_SEVERITY[status] ?? "warning",
      label: `Meta CAPI ${safeToken(row.event_name, 40)}: ${status}${retries}.`,
      occurred_at: occurred,
      correlation: safeToken(row.event_id, 64),
      href: "/admin/ads/meta",
    });
  }
  return entries;
}

const PAYMENT_SEVERITY: Record<string, SystemLogSeverity> = {
  created: "info",
  pending: "info",
  paid: "info",
  failed: "warning",
  expired: "warning",
  attention_required: "error",
};

async function readPayments(database: D1Database, since: string): Promise<SystemLogEntry[]> {
  // `checkout_url`, `idempotency_key`, `request_fingerprint` and
  // `provider_reference` are deliberately absent from this projection.
  //
  // `received_at` can hold two shapes. Every application write path binds an ISO
  // string, so in practice that is what is there; the column default is SQLite's
  // `CURRENT_TIMESTAMP`, `YYYY-MM-DD HH:MM:SS`, which a manual D1 write would
  // produce. A space sorts before `T`, so an ISO bound would silently drop such
  // a row. Bind the lexically-earlier shape, which can only be over-inclusive,
  // and let the exact cutoff in `loadSystemLog` settle it. The ordering below
  // adds `id` for the same reason: text order across the two spellings is not
  // chronological, and `id` is.
  const permissiveSince = since.replace("T", " ").slice(0, 19);
  const rows = await database
    .prepare(
      `SELECT e.source          AS event_source,
              e.resulting_status AS resulting_status,
              e.received_at      AS received_at,
              e.payment_attempt_id AS attempt_id,
              a.error_class      AS error_class,
              o.order_number     AS order_number
         FROM payment_events e
         JOIN payment_attempts a ON a.id = e.payment_attempt_id
         JOIN orders o           ON o.id = a.order_id
        WHERE e.received_at >= ?
        ORDER BY e.received_at DESC, e.id DESC
        LIMIT ?`,
    )
    .bind(permissiveSince, PER_SOURCE_LIMIT)
    .all<{
      event_source: string;
      resulting_status: string;
      received_at: string;
      attempt_id: string;
      error_class: string | null;
      order_number: string;
    }>();

  const entries: SystemLogEntry[] = [];
  for (const row of rows.results ?? []) {
    const occurred = toIso(row.received_at);
    if (!occurred) continue;
    const status = safeToken(row.resulting_status, 24);
    const reason = row.error_class ? ` (${safeToken(row.error_class, 24)})` : "";
    entries.push({
      source: "payment",
      severity: PAYMENT_SEVERITY[status] ?? "warning",
      label: `DOKU — ${safeToken(row.event_source, 20)} menghasilkan status ${status}${reason}.`,
      occurred_at: occurred,
      correlation: safeToken(row.attempt_id, 64),
      href: `/admin/orders/${encodeURIComponent(row.order_number)}`,
    });
  }
  return entries;
}

async function readOrders(database: D1Database, since: string): Promise<SystemLogEntry[]> {
  // `title` and `body` are never selected: `body` carries the customer's name.
  const rows = await database
    .prepare(
      `SELECT type, order_number, created_at
         FROM notifications
        WHERE created_at >= ?
        ORDER BY created_at DESC, id DESC
        LIMIT ?`,
    )
    .bind(since, PER_SOURCE_LIMIT)
    .all<{ type: string; order_number: string; created_at: string }>();

  const kinds: Record<string, string> = {
    order: "Pesanan baru masuk",
    lead: "Lead baru masuk",
    payment: "Pembayaran diperbarui",
  };

  const entries: SystemLogEntry[] = [];
  for (const row of rows.results ?? []) {
    const occurred = toIso(row.created_at);
    if (!occurred) continue;
    const kind = kinds[row.type] ?? "Notifikasi operator";
    entries.push({
      source: "order",
      severity: "info",
      label: `${kind}.`,
      occurred_at: occurred,
      correlation: safeToken(row.order_number, 40),
      href: `/admin/orders/${encodeURIComponent(row.order_number)}`,
    });
  }
  return entries;
}

const API_SEVERITY: Record<string, SystemLogSeverity> = {
  allowed: "info",
  scope_denied: "warning",
  rate_limited: "warning",
  quota_exhausted: "warning",
  origin_denied: "warning",
};

async function readApi(database: D1Database, since: string): Promise<SystemLogEntry[]> {
  const rows = await database
    .prepare(
      `SELECT api_key_id, operation, outcome, status_code, created_at
         FROM headless_api_audit_events
        WHERE created_at >= ?
        ORDER BY created_at DESC, id DESC
        LIMIT ?`,
    )
    .bind(since, PER_SOURCE_LIMIT)
    .all<{
      api_key_id: number;
      operation: string;
      outcome: string;
      status_code: number;
      created_at: string;
    }>();

  const entries: SystemLogEntry[] = [];
  for (const row of rows.results ?? []) {
    const occurred = toIso(row.created_at);
    if (!occurred) continue;
    const outcome = safeToken(row.outcome, 24);
    entries.push({
      source: "api",
      severity: API_SEVERITY[outcome] ?? "warning",
      label: `Headless API ${safeToken(row.operation, 40)}: ${outcome} (HTTP ${Number(row.status_code) || 0}).`,
      occurred_at: occurred,
      correlation: `key#${Number(row.api_key_id) || 0}`,
      href: "/admin/settings/developer",
    });
  }
  return entries;
}

const AUDIT_HREF: Record<string, string> = {
  store: "/admin/settings", payment: "/admin/payments",
  ads: "/admin/ads/meta", api_key: "/admin/settings/developer",
  operator: "/admin/settings/access",
};

async function readAudit(database: D1Database, since: string, role?: string): Promise<SystemLogEntry[]> {
  const rows = await database.prepare(`
    SELECT actor, source, action, correlation, occurred_at FROM system_events
    WHERE occurred_at >= ? ORDER BY occurred_at DESC, id DESC LIMIT ?
  `).bind(since, PER_SOURCE_LIMIT).all<{
    actor: string; source: string; action: string; correlation: string; occurred_at: string;
  }>();
  return (rows.results ?? []).flatMap((row): SystemLogEntry[] => {
    if (!Object.hasOwn(SYSTEM_EVENT_LABELS, row.action)) return [];
    const action = row.action as SystemEventAction;
    const scheduled = action.startsWith("scheduler.");
    const login = action === "login.lockout";
    const source = scheduled ? "scheduler" : login ? "auth" : "admin";
    const prefix = action.split(".")[0];
    const expectedCorrelation = scheduled ? `scheduler:${action.split(".")[1]}` : login ? "login" : null;
    const validCorrelation = expectedCorrelation ? row.correlation === expectedCorrelation
      : typeof row.correlation === "string" && row.correlation.startsWith(`${prefix}:`) && /^[a-z_]+:[1-9][0-9]*$/.test(row.correlation);
    const occurred = toIso(row.occurred_at);
    if (!occurred || row.source !== source || !validCorrelation || typeof row.actor !== "string"
      || !/^[a-z0-9._-]{3,64}$/.test(row.actor)
      || (scheduled && row.actor !== "system") || (login && row.actor !== "anonymous")) return [];
    return [{
      source: "audit", actor: row.actor, label: SYSTEM_EVENT_LABELS[action],
      severity: scheduled ? "error" : login ? "warning" : "info",
      correlation: row.correlation, occurred_at: occurred,
      href: prefix === "operator" && role !== "owner" ? null : action === "ads.google.updated" ? "/admin/ads/google" : AUDIT_HREF[prefix] ?? null,
    }];
  });
}

/**
 * Merge every source, newest first, bounded by age and count.
 *
 * `now` is injectable so a test can pin the window instead of racing the clock.
 */
export async function loadSystemLog(
  locals: App.Locals,
  database: D1Database | null,
  now: Date = new Date(),
): Promise<SystemLogEntry[]> {
  const since = windowStart(now);
  const groups = await Promise.all([
    collect("schema", () => readSchema(locals, now)),
    ...(database
      ? [
          collect("ads", () => readAds(database, since)),
          collect("payment", () => readPayments(database, since)),
          collect("order", () => readOrders(database, since)),
          collect("api", () => readApi(database, since)),
          collect("audit", () => readAudit(database, since, locals.admin?.role)),
        ]
      : []),
  ]);

  const cutoff = new Date(since).getTime();
  return groups
    .flat()
    .filter((entry) => new Date(entry.occurred_at).getTime() >= cutoff)
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
    .slice(0, SYSTEM_LOG_MAX_ENTRIES);
}
