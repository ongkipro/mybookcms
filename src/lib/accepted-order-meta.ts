import { getStoreAdsConfig } from "./ads-config.ts";
import { getClientIp } from "./rate-limit.ts";

export type AcceptedOrderMetaContext = {
  eventSourceUrl: string;
  clientIp?: string;
  userAgent?: string;
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
    clientIp: clientIp === "unknown" ? undefined : clientIp,
    userAgent: request.headers.get("user-agent") || undefined,
  };
}
