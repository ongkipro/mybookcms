export const CLICK_ID_COOKIE = "mybook_click_ids";
export const META_EXTERNAL_ID_COOKIE = "mybook_meta_external_id";

export const CLICK_ID_KEYS = [
  "gclid", "gbraid", "wbraid", "_fbp", "_fbc", "fbclid",
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
] as const;
export type ClickIdKey = (typeof CLICK_ID_KEYS)[number];
export type ClickIds = Partial<Record<ClickIdKey, string>>;
export type OrderAttribution = ClickIds & { meta_external_id?: string };

export const AD_CLICK_KEYS = [
  "gclid", "gbraid", "wbraid", "fbclid", "_fbc", "_fbp",
] as const satisfies readonly ClickIdKey[];

export function hasAdClickId(ids: ClickIds) {
  return AD_CLICK_KEYS.some((key) => Boolean(ids[key]));
}

export function mergeClickIds(stored: ClickIds, incoming: ClickIds): ClickIds {
  if (hasAdClickId(incoming)) return incoming;
  const paidClick: ClickIds = {};
  for (const key of AD_CLICK_KEYS) {
    if (stored[key]) paidClick[key] = stored[key];
  }
  return { ...paidClick, ...incoming };
}

const CLICK_ID_PATTERN = /^[A-Za-z0-9._-]{1,256}$/;
const FB_BROWSER_ID_PATTERN = /^fb\.\d\.\d{10,20}\..+$/;
const META_EXTERNAL_ID_PATTERN = /^[a-f0-9]{32}$/;

function isValidClickId(key: ClickIdKey, value: string) {
  return key === "_fbp" || key === "_fbc"
    ? FB_BROWSER_ID_PATTERN.test(value)
    : CLICK_ID_PATTERN.test(value);
}

export function parseClickIdsFromUrl(url: URL): ClickIds {
  const found: ClickIds = {};
  for (const key of CLICK_ID_KEYS) {
    const value = url.searchParams.get(key)?.trim();
    if (value && isValidClickId(key, value)) found[key] = value;
  }
  if (found.fbclid && !found._fbc) found._fbc = `fb.1.${Date.now()}.${found.fbclid}`;
  return found;
}

export function serializeClickIds(ids: OrderAttribution) {
  return JSON.stringify(ids);
}

export function parseClickIds(raw: string | null | undefined): ClickIds {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const found: ClickIds = {};
    for (const key of CLICK_ID_KEYS) {
      const value = parsed[key];
      if (typeof value === "string" && isValidClickId(key, value)) found[key] = value;
    }
    return found;
  } catch {
    return {};
  }
}

export function parseOrderAttribution(raw: string | null | undefined): OrderAttribution {
  const clickIds = parseClickIds(raw);
  if (!raw) return clickIds;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const externalId = parsed.meta_external_id;
    return {
      ...clickIds,
      ...(typeof externalId === "string" && META_EXTERNAL_ID_PATTERN.test(externalId)
        ? { meta_external_id: externalId }
        : {}),
    };
  } catch {
    return clickIds;
  }
}

export function hasClickId(ids: OrderAttribution) {
  return CLICK_ID_KEYS.some((key) => Boolean(ids[key])) || Boolean(ids.meta_external_id);
}

function readCookie(request: Request, name: string) {
  const header = request.headers.get("cookie") || "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  if (!match) return "";
  try { return decodeURIComponent(match[1]); } catch { return ""; }
}

export function readClickIdCookie(request: Request) {
  return parseClickIds(readCookie(request, CLICK_ID_COOKIE));
}

export function readMetaBrowserIds(request: Request) {
  const ids = readClickIdCookie(request);
  const externalId = readCookie(request, META_EXTERNAL_ID_COOKIE);
  const fbp = readCookie(request, "_fbp");
  const fbc = readCookie(request, "_fbc");
  return {
    externalId: META_EXTERNAL_ID_PATTERN.test(externalId) ? externalId : undefined,
    fbp: FB_BROWSER_ID_PATTERN.test(fbp) ? fbp : undefined,
    fbc: FB_BROWSER_ID_PATTERN.test(fbc) ? fbc : ids._fbc,
  };
}

export function readOrderAttribution(request: Request): OrderAttribution {
  const ids = readClickIdCookie(request);
  const browserIds = readMetaBrowserIds(request);
  return {
    ...ids,
    ...(browserIds.fbp ? { _fbp: browserIds.fbp } : {}),
    ...(browserIds.fbc ? { _fbc: browserIds.fbc } : {}),
    ...(browserIds.externalId ? { meta_external_id: browserIds.externalId } : {}),
  };
}
