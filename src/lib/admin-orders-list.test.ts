import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../pages/api/admin/orders/index.ts";

test("admin order list supports an unfiltered request without emitting an empty WHERE", async () => {
  const preparedQueries: string[] = [];
  const database = {
    prepare(query: string) {
      preparedQueries.push(query);
      return {
        bind() { return this; },
        async all() { return { results: [] }; },
      };
    },
    async batch(statements: Array<{ all: () => Promise<{ results: unknown[] }> }>) {
      return Promise.all(statements.map((statement) => statement.all()));
    },
  } as unknown as D1Database;

  const response = await GET({
    locals: { runtimeEnv: { OMS_DB: database } },
    url: new URL("https://store.example/api/admin/orders"),
  } as never);

  assert.equal(response.status, 200);
  const listQuery = preparedQueries.find((query) => /FROM orders o[\s\S]+ORDER BY o\.id DESC/i.test(query)) || "";
  assert.doesNotMatch(listQuery, /WHERE\s+ORDER/i);
  assert.match(listQuery, /FROM orders o[\s\S]+ORDER BY o\.id DESC/i);
});

test("admin order list exposes counts using the same operational status taxonomy as the table", async () => {
  const database = {
    prepare(query: string) {
      return {
        bind() { return this; },
        async all() {
          if (query.includes("GROUP BY operational_status")) {
            return { results: [
              { operational_status: "new", count: 2 },
              { operational_status: "queued", count: 3 },
              { operational_status: "cancelled", count: 1 },
            ] };
          }
          if (query.includes("COUNT(*) AS total_orders")) {
            return { results: [{ total_orders: 6, unpaid_count: 3, fulfilment_count: 3, total_value: 10000 }] };
          }
          return { results: [] };
        },
      };
    },
    async batch(statements: Array<{ all: () => Promise<{ results: unknown[] }> }>) {
      return Promise.all(statements.map((statement) => statement.all()));
    },
  } as unknown as D1Database;

  const response = await GET({
    locals: { runtimeEnv: { OMS_DB: database } },
    url: new URL("https://store.example/api/admin/orders?order_status=queued"),
  } as never);
  assert.equal(response.status, 200);
  const payload = await response.json() as { status_counts: Record<string, number> };
  assert.deepEqual(payload.status_counts, { all: 6, new: 2, queued: 3, cancelled: 1 });
});
