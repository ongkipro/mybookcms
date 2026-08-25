import type { APIRoute } from "astro";
import { hasClickId, readOrderAttribution, serializeClickIds } from "../../lib/click-ids.ts";
import { getRuntimeEnv } from "../../lib/env.ts";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "../../lib/rate-limit.ts";
import {
  isValidMalaysiaCustomerName,
  isValidMalaysiaDeliveryAddress,
  isValidMalaysiaPhone,
  normalizeMalaysiaCustomerName,
  normalizeMalaysiaDeliveryAddress,
  normalizeMalaysiaPhone,
} from "../../lib/validation.ts";
import { DuplicateSubmissionError, OrderInputError, persistOrder } from "../../lib/order-persistence.ts";

export const prerender = false;

const json = (body: Record<string, unknown>, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...headers } });

export const POST: APIRoute = async ({ request, locals }) => {
  const env = getRuntimeEnv(locals);
  const rateLimit = await checkRateLimit(
    env?.SESSION as KVNamespace | undefined,
    `submit-middle-order:${getClientIp(request.headers)}`,
    10,
    60_000,
  );
  if (!rateLimit.allowed) {
    return json({ success: false, error: "Terlalu banyak percubaan. Cuba lagi sebentar.", code: "RATE_LIMITED" }, 429, rateLimitHeaders(rateLimit.remaining, rateLimit.resetAt));
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return json({ success: false, error: "Payload tidak sah.", code: "VALIDATION_ERROR" }, 400);
  if (String(body.website || "").trim()) return json({ success: false, error: "Request tidak sah.", code: "HONEYPOT_TRIGGERED" }, 400);

  const submitToken = String(body.submit_token || "").trim();
  const customerName = normalizeMalaysiaCustomerName(String(body.customer_name || ""));
  const customerPhone = normalizeMalaysiaPhone(String(body.customer_phone || ""));
  const address = normalizeMalaysiaDeliveryAddress(String(body.address || ""));
  const variantKey = String(body.variant_id || body.variant || "").trim();
  if (submitToken.length < 16 || submitToken.length > 120) return json({ success: false, error: "Token submit tidak sah.", code: "VALIDATION_ERROR" }, 422);
  if (!isValidMalaysiaCustomerName(customerName)) return json({ success: false, error: "Nama penuh mesti mengandungi 2-100 aksara dan huruf yang sah.", code: "VALIDATION_ERROR" }, 422);
  if (!isValidMalaysiaPhone(customerPhone)) return json({ success: false, error: "Nombor telefon Malaysia tidak sah. Contoh: 0123456789", code: "VALIDATION_ERROR" }, 422);
  if (!isValidMalaysiaDeliveryAddress(address)) return json({ success: false, error: "Alamat lengkap mesti mengandungi 10-500 aksara serta nama jalan atau kawasan.", code: "VALIDATION_ERROR" }, 422);
  if (!variantKey || variantKey.length > 120) return json({ success: false, error: "Varian produk mesti dipilih.", code: "VALIDATION_ERROR" }, 422);

  const database = env?.OMS_DB as D1Database | undefined;
  if (!database?.prepare) return json({ success: false, error: "Database order belum tersedia.", code: "DATABASE_UNAVAILABLE" }, 503);

  try {
    const clickIds = readOrderAttribution(request);
    const order = await persistOrder(database, {
      submitToken,
      customerName,
      customerPhone,
      address,
      province: "Belum dikonfirmasi",
      city: "Belum dikonfirmasi",
      district: "Belum dikonfirmasi",
      variantKey,
      quantity: 1,
      shippingCost: 0,
      paymentMethod: "cod",
      adClickIds: hasClickId(clickIds) ? serializeClickIds(clickIds) : undefined,
    });
    return json({
      success: true,
      order: {
        id: order.id,
        order_id: order.orderNumber,
        order_number: order.orderNumber,
        status_token: order.publicStatusToken,
        payment_method: "cod",
        payment_status: "unpaid",
        status: "pending",
        content_id: order.contentId,
        total_payment: order.totalAmount,
        product_value_sen: order.productValue,
        shipping_cost: 0,
      },
    });
  } catch (error) {
    if (error instanceof DuplicateSubmissionError) return json({ success: false, error: error.message, code: "DUPLICATE_SUBMIT" }, 409);
    if (error instanceof OrderInputError) return json({ success: false, error: error.message, code: "VALIDATION_ERROR" }, 422);
    console.error("submit-middle-order", error);
    return json({ success: false, error: "Pesanan gagal disimpan.", code: "ORDER_PERSIST_FAILED" }, 500);
  }
};
