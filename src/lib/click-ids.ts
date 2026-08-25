export const CLICK_ID_COOKIE = "mybook_click_ids";

export const CLICK_ID_KEYS = [
  "gclid", "gbraid", "wbraid", "_fbp", "_fbc", "fbclid",
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
] as const;
export type ClickIdKey = (typeof CLICK_ID_KEYS)[number];
export type ClickIds = Partial<Record<ClickIdKey, string>>;

const CLICK_ID_PATTERN = /^[A-Za-z0-9._-]{1,256}$/;
const FB_BROWSER_ID_PATTERN = /^fb\.\d\.\d{10,20}\..+$/;

export function parseClickIdsFromUrl(url: URL): ClickIds {
  const found: ClickIds = {};
  for (const key of CLICK_ID_KEYS) {
    const value = url.searchParams.get(key)?.trim();
    if (value && CLICK_ID_PATTERN.test(value)) found[key] = value;
  }
  if (found.fbclid && !found._fbc) found._fbc = `fb.1.${Date.now()}.${found.fbclid}`;
  return found;
}

export function serializeClickIds(ids: ClickIds) {
  return JSON.stringify(ids);
}

export function parseClickIds(raw: string | null | undefined): ClickIds {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const found: ClickIds = {};
    for (const key of CLICK_ID_KEYS) {
      const value = parsed[key];
      if (typeof value === "string" && CLICK_ID_PATTERN.test(value)) found[key] = value;
    }
    return found;
  } catch {
    return {};
  }
}

export function hasClickId(ids: ClickIds) {
  return CLICK_ID_KEYS.some((key) => Boolean(ids[key]));
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
  const fbp = readCookie(request, "_fbp");
  const fbc = readCookie(request, "_fbc");
  return {
    fbp: FB_BROWSER_ID_PATTERN.test(fbp) ? fbp : undefined,
    fbc: FB_BROWSER_ID_PATTERN.test(fbc) ? fbc : ids._fbc,
  };
}

export function readOrderAttribution(request: Request): ClickIds {
  const ids = readClickIdCookie(request);
  const browserIds = readMetaBrowserIds(request);
  return {
    ...ids,
    ...(browserIds.fbp ? { _fbp: browserIds.fbp } : {}),
    ...(browserIds.fbc ? { _fbc: browserIds.fbc } : {}),
  };
}
