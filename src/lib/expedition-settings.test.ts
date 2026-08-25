import assert from "node:assert/strict";
import test from "node:test";
import { PATCH, POST } from "../pages/api/admin/expeditions.ts";

function createDatabase(options: { overlap?: boolean; zoneCode?: string } = {}) {
  const statements: Array<{ query: string; values: unknown[] }> = [];
  const database = {
    prepare(query: string) {
      const entry = { query, values: [] as unknown[] };
      statements.push(entry);
      const statement = {
        bind(...values: unknown[]) {
          entry.values = values;
          return statement;
        },
        async first() {
          return query.includes("FROM shipping_zones") ? { id: 2, code: options.zoneCode || "peninsular" } : null;
        },
        async run() {
          if (options.overlap && query.includes("UPDATE shipping_postcode_ranges")) {
            throw new Error("D1_ERROR: active shipping postcode ranges overlap");
          }
          return { meta: { changes: 1, last_row_id: 17 } };
        },
      };
      return statement;
    },
  } as unknown as D1Database;
  return { database, statements };
}

function context(database: D1Database, method: "POST" | "PATCH", body: Record<string, unknown>) {
  return {
    locals: { runtimeEnv: { OMS_DB: database } },
    request: new Request("https://store.example/api/admin/expeditions", {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  } as never;
}

test("a new Malaysia postcode range is always created inactive", async () => {
  const { database, statements } = createDatabase();
  const response = await POST(context(database, "POST", {
    kind: "postcode",
    zoneId: 2,
    postcodeStart: "87000",
    postcodeEnd: "87033",
  }));
  assert.equal(response.status, 201);
  const insert = statements.find((entry) => entry.query.includes("INSERT INTO shipping_postcode_ranges"));
  assert.deepEqual(insert?.values, [2, "87000", "87033"]);
  assert.match(insert?.query || "", /VALUES \(\?, \?, \?, 0\)/);
});

test("state rates are stored only under their canonical fallback zone", async () => {
  const valid = createDatabase();
  const validResponse = await POST(context(valid.database, "POST", {
    kind: "rate",
    zoneId: 2,
    stateCode: "johor",
    minWeightGrams: 5001,
    maxWeightGrams: 10000,
    amountSen: 900,
    isActive: false,
  }));
  assert.equal(validResponse.status, 201);
  const insert = valid.statements.find((entry) => entry.query.includes("INSERT INTO shipping_rate_rules"));
  assert.deepEqual(insert?.values, [2, 5001, 10000, 900, 0, "johor"]);

  const mismatch = createDatabase();
  const mismatchResponse = await POST(context(mismatch.database, "POST", {
    kind: "rate",
    zoneId: 2,
    stateCode: "sabah",
    minWeightGrams: 5001,
    maxWeightGrams: 10000,
    amountSen: 1500,
    isActive: false,
  }));
  assert.equal(mismatchResponse.status, 400);
  assert.match(JSON.stringify(await mismatchResponse.json()), /tidak cocok/);
});

test("postcode range mutations reject malformed or overlapping active policy", async () => {
  const invalid = createDatabase();
  const invalidResponse = await POST(context(invalid.database, "POST", {
    kind: "postcode",
    zoneId: 1,
    postcodeStart: "900",
    postcodeEnd: "800",
  }));
  assert.equal(invalidResponse.status, 400);
  assert.equal(invalid.statements.length, 0);

  const overlap = createDatabase({ overlap: true });
  const overlapResponse = await PATCH(context(overlap.database, "PATCH", {
    kind: "postcode",
    id: 4,
    zoneId: 2,
    postcodeStart: "86000",
    postcodeEnd: "88000",
    isActive: true,
  }));
  assert.equal(overlapResponse.status, 409);
  assert.match(JSON.stringify(await overlapResponse.json()), /bertindih/);
});
