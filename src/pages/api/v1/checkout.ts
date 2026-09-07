import type { APIRoute } from "astro";
import { methodNotAllowed } from "../../../lib/api.ts";
import { resolveAcceptedOrderMetaContext } from "../../../lib/accepted-order-meta.ts";
import { hasClickId, readClickIdCookie, serializeClickIds } from "../../../lib/click-ids.ts";
import { handleOptions, headlessError, headlessOk, validateHeadlessRequest } from "../../../lib/headless-api";
import { orderSubmitSchema } from "../../../lib/order-schema";
import { getEnvValue, getRuntimeEnv } from "../../../lib/env";
import { checkRateLimit, getClientIp } from "../../../lib/rate-limit";
import { persistOrder, DuplicateSubmissionError, OrderInputError } from "../../../lib/order-persistence";
import { MalaysiaShippingError, quoteMalaysiaShippingFromD1 } from "../../../lib/malaysia-shipping";
import { DokuCheckoutError, createDokuHostedCheckout } from "../../../lib/doku-checkout.ts";

export const prerender = false;
export const OPTIONS = handleOptions;

export const POST: APIRoute = async ({ request, locals }) => {
  const validation = await validateHeadlessRequest(request, locals, { operation: "checkoutCreate" });
  if (!validation.allowed) return validation.errorResponse;
  const sessions = getRuntimeEnv(locals)?.SESSION as KVNamespace | undefined;
  const clientIp = getClientIp(request.headers);
  const limit = await checkRateLimit(sessions, `headless-checkout:${clientIp}`, 15, 60_000);
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
    const orderInput = {
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
      shippingZoneCode: quote.zoneCode,
      shippingRateRuleId: quote.rateRuleId,
      shippingAmountSen: quote.amountSen,
      adClickIds: hasClickId(clickIds) ? serializeClickIds(clickIds) : undefined,
    };
    if (data.payment_method === "doku") {
      // See the same guard in `POST /api/submit-order`: the schema's superRefine
      // states the rule but narrows no type, so the payment path checks rather
      // than asserts.
      if (!data.doku_channel) {
        return validation.finalize(headlessError(
          "Pilih saluran pembayaran DOKU.",
          422,
          { code: "DOKU_CHANNEL_REQUIRED" },
          validation.corsHeaders,
        ));
      }
      const checkout = await createDokuHostedCheckout(
        database,
        getEnvValue("AUTH_SECRET", getRuntimeEnv(locals)),
        {
          ...orderInput,
          city: orderInput.city || data.district,
          customerEmail: data.customer_email || "",
          selectedChannel: data.doku_channel,
          requestUrl: request.url,
          clientIp,
          userAgent: request.headers.get("User-Agent") || "unknown",
        },
      );
      return validation.finalize(headlessOk({
        order: {
          id: checkout.order.id,
          order_number: checkout.order.orderNumber,
          public_status_token: checkout.order.publicStatusToken,
          total_amount: checkout.order.totalAmount,
          shipping_amount: quote.amountSen,
          currency: "MYR",
        },
        payment: {
          provider: "doku",
          checkout_url: checkout.payment.checkoutUrl,
          expires_at: checkout.payment.expiresAt,
          status: checkout.payment.status,
          state: checkout.payment.state,
        },
      }, 201, validation.corsHeaders));
    }
    const order = await persistOrder(database, {
      ...orderInput,
      paymentMethod: data.payment_method,
      sellerBankAccountId: data.seller_bank_account_id,
      metaPurchase: await resolveAcceptedOrderMetaContext(request, locals),
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
    if (error instanceof DokuCheckoutError) {
      const status = error.code === "DOKU_UNAVAILABLE" || error.code === "DOKU_CONFLICT" ? 409 : 502;
      return validation.finalize(headlessError(
        error.code === "DOKU_UNAVAILABLE" ? "Pembayaran DOKU belum tersedia." : "Checkout DOKU gagal diproses.",
        status,
        { code: error.code },
        validation.corsHeaders,
      ));
    }
    if (error instanceof DuplicateSubmissionError) return validation.finalize(headlessError(error.message, 409, { code: "DUPLICATE_ORDER" }, validation.corsHeaders));
    if (error instanceof MalaysiaShippingError || error instanceof OrderInputError) return validation.finalize(headlessError(error.message, 422, { code: error instanceof MalaysiaShippingError ? error.code : "ORDER_INPUT_ERROR" }, validation.corsHeaders));
    console.error("headless-checkout", error);
    return validation.finalize(headlessError("Order gagal diproses.", 500, { code: "CHECKOUT_ERROR" }, validation.corsHeaders));
  }
};

// Otherwise Astro falls through to the storefront 404 route and answers an
// API client with a full HTML page.
export const ALL: APIRoute = () => methodNotAllowed("POST", "OPTIONS");
