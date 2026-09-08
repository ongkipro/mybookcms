/** Stable operator audit vocabulary. Values and request/provider bodies are never accepted. */
export const SYSTEM_EVENT_LABELS = {
  "store.profile.updated": "Profil toko diperbarui.",
  "store.cod.updated": "Ketersediaan COD diperbarui.",
  "store.embed.updated": "Origin embed diperbarui.",
  "store.headless.updated": "Origin headless diperbarui.",
  "store.crm.updated": "Template CRM diperbarui.",
  "store.template.added": "Template storefront ditambahkan.",
  "payment.config.saved": "Revisi konfigurasi pembayaran disimpan.",
  "payment.config.cleared": "Konfigurasi pembayaran dikosongkan.",
  "payment.config.enabled": "Konfigurasi pembayaran diaktifkan.",
  "payment.config.disabled": "Konfigurasi pembayaran dinonaktifkan.",
  "ads.meta.updated": "Konfigurasi Meta diperbarui.",
  "ads.google.updated": "Konfigurasi Google diperbarui.",
  "api_key.issued": "API key diterbitkan.",
  "api_key.updated": "Kebijakan API key diperbarui.",
  "api_key.revoked": "API key dicabut.",
  "operator.created": "Operator ditambahkan.",
  "operator.updated": "Akses operator diperbarui.",
  "operator.deleted": "Operator dihapus.",
  "operator.credentials.updated": "Kredensial operator diperbarui.",
  "login.lockout": "Batas percobaan login tercapai.",
  "scheduler.capi.failed": "Scheduler CAPI gagal.",
  "scheduler.doku.failed": "Scheduler rekonsiliasi pembayaran gagal.",
} as const;

export type SystemEventAction = keyof typeof SYSTEM_EVENT_LABELS;
export type AdminSystemEventAction = Exclude<SystemEventAction, "login.lockout" | `scheduler.${string}`>;
export const SYSTEM_EVENT_RETENTION_DAYS = 90;
const PRUNE_BATCH_SIZE = 1000;

function labelFor(action: SystemEventAction): string {
  if (!Object.hasOwn(SYSTEM_EVENT_LABELS, action)) throw new Error("Invalid system event action.");
  return SYSTEM_EVENT_LABELS[action];
}

/**
 * The event immediately follows the mutation in one D1 transaction. changes()
 * skips a rejected optimistic update/no-op; an audit failure rolls back both.
 * A missing targetId is allowed only for inserts, using that statement's row id.
 */
export async function commitSystemMutation(
  database: D1Database,
  mutation: D1PreparedStatement,
  event: { action: AdminSystemEventAction; actor: string; targetId?: number },
  now = new Date(),
): Promise<D1Result> {
  const label = labelFor(event.action);
  if (event.action.startsWith("login.") || event.action.startsWith("scheduler.")) {
    throw new Error("Invalid admin event action.");
  }
  if (typeof event.actor !== "string" || !/^[a-z0-9._-]{3,64}$/.test(event.actor)) throw new Error("Invalid system event actor.");
  if (event.targetId === undefined) {
    if (!["api_key.issued", "operator.created"].includes(event.action)) {
      throw new Error("System event target is required.");
    }
  } else if (!Number.isSafeInteger(event.targetId) || event.targetId <= 0) {
    throw new Error("Invalid system event target.");
  }
  const target = event.action.split(".")[0];
  const audit = database.prepare(`
    INSERT INTO system_events (actor, source, action, label, severity, correlation, detail, occurred_at)
    SELECT ?, 'admin', ?, ?, 'info', ? || ':' || CAST(COALESCE(?, last_insert_rowid()) AS INTEGER), '{}', ?
    WHERE changes() > 0
  `).bind(event.actor, event.action, label, target, event.targetId ?? null, now.toISOString());
  const [result] = await database.batch([mutation, audit]);
  return result;
}

/** The unauthenticated requester is not an operator identity. Never accept its submitted username. */
export async function recordLoginLockout(database: D1Database | undefined, now = new Date()): Promise<void> {
  if (!database) return;
  try {
    await database.prepare(`
      INSERT INTO system_events (actor, source, action, label, severity, correlation, detail, occurred_at)
      VALUES ('anonymous', 'auth', 'login.lockout', ?, 'warning', 'login', '{}', ?)
    `).bind(SYSTEM_EVENT_LABELS["login.lockout"], now.toISOString()).run();
  } catch {
    console.error("system-event-write-failed", { source: "auth" });
  }
}

/** A diagnostic sink failure never propagates into scheduled work. */
export async function runScheduledSystemJob(
  database: D1Database | undefined,
  job: "capi" | "doku",
  run: () => Promise<unknown>,
): Promise<void> {
  try {
    await run();
  } catch {
    console.error(job === "capi" ? "capi-outbox-scheduled" : "doku-reconciliation-scheduled", {
      outcome: "scheduler_failed", error_class: "local_transition",
    });
    if (!database) return;
    const action = job === "capi" ? "scheduler.capi.failed" : "scheduler.doku.failed";
    try {
      await database.prepare(`
        INSERT INTO system_events (actor, source, action, label, severity, correlation, detail, occurred_at)
        VALUES ('system', 'scheduler', ?, ?, 'error', ?, '{}', ?)
      `).bind(action, SYSTEM_EVENT_LABELS[action], `scheduler:${job}`, new Date().toISOString()).run();
    } catch {
      console.error("system-event-write-failed", { source: "scheduler" });
    }
  }
}

/** Bound each scheduled prune; remaining expired rows are picked up next minute. */
export async function pruneSystemEvents(database: D1Database, now = new Date()): Promise<void> {
  const cutoff = new Date(now.getTime() - SYSTEM_EVENT_RETENTION_DAYS * 86_400_000).toISOString();
  await database.prepare(`
    DELETE FROM system_events WHERE id IN (
      SELECT id FROM system_events WHERE occurred_at < ? ORDER BY occurred_at, id LIMIT ?
    )
  `).bind(cutoff, PRUNE_BATCH_SIZE).run();
}
