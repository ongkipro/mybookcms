import type { APIRoute } from "astro";
import { z } from "zod";
import {
  DOKU_PAYMENT_CHANNELS,
  DokuConfigError,
  clearDokuConfigDraft,
  getDokuConfigStatus,
  replaceDokuConfigDraft,
  setDokuConfigEnabled,
} from "../../../lib/doku-config.ts";
import { getEnvValue, getRuntimeEnv } from "../../../lib/env.ts";

export const prerender = false;

const saveSchema = z.object({
  environment: z.enum(["sandbox", "production"]),
  client_id: z.string().trim().min(1).max(255),
  api_key: z.string().trim().min(8).max(512),
  secret_key: z.string().trim().min(8).max(512),
  enabled_channels: z.array(z.enum(DOKU_PAYMENT_CHANNELS)).min(1).max(DOKU_PAYMENT_CHANNELS.length),
  expected_revision: z.number().int().positive().nullable(),
}).strict();

const stateSchema = z.object({
  action: z.enum(["enable", "disable"]),
  expected_revision: z.number().int().positive(),
}).strict();

const deleteSchema = z.object({
  expected_revision: z.number().int().positive(),
}).strict();

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

function authorized(locals: App.Locals) {
  return locals.admin?.role === "owner" || locals.admin?.role === "admin";
}

function context(locals: App.Locals) {
  const runtime = getRuntimeEnv(locals);
  const database = runtime?.OMS_DB as D1Database | undefined;
  return {
    database: database?.prepare ? database : null,
    rootSecret: getEnvValue("AUTH_SECRET", runtime),
  };
}

async function notificationUrl(database: D1Database): Promise<string | null> {
  const row = await database.prepare("SELECT site_url FROM stores ORDER BY id LIMIT 1")
    .first<{ site_url: string | null }>();
  try {
    const url = new URL(row?.site_url || "");
    return url.protocol === "https:"
      ? `${url.origin}/api/payments/doku/notifications`
      : null;
  } catch {
    return null;
  }
}

async function redactedData(database: D1Database, rootSecret: string) {
  return {
    ...(await getDokuConfigStatus(database, rootSecret)),
    notificationUrl: await notificationUrl(database),
  };
}

function configError(error: unknown, fallback: string) {
  if (!(error instanceof DokuConfigError)) return json({ success: false, error: fallback }, 500);
  const messages: Record<DokuConfigError["code"], [string, number]> = {
    DOKU_CONFIG_INVALID: ["Draft konfigurasi DOKU tidak valid.", 422],
    DOKU_CONFIG_STORE_MISSING: ["Store belum siap untuk konfigurasi DOKU.", 409],
    DOKU_CONFIG_WRITE_FAILED: [fallback, 500],
    DOKU_CONFIG_STALE: ["Konfigurasi DOKU telah berubah. Muat ulang status sebelum mencoba lagi.", 409],
    DOKU_CONFIG_ACTIVE_ATTEMPTS: ["Selesaikan pembayaran nonterminal pada revisi ini sebelum mengganti atau menghapus kredensial.", 409],
    DOKU_CONFIG_NOT_READY: ["Konfigurasi DOKU belum lengkap atau tidak valid untuk diaktifkan.", 422],
  };
  const [message, status] = messages[error.code];
  return json({ success: false, error: message }, status);
}

export const GET: APIRoute = async ({ locals }) => {
  if (!authorized(locals)) return json({ success: false, error: "Akses konfigurasi pembayaran ditolak." }, 403);
  const { database, rootSecret } = context(locals);
  if (!database) return json({ success: false, error: "Database pembayaran belum tersedia." }, 503);
  try {
    return json({ success: true, data: await redactedData(database, rootSecret) });
  } catch {
    return json({ success: false, error: "Konfigurasi DOKU tidak dapat dibaca." }, 500);
  }
};

export const PUT: APIRoute = async ({ request, locals }) => {
  if (!authorized(locals)) return json({ success: false, error: "Akses konfigurasi pembayaran ditolak." }, 403);
  const { database, rootSecret } = context(locals);
  if (!database) return json({ success: false, error: "Database pembayaran belum tersedia." }, 503);
  const parsed = saveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ success: false, error: "Draft konfigurasi DOKU tidak valid." }, 400);
  try {
    await replaceDokuConfigDraft(database, rootSecret, {
      environment: parsed.data.environment,
      clientId: parsed.data.client_id,
      apiKey: parsed.data.api_key,
      secretKey: parsed.data.secret_key,
      enabledChannels: parsed.data.enabled_channels,
    }, parsed.data.expected_revision, locals.admin?.username ?? "");
    return json({
      success: true,
      message: "Draft DOKU tersimpan dalam keadaan nonaktif.",
      data: await redactedData(database, rootSecret),
    });
  } catch (error) {
    return configError(error, "Draft konfigurasi DOKU gagal disimpan.");
  }
};

export const PATCH: APIRoute = async ({ request, locals }) => {
  if (!authorized(locals)) return json({ success: false, error: "Akses konfigurasi pembayaran ditolak." }, 403);
  const { database, rootSecret } = context(locals);
  if (!database) return json({ success: false, error: "Database pembayaran belum tersedia." }, 503);
  const parsed = stateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ success: false, error: "Perubahan status DOKU tidak valid." }, 400);
  try {
    const enabled = parsed.data.action === "enable";
    await setDokuConfigEnabled(database, rootSecret, parsed.data.expected_revision, enabled, locals.admin?.username ?? "");
    return json({
      success: true,
      message: enabled ? "DOKU diaktifkan tanpa menghubungi provider." : "DOKU dinonaktifkan untuk checkout baru.",
      data: await redactedData(database, rootSecret),
    });
  } catch (error) {
    return configError(error, "Status DOKU gagal diperbarui.");
  }
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  if (!authorized(locals)) return json({ success: false, error: "Akses konfigurasi pembayaran ditolak." }, 403);
  const { database, rootSecret } = context(locals);
  if (!database) return json({ success: false, error: "Database pembayaran belum tersedia." }, 503);
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ success: false, error: "Permintaan penghapusan DOKU tidak valid." }, 400);
  try {
    await clearDokuConfigDraft(database, parsed.data.expected_revision, locals.admin?.username ?? "");
    return json({
      success: true,
      message: "Kredensial DOKU dihapus dan integrasi tetap nonaktif.",
      data: await redactedData(database, rootSecret),
    });
  } catch (error) {
    return configError(error, "Kredensial DOKU gagal dihapus.");
  }
};
