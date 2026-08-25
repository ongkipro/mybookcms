import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCartWeightGrams,
  MalaysiaShippingError,
  normalizeMalaysiaPostcode,
  quoteMalaysiaOrderShippingFromD1,
  quoteMalaysiaShipping,
  type MalaysiaPostcodeRange,
  type MalaysiaShippingRateRule,
} from "./malaysia-shipping.ts";

const postcodeRanges: MalaysiaPostcodeRange[] = [
  { id: 1, zoneCode: "peninsular", postcodeStart: "01000", postcodeEnd: "86999", isActive: 1 },
  { id: 2, zoneCode: "labuan", postcodeStart: "87000", postcodeEnd: "87033", isActive: 1 },
  { id: 3, zoneCode: "sabah", postcodeStart: "88000", postcodeEnd: "91309", isActive: 1 },
  { id: 4, zoneCode: "sarawak", postcodeStart: "93000", postcodeEnd: "98859", isActive: 1 },
];

const rateRules: MalaysiaShippingRateRule[] = [
  { id: 11, zoneCode: "peninsular", minWeightGrams: 1, maxWeightGrams: 5000, amountSen: 650, isActive: 1 },
  { id: 12, zoneCode: "sabah", minWeightGrams: 1, maxWeightGrams: 5000, amountSen: 1300, isActive: 1 },
  { id: 13, zoneCode: "sarawak", minWeightGrams: 1, maxWeightGrams: 5000, amountSen: 1300, isActive: 1 },
];

test("normalizes five-digit Malaysian postcodes without removing leading zeroes", () => {
  assert.equal(normalizeMalaysiaPostcode(" 01000 "), "01000");
  assert.throws(() => normalizeMalaysiaPostcode("1000"), (error: unknown) =>
    error instanceof MalaysiaShippingError && error.code === "POSTCODE_INVALID");
});

test("uses inclusive gram bands and returns an immutable order quote snapshot", () => {
  const quote = quoteMalaysiaShipping({
    postcode: "50000",
    weightGrams: calculateCartWeightGrams([
      { unitWeightGrams: 1250, quantity: 2 },
      { unitWeightGrams: 500, quantity: 1 },
    ]),
    postcodeRanges,
    rateRules,
  });
  assert.deepEqual(quote, {
    zoneCode: "peninsular",
    rateRuleId: 11,
    amountSen: 650,
    postcode: "50000",
    weightGrams: 3000,
    stateCode: null,
  });
  assert.equal(Object.isFrozen(quote), true);
  assert.equal(quoteMalaysiaShipping({ postcode: "91309", weightGrams: 5000, postcodeRanges, rateRules }).zoneCode, "sabah");
});

test("re-quotes an existing multi-line order from persisted quantities and weights", async () => {
  const database = {
    prepare(sql: string) {
      const statement = {
        bind() { return statement; },
        async all() {
          assert.match(sql, /FROM order_items oi/);
          return { results: [
            { unitWeightGrams: 700, quantity: 2 },
            { unitWeightGrams: 300, quantity: 1 },
          ] };
        },
      };
      return statement;
    },
    async batch() {
      return [
        { results: [{ state: "Johor" }] },
        { results: postcodeRanges },
        { results: [
          { id: 41, zoneCode: "peninsular", stateCode: null, minWeightGrams: 1001, maxWeightGrams: 2000, amountSen: 900, isActive: 1 },
          { id: 42, zoneCode: "peninsular", stateCode: "johor", minWeightGrams: 1001, maxWeightGrams: 2000, amountSen: 950, isActive: 1 },
        ] },
      ];
    },
  } as unknown as D1Database;

  const quote = await quoteMalaysiaOrderShippingFromD1(database, { orderId: 7, postcode: "80000" });
  assert.equal(quote.weightGrams, 1700);
  assert.equal(quote.rateRuleId, 42);
  assert.equal(quote.amountSen, 950);
});

test("prefers a matching state rate and keeps the broad zone rate as fallback", () => {
  const tieredRates: MalaysiaShippingRateRule[] = [
    { id: 31, zoneCode: "peninsular", minWeightGrams: 1, maxWeightGrams: 1000, amountSen: 800, isActive: 1 },
    { id: 32, zoneCode: "peninsular", minWeightGrams: 1001, maxWeightGrams: 2000, amountSen: 900, isActive: 1 },
  ];
  const stateRate: MalaysiaShippingRateRule = {
    id: 21,
    zoneCode: "peninsular",
    stateCode: "johor",
    minWeightGrams: 1,
    maxWeightGrams: 1000,
    amountSen: 850,
    isActive: 1,
  };
  assert.equal(quoteMalaysiaShipping({
    postcode: "80000",
    weightGrams: 500,
    stateCode: "johor",
    postcodeRanges,
    rateRules: [...tieredRates, stateRate],
  }).amountSen, 850);
  assert.equal(quoteMalaysiaShipping({
    postcode: "80000",
    weightGrams: 1500,
    stateCode: "johor",
    postcodeRanges,
    rateRules: [...tieredRates, stateRate],
  }).amountSen, 900);
  assert.equal(quoteMalaysiaShipping({
    postcode: "50000",
    weightGrams: 500,
    stateCode: "kuala_lumpur",
    postcodeRanges,
    rateRules: [...tieredRates, stateRate],
  }).amountSen, 800);
});

test("refuses malformed, unmapped, unpriced and overlapping shipping policy", () => {
  const expectCode = (fn: () => unknown, code: MalaysiaShippingError["code"]) =>
    assert.throws(fn, (error: unknown) => error instanceof MalaysiaShippingError && error.code === code);

  expectCode(() => quoteMalaysiaShipping({ postcode: "99999", weightGrams: 500, postcodeRanges, rateRules }), "POSTCODE_UNMAPPED");
  expectCode(() => quoteMalaysiaShipping({ postcode: "87010", weightGrams: 500, postcodeRanges, rateRules }), "RATE_UNAVAILABLE");
  expectCode(() => quoteMalaysiaShipping({ postcode: "50000", weightGrams: 5001, postcodeRanges, rateRules }), "RATE_UNAVAILABLE");
  expectCode(() => quoteMalaysiaShipping({
    postcode: "50000", weightGrams: 500, rateRules,
    postcodeRanges: [...postcodeRanges, { id: 5, zoneCode: "sabah", postcodeStart: "50000", postcodeEnd: "50001", isActive: 1 }],
  }), "POSTCODE_RANGE_OVERLAP");
  expectCode(() => quoteMalaysiaShipping({
    postcode: "50000", weightGrams: 500, postcodeRanges,
    rateRules: [...rateRules, { id: 14, zoneCode: "peninsular", minWeightGrams: 1, maxWeightGrams: 1000, amountSen: 700, isActive: 1 }],
  }), "RATE_RULE_OVERLAP");
});
