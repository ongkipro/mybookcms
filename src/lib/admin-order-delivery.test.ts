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
    role: "owner",
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

test("a direct shipping amount is refused for roles that may not set one", async () => {
  // An independent review found the first version of this rule guarded only
  // `PATCH /api/admin/orders/[id]`, leaving the identical write reachable
  // through `PATCH /api/admin/shipping` — a route customer service also holds,
  // two clicks away in its own UI. The rule lives in this shared helper now, so
  // every caller inherits it.
  const database = {
    prepare() {
      return { bind() { return this; }, async first() { return null; }, async all() { return { results: [] }; } };
    },
  } as unknown as D1Database;

  for (const role of ["customer_service", "advertiser", undefined] as const) {
    const patch = await resolveAdminOrderDeliveryPatch(database, {
      orderId: 7,
      shippingCostSen: 0,
      role,
    });
    assert.equal(patch.shippingCostRefused, true, `${role} must not set an amount`);
    assert.deepEqual(patch.assignments, [], `${role} must produce no money write`);
    assert.deepEqual(patch.values, []);
  }

  for (const role of ["owner", "admin"] as const) {
    const patch = await resolveAdminOrderDeliveryPatch(database, {
      orderId: 7,
      shippingCostSen: 0,
      role,
    });
    assert.equal(patch.shippingCostRefused, false, `${role} may set an amount`);
    assert.ok(patch.assignments.includes("shipping_cost = ?"));
    assert.ok(patch.values.includes(0));
  }
});

test("an address-only correction stays open to every admin role", async () => {
  // The regression risk. Correcting a wrong address is the work customer
  // service exists to do, so the guard must not reach it.
  const database = {
    prepare() {
      return { bind() { return this; }, async first() { return null; }, async all() { return { results: [] }; } };
    },
  } as unknown as D1Database;

  for (const role of ["owner", "admin", "advertiser", "customer_service"] as const) {
    const patch = await resolveAdminOrderDeliveryPatch(database, {
      orderId: 7,
      address: "88 Jalan Betul, Kuala Lumpur",
      role,
    });
    assert.equal(patch.shippingCostRefused, false);
    assert.deepEqual(patch.assignments, ["address = ?"], `${role} should still correct an address`);
  }
});
