import assert from "node:assert/strict";
import test from "node:test";
import { POST as updateOrderQueue } from "../pages/api/admin/orders/index.ts";
import { GET as getShipping, PATCH as updateShipping } from "../pages/api/admin/shipping.ts";

function requestContext(database: D1Database, path: string, method = "GET", body?: unknown) {
  return {
    locals: { runtimeEnv: { OMS_DB: database } },
    url: new URL(`https://store.example${path}`),
    request: new Request(`https://store.example${path}`, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  } as never;
}

test("a valid COD order enters the local shipping queue without changing fulfilment status", async () => {
  const queries: Array<{ sql: string; values: unknown[] }> = [];
  const candidate = {
    id: 3,
    order_number: "INV-10003",
    payment_method: "cod",
    payment_status: "unpaid",
    shipping_status: "pending",
    shipping_queued_at: null,
    city: "Johor Bahru",
    province: "Johor",
    postal_code: "80000",
    shipping_zone_code: "peninsular",
    shipping_amount_sen: 650,
    courier_code: null,
    cnote_no: null,
  };
  const database = {
    prepare(sql: string) {
      const entry = { sql, values: [] as unknown[] };
      queries.push(entry);
      const statement = {
        bind(...values: unknown[]) { entry.values = values; return statement; },
        async all() { return { results: [candidate] }; },
      };
      return statement;
    },
    async batch(statements: unknown[]) {
      assert.equal(statements.length, 1);
      return [{ meta: { changes: 1 } }];
    },
  } as unknown as D1Database;

  const response = await updateOrderQueue(requestContext(database, "/api/admin/orders", "POST", {
    order_ids: [3],
    queued: true,
  }));
  assert.equal(response.status, 200);
  const payload = await response.json() as Record<string, unknown>;
  assert.equal(payload.updated_count, 1);
  assert.equal(payload.failed_count, 0);
  const update = queries.find((entry) => entry.sql.includes("UPDATE orders SET shipping_queued_at"));
  assert.ok(update);
  assert.doesNotMatch(update.sql, /SET\s+shipping_status/i);
});

test("queue membership is independent from payment, status, address, and legacy evidence", async () => {
  let batchCalls = 0;
  const rows = [
    {
      id: 4, order_number: "INV-10004", payment_method: "manual_transfer",
      payment_status: "pending", shipping_status: "pending", shipping_queued_at: null,
      city: "Kuching", province: "Sarawak", postal_code: "93000",
      shipping_zone_code: "sarawak", shipping_amount_sen: 1300,
      courier_code: null, cnote_no: null,
    },
    {
      id: 5, order_number: "INV-10005", payment_method: "cod",
      payment_status: "unpaid", shipping_status: "processing", shipping_queued_at: "2026-08-23 12:00:00",
      city: "Kuantan", province: "Pahang", postal_code: "25000",
      shipping_zone_code: "peninsular", shipping_amount_sen: 650,
      courier_code: "Pos Laju", cnote_no: null,
    },
  ];
  const databaseFor = (row: (typeof rows)[number]) => ({
    prepare() {
      const statement = { bind() { return statement; }, async all() { return { results: [row] }; } };
      return statement;
    },
    async batch() { batchCalls += 1; return [{ meta: { changes: 1 } }]; },
  }) as unknown as D1Database;

  const unpaid = await updateOrderQueue(requestContext(databaseFor(rows[0]), "/api/admin/orders", "POST", { order_ids: [4], queued: true }));
  assert.equal((await unpaid.json() as { failed_count: number }).failed_count, 0);
  const processed = await updateOrderQueue(requestContext(databaseFor(rows[1]), "/api/admin/orders", "POST", { order_ids: [5], queued: false }));
  assert.equal((await processed.json() as { failed_count: number }).failed_count, 0);
  assert.equal(batchCalls, 2);
});

test("shipping CSV exports the filtered local queue and neutralizes spreadsheet formulas", async () => {
  const prepared: Array<{ sql: string; values: unknown[] }> = [];
  const row = {
    id: 3, orderNumber: "INV-10003", customerName: "=HYPERLINK(\"bad\")",
    customerPhone: "60123456789", address: "12 Jalan Demo", district: "Johor Bahru",
    city: "Johor Bahru", province: "Johor", postcode: "80000",
    shippingStatus: "pending", paymentMethod: "cod", paymentStatus: "unpaid",
    totalAmount: 3140, shippingCost: 650, shippingZoneCode: "peninsular",
    locationId: 1,
    items: "Jurnal Fokus Harian - A5 x1", totalQuantity: 1, totalWeightGrams: 350,
    createdAt: "2026-08-23T09:12:00.000Z", queuedAt: "2026-08-23 12:00:00",
  };
  const database = {
    prepare(sql: string) {
      const entry = { sql, values: [] as unknown[] };
      prepared.push(entry);
      const statement = {
        bind(...values: unknown[]) { entry.values = values; return statement; },
        async all() { return { results: [row] }; },
      };
      return statement;
    },
  } as unknown as D1Database;

  const response = await getShipping(requestContext(database, "/api/admin/shipping?format=csv&status=pending&q=Johor"));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /^text\/csv/);
  assert.match(response.headers.get("content-disposition") || "", /mybookcms-pengiriman-\d{4}-\d{2}-\d{2}\.csv/);
  assert.equal(response.headers.get("x-export-count"), "1");
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
  const csv = new TextDecoder().decode(bytes);
  assert.match(csv, /"'=HYPERLINK\(""bad""\)"/);
  assert.match(csv, /"31\.40","peninsular","6\.50"/);
  assert.doesNotMatch(csv.split("\r\n")[0], /courier|service|tracking/i);
  assert.match(prepared[0].sql, /shipping_queued_at IS NOT NULL/);
  assert.deepEqual(prepared[0].values, ["pending", "%Johor%", "%Johor%", "%Johor%", "%Johor%", "%Johor%", "%Johor%"]);
});

test("shipping updates refuse orders outside the local shipping queue", async () => {
  let updates = 0;
  const database = {
    prepare(_sql: string) {
      const statement = {
        bind() { return statement; },
        async first() {
          return {
            id: 9, payment_method: "cod", payment_status: "unpaid", shipping_status: "pending",
            stock_restored_at: null, shipping_queued_at: null,
          };
        },
        async run() { updates += 1; return { meta: { changes: 1 } }; },
      };
      return statement;
    },
  } as unknown as D1Database;
  const response = await updateShipping(requestContext(database, "/api/admin/shipping", "PATCH", {
    orderId: 9,
    shippingStatus: "processing",
  }));
  assert.equal(response.status, 409);
  assert.equal(updates, 0);
});

test("queued order status saves without courier or tracking evidence", async () => {
  const sql: string[] = [];
  const database = {
    prepare(query: string) {
      sql.push(query);
      const statement = {
        bind() { return statement; },
        async first() {
          return {
            id: 10, payment_method: "cod", payment_status: "unpaid",
            shipping_status: "processing", stock_restored_at: null,
            shipping_queued_at: "2026-08-24 09:00:00",
          };
        },
      };
      return statement;
    },
    async batch(statements: unknown[]) {
      assert.equal(statements.length, 1);
      return [{ meta: { changes: 1 } }];
    },
  } as unknown as D1Database;

  const response = await updateShipping(requestContext(database, "/api/admin/shipping", "PATCH", {
    orderId: 10,
    shippingStatus: "shipped",
  }));
  assert.equal(response.status, 200);
  const update = sql.find((query) => query.includes("UPDATE orders")) || "";
  assert.match(update, /shipping_status = \?/);
  assert.doesNotMatch(update, /courier|cnote|tracking/i);
});
