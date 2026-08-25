export type MalaysiaShippingZoneCode =
  | "peninsular"
  | "sabah"
  | "sarawak"
  | "labuan";

export type MalaysiaPostcodeRange = {
  id: number;
  zoneCode: MalaysiaShippingZoneCode;
  postcodeStart: string;
  postcodeEnd: string;
  isActive: boolean | number;
};

export type MalaysiaShippingRateRule = {
  id: number;
  zoneCode: MalaysiaShippingZoneCode;
  minWeightGrams: number;
  maxWeightGrams: number;
  amountSen: number;
  isActive: boolean | number;
  stateCode?: string | null;
};

export type MalaysiaCartWeightLine = {
  unitWeightGrams: number;
  quantity: number;
};

export type MalaysiaShippingQuote = Readonly<{
  zoneCode: MalaysiaShippingZoneCode;
  rateRuleId: number;
  amountSen: number;
  postcode: string;
  weightGrams: number;
  stateCode: string | null;
}>;

export class MalaysiaShippingError extends Error {
  readonly code:
    | "POSTCODE_INVALID"
    | "POSTCODE_UNMAPPED"
    | "POSTCODE_RANGE_OVERLAP"
    | "WEIGHT_INVALID"
    | "RATE_UNAVAILABLE"
    | "RATE_RULE_OVERLAP"
    | "VARIANT_NOT_FOUND";

  constructor(message: string, code: MalaysiaShippingError["code"]) {
    super(message);
    this.code = code;
  }
}

/** Resolves a quote from D1-owned catalogue weight and merchant rate rules. */
export async function quoteMalaysiaShippingFromD1(
  database: D1Database,
  input: { postcode: unknown; variantKey: string; quantity: number },
): Promise<MalaysiaShippingQuote> {
  const postcode = normalizeMalaysiaPostcode(input.postcode);
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1 || input.quantity > 100) {
    throw new MalaysiaShippingError("Kuantiti pesanan tidak sah.", "WEIGHT_INVALID");
  }
  const variant = await database.prepare(`
    SELECT pv.weight_grams AS weightGrams
    FROM product_variants pv
    INNER JOIN products p ON p.id = pv.product_id
    WHERE (CAST(pv.id AS TEXT) = ? OR pv.sku = ?)
      AND p.is_active = 1
    LIMIT 1
  `).bind(input.variantKey, input.variantKey).first<{ weightGrams: number }>();
  if (!variant) {
    throw new MalaysiaShippingError("Varian produk tidak ditemukan.", "VARIANT_NOT_FOUND");
  }

  const weightGrams = calculateCartWeightGrams([
    { unitWeightGrams: Number(variant.weightGrams), quantity: input.quantity },
  ]);
  return quoteMalaysiaWeightFromD1(database, postcode, weightGrams);
}

/** Re-quotes an existing order from every persisted line and current D1 rates. */
export async function quoteMalaysiaOrderShippingFromD1(
  database: D1Database,
  input: { postcode: unknown; orderId: number },
): Promise<MalaysiaShippingQuote> {
  const postcode = normalizeMalaysiaPostcode(input.postcode);
  if (!Number.isSafeInteger(input.orderId) || input.orderId <= 0) {
    throw new MalaysiaShippingError("Pesanan tidak sah.", "WEIGHT_INVALID");
  }
  const result = await database.prepare(`
    SELECT pv.weight_grams AS unitWeightGrams, oi.quantity
    FROM order_items oi
    INNER JOIN product_variants pv ON pv.id = oi.variant_id
    WHERE oi.order_id = ?
    ORDER BY oi.id
  `).bind(input.orderId).all<MalaysiaCartWeightLine>();
  const weightGrams = calculateCartWeightGrams((result.results ?? []).map((line) => ({
    unitWeightGrams: Number(line.unitWeightGrams),
    quantity: Number(line.quantity),
  })));
  return quoteMalaysiaWeightFromD1(database, postcode, weightGrams);
}

async function quoteMalaysiaWeightFromD1(
  database: D1Database,
  postcode: string,
  weightGrams: number,
): Promise<MalaysiaShippingQuote> {
  const [locationResult, rangeResult, rateResult] = await database.batch([
    database.prepare(`
      SELECT state
      FROM malaysia_postcodes
      WHERE postcode = ?
      ORDER BY id
      LIMIT 1
    `).bind(postcode),
    database.prepare(`
      SELECT r.id, z.code AS zoneCode, r.postcode_start AS postcodeStart,
             r.postcode_end AS postcodeEnd, r.is_active AS isActive
      FROM shipping_postcode_ranges r
      INNER JOIN shipping_zones z ON z.id = r.shipping_zone_id
      WHERE z.is_active = 1 AND r.is_active = 1
    `),
    database.prepare(`
      SELECT rr.id, z.code AS zoneCode, rr.min_weight_grams AS minWeightGrams,
             rr.max_weight_grams AS maxWeightGrams,
             rr.amount_sen AS amountSen, rr.is_active AS isActive,
             rr.state_code AS stateCode
      FROM shipping_rate_rules rr
      INNER JOIN shipping_zones z ON z.id = rr.shipping_zone_id
      WHERE z.is_active = 1 AND rr.is_active = 1
    `),
  ]);

  const locationState = (locationResult.results?.[0] as { state?: string } | undefined)?.state || "";
  return quoteMalaysiaShipping({
    postcode,
    weightGrams,
    stateCode: malaysiaStateCode(locationState),
    postcodeRanges: (rangeResult.results ?? []) as MalaysiaPostcodeRange[],
    rateRules: (rateResult.results ?? []) as MalaysiaShippingRateRule[],
  });
}

const isActive = (value: boolean | number) => value === true || value === 1;
const isPostcode = (value: string) => /^\d{5}$/.test(value);

/** Converts one customer input into the only postcode representation stored in D1. */
export function normalizeMalaysiaPostcode(value: unknown): string {
  const postcode = typeof value === "string" ? value.trim() : "";
  if (!isPostcode(postcode)) {
    throw new MalaysiaShippingError(
      "Poskod Malaysia mesti mengandungi lima digit.",
      "POSTCODE_INVALID",
    );
  }
  return postcode;
}

/** Sum physical cart weight without floats; a malformed catalogue row cannot quote. */
export function calculateCartWeightGrams(lines: readonly MalaysiaCartWeightLine[]): number {
  let total = 0;
  for (const line of lines) {
    if (!Number.isSafeInteger(line.unitWeightGrams) || line.unitWeightGrams <= 0 ||
        !Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
      throw new MalaysiaShippingError("Berat pesanan tidak sah.", "WEIGHT_INVALID");
    }
    const lineTotal = line.unitWeightGrams * line.quantity;
    if (!Number.isSafeInteger(lineTotal) || total > Number.MAX_SAFE_INTEGER - lineTotal) {
      throw new MalaysiaShippingError("Berat pesanan tidak sah.", "WEIGHT_INVALID");
    }
    total += lineTotal;
  }
  if (total <= 0) {
    throw new MalaysiaShippingError("Berat pesanan tidak sah.", "WEIGHT_INVALID");
  }
  return total;
}

export function quoteMalaysiaShipping(input: {
  postcode: unknown;
  weightGrams: number;
  stateCode?: string | null;
  postcodeRanges: readonly MalaysiaPostcodeRange[];
  rateRules: readonly MalaysiaShippingRateRule[];
}): MalaysiaShippingQuote {
  const postcode = normalizeMalaysiaPostcode(input.postcode);
  if (!Number.isSafeInteger(input.weightGrams) || input.weightGrams <= 0) {
    throw new MalaysiaShippingError("Berat pesanan tidak sah.", "WEIGHT_INVALID");
  }

  const matchingRanges = input.postcodeRanges.filter(
    (range) => isActive(range.isActive) &&
      isPostcode(range.postcodeStart) &&
      isPostcode(range.postcodeEnd) &&
      range.postcodeStart <= postcode && postcode <= range.postcodeEnd,
  );
  if (matchingRanges.length === 0) {
    throw new MalaysiaShippingError(
      "Penghantaran belum tersedia untuk poskod ini.",
      "POSTCODE_UNMAPPED",
    );
  }
  if (matchingRanges.length !== 1) {
    throw new MalaysiaShippingError(
      "Konfigurasi zon penghantaran bertindih.",
      "POSTCODE_RANGE_OVERLAP",
    );
  }

  const zoneCode = matchingRanges[0].zoneCode;
  const matchesWeightAndZone = (rule: MalaysiaShippingRateRule) =>
    isActive(rule.isActive) && rule.zoneCode === zoneCode &&
      Number.isSafeInteger(rule.minWeightGrams) &&
      Number.isSafeInteger(rule.maxWeightGrams) &&
      Number.isSafeInteger(rule.amountSen) && rule.amountSen >= 0 &&
      rule.minWeightGrams <= input.weightGrams && input.weightGrams <= rule.maxWeightGrams;
  const matchingStateRules = input.stateCode
    ? input.rateRules.filter((rule) =>
      rule.stateCode === input.stateCode && matchesWeightAndZone(rule))
    : [];
  const matchingRules = matchingStateRules.length > 0
    ? matchingStateRules
    : input.rateRules.filter((rule) => !rule.stateCode && matchesWeightAndZone(rule));
  if (matchingRules.length === 0) {
    throw new MalaysiaShippingError(
      "Kadar penghantaran belum tersedia untuk berat ini.",
      "RATE_UNAVAILABLE",
    );
  }
  if (matchingRules.length !== 1) {
    throw new MalaysiaShippingError(
      "Konfigurasi kadar penghantaran bertindih.",
      "RATE_RULE_OVERLAP",
    );
  }

  const rule = matchingRules[0];
  return Object.freeze({
    zoneCode,
    rateRuleId: rule.id,
    amountSen: rule.amountSen,
    postcode,
    weightGrams: input.weightGrams,
    stateCode: input.stateCode || null,
  });
}
import { malaysiaStateCode } from "./malaysia-states.ts";
