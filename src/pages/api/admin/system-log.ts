import type { APIRoute } from "astro";
import { jsonError, jsonOk } from "../../../lib/api.ts";
import { getRuntimeEnv } from "../../../lib/env.ts";
import {
  loadSystemLog,
  SYSTEM_LOG_MAX_ENTRIES,
  SYSTEM_LOG_WINDOW_DAYS,
} from "../../../lib/system-log.ts";

export const prerender = false;

/**
 * Read-only. There is no POST, PUT, PATCH or DELETE here on purpose: the panel
 * this feeds shows what the system already recorded, and an operator must not
 * be able to edit or clear that record from the browser.
 *
 * The middleware has already proved the session and that the role may reach
 * `/api/admin/system-log` at all — `auth.ts` grants it to owner and admin only,
 * so advertiser and customer service receive `403` before this file runs. The
 * check below is the narrower belt-and-braces one, kept because this endpoint
 * aggregates payment and API-audit rows and a silent grant widening elsewhere
 * should not quietly open it.
 */
export const GET: APIRoute = async ({ locals }) => {
  const role = locals.admin?.role;
  if (role !== "owner" && role !== "admin") {
    return jsonError("Permission denied.", 403);
  }

  const runtime = getRuntimeEnv(locals);
  const candidate = runtime?.OMS_DB;
  const database =
    candidate &&
    typeof candidate === "object" &&
    typeof (candidate as D1Database).prepare === "function"
      ? (candidate as D1Database)
      : null;

  try {
    const entries = await loadSystemLog(locals, database);
    // `json` already sets `cache-control: no-store` on every response, which is
    // what this endpoint needs; passing it again here would only drift.
    return jsonOk({
      entries,
      meta: {
        window_days: SYSTEM_LOG_WINDOW_DAYS,
        max_entries: SYSTEM_LOG_MAX_ENTRIES,
        truncated: entries.length >= SYSTEM_LOG_MAX_ENTRIES,
        // Says so plainly, because an operator reading an empty panel needs to
        // know the difference between "nothing happened" and "no database".
        database_available: database !== null,
      },
    });
  } catch (error) {
    console.error("system-log-read-failed", {
      error_class: error instanceof Error ? error.name : "unknown",
    });
    return jsonError("Gagal memuat log sistem.", 500);
  }
};
