import assert from "node:assert/strict";
import test from "node:test";
import { persistOrder, type PersistOrderInput } from "./order-persistence.ts";

class Statement {
  readonly sql: string;
  readonly database: FakeDatabase;
  readonly values: unknown[];

  constructor(sql: string, database: FakeDatabase, values: unknown[] = []) {
    this.sql = sql;
    this.database = database;
    this.values = values;
  }

  bind(...values: unknown[]) {
    return new Statement(this.sql, this.database, values);
  }

  async first<T>() {
    if (/FROM product_variants/.test(this.sql)) {
      return {
        id: 20001,
        product_id: 10001,
        price: 3290,
        stock: 8,
        title: "Jurnal Fokus Harian",
      } as T;
    }
    if (/SELECT id FROM stores/.test(this.sql)) return { id: 1 } as T;
    if (/UPDATE order_number_counters/.test(this.sql)) return { last_value: 10001 } as T;
    throw new Error(`Unexpected first query: ${this.sql}`);
  }

  async run() {
    if (/INSERT OR IGNORE INTO notifications/.test(this.sql)) {
      return { meta: { changes: 1 } };
    }
    throw new Error(`Unexpected run query: ${this.sql}`);
  }
}

class FakeDatabase {
  batchStatements: Statement[] = [];

  prepare(sql: string) {
    return new Statement(sql, this);
  }

  async batch(statements: Statement[]) {
    this.batchStatements = statements;
    return statements.map((statement) =>
      /SELECT id FROM orders/.test(statement.sql)
        ? { results: [{ id: 7 }], meta: { changes: 0 } }
        : { results: [], meta: { changes: 1 } });
  }
}

const input: PersistOrderInput = {
  submitToken: "accepted-order-token-1234",
  customerName: "Aina Rahman",
  customerPhone: "60123456789",
  customerEmail: "aina@example.com",
  address: "12 Jalan Buku, Taman Fokus",
  province: "Johor",
  city: "Johor Bahru",
  district: "Johor Bahru",
  postalCode: "80000",
  variantKey: "20001",
  quantity: 1,
  shippingCost: 800,
  paymentMethod: "cod",
  shippingZoneCode: "peninsular",
  shippingRateRuleId: 41,
  shippingAmountSen: 800,
  adClickIds: JSON.stringify({
    _fbp: "fb.1.1720000000000.browser123",
    _fbc: "fb.1.1720000000000.click123",
  }),
  metaPurchase: {
    eventSourceUrl: "https://store.example/produk/jurnal-fokus-harian",
    clientIp: "203.0.113.10",
    userAgent: "MyBookCMS test agent",
  },
};

test("accepted order and configured Meta Purchase share one D1 batch", async () => {
  const database = new FakeDatabase();
  const order = await persistOrder(database as unknown as D1Database, input);

  assert.equal(order.orderNumber, "INV-10001");
  const outbox = database.batchStatements.find((statement) =>
    /INSERT INTO capi_event_outbox/.test(statement.sql));
  assert.ok(outbox, "Purchase outbox insert must be part of the order batch");
  assert.equal(database.batchStatements.at(-1)?.sql.includes("SELECT id FROM orders"), true);
  assert.equal(outbox.values[0], "purchase:INV-10001");

  const payload = JSON.parse(String(outbox.values[1])) as {
    data: Array<{
      event_name: string;
      event_id: string;
      user_data: Record<string, unknown>;
      custom_data: Record<string, unknown>;
    }>;
  };
  assert.equal(payload.data[0]?.event_name, "Purchase");
  assert.equal(payload.data[0]?.event_id, "purchase:INV-10001");
  assert.deepEqual(payload.data[0]?.custom_data.content_ids, ["p10001-v20001"]);
  assert.equal(payload.data[0]?.custom_data.value, 32.9);
  assert.equal(payload.data[0]?.custom_data.currency, "MYR");
  assert.equal(payload.data[0]?.custom_data.order_id, "INV-10001");
  assert.equal(payload.data[0]?.user_data.fbp, "fb.1.1720000000000.browser123");
  assert.equal(payload.data[0]?.user_data.fbc, "fb.1.1720000000000.click123");
});

test("order persistence omits Meta outbox without configured signal context", async () => {
  const database = new FakeDatabase();
  await persistOrder(database as unknown as D1Database, {
    ...input,
    metaPurchase: undefined,
  });
  assert.equal(
    database.batchStatements.some((statement) => /capi_event_outbox/.test(statement.sql)),
    false,
  );
});
