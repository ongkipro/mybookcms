import { getStoreAdsConfig, META_PIXEL_ID_PATTERN } from "./ads-config.ts";
import { myrMajorFromSen } from "./ads-signal-policy.ts";
import { parseOrderAttribution, readMetaBrowserIds } from "./click-ids.ts";
import { prepareMetaCapiPayload, type PreparedMetaPayload } from "./meta-capi.ts";
import { getClientIp } from "./rate-limit.ts";

export type AcceptedOrderMetaContext = {
  eventSourceUrl: string;
  externalId?: string;
  clientIp?: string;
  userAgent?: string;
};

export type SettledDokuMetaPurchase = {
  eventId: string;
  payload: PreparedMetaPayload;
};

type SettledDokuOrderRow = {
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  city: string;
  province: string;
  postal_code: string | null;
  ad_click_ids: string | null;
  product_value_sen: number;
  content_name: string;
  content_ids: string;
  site_url: string | null;
  meta_pixel_id: string | null;
};

function sameOriginSourceUrl(request: Request) {
  const requestUrl = new URL(request.url);
  const referer = request.headers.get("referer");
  if (!referer) return requestUrl.origin;
  try {
    const source = new URL(referer);
    return source.origin === requestUrl.origin ? source.toString() : requestUrl.origin;
  } catch {
    return requestUrl.origin;
  }
}

export async function resolveAcceptedOrderMetaContext(
  request: Request,
  locals?: App.Locals,
): Promise<AcceptedOrderMetaContext | undefined> {
  const config = await getStoreAdsConfig(locals);
  if (!config.metaPixelId || !config.metaCapiToken) return undefined;
  const clientIp = getClientIp(request.headers);
  return {
    eventSourceUrl: sameOriginSourceUrl(request),
    externalId: readMetaBrowserIds(request).externalId,
    clientIp: clientIp === "unknown" ? undefined : clientIp,
    userAgent: request.headers.get("user-agent") || undefined,
  };
}

function canonicalStoreOrigin(siteUrl: string | null) {
  try {
    const url = new URL(String(siteUrl || ""));
    return url.protocol === "https:" ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

export async function prepareSettledDokuMetaPurchase(
  database: D1Database,
  orderId: number,
): Promise<SettledDokuMetaPurchase | null> {
  const order = await database.prepare(`
    SELECT
      o.order_number, o.customer_name, o.customer_phone, o.customer_email,
      o.city, o.province, o.postal_code, o.ad_click_ids,
      COALESCE((
        SELECT SUM(oi.unit_price * oi.quantity)
        FROM order_items oi WHERE oi.order_id = o.id
      ), 0) AS product_value_sen,
      COALESCE((
        SELECT GROUP_CONCAT(DISTINCT p.title)
        FROM order_items oi
        INNER JOIN product_variants pv ON pv.id = oi.variant_id
        INNER JOIN products p ON p.id = pv.product_id
        WHERE oi.order_id = o.id
      ), '') AS content_name,
      COALESCE((
        SELECT GROUP_CONCAT('p' || pv.product_id || '-v' || pv.id)
        FROM order_items oi
        INNER JOIN product_variants pv ON pv.id = oi.variant_id
        WHERE oi.order_id = o.id
      ), '') AS content_ids,
      s.site_url, s.meta_pixel_id
    FROM orders o
    INNER JOIN stores s ON s.id = o.store_id
    WHERE o.id = ? AND o.payment_method = 'doku'
    LIMIT 1
  `).bind(orderId).first<SettledDokuOrderRow>();
  const eventSourceUrl = canonicalStoreOrigin(order?.site_url || null);
  if (!order || !eventSourceUrl || !META_PIXEL_ID_PATTERN.test(order.meta_pixel_id || "")) {
    return null;
  }

  const attribution = parseOrderAttribution(order.ad_click_ids);
  const eventId = `purchase:${order.order_number}`;
  return {
    eventId,
    payload: await prepareMetaCapiPayload({
      eventName: "Purchase",
      eventId,
      eventSourceUrl,
      userData: {
        phone: order.customer_phone,
        name: order.customer_name,
        email: order.customer_email || undefined,
        city: order.city,
        state: order.province,
        postcode: order.postal_code || undefined,
        externalId: attribution.meta_external_id,
        fbp: attribution._fbp,
        fbc: attribution._fbc,
      },
      customData: {
        contentName: order.content_name,
        contentIds: order.content_ids.split(",").filter(Boolean),
        value: myrMajorFromSen(order.product_value_sen),
        orderNumber: order.order_number,
      },
    }),
  };
}
