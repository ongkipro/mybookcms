import { getStoreAdsConfigFromEnv } from "./ads-config.ts";
import { sendPreparedMetaCapi, type PreparedMetaPayload } from "./meta-capi.ts";

type OutboxRow = {
  event_name: string;
  event_id: string;
  payload_json: string;
  attempts: number;
};

const DELIVERY_LEASE_MS = 5 * 60_000;
const DELIVERED_RETENTION_MS = 7 * 24 * 60 * 60_000;
const FAILED_RETENTION_MS = 30 * 24 * 60 * 60_000;

export async function enqueueCapiEvent(
  database: D1Database,
  eventName: string,
  eventId: string,
  payload: PreparedMetaPayload,
) {
  const result = await database.prepare(`
    INSERT OR IGNORE INTO capi_event_outbox
      (event_name, event_id, payload_json, status, attempts, next_retry_at, created_at, updated_at)
    VALUES (?, ?, ?, 'pending', 0, ?, ?, ?)
  `).bind(eventName, eventId, JSON.stringify(payload), new Date().toISOString(), new Date().toISOString(), new Date().toISOString()).run();
  return Boolean(result.meta?.changes);
}

export async function deliverCapiEvent(
  database: D1Database,
  eventName: string,
  eventId: string,
  pixelId: string,
  accessToken: string,
) {
  const now = new Date();
  const nowIso = now.toISOString();
  const leaseUntil = new Date(now.getTime() + DELIVERY_LEASE_MS).toISOString();
  const row = await database.prepare(`
    UPDATE capi_event_outbox
    SET next_retry_at = ?, updated_at = ?
    WHERE event_name = ? AND event_id = ? AND status = 'pending'
      AND (next_retry_at IS NULL OR next_retry_at <= ?)
    RETURNING event_name, event_id, payload_json, attempts
  `).bind(leaseUntil, nowIso, eventName, eventId, nowIso).first<OutboxRow>();
  if (!row) return true;
  let payload: PreparedMetaPayload;
  try {
    payload = JSON.parse(row.payload_json) as PreparedMetaPayload;
  } catch {
    await database.prepare(`
      UPDATE capi_event_outbox SET status = 'failed', last_error = ?, updated_at = ?
      WHERE event_name = ? AND event_id = ?
    `).bind("Payload outbox tidak valid.", new Date().toISOString(), eventName, eventId).run();
    return false;
  }
  const result = await sendPreparedMetaCapi(payload, pixelId, accessToken);
  if (result.success) {
    await database.prepare(`
      UPDATE capi_event_outbox
      SET status = 'delivered', attempts = attempts + 1, delivered_at = ?,
        last_error = NULL, next_retry_at = NULL, updated_at = ?
      WHERE event_name = ? AND event_id = ?
    `).bind(now.toISOString(), now.toISOString(), eventName, eventId).run();
    return true;
  }
  const attempts = Number(row.attempts || 0) + 1;
  const terminal = !result.retryable || attempts >= 8;
  const delayMinutes = Math.min(360, 2 ** attempts);
  await database.prepare(`
    UPDATE capi_event_outbox
    SET status = ?, attempts = ?, next_retry_at = ?, last_error = ?, updated_at = ?
    WHERE event_name = ? AND event_id = ?
  `).bind(
    terminal ? "failed" : "pending",
    attempts,
    terminal ? null : new Date(now.getTime() + delayMinutes * 60_000).toISOString(),
    String(result.reason || "Meta CAPI delivery failed.").slice(0, 500),
    now.toISOString(),
    eventName,
    eventId,
  ).run();
  return false;
}

export async function pruneCapiOutbox(database: D1Database, now = new Date()) {
  const deliveredBefore = new Date(now.getTime() - DELIVERED_RETENTION_MS).toISOString();
  const failedBefore = new Date(now.getTime() - FAILED_RETENTION_MS).toISOString();
  await database.prepare(`
    DELETE FROM capi_event_outbox
    WHERE id IN (
      SELECT id FROM capi_event_outbox
      WHERE (status = 'delivered' AND delivered_at < ?)
        OR (status = 'failed' AND updated_at < ?)
      ORDER BY id
      LIMIT 25
    )
  `).bind(deliveredBefore, failedBefore).run();
}

export async function drainCapiOutbox(
  database: D1Database,
  pixelId: string,
  accessToken: string,
) {
  const due = await database.prepare(`
    SELECT event_name, event_id FROM capi_event_outbox
    WHERE status = 'pending' AND (next_retry_at IS NULL OR next_retry_at <= ?)
    ORDER BY id LIMIT 5
  `).bind(new Date().toISOString()).all<{ event_name: string; event_id: string }>();
  for (const row of due.results || []) {
    await deliverCapiEvent(database, row.event_name, row.event_id, pixelId, accessToken);
  }
  await pruneCapiOutbox(database);
}

export async function drainConfiguredCapiOutbox(env: Env) {
  const database = env.OMS_DB;
  if (!database?.prepare) return;
  const config = await getStoreAdsConfigFromEnv(env);
  if (!config.metaPixelId || !config.metaCapiToken) return;
  await drainCapiOutbox(database, config.metaPixelId, config.metaCapiToken);
}
