export type MalaysiaLocation = Readonly<{
  id: number;
  state: string;
  city: string;
  postcode: string;
  zoneCode: string;
  zoneName: string;
}>;

export class MalaysiaLocationError extends Error {
  readonly code: "LOCATION_INVALID" | "LOCATION_UNAVAILABLE";

  constructor(message: string, code: MalaysiaLocationError["code"]) {
    super(message);
    this.code = code;
  }
}

const normalizeQuery = (value: unknown) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, 80);

const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

export async function searchMalaysiaLocations(
  database: D1Database,
  input: unknown,
  limit = 10,
): Promise<MalaysiaLocation[]> {
  const query = normalizeQuery(input);
  const numeric = /^\d+$/.test(query);
  if ((numeric && query.length !== 5) || (!numeric && query.length < 3)) return [];

  const boundedLimit = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 20) : 10;
  const normalized = query.toLocaleLowerCase("ms-MY");
  const escaped = escapeLike(normalized);
  const prefix = `${escaped}%`;
  const contains = `%${escaped}%`;
  const result = await database.prepare(`
    SELECT p.id, p.state, p.city, p.postcode,
           z.code AS zoneCode, z.name AS zoneName
    FROM malaysia_postcodes p
    INNER JOIN shipping_postcode_ranges r
      ON r.is_active = 1 AND p.postcode BETWEEN r.postcode_start AND r.postcode_end
    INNER JOIN shipping_zones z
      ON z.id = r.shipping_zone_id AND z.is_active = 1
    WHERE p.postcode LIKE ? ESCAPE '\\'
       OR lower(p.city) LIKE ? ESCAPE '\\'
       OR lower(p.state) LIKE ? ESCAPE '\\'
    ORDER BY CASE
      WHEN p.postcode = ? THEN 0
      WHEN p.postcode LIKE ? ESCAPE '\\' THEN 1
      WHEN lower(p.city) = ? THEN 2
      WHEN lower(p.city) LIKE ? ESCAPE '\\' THEN 3
      WHEN lower(p.state) LIKE ? ESCAPE '\\' THEN 4
      ELSE 5
    END, p.city COLLATE NOCASE, p.postcode
    LIMIT ?
  `).bind(prefix, contains, contains, query, prefix, normalized, prefix, prefix, boundedLimit)
    .all<MalaysiaLocation>();

  return (result.results ?? []).map((row) => Object.freeze({
    id: Number(row.id),
    state: String(row.state).trim(),
    city: String(row.city).trim(),
    postcode: String(row.postcode),
    zoneCode: String(row.zoneCode),
    zoneName: String(row.zoneName),
  }));
}

export async function resolveMalaysiaLocation(
  database: D1Database,
  input: unknown,
): Promise<MalaysiaLocation> {
  const id = Number(input);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new MalaysiaLocationError("Pilih lokasi daripada senarai yang tersedia.", "LOCATION_INVALID");
  }
  const row = await database.prepare(`
    SELECT p.id, p.state, p.city, p.postcode,
           z.code AS zoneCode, z.name AS zoneName
    FROM malaysia_postcodes p
    INNER JOIN shipping_postcode_ranges r
      ON r.is_active = 1 AND p.postcode BETWEEN r.postcode_start AND r.postcode_end
    INNER JOIN shipping_zones z
      ON z.id = r.shipping_zone_id AND z.is_active = 1
    WHERE p.id = ?
    LIMIT 1
  `).bind(id).first<MalaysiaLocation>();
  if (!row) {
    throw new MalaysiaLocationError("Lokasi penghantaran tidak lagi tersedia.", "LOCATION_UNAVAILABLE");
  }
  return Object.freeze({
    id: Number(row.id),
    state: String(row.state).trim(),
    city: String(row.city).trim(),
    postcode: String(row.postcode),
    zoneCode: String(row.zoneCode),
    zoneName: String(row.zoneName),
  });
}
