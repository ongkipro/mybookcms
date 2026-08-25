import type { APIRoute } from "astro";
import { handleOptions, headlessError, headlessOk, validateHeadlessRequest } from "../../../../lib/headless-api";
import { getRuntimeEnv } from "../../../../lib/env";
import { MalaysiaShippingError, quoteMalaysiaShippingFromD1 } from "../../../../lib/malaysia-shipping";

export const prerender = false;
export const OPTIONS = handleOptions;
export const GET: APIRoute = (context) => calculate(context);
export const POST: APIRoute = (context) => calculate(context);

async function calculate({ request, url, locals }: Parameters<APIRoute>[0]) {
  const validation = await validateHeadlessRequest(request, locals, { operation: "shippingQuote" });
  if (!validation.allowed) return validation.errorResponse;
  const body = request.method === "POST" ? await request.json().catch(() => ({})) as Record<string, unknown> : {};
  const postcode = body.postcode || body.postal_code || url.searchParams.get("postcode") || url.searchParams.get("postal_code") || "";
  const variantKey = String(body.variant_id || url.searchParams.get("variant_id") || "").trim();
  const quantity = Number(body.quantity || url.searchParams.get("quantity") || 1);
  const database = getRuntimeEnv(locals)?.OMS_DB as D1Database | undefined;
  if (!database?.prepare) return validation.finalize(headlessError("Database belum tersedia.", 503, { code: "DATABASE_UNAVAILABLE" }, validation.corsHeaders));
  try {
    const quote = await quoteMalaysiaShippingFromD1(database, { postcode, variantKey, quantity });
    return validation.finalize(headlessOk({
      postcode: quote.postcode,
      currency: "MYR",
      zone_code: quote.zoneCode,
      weight_grams: quote.weightGrams,
      rates: [{
        rate_rule_id: quote.rateRuleId,
        name: "Penghantaran standard",
        amount_sen: quote.amountSen,
      }],
    }, 200, validation.corsHeaders));
  } catch (error) {
    const shipping = error instanceof MalaysiaShippingError ? error : null;
    return validation.finalize(headlessError(shipping?.message || "Kadar penghantaran gagal dihitung.", shipping ? 422 : 500, { code: shipping?.code || "SHIPPING_ERROR" }, validation.corsHeaders));
  }
}
