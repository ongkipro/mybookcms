export function json(data: Record<string, unknown>, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...(headers || {}),
    },
  });
}

export function jsonOk(data: Record<string, unknown>, status = 200, headers?: HeadersInit) {
  return json({ success: true, ...data }, status, headers);
}

export function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return json({ success: false, error: message, ...(extra || {}) }, status);
}

/**
 * The answer an API path gives to a method it does not implement.
 *
 * Without it Astro falls through to the storefront 404 route, so a client
 * holding a valid API key received a complete HTML page — layout, header and
 * all — where it expected JSON, and failed obscurely while parsing it. The DOKU
 * capability routes already answered `405` with a bounded body; this is that
 * decision applied everywhere rather than in one corner.
 *
 * `Allow` is required by RFC 9110 on a 405 and is the part that actually tells
 * an integrator what to do differently.
 */
export function methodNotAllowed(...allowed: string[]) {
  return json(
    { success: false, error: "Kaedah HTTP tidak disokong untuk laluan ini.", code: "METHOD_NOT_ALLOWED" },
    405,
    { Allow: allowed.join(", ") },
  );
}
