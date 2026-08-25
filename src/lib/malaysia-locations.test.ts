import assert from "node:assert/strict";
import test from "node:test";
import {
  MalaysiaLocationError,
  resolveMalaysiaLocation,
  searchMalaysiaLocations,
} from "./malaysia-locations.ts";

function fakeDatabase(rows: Record<string, unknown>[]) {
  const statements: Array<{ query: string; values: unknown[] }> = [];
  const database = {
    prepare(query: string) {
      const entry = { query, values: [] as unknown[] };
      statements.push(entry);
      const statement = {
        bind(...values: unknown[]) { entry.values = values; return statement; },
        async all() { return { results: rows }; },
        async first() { return rows[0] ?? null; },
      };
      return statement;
    },
  } as unknown as D1Database;
  return { database, statements };
}

const johor = {
  id: 41,
  state: "Johor",
  city: "Johor Bahru",
  postcode: "80000",
  zoneCode: "peninsular",
  zoneName: "Peninsular Malaysia",
};

test("location search requires a complete postcode or three text characters", async () => {
  const { database, statements } = fakeDatabase([johor]);
  assert.deepEqual(await searchMalaysiaLocations(database, "80"), []);
  assert.deepEqual(await searchMalaysiaLocations(database, "Jo"), []);
  assert.equal(statements.length, 0);
});

test("location search returns only D1-backed shippable city, state, and postcode rows", async () => {
  const { database, statements } = fakeDatabase([johor]);
  assert.deepEqual(await searchMalaysiaLocations(database, "Johor"), [johor]);
  assert.match(statements[0].query, /malaysia_postcodes/);
  assert.match(statements[0].query, /shipping_postcode_ranges/);
  assert.equal(statements[0].values.at(-1), 10);
});

test("selected location resolution rejects invalid ids and returns the canonical D1 row", async () => {
  const { database, statements } = fakeDatabase([johor]);
  await assert.rejects(() => resolveMalaysiaLocation(database, "bad"), (error: unknown) =>
    error instanceof MalaysiaLocationError && error.code === "LOCATION_INVALID");
  assert.deepEqual(await resolveMalaysiaLocation(database, 41), johor);
  assert.deepEqual(statements[0].values, [41]);

  const missing = fakeDatabase([]);
  await assert.rejects(() => resolveMalaysiaLocation(missing.database, 99), (error: unknown) =>
    error instanceof MalaysiaLocationError && error.code === "LOCATION_UNAVAILABLE");
});
