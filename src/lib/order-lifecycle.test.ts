import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after, before } from "node:test";
import { getPlatformProxy, type PlatformProxy } from "wrangler";
import {
  applyOrderLifecycleMutation,
  deleteOrdersRestoringStock,
  type OrderLifecycleState,
} from "./order-lifecycle.ts";
import {
  DuplicateSubmissionError,
  OrderInputError,
  persistOrder,
  type PersistOrderInput,
} from "./order-persistence.ts";
import { splitMigrationStatements } from "./schema-version.ts";

type TestEnv = { OMS_DB: D1Database };

let platform: PlatformProxy<TestEnv>;
let database: D1Database;
let platformDirectory = "";

before(async () => {
  platformDirectory = mkdtempSync(join(tmpdir(), "mybookcms-order-d1-"));
  const configPath = join(platformDirectory, "wrangler.jsonc");
  writeFileSync(configPath, JSON.stringify({
    name: "mybookcms-order-integration",
    compatibility_date: "2026-08-01",
    d1_databases: [{
      binding: "OMS_DB",
      database_name: "order-integration",
      database_id: "00000000-0000-4000-8000-000000000001",
    }],
  }));
  platform = await getPlatformProxy<TestEnv>({
    configPath,
    envFiles: [],
    persist: false,
    remoteBindings: false,
  });
  database = platform.env.OMS_DB;

  const migrationsDirectory = new URL("../db/migrations/", import.meta.url);
  for (const file of readdirSync(migrationsDirectory).sort()) {
    if (!file.endsWith(".sql")) continue;
    const sql = readFileSync(new URL(file, migrationsDirectory), "utf8");
    await database.batch(
      splitMigrationStatements(sql).map((statement) => database.prepare(statement)),
    );
  }

  await database.batch([
    database
      .prepare("INSERT INTO stores (id, name, slug, created_at) VALUES (?, ?, ?, ?)")
      .bind(1, "Order Integration Store", "order-integration", "2026-08-25T00:00:00.000Z"),
    database
      .prepare(
        "INSERT INTO products (id, store_id, title, slug, is_active, created_at) VALUES (?, ?, ?, ?, 1, ?)",
      )
      .bind(10001, 1, "Jurnal Integrasi", "jurnal-integrasi", "2026-08-25T00:00:00.000Z"),
  ]);
});

after(async () => {
  await platform?.dispose();
  if (platformDirectory) {
    rmSync(platformDirectory, { recursive: true, force: true });
  }
});

async function seedVariant(id: number, stock: number) {
  await database
    .prepare(
      "INSERT INTO product_variants (id, product_id, sku, title, price, weight_grams, stock) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(id, 10001, `SKU-${id}`, `Varian ${id}`, 3290, 500, stock)
    .run();
}

function orderInput(variantId: number, submitToken: string): PersistOrderInput {
  return {
    submitToken,
    customerName: "Aina Rahman",
    customerPhone: "60123456789",
    customerEmail: "aina@example.com",
    address: "12 Jalan Buku, Taman Fokus",
    province: "Johor",
    city: "Johor Bahru",
    district: "Johor Bahru",
    postalCode: "80000",
    variantKey: String(variantId),
    quantity: 1,
    shippingCost: 800,
    paymentMethod: "cod",
  };
}

async function loadStock(variantId: number) {
  const row = await database
    .prepare("SELECT stock FROM product_variants WHERE id = ?")
    .bind(variantId)
    .first<{ stock: number }>();
  return row?.stock;
}

async function loadLifecycle(orderId: number) {
  const row = await database
    .prepare(
      "SELECT id, payment_method, payment_status, shipping_status, stock_restored_at FROM orders WHERE id = ?",
    )
    .bind(orderId)
    .first<OrderLifecycleState>();
  assert.ok(row);
  return row;
}

test("real D1 rejects a duplicate submission without duplicating stock or order rows", async () => {
  const variantId = 21001;
  const token = "duplicate-order-token-21001";
  await seedVariant(variantId, 2);

  await persistOrder(database, orderInput(variantId, token));
  await assert.rejects(
    persistOrder(database, orderInput(variantId, token)),
    DuplicateSubmissionError,
  );

  const orderCount = await database
    .prepare("SELECT COUNT(*) AS count FROM orders WHERE submit_token = ?")
    .bind(token)
    .first<{ count: number }>();
  const itemCount = await database
    .prepare(
      "SELECT COUNT(*) AS count FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.submit_token = ?",
    )
    .bind(token)
    .first<{ count: number }>();
  assert.equal(orderCount?.count, 1);
  assert.equal(itemCount?.count, 1);
  assert.equal(await loadStock(variantId), 1);
});

test("real D1 rolls back the losing oversell submission", async () => {
  const variantId = 21002;
  await seedVariant(variantId, 1);

  const outcomes = await Promise.allSettled([
    persistOrder(database, orderInput(variantId, "oversell-order-token-a")),
    persistOrder(database, orderInput(variantId, "oversell-order-token-b")),
  ]);
  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
  const rejected = outcomes.find((outcome) => outcome.status === "rejected");
  assert.ok(rejected?.status === "rejected");
  assert.ok(rejected.reason instanceof OrderInputError);

  const persisted = await database
    .prepare(
      "SELECT COUNT(*) AS orders_count, COALESCE(SUM(oi.quantity), 0) AS item_quantity FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id WHERE o.submit_token IN (?, ?)",
    )
    .bind("oversell-order-token-a", "oversell-order-token-b")
    .first<{ orders_count: number; item_quantity: number }>();
  assert.equal(persisted?.orders_count, 1);
  assert.equal(persisted?.item_quantity, 1);
  assert.equal(await loadStock(variantId), 0);
});

test("real D1 restores terminal-order stock exactly once", async () => {
  const variantId = 21003;
  await seedVariant(variantId, 1);
  const order = await persistOrder(
    database,
    orderInput(variantId, "terminal-order-token-21003"),
  );
  assert.equal(await loadStock(variantId), 0);

  const first = await applyOrderLifecycleMutation(
    database,
    await loadLifecycle(order.id),
    { shippingStatus: "cancelled" },
    database
      .prepare("UPDATE orders SET shipping_status = 'cancelled' WHERE id = ?")
      .bind(order.id),
  );
  assert.equal(first.updated, true);
  assert.equal(first.stockRestored, true);
  assert.equal(await loadStock(variantId), 1);

  const second = await applyOrderLifecycleMutation(
    database,
    await loadLifecycle(order.id),
    { shippingStatus: "cancelled" },
    database
      .prepare("UPDATE orders SET shipping_status = 'cancelled' WHERE id = ?")
      .bind(order.id),
  );
  assert.equal(second.stockRestored, false);
  assert.equal(await loadStock(variantId), 1);
});

test("real D1 delete restores reserved stock exactly once", async () => {
  const variantId = 21004;
  await seedVariant(variantId, 2);
  const order = await persistOrder(
    database,
    orderInput(variantId, "delete-order-token-21004"),
  );
  assert.equal(await loadStock(variantId), 1);

  assert.deepEqual(await deleteOrdersRestoringStock(database, [order.id]), [
    { id: order.id, order_number: order.orderNumber },
  ]);
  assert.equal(await loadStock(variantId), 2);
  assert.deepEqual(await deleteOrdersRestoringStock(database, [order.id]), []);
  assert.equal(await loadStock(variantId), 2);
});
