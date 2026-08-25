import type { APIRoute } from "astro";
import { getRuntimeEnv } from "../../lib/env";
import { searchMalaysiaLocations } from "../../lib/malaysia-locations";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "../../lib/rate-limit";

export const prerender = false;

export const GET: APIRoute = async ({ request, url, locals }) => {
  const env = getRuntimeEnv(locals);
  const limit = await checkRateLimit(env?.SESSION as KVNamespace | undefined, `public-location:${getClientIp(request.headers)}`, 120, 60_000);
  if (!limit.allowed) return new Response(JSON.stringify({ success: false, error: "Terlalu banyak carian poskod." }), { status: 429, headers: { "Content-Type": "application/json", ...rateLimitHeaders(limit.remaining, limit.resetAt) } });
  const database = env?.OMS_DB as D1Database | undefined;
  if (!database?.prepare) return new Response(JSON.stringify({ success: false, error: "Database belum tersedia." }), { status: 503, headers: { "Content-Type": "application/json" } });
  const search = String(url.searchParams.get("postcode") || url.searchParams.get("search") || "");
  try {
    const matches = await searchMalaysiaLocations(database, search);
    const items = matches.map((item) => ({
      id: String(item.id),
      location_id: String(item.id),
      postal_code: item.postcode,
      postcode: item.postcode,
      district: item.city,
      city: item.city,
      province: item.state,
      label: `${item.city}, ${item.state} · ${item.postcode}`,
      zone_code: item.zoneCode,
      zone_name: item.zoneName,
    }));
    return new Response(JSON.stringify({ success: true, items, locations: items, alternatives: [] }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("malaysia-location-search", error);
    return new Response(JSON.stringify({ success: false, error: "Lokasi gagal dicari." }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
