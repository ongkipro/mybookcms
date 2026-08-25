import assert from "node:assert/strict";
import test from "node:test";
import { resolveAdminOrderDeliveryPatch } from "./admin-order-delivery.ts";

test("admin destination change resolves trusted Malaysia fields and an atomic MYR total update", async () => {
  const database = {
    prepare(sql: string) {
      const statement = {
        bind() { return statement; },
        async first() {
          assert.match(sql, /FROM malaysia_postcodes p/);
          return { id: 88, state: "Johor", city: "Johor Bahru", postcode: "80000", zoneCode: "peninsular", zoneName: "Semenanjung" };
        },
        async all() {
          assert.match(sql, /FROM order_items oi/);
          return { results: [{ unitWeightGrams: 350, quantity: 2 }] };
        },
      };
      return statement;
    },
    async batch() {
      return [
        { results: [{ state: "Johor" }] },
        { results: [{ id: 1, zoneCode: "peninsular", postcodeStart: "01000", postcodeEnd: "86999", isActive: 1 }] },
        { results: [{ id: 22, zoneCode: "peninsular", stateCode: "johor", minWeightGrams: 1, maxWeightGrams: 1000, amountSen: 850, isActive: 1 }] },
      ];
    },
  } as unknown as D1Database;

  const patch = await resolveAdminOrderDeliveryPatch(database, {
    orderId: 7,
    address: "12 Jalan Sutera, Taman Sutera",
    locationId: 88,
    shippingCostSen: 900,
  });
  assert.deepEqual(patch.assignments.slice(0, 8), [
    "address = ?", "district = ?", "city = ?", "province = ?", "postal_code = ?",
    "shipping_zone_code = ?", "shipping_rate_rule_id = ?", "shipping_amount_sen = ?",
  ]);
  assert.match(patch.assignments.at(-1) || "", /total_amount = MAX/);
  assert.deepEqual(patch.values.slice(0, 9), [
    "12 Jalan Sutera, Taman Sutera", "Johor Bahru", "Johor Bahru", "Johor", "80000",
    "peninsular", 22, 900, 900,
  ]);
  assert.equal(patch.values.at(-1), 900);
});
