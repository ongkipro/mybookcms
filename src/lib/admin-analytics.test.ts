import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { GET } from "../pages/api/admin/analytics.ts";

type SqlValue = null | number | string | Uint8Array;

class TestStatement {
  private readonly database: DatabaseSync;
  private readonly sql: string;
  private readonly values: SqlValue[];

  constructor(
    database: DatabaseSync,
    sql: string,
    values: SqlValue[] = [],
  ) {
    this.database = database;
    this.sql = sql;
    this.values = values;
  }

  bind(...values: SqlValue[]) {
    return new TestStatement(this.database, this.sql, values);
  }

  async first<T>() {
    return (this.database.prepare(this.sql).get(...this.values) as T | undefined) ?? null;
  }

  async all<T>() {
    return {
      success: true,
      results: this.database.prepare(this.sql).all(...this.values) as T[],
      meta: { changes: 0, last_row_id: 0 },
    };
  }
}

function createAnalyticsDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE orders (
      id INTEGER PRIMARY KEY,
      total_amount INTEGER NOT NULL,
      -- collected_revenue nets these out; default 0 keeps every older
      -- fixture row meaning exactly what it meant.
      shipping_cost INTEGER NOT NULL DEFAULT 0,
      cod_service_fee INTEGER NOT NULL DEFAULT 0,
      cod_service_fee_vat INTEGER NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL,
      payment_status TEXT NOT NULL,
      shipping_status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  return {
    sqlite,
    d1: {
      prepare(sql: string) {
        return new TestStatement(sqlite, sql);
      },
    } as unknown as D1Database,
  };
}

test("admin analytics separates COD/manual transfer across persisted orders", async () => {
  const { sqlite, d1 } = createAnalyticsDatabase();
  const insert = sqlite.prepare(`
    INSERT INTO orders (id, total_amount, payment_method, payment_status, shipping_status, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  [
    [1, 100_000, "cod", "pending", "pending", "2026-08-17T18:00:00.000Z"],
    [2, 200_000, "manual_transfer", "pending", "pending", "2026-08-17T19:00:00.000Z"],
    [3, 300_000, "cod", "unpaid", "pending", "2026-08-17T20:00:00.000Z"],
    [4, 400_000, "manual_transfer", "pending", "pending", "2026-08-17T21:00:00.000Z"],
    [5, 900_000, "cod", "pending", "pending", "2026-08-17T22:00:00.000Z"],
  ].forEach((row) => insert.run(...row));

  const response = await GET({
    locals: { runtimeEnv: { OMS_DB: d1 } },
    url: new URL("https://cms.test/api/admin/analytics?startDate=2026-08-18&endDate=2026-08-18&interval=hour"),
  } as never);
  const payload = await response.json() as any;

  assert.equal(response.status, 200);
  assert.equal(payload.data.total_orders, 5);
  assert.equal(payload.data.total_revenue, 1_900_000);
  assert.deepEqual(payload.data.payment_methods, {
    total: 5,
    cod: { count: 3, percentage: 60 },
    manual_transfer: { count: 2, percentage: 40 },
    unknown_count: 0,
  });
  assert.equal(payload.data.period.interval, "hour");
  assert.equal(payload.data.trends.reduce((sum: number, point: { orders: number }) => sum + point.orders, 0), 5);
});

test("admin analytics supports the all-time dashboard request without an empty WHERE clause", async () => {
  const { sqlite, d1 } = createAnalyticsDatabase();
  sqlite.exec(`
    INSERT INTO orders (id, total_amount, payment_method, payment_status, shipping_status, created_at)
    VALUES (1, 2490, 'cod', 'unpaid', 'pending', '2026-08-23T00:00:00.000Z');
  `);
  const response = await GET({
    locals: { runtimeEnv: { OMS_DB: d1 } },
    url: new URL("https://cms.test/api/admin/analytics"),
  } as never);
  const payload = await response.json() as any;
  assert.equal(response.status, 200);
  assert.equal(payload.data.total_revenue, 2490);
  assert.equal(payload.data.total_orders, 1);
});

test("admin analytics reports unknown methods and prevents truncated multi-day hourly output", async () => {
  const { sqlite, d1 } = createAnalyticsDatabase();
  sqlite.exec(`
    INSERT INTO orders (id, total_amount, payment_method, payment_status, shipping_status, created_at) VALUES
      (1, 100000, 'legacy_wallet', 'pending', 'pending', '2026-08-17T18:00:00.000Z'),
      (2, 100000, 'cod', 'pending', 'pending', '2026-08-18T18:00:00.000Z');
  `);

  const response = await GET({
    locals: { runtimeEnv: { OMS_DB: d1 } },
    url: new URL("https://cms.test/api/admin/analytics?startDate=2026-08-18&endDate=2026-08-19&interval=hour"),
  } as never);
  const payload = await response.json() as any;

  assert.equal(payload.data.payment_methods.unknown_count, 1);
  assert.equal(payload.data.period.interval, "day");
  assert.equal(payload.data.trends.length, 2);
});

test("omset excludes cancelled and failed orders, and collected revenue counts paid only", async () => {
  const { sqlite, d1 } = createAnalyticsDatabase();
  const insert = sqlite.prepare(`
    INSERT INTO orders (id, total_amount, payment_method, payment_status, shipping_status, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  [
    [1, 100_000, "cod", "unpaid", "pending", "2026-08-17T18:00:00.000Z"],          // live, unpaid COD
    [2, 200_000, "manual_transfer", "paid", "pending", "2026-08-17T19:00:00.000Z"], // live, paid
    [3, 300_000, "manual_transfer", "failed", "pending", "2026-08-17T20:00:00.000Z"], // failed payment
    [4, 400_000, "cod", "unpaid", "cancelled", "2026-08-17T21:00:00.000Z"],        // cancelled
  ].forEach((row) => insert.run(...row));

  const response = await GET({
    locals: { runtimeEnv: { OMS_DB: d1 } },
    url: new URL("https://cms.test/api/admin/analytics?startDate=2026-08-18&endDate=2026-08-18&interval=hour"),
  } as never);
  const data = ((await response.json()) as any).data;

  // Before: 1.000.000 — every order, including the one that was cancelled and
  // the one whose payment failed, reported as "Pendapatan".
  assert.equal(data.total_revenue, 300_000);
  assert.equal(data.collected_revenue, 200_000);
  assert.equal(data.total_orders, 4);
  assert.equal(data.live_orders, 2);
});

test("manual transfer pending state is reported without retired online methods", async () => {
  const { sqlite, d1 } = createAnalyticsDatabase();
  const insert = sqlite.prepare(`
    INSERT INTO orders (id, total_amount, payment_method, payment_status, shipping_status, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  [
    [1, 100_000, "cod", "unpaid", "pending", "2026-08-17T18:00:00.000Z"],
    [2, 100_000, "cod", "unpaid", "pending", "2026-08-17T18:00:00.000Z"],
    [3, 100_000, "cod", "unpaid", "pending", "2026-08-17T18:00:00.000Z"],
    [4, 100_000, "manual_transfer", "paid", "pending", "2026-08-17T19:00:00.000Z"],
    [5, 100_000, "manual_transfer", "pending", "pending", "2026-08-17T19:00:00.000Z"],
  ].forEach((row) => insert.run(...row));

  const response = await GET({
    locals: { runtimeEnv: { OMS_DB: d1 } },
    url: new URL("https://cms.test/api/admin/analytics?startDate=2026-08-18&endDate=2026-08-18&interval=hour"),
  } as never);
  const data = ((await response.json()) as any).data;

  // Manual transfer remains a separately observable pending/paid payment path.
  assert.equal(data.payment_methods.manual_transfer.count, 2);
});

test("RTS is measured against shipments that reached an outcome, not every order", async () => {
  const { sqlite, d1 } = createAnalyticsDatabase();
  const insert = sqlite.prepare(`
    INSERT INTO orders (id, total_amount, payment_method, payment_status, shipping_status, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  [
    [1, 100_000, "cod", "unpaid", "pending", "2026-08-17T18:00:00.000Z"],   // never dispatched
    [2, 100_000, "cod", "unpaid", "pending", "2026-08-17T18:00:00.000Z"],
    [3, 100_000, "cod", "paid", "delivered", "2026-08-17T18:00:00.000Z"],
    [4, 100_000, "cod", "unpaid", "returned", "2026-08-17T19:00:00.000Z"],
  ].forEach((row) => insert.run(...row));

  const response = await GET({
    locals: { runtimeEnv: { OMS_DB: d1 } },
    url: new URL("https://cms.test/api/admin/analytics?startDate=2026-08-18&endDate=2026-08-18&interval=hour"),
  } as never);
  const data = ((await response.json()) as any).data;

  // Before: 1 returned / 4 orders = 25%, diluted by orders that were never
  // shipped. Now 1 returned / (1 delivered + 1 returned) = 50%.
  assert.equal(data.rts_base, 2);
  assert.equal(data.rts_rate, 50);
});

test("the trend bars sum to exactly the omset card — one released-order rule for both", async () => {
  const { sqlite, d1 } = createAnalyticsDatabase();
  const insert = sqlite.prepare(`
    INSERT INTO orders (id, total_amount, payment_method, payment_status, shipping_status, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  [
    [1, 100_000, "cod", "unpaid", "pending", "2026-08-17T18:00:00.000Z"],
    [2, 200_000, "manual_transfer", "paid", "pending", "2026-08-17T19:00:00.000Z"],
    [3, 300_000, "manual_transfer", "failed", "pending", "2026-08-17T20:00:00.000Z"],
    [4, 400_000, "cod", "unpaid", "cancelled", "2026-08-17T21:00:00.000Z"],
    [5, 500_000, "cod", "unpaid", "returned", "2026-08-17T22:00:00.000Z"],
  ].forEach((row) => insert.run(...row));

  const response = await GET({
    locals: { runtimeEnv: { OMS_DB: d1 } },
    url: new URL("https://cms.test/api/admin/analytics?startDate=2026-08-18&endDate=2026-08-18&interval=hour"),
  } as never);
  const data = ((await response.json()) as any).data;

  // The card and chart must read the same released-order predicate.
  // more than the number above them. Both now read one predicate.
  const barTotal = data.trends.reduce((sum: number, p: { revenue: number }) => sum + p.revenue, 0);
  assert.equal(data.total_revenue, 300_000);
  assert.equal(barTotal, data.total_revenue);
  // A returned (RTS) order gave its stock back and its COD money never came;
  // it is released in order-lifecycle.ts and must not count as omset.
  assert.equal(data.live_orders, 2);
});
