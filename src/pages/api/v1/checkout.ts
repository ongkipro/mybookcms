import type { APIRoute } from "astro";
import { hasClickId, readClickIdCookie, serializeClickIds } from "../../../lib/click-ids.ts";
import { handleOptions, headlessError, headlessOk, validateHeadlessRequest } from "../../../lib/headless-api";
import { orderSubmitSchema } from "../../../lib/order-schema";
import { getRuntimeEnv } from "../../../lib/env";
import { checkRateLimit, getClientIp } from "../../../lib/rate-limit";
import { persistOrder, DuplicateSubmissionError, OrderInputError } from "../../../lib/order-persistence";
import { MalaysiaShippingError, quoteMalaysiaShippingFromD1 } from "../../../lib/malaysia-shipping";

export const prerender = false;
export const OPTIONS = handleOptions;

export const POST: APIRoute = async ({ request, locals }) => {
  const validation = await validateHeadlessRequest(request, locals, { operation: "checkoutCreate" });
  if (!validation.allowed) return validation.errorResponse;
  const sessions = getRuntimeEnv(locals)?.SESSION as KVNamespace | undefined;
  const limit = await checkRateLimit(sessions, `headless-checkout:${getClientIp(request.headers)}`, 15, 60_000);
  if (!limit.allowed) return validation.finalize(headlessError("Terlalu banyak percobaan order.", 429, { code: "RATE_LIMITED" }, validation.corsHeaders));
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return validation.finalize(headlessError("Payload JSON tidak valid.", 400, { code: "INVALID_PAYLOAD" }, validation.corsHeaders));
  const parsed = orderSubmitSchema.safeParse(body);
  if (!parsed.success) return validation.finalize(headlessError(parsed.error.issues[0]?.message || "Data order tidak valid.", 422, { code: "VALIDATION_ERROR" }, validation.corsHeaders));
  const data = parsed.data;
  const database = getRuntimeEnv(locals)?.OMS_DB as D1Database | undefined;
  if (!database?.prepare) return validation.finalize(headlessError("Database belum tersedia.", 503, { code: "DATABASE_UNAVAILABLE" }, validation.corsHeaders));
  try {
    const clickIds = readClickIdCookie(request);
    const quote = await quoteMalaysiaShippingFromD1(database, { postcode: data.postal_code, variantKey: data.variant_id, quantity: data.quantity });
    const order = await persistOrder(database, {
      submitToken: data.submit_token,
      customerName: data.customer_name,
      customerPhone: data.customer_phone,
      customerEmail: data.customer_email || undefined,
      address: data.address,
      province: data.province,
      city: String(body.city || "").trim().slice(0, 120),
      district: data.district,
      postalCode: data.postal_code,
      variantKey: data.variant_id,
      quantity: data.quantity,
      shippingCost: quote.amountSen,
      paymentMethod: data.payment_method,
      sellerBankAccountId: data.seller_bank_account_id,
      shippingZoneCode: quote.zoneCode,
      shippingRateRuleId: quote.rateRuleId,
      shippingAmountSen: quote.amountSen,
      adClickIds: hasClickId(clickIds) ? serializeClickIds(clickIds) : undefined,
    });
    return validation.finalize(headlessOk({ order: {
      id: order.id,
      order_number: order.orderNumber,
      public_status_token: order.publicStatusToken,
      total_amount: order.totalAmount,
      shipping_amount: quote.amountSen,
      currency: "MYR",
    } }, 201, validation.corsHeaders));
  } catch (error) {
    if (error instanceof DuplicateSubmissionError) return validation.finalize(headlessError(error.message, 409, { code: "DUPLICATE_ORDER" }, validation.corsHeaders));
    if (error instanceof MalaysiaShippingError || error instanceof OrderInputError) return validation.finalize(headlessError(error.message, 422, { code: error instanceof MalaysiaShippingError ? error.code : "ORDER_INPUT_ERROR" }, validation.corsHeaders));
    console.error("headless-checkout", error);
    return validation.finalize(headlessError("Order gagal diproses.", 500, { code: "CHECKOUT_ERROR" }, validation.corsHeaders));
  }
};
