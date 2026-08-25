import type { APIRoute } from "astro";
import { getRuntimeEnv } from "../../../../lib/env";
import { handleOptions, headlessError, headlessOk, validateHeadlessRequest } from "../../../../lib/headless-api";
import { searchMalaysiaLocations } from "../../../../lib/malaysia-locations";

export const prerender = false;

export const OPTIONS = handleOptions;

export const GET: APIRoute = async ({ request, url, locals }) => {
  const validation = await validateHeadlessRequest(request, locals, { operation: "districtSearch" });
  if (!validation.allowed) return validation.errorResponse;
  const query = String(url.searchParams.get("postcode") || url.searchParams.get("q") || "");
  const database = getRuntimeEnv(locals)?.OMS_DB as D1Database | undefined;
  if (!database?.prepare) {
    return validation.finalize(headlessError("Database belum tersedia.", 503, { code: "DATABASE_UNAVAILABLE" }, validation.corsHeaders));
  }
  try {
    const matches = await searchMalaysiaLocations(database, query);
    const locations = matches.map((item) => ({
      id: item.id,
      city: item.city,
      district: item.city,
      province: item.state,
      postcode: item.postcode,
      zone_code: item.zoneCode,
      zone_name: item.zoneName,
      label: `${item.city}, ${item.state} · ${item.postcode}`,
    }));
    return validation.finalize(headlessOk({
      query: query.trim(),
      locations,
      postcodes: locations,
    }, 200, validation.corsHeaders));
  } catch (error) {
    console.error("headless-location-search", error);
    return validation.finalize(headlessError("Lokasi gagal dicari.", 500, { code: "LOCATION_SEARCH_FAILED" }, validation.corsHeaders));
  }
};
