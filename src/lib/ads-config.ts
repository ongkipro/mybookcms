import { decryptAdsSecret } from "./ads-secret.ts";
import { getEnvValue, getRuntimeEnv } from "./env.ts";

export const META_PIXEL_ID_PATTERN = /^\d{5,25}$/;
export const META_TEST_CODE_PATTERN = /^TEST\d{3,20}$/;
export const GOOGLE_ADS_ID_PATTERN = /^AW-\d{5,20}$/;
export const GOOGLE_ADS_LABEL_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
export const GOOGLE_TAG_MANAGER_ID_PATTERN = /^GTM-[A-Z0-9]{4,20}$/;

export type StoreAdsConfig = {
  metaPixelId: string;
  metaCapiToken: string;
  metaCapiTokenSource: "database" | "environment" | "none" | "invalid";
  metaCapiEnvironmentFallback: boolean;
  googleTagManagerId: string;
  googleAdsConversionId: string;
  googleAdsConversionLabel: string;
};

type StoreAdsRow = {
  meta_pixel_id?: string | null;
  meta_capi_token?: string | null;
  google_tag_manager_id?: string | null;
  google_ads_conversion_id?: string | null;
  google_ads_conversion_label?: string | null;
};

export function maskAdsSecret(value: string) {
  if (!value) return "";
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

export async function getStoreAdsConfig(locals?: App.Locals): Promise<StoreAdsConfig> {
  const env = getRuntimeEnv(locals);
  const fallbackToken = getEnvValue("META_CAPI_ACCESS_TOKEN", env).trim();
  const fallbackSource = fallbackToken ? "environment" as const : "none" as const;
  const database = env?.OMS_DB as D1Database | undefined;
  if (!database?.prepare) {
    return {
      metaPixelId: "",
      metaCapiToken: fallbackToken,
      metaCapiTokenSource: fallbackSource,
      metaCapiEnvironmentFallback: Boolean(fallbackToken),
      googleTagManagerId: "",
      googleAdsConversionId: "",
      googleAdsConversionLabel: "",
    };
  }
  try {
    const row = await database.prepare(`
      SELECT meta_pixel_id, meta_capi_token, google_tag_manager_id,
        google_ads_conversion_id, google_ads_conversion_label
      FROM stores ORDER BY id LIMIT 1
    `).first<StoreAdsRow>();
    const storedToken = String(row?.meta_capi_token || "");
    let token = fallbackToken;
    let tokenSource: StoreAdsConfig["metaCapiTokenSource"] = fallbackSource;
    if (storedToken) {
      const authSecret = getEnvValue("AUTH_SECRET", env);
      try {
        token = await decryptAdsSecret(storedToken, authSecret);
        tokenSource = "database";
      } catch {
        token = "";
        tokenSource = "invalid";
      }
    }
    return {
      metaPixelId: String(row?.meta_pixel_id || ""),
      metaCapiToken: token,
      metaCapiTokenSource: tokenSource,
      metaCapiEnvironmentFallback: Boolean(fallbackToken),
      googleTagManagerId: String(row?.google_tag_manager_id || ""),
      googleAdsConversionId: String(row?.google_ads_conversion_id || ""),
      googleAdsConversionLabel: String(row?.google_ads_conversion_label || ""),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/no such column|no such table/i.test(message)) console.error("ads-config-load", error);
    return {
      metaPixelId: "",
      metaCapiToken: fallbackToken,
      metaCapiTokenSource: fallbackSource,
      metaCapiEnvironmentFallback: Boolean(fallbackToken),
      googleTagManagerId: "",
      googleAdsConversionId: "",
      googleAdsConversionLabel: "",
    };
  }
}
