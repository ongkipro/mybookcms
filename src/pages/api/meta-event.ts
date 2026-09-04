import type { APIRoute } from "astro";
import { methodNotAllowed } from "../../lib/api.ts";
import { z } from "zod";
import { getStoreAdsConfig } from "../../lib/ads-config.ts";
import { deliverCapiEvent, drainCapiOutbox, enqueueCapiEvent } from "../../lib/capi-outbox.ts";
import { parseCatalogOfferId } from "../../lib/catalog-id.ts";
import { parseOrderAttribution, readMetaBrowserIds } from "../../lib/click-ids.ts";
import { getRuntimeEnv } from "../../lib/env.ts";
import { myrMajorFromSen } from "../../lib/ads-signal-policy.ts";
import { prepareMetaCapiPayload } from "../../lib/meta-capi.ts";
import { checkRateLimit, getClientIp } from "../../lib/rate-limit.ts";

export const prerender = false;

const schema = z.object({
  event_name: z.enum(["PageView", "ViewContent", "InitiateCheckout", "Lead", "Purchase"]),
  event_id: z.string().trim().min(1).max(180),
  order_number: z.string().trim().max(80).optional(),
  status_token: z.string().trim().max(160).optional(),
  content_id: z.string().trim().max(100).optional(),
  content_name: z.string().trim().max(200).optional(),
  value: z.number().finite().min(0).max(100_000_000).optional(),
}).strict();

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

type OrderSignalRow = {
  id: number;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  city: string;
  province: string;
  postal_code: string | null;
  product_value_sen: number;
  content_name: string;
  content_ids: string;
  ad_click_ids: string | null;
  payment_method: string;
  payment_status: string;
};

type CatalogSignalRow = {
  product_id: number;
  variant_id: number;
  content_name: string;
  value_sen: number;
};

function sourceUrl(request: Request) {
  const origin = new URL(request.url).origin;
  const referer = request.headers.get("referer");
  if (!referer) return origin;
  try {
    const url = new URL(referer);
    return url.origin === origin ? url.toString() : origin;
  } catch { return origin; }
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = getRuntimeEnv(locals);
  const limit = await checkRateLimit(
    env?.SESSION as KVNamespace | undefined,
    `meta-event:${getClientIp(request.headers)}`,
    120,
    60_000,
  );
  if (!limit.allowed) return json({ success: false, error: "Terlalu banyak event." }, 429);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ success: false, error: "Payload Meta event tidak valid." }, 400);
  const database = env?.OMS_DB as D1Database | undefined;
  if (!database?.prepare) return json({ success: false, error: "Event store belum tersedia." }, 503);
  const config = await getStoreAdsConfig(locals);
  if (!config.metaPixelId || !config.metaCapiToken) return json({ success: true, skipped: true }, 202);

  try {
    const input = parsed.data;
    let order: OrderSignalRow | null = null;
    let catalogItem: CatalogSignalRow | null = null;
    if (input.event_name === "Lead" || input.event_name === "Purchase") {
      if (!input.order_number || !input.status_token) return json({ success: false, error: "Order dan status token wajib untuk event ini." }, 400);
      order = await database.prepare(`
        SELECT o.id, o.order_number, o.customer_name, o.customer_phone, o.customer_email,
          o.city, o.province, o.postal_code,
          COALESCE((SELECT SUM(oi.unit_price * oi.quantity) FROM order_items oi WHERE oi.order_id = o.id), 0) AS product_value_sen,
          COALESCE((SELECT GROUP_CONCAT(DISTINCT p.title) FROM order_items oi INNER JOIN product_variants pv ON pv.id = oi.variant_id INNER JOIN products p ON p.id = pv.product_id WHERE oi.order_id = o.id), '') AS content_name,
          COALESCE((SELECT GROUP_CONCAT('p' || pv.product_id || '-v' || pv.id) FROM order_items oi INNER JOIN product_variants pv ON pv.id = oi.variant_id WHERE oi.order_id = o.id), '') AS content_ids,
          o.ad_click_ids, o.payment_method, o.payment_status
        FROM orders o WHERE o.order_number = ? AND o.public_status_token = ? LIMIT 1
      `).bind(input.order_number, input.status_token).first<OrderSignalRow>();
      if (!order) return json({ success: false, error: "Order tidak ditemukan." }, 404);
      if (
        input.event_name === "Purchase" &&
        order.payment_method === "doku" &&
        !["paid", "settled", "success"].includes(order.payment_status.toLowerCase())
      ) {
        return json({ success: false, error: "Purchase DOKU menunggu pembayaran sah." }, 409);
      }
    }
    if (input.event_name === "ViewContent" || input.event_name === "InitiateCheckout") {
      const offer = parseCatalogOfferId(input.content_id || "");
      if (!offer) return json({ success: false, error: "Content ID canonical wajib untuk event produk." }, 422);
      catalogItem = await database.prepare(`
        SELECT p.id AS product_id, pv.id AS variant_id, p.title AS content_name, pv.price AS value_sen
        FROM product_variants pv
        INNER JOIN products p ON p.id = pv.product_id
        WHERE p.id = ? AND pv.id = ? AND p.is_active = 1
          AND (pv.stock IS NULL OR pv.stock > 0)
        LIMIT 1
      `).bind(offer.productId, offer.variantId).first<CatalogSignalRow>();
      if (!catalogItem) return json({ success: false, error: "Produk aktif untuk event tidak ditemukan." }, 404);
    }
    const requestBrowserIds = readMetaBrowserIds(request);
    const storedIds = order ? parseOrderAttribution(order.ad_click_ids) : {};
    const browserIds = order ? {
      fbp: storedIds._fbp || requestBrowserIds.fbp,
      fbc: storedIds._fbc || requestBrowserIds.fbc,
    } : requestBrowserIds;
    const eventId = order
      ? `${input.event_name === "Purchase" ? "purchase" : "lead"}:${order.order_number}`
      : input.event_id;
    const canonicalCatalogId = catalogItem
      ? `p${catalogItem.product_id}-v${catalogItem.variant_id}`
      : undefined;
    const payload = await prepareMetaCapiPayload({
      eventName: input.event_name,
      eventId,
      eventSourceUrl: sourceUrl(request),
      userData: order ? {
        phone: order.customer_phone,
        name: order.customer_name,
        email: order.customer_email || undefined,
        city: order.city,
        state: order.province,
        postcode: order.postal_code || undefined,
        externalId: storedIds.meta_external_id || requestBrowserIds.externalId,
        ...browserIds,
        clientIp: getClientIp(request.headers),
        userAgent: request.headers.get("user-agent") || undefined,
      } : {
        externalId: requestBrowserIds.externalId,
        ...browserIds,
        clientIp: getClientIp(request.headers),
        userAgent: request.headers.get("user-agent") || undefined,
      },
      customData: {
        contentName: order?.content_name || catalogItem?.content_name,
        contentIds: order
          ? order.content_ids.split(",").filter(Boolean)
          : canonicalCatalogId
            ? [canonicalCatalogId]
            : undefined,
        value: order
          ? myrMajorFromSen(order.product_value_sen)
          : catalogItem
            ? myrMajorFromSen(catalogItem.value_sen)
            : undefined,
        orderNumber: order?.order_number,
      },
    });
    const queued = await enqueueCapiEvent(database, input.event_name, eventId, payload);
    const delivered = await deliverCapiEvent(database, input.event_name, eventId, config.metaPixelId, config.metaCapiToken);
    const drain = drainCapiOutbox(database, config.metaPixelId, config.metaCapiToken)
      .catch((error) => console.error("capi-outbox-drain", error));
    if (locals.cfContext) locals.cfContext.waitUntil(drain); else void drain;
    return json({ success: true, queued, delivered, deduplicated: !queued }, 200);
  } catch (error) {
    console.error("meta-event", error);
    return json({ success: false, error: "Meta event gagal diproses." }, 500);
  }
};

// Otherwise Astro falls through to the storefront 404 route and answers an
// API client with a full HTML page.
export const ALL: APIRoute = () => methodNotAllowed("POST");
