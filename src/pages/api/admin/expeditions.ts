import type { APIRoute } from "astro";
import { z } from "zod";
import { jsonError, jsonOk } from "../../../lib/api.ts";
import { getRuntimeEnv } from "../../../lib/env.ts";
import { MALAYSIA_STATES } from "../../../lib/malaysia-states.ts";

export const prerender = false;

const zoneMutation = z.object({
  kind: z.literal("zone"),
  id: z.number().int().positive(),
  isActive: z.boolean(),
}).strict();

const rateMutation = z.object({
  kind: z.literal("rate"),
  id: z.number().int().positive(),
  amountSen: z.number().int().nonnegative(),
  isActive: z.boolean(),
}).strict();

const postcodeFields = {
  zoneId: z.number().int().positive(),
  postcodeStart: z.string().regex(/^\d{5}$/, "Poskod awal mesti lima digit."),
  postcodeEnd: z.string().regex(/^\d{5}$/, "Poskod akhir mesti lima digit."),
};

const postcodeMutation = z.object({
  kind: z.literal("postcode"),
  id: z.number().int().positive(),
  ...postcodeFields,
  isActive: z.boolean(),
}).strict().refine((value) => value.postcodeEnd >= value.postcodeStart, {
  message: "Poskod akhir tidak boleh lebih kecil dari poskod awal.",
});

const newRate = z.object({
  kind: z.literal("rate"),
  zoneId: z.number().int().positive(),
  minWeightGrams: z.number().int().positive(),
  maxWeightGrams: z.number().int().positive(),
  amountSen: z.number().int().nonnegative(),
  stateCode: z.enum(MALAYSIA_STATES.map((state) => state.code) as [string, ...string[]]).optional(),
  isActive: z.boolean().default(false),
}).strict().refine((value) => value.maxWeightGrams >= value.minWeightGrams, {
  message: "Berat maksimum tidak boleh lebih kecil dari berat minimum.",
});

const newPostcodeRange = z.object({
  kind: z.literal("postcode"),
  ...postcodeFields,
}).strict().refine((value) => value.postcodeEnd >= value.postcodeStart, {
  message: "Poskod akhir tidak boleh lebih kecil dari poskod awal.",
});

function databaseFrom(locals: App.Locals) {
  const database = getRuntimeEnv(locals)?.OMS_DB;
  return database && typeof database === "object" &&
    typeof (database as D1Database).prepare === "function"
    ? database as D1Database
    : null;
}

function mutationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("active shipping weight rules overlap")) {
    return jsonError("Rentang berat aktif bertindih dengan tarif lain pada zona yang sama.", 409);
  }
  if (message.includes("active shipping postcode ranges overlap")) {
    return jsonError("Rentang poskod aktif bertindih dengan rentang aktif lain.", 409);
  }
  console.error("malaysia-shipping-settings", error);
  return jsonError("Pengaturan pengiriman gagal disimpan.", 500);
}

export const GET: APIRoute = async ({ locals }) => {
  const database = databaseFrom(locals);
  if (!database) return jsonError("Database pengiriman belum tersedia.", 503);

  try {
    const [zones, ranges, rates] = await database.batch([
      database.prepare(`
        SELECT id, code, name, is_active AS isActive
        FROM shipping_zones
        ORDER BY CASE code
          WHEN 'peninsular' THEN 1 WHEN 'sabah' THEN 2
          WHEN 'sarawak' THEN 3 ELSE 4 END
      `),
      database.prepare(`
        SELECT id, shipping_zone_id AS zoneId, postcode_start AS postcodeStart,
               postcode_end AS postcodeEnd, is_active AS isActive
        FROM shipping_postcode_ranges
        ORDER BY postcode_start
      `),
      database.prepare(`
        SELECT id, shipping_zone_id AS zoneId,
               min_weight_grams AS minWeightGrams,
               max_weight_grams AS maxWeightGrams,
               amount_sen AS amountSen, is_active AS isActive,
               is_reference AS isReference, state_code AS stateCode
        FROM shipping_rate_rules
        ORDER BY shipping_zone_id, min_weight_grams, max_weight_grams
      `),
    ]);
    const zoneRows = (zones.results ?? []) as Array<{ id: number; code: string }>;
    return jsonOk({
      data: {
        zones: zoneRows,
        postcodeRanges: ranges.results ?? [],
        rateRules: rates.results ?? [],
        states: MALAYSIA_STATES.map((state) => ({
          code: state.code,
          name: state.name,
          zoneCode: state.zoneCode,
          zoneId: zoneRows.find((zone) => zone.code === state.zoneCode)?.id ?? null,
        })),
      },
    });
  } catch (error) {
    console.error("malaysia-shipping-settings-list", error);
    return jsonError("Pengaturan pengiriman gagal dimuat.", 500);
  }
};

export const PATCH: APIRoute = async ({ locals, request }) => {
  const database = databaseFrom(locals);
  if (!database) return jsonError("Database pengiriman belum tersedia.", 503);
  const parsed = z.union([zoneMutation, rateMutation, postcodeMutation]).safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return jsonError("Perubahan pengiriman tidak valid.", 400);

  try {
    const body = parsed.data;
    const result = body.kind === "zone"
      ? await database.prepare(`
          UPDATE shipping_zones
          SET is_active = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(body.isActive ? 1 : 0, body.id).run()
      : body.kind === "rate"
        ? await database.prepare(`
          UPDATE shipping_rate_rules
          SET amount_sen = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(body.amountSen, body.isActive ? 1 : 0, body.id).run()
        : await database.prepare(`
          UPDATE shipping_postcode_ranges
          SET shipping_zone_id = ?, postcode_start = ?, postcode_end = ?,
              is_active = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(
          body.zoneId,
          body.postcodeStart,
          body.postcodeEnd,
          body.isActive ? 1 : 0,
          body.id,
        ).run();
    if (!result.meta?.changes) return jsonError("Pengaturan tidak ditemukan.", 404);
    return jsonOk({ message: "Pengaturan pengiriman disimpan." });
  } catch (error) {
    return mutationError(error);
  }
};

export const POST: APIRoute = async ({ locals, request }) => {
  const database = databaseFrom(locals);
  if (!database) return jsonError("Database pengiriman belum tersedia.", 503);
  const parsed = z.union([newRate, newPostcodeRange])
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message || "Pengaturan tidak valid.", 400);
  }

  try {
    const body = parsed.data;
    const zone = await database.prepare("SELECT id, code FROM shipping_zones WHERE id = ?")
      .bind(body.zoneId).first<{ id: number; code: string }>();
    if (!zone) return jsonError("Zona pengiriman tidak ditemukan.", 404);
    if (body.kind === "postcode") {
      const result = await database.prepare(`
        INSERT INTO shipping_postcode_ranges (
          shipping_zone_id, postcode_start, postcode_end, is_active
        ) VALUES (?, ?, ?, 0)
      `).bind(body.zoneId, body.postcodeStart, body.postcodeEnd).run();
      return jsonOk({
        message: "Rentang poskod ditambahkan dalam keadaan nonaktif.",
        data: { id: result.meta?.last_row_id },
      }, 201);
    }
    if (body.stateCode) {
      const state = MALAYSIA_STATES.find((item) => item.code === body.stateCode);
      if (!state || state.zoneCode !== zone.code) {
        return jsonError("Negeri tidak cocok dengan zona pengiriman.", 400);
      }
    }
    const result = await database.prepare(`
      INSERT INTO shipping_rate_rules (
        shipping_zone_id, min_weight_grams, max_weight_grams,
        amount_sen, is_active, is_reference, state_code
      ) VALUES (?, ?, ?, ?, ?, 0, ?)
    `).bind(
      body.zoneId,
      body.minWeightGrams,
      body.maxWeightGrams,
      body.amountSen,
      body.isActive ? 1 : 0,
      body.stateCode || null,
    ).run();
    return jsonOk({
      message: "Tarif pengiriman ditambahkan.",
      data: { id: result.meta?.last_row_id },
    }, 201);
  } catch (error) {
    return mutationError(error);
  }
};
