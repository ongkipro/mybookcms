import type { APIRoute } from "astro";
import { hasClickId, readOrderAttribution, serializeClickIds } from "../../lib/click-ids.ts";
import { orderSubmitSchema } from "../../lib/order-schema";
import { getRuntimeEnv } from "../../lib/env";
import {
  checkRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "../../lib/rate-limit";
import {
  DuplicateSubmissionError,
  OrderInputError,
  persistOrder,
} from "../../lib/order-persistence";
import {
  MalaysiaShippingError,
  quoteMalaysiaShippingFromD1,
  type MalaysiaShippingQuote,
} from "../../lib/malaysia-shipping";
import { normalizeMalaysiaPhone } from "../../lib/validation";
import {
  MalaysiaLocationError,
  resolveMalaysiaLocation,
  type MalaysiaLocation,
} from "../../lib/malaysia-locations";

export const prerender = false;

const json = (
  body: Record<string, unknown>,
  status = 200,
  headers: Record<string, string> = {},
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });

export const POST: APIRoute = async ({ request, locals }) => {
  const clientIp = getClientIp(request.headers);
  const sessions = getRuntimeEnv(locals)?.SESSION as KVNamespace | undefined;
  const rateLimit = await checkRateLimit(
    sessions,
    `submit-order:${clientIp}`,
    10,
    60_000,
  );
  if (!rateLimit.allowed) {
    return json(
      {
        success: false,
        error: "Terlalu banyak percobaan. Coba lagi sebentar.",
        code: "RATE_LIMITED",
      },
      429,
      rateLimitHeaders(rateLimit.remaining, rateLimit.resetAt),
    );
  }
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body)
    return json(
      {
        success: false,
        error: "Payload tidak valid.",
        code: "VALIDATION_ERROR",
      },
      400,
    );
  if (String(body.website || "").trim()) {
    return json(
      {
        success: false,
        error: "Request tidak valid",
        code: "HONEYPOT_TRIGGERED",
      },
      400,
    );
  }

  const parsed = orderSubmitSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      {
        success: false,
        error: parsed.error.errors[0]?.message || "Data tidak valid",
        code: "VALIDATION_ERROR",
      },
      422,
    );
  }
  const data = parsed.data;
  const customerPhone = normalizeMalaysiaPhone(data.customer_phone);
  const database = getRuntimeEnv(locals)?.OMS_DB as D1Database | undefined;
  if (!database?.prepare) {
    return json(
      {
        success: false,
        error: "Database order belum tersedia.",
        code: "DATABASE_UNAVAILABLE",
      },
      503,
    );
  }
  const submittedShippingCost = Number(body.shipping_cost);
  if (!Number.isInteger(submittedShippingCost) || submittedShippingCost < 0) {
    return json(
      {
        success: false,
        error: "Biaya pengiriman tidak valid.",
        code: "VALIDATION_ERROR",
      },
      422,
    );
  }

  let quote: MalaysiaShippingQuote;
  let location: MalaysiaLocation;
  const clickIds = readOrderAttribution(request);
  try {
    location = await resolveMalaysiaLocation(database, data.location_id);
    if (
      data.postal_code !== location.postcode ||
      data.district !== location.city ||
      data.province !== location.state
    ) {
      return json(
        {
          success: false,
          error: "Lokasi berubah. Pilih semula lokasi penghantaran.",
          code: "LOCATION_CHANGED",
        },
        409,
      );
    }
    quote = await quoteMalaysiaShippingFromD1(database, {
      postcode: location.postcode,
      variantKey: data.variant_id,
      quantity: data.quantity,
    });
    if (quote.amountSen !== submittedShippingCost) {
      return json(
        {
          success: false,
          error: "Kadar penghantaran berubah. Muat semula sebelum meneruskan.",
          code: "SHIPPING_QUOTE_CHANGED",
          shipping_cost: quote.amountSen,
        },
        409,
      );
    }
  } catch (error) {
    if (error instanceof MalaysiaLocationError) {
      return json({ success: false, error: error.message, code: error.code }, 422);
    }
    const quoteError = error instanceof MalaysiaShippingError ? error : null;
    if (!quoteError) console.error("submit-order-shipping-quote", error);
    return json(
      {
        success: false,
        error: quoteError?.message || "Kadar penghantaran belum dapat disahkan.",
        code: quoteError?.code || "SHIPPING_ERROR",
      },
      quoteError ? 422 : 500,
    );
  }
  try {
    const order = await persistOrder(database, {
      submitToken: data.submit_token,
      customerName: data.customer_name.trim(),
      customerPhone,
      customerEmail:
        data.customer_email ||
        (data.payment_method !== "cod"
          ? `${customerPhone}@${new URL(request.url).hostname}`
          : undefined),
      address: data.address,
      province: location.state,
      city: location.city,
      district: location.city,
      postalCode: location.postcode,
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

    const paymentStatus =
      data.payment_method === "cod" ? "unpaid" : "pending";
    return json({
      success: true,
      order: {
        id: order.id,
        order_id: order.orderNumber,
        order_number: order.orderNumber,
        status_token: order.publicStatusToken,
        payment_method: data.payment_method,
        payment_status: paymentStatus,
        status: "pending",
        content_id: order.contentId,
        total_payment: order.totalAmount,
        product_value_sen: order.productValue,
        shipping_cost: quote.amountSen,
        seller_bank_account_id: order.sellerBankAccountId || null,
      },
      payment: data.payment_method === "manual_transfer"
          ? {
              bank_code: order.sellerBankCode,
              bank_name: order.sellerBankName,
              account_holder: order.sellerAccountHolder,
              account_number: order.sellerAccountNumber,
              manual_transfer: true,
              status: "pending",
              amount: order.totalAmount,
              total_amount: order.totalAmount,
            }
          : null,
    });
  } catch (error) {
    if (error instanceof DuplicateSubmissionError) {
      return json(
        { success: false, error: error.message, code: "DUPLICATE_SUBMIT" },
        409,
      );
    }
    if (error instanceof OrderInputError) {
      return json(
        { success: false, error: error.message, code: "VALIDATION_ERROR" },
        422,
      );
    }
    console.error("submit-order", error);
    return json(
      {
        success: false,
        error: "Gagal menyimpan pesanan.",
        code: "ORDER_PERSIST_FAILED",
      },
      500,
    );
  }
};
