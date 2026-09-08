import type { APIRoute } from "astro";
import { z } from "zod";
import {
  getStoreAdsConfig,
  GOOGLE_ADS_ID_PATTERN,
  GOOGLE_ADS_LABEL_PATTERN,
  GOOGLE_TAG_MANAGER_ID_PATTERN,
  maskAdsSecret,
  META_PIXEL_ID_PATTERN,
  META_TEST_CODE_PATTERN,
} from "../../../lib/ads-config.ts";
import { encryptAdsSecret } from "../../../lib/ads-secret.ts";
import { getEnvValue, getRuntimeEnv } from "../../../lib/env.ts";
import { prepareMetaCapiPayload, sendPreparedMetaCapi } from "../../../lib/meta-capi.ts";
import { getClientIp } from "../../../lib/rate-limit.ts";

import { commitSystemMutation } from "../../../lib/system-events.ts";

export const prerender = false;

const bodySchema = z.object({
  action: z.enum(["save-meta", "save-google", "test-capi"]),
  meta_pixel_id: z.string().trim().max(25).optional(),
  meta_capi_token: z.string().trim().max(4096).optional(),
  meta_test_event_code: z.string().trim().max(24).optional(),
  clear_meta_capi_token: z.boolean().optional(),
  google_tag_manager_id: z.string().trim().max(24).optional(),
  google_ads_conversion_id: z.string().trim().max(24).optional(),
  google_ads_conversion_label: z.string().trim().max(100).optional(),
}).strict();

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

function databaseFrom(locals: App.Locals) {
  const database = getRuntimeEnv(locals)?.OMS_DB as D1Database | undefined;
  return database?.prepare ? database : null;
}

function publicConfig(config: Awaited<ReturnType<typeof getStoreAdsConfig>>) {
  return {
    meta_pixel_id: config.metaPixelId,
    meta_capi_configured: config.metaCapiTokenSource === "database"
      || config.metaCapiTokenSource === "environment",
    meta_capi_token_masked: config.metaCapiTokenSource === "database"
      ? maskAdsSecret(config.metaCapiToken)
      : "",
    meta_capi_token_source: config.metaCapiTokenSource,
    meta_capi_environment_fallback: config.metaCapiEnvironmentFallback,
    google_tag_manager_id: config.googleTagManagerId,
    google_ads_conversion_id: config.googleAdsConversionId,
    google_ads_conversion_label: config.googleAdsConversionLabel,
  };
}

export const GET: APIRoute = async ({ locals }) => {
  if (!databaseFrom(locals)) return json({ success: false, error: "Database konfigurasi belum tersedia." }, 503);
  return json({ success: true, data: publicConfig(await getStoreAdsConfig(locals)) });
};

export const PUT: APIRoute = async ({ request, locals }) => {
  const database = databaseFrom(locals);
  if (!database) return json({ success: false, error: "Database konfigurasi belum tersedia." }, 503);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ success: false, error: "Payload konfigurasi Ads tidak valid." }, 400);
  const body = parsed.data;
  const current = await getStoreAdsConfig(locals);
  try {
    if (body.action === "test-capi") {
      const pixelId = body.meta_pixel_id || current.metaPixelId;
      const token = body.meta_capi_token || current.metaCapiToken;
      const code = String(body.meta_test_event_code || "").toUpperCase();
      if (!META_PIXEL_ID_PATTERN.test(pixelId)) return json({ success: false, error: "Meta Pixel ID harus berisi 5–25 digit." }, 422);
      if (!token) return json({ success: false, error: "Meta CAPI Access Token belum dikonfigurasi." }, 422);
      if (!META_TEST_CODE_PATTERN.test(code)) return json({ success: false, error: "Test Event Code harus berformat TEST diikuti 3–20 digit." }, 422);
      const payload = await prepareMetaCapiPayload({
        eventName: "PageView",
        eventId: `settings-test:${crypto.randomUUID()}`,
        eventSourceUrl: new URL(request.url).origin,
        testEventCode: code,
        userData: {
          clientIp: getClientIp(request.headers),
          userAgent: request.headers.get("user-agent") || "MyBookCMS-CAPI-Test",
        },
        customData: { contentName: "MyBookCMS Meta CAPI connection test" },
      });
      const result = await sendPreparedMetaCapi(payload, pixelId, token);
      return json({
        success: result.success,
        message: result.success ? "Test event diterima Meta Conversions API." : result.reason || "Test event ditolak Meta.",
      }, result.success ? 200 : 422);
    }

    if (body.action === "save-meta") {
      const pixelId = String(body.meta_pixel_id || "");
      if (pixelId && !META_PIXEL_ID_PATTERN.test(pixelId)) return json({ success: false, error: "Meta Pixel ID harus berisi 5–25 digit." }, 422);
      const submittedToken = String(body.meta_capi_token || "");
      if (body.clear_meta_capi_token && submittedToken) {
        return json({ success: false, error: "Pilih hapus token atau simpan token baru, bukan keduanya." }, 422);
      }
      if (body.clear_meta_capi_token && current.metaCapiTokenSource !== "database" && current.metaCapiTokenSource !== "invalid") {
        return json({ success: false, error: "Tidak ada token database yang dapat dihapus." }, 409);
      }
      let storedToken: string | null | undefined;
      if (body.clear_meta_capi_token) storedToken = null;
      else if (submittedToken) {
        const authSecret = getEnvValue("AUTH_SECRET", getRuntimeEnv(locals));
        storedToken = await encryptAdsSecret(submittedToken, authSecret);
      }
      const store = await database.prepare("SELECT id FROM stores ORDER BY id LIMIT 1").first<{ id: number }>();
      if (!store) return json({ success: false, error: "Store belum tersedia." }, 404);
      if (storedToken === undefined) {
        await commitSystemMutation(database, database.prepare(`UPDATE stores SET meta_pixel_id = ? WHERE id = ?`)
          .bind(pixelId || null, store.id), { action: "ads.meta.updated", actor: locals.admin?.username ?? "", targetId: store.id });
      } else {
        await commitSystemMutation(database, database.prepare(`UPDATE stores SET meta_pixel_id = ?, meta_capi_token = ? WHERE id = ?`)
          .bind(pixelId || null, storedToken, store.id), { action: "ads.meta.updated", actor: locals.admin?.username ?? "", targetId: store.id });
      }
    }

    if (body.action === "save-google") {
      const gtmId = String(body.google_tag_manager_id || "").toUpperCase();
      const adsId = String(body.google_ads_conversion_id || "").toUpperCase();
      const label = String(body.google_ads_conversion_label || "");
      if (Boolean(adsId) !== Boolean(label)) return json({ success: false, error: "Conversion ID dan Purchase Label harus diisi berpasangan." }, 422);
      if (gtmId && !GOOGLE_TAG_MANAGER_ID_PATTERN.test(gtmId)) return json({ success: false, error: "GTM Container ID harus berformat GTM-XXXXXXX." }, 422);
      if (adsId && !GOOGLE_ADS_ID_PATTERN.test(adsId)) return json({ success: false, error: "Google Ads Conversion ID harus berformat AW-XXXXXXXXX." }, 422);
      if (label && !GOOGLE_ADS_LABEL_PATTERN.test(label)) return json({ success: false, error: "Google Ads Purchase Label tidak valid." }, 422);
      const store = await database.prepare("SELECT id FROM stores ORDER BY id LIMIT 1").first<{ id: number }>();
      if (!store) return json({ success: false, error: "Store belum tersedia." }, 404);
      await commitSystemMutation(database, database.prepare(`
        UPDATE stores SET google_tag_manager_id = ?, google_ads_conversion_id = ?, google_ads_conversion_label = ?
        WHERE id = ?
      `).bind(gtmId || null, adsId || null, label || null, store.id), { action: "ads.google.updated", actor: locals.admin?.username ?? "", targetId: store.id });
    }

    const updated = await getStoreAdsConfig(locals);
    return json({ success: true, message: "Konfigurasi Ads & Tracking tersimpan.", data: publicConfig(updated) });
  } catch (error) {
    console.error("ads-config-update", error);
    return json({ success: false, error: "Konfigurasi Ads & Tracking gagal disimpan." }, 500);
  }
};
