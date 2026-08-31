import type { APIRoute } from "astro";
import { getRuntimeEnv } from "../../lib/env";
import {
  MalaysiaShippingError,
  quoteMalaysiaShippingFromD1,
} from "../../lib/malaysia-shipping";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "../../lib/rate-limit";

export const prerender = false;

const json = (body: Record<string, unknown>, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });

const statusFor = (error: MalaysiaShippingError) =>
  error.code === "POSTCODE_INVALID" || error.code === "WEIGHT_INVALID" || error.code === "VARIANT_NOT_FOUND"
    ? 422
    : error.code === "POSTCODE_UNMAPPED" || error.code === "RATE_UNAVAILABLE"
      ? 404
      : 409;

export const GET: APIRoute = async ({ request, url, locals }) => {
  const env = getRuntimeEnv(locals);
  const rateLimit = await checkRateLimit(
    env?.SESSION as KVNamespace | undefined,
    `public-shipping-rate:${getClientIp(request.headers)}`,
    60,
    60_000,
  );
  if (!rateLimit.allowed) {
    return json(
      { success: false, error: "Terlalu banyak permintaan kadar penghantaran." },
      429,
      rateLimitHeaders(rateLimit.remaining, rateLimit.resetAt),
    );
  }
  const database = env?.OMS_DB as D1Database | undefined;
  if (!database?.prepare) return json({ success: false, error: "Database belum tersedia." }, 503);

  const postcode = url.searchParams.get("postcode") ||
    url.searchParams.get("postal_code") ||
    url.searchParams.get("destination_id") ||
    url.searchParams.get("location_id") || "";
  const variantKey = String(
    url.searchParams.get("variant_unique_id") || url.searchParams.get("variant_id") || "",
  ).trim();
  const quantity = Number(url.searchParams.get("quantity") || 1);
  if (!variantKey) return json({ success: false, error: "Varian produk wajib dipilih.", code: "VARIANT_REQUIRED" }, 422);

  try {
    const quote = await quoteMalaysiaShippingFromD1(database, { postcode, variantKey, quantity });
    const item = {
      rate_rule_id: quote.rateRuleId,
      name: "Penghantaran standard",
      shipping_cost: quote.amountSen,
      currency: "MYR",
      zone_code: quote.zoneCode,
      weight_grams: quote.weightGrams,
    };
    return json({
      success: true,
      currency: "MYR",
      postcode: quote.postcode,
      zone_code: quote.zoneCode,
      weight_grams: quote.weightGrams,
      rates: [item],
      items: [item],
    });
  } catch (error) {
    if (error instanceof MalaysiaShippingError) {
      return json({ success: false, error: error.message, code: error.code }, statusFor(error));
    }
    console.error("malaysia-shipping-rates", error);
    return json({ success: false, error: "Kadar penghantaran gagal dikira.", code: "SHIPPING_ERROR" }, 500);
  }
};
