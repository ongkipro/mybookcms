import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after, before } from "node:test";
import { getPlatformProxy, type PlatformProxy } from "wrangler";
import {
  applyDokuPaymentFact,
  mapDokuNotificationStatus,
  type DokuNotificationFact,
} from "./doku-payment-lifecycle.ts";
import { persistOrder } from "./order-persistence.ts";
import { splitMigrationStatements } from "./schema-version.ts";

type TestEnv = { OMS_DB: D1Database };

let platform: PlatformProxy<TestEnv>;
let database: D1Database;
let platformDirectory = "";

before(async () => {
  platformDirectory = mkdtempSync(join(tmpdir(), "mybookcms-doku-lifecycle-"));
  const configPath = join(platformDirectory, "wrangler.jsonc");
  writeFileSync(configPath, JSON.stringify({
    name: "mybookcms-doku-lifecycle",
    compatibility_date: "2026-08-01",
    d1_databases: [{
      binding: "OMS_DB",
      database_name: "doku-lifecycle",
      database_id: "00000000-0000-4000-8000-000000000006",
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
    database.prepare(`
      INSERT INTO stores (id, name, slug, site_url, meta_pixel_id, created_at)
      VALUES (1, 'DOKU Lifecycle Store', 'doku-lifecycle',
        'https://shop.example', '1234567890', ?)
    `).bind(new Date().toISOString()),
    database.prepare(`
      INSERT INTO products (id, store_id, title, slug, is_active, created_at)
      VALUES (36000, 1, 'Jurnal Settlement', 'jurnal-settlement', 1, ?)
    `).bind(new Date().toISOString()),
    database.prepare(`
      INSERT INTO payment_provider_configs
        (id, store_id, provider, environment, enabled_channels_json,
          is_enabled, config_revision)
      VALUES (1, 1, 'doku', 'sandbox', '["INTERNET_BANKING_FPX"]', 1, 1)
    `),
  ]);
});

after(async () => {
  await platform?.dispose();
  if (platformDirectory) rmSync(platformDirectory, { recursive: true, force: true });
});

async function seedDokuOrder(variantId: number, suffix: string) {
  await database.prepare(`
    INSERT INTO product_variants
      (id, product_id, sku, title, price, weight_grams, stock)
    VALUES (?, 36000, ?, 'Hardback', 3290, 500, 5)
  `).bind(variantId, `SETTLE-${variantId}`).run();
  const attemptId = `attempt-${suffix}`;
  const merchantInvoice = `DOKU-${suffix}`;
  const persisted = await persistOrder(database, {
    submitToken: `submit-${suffix}`,
    customerName: "Nur Aisyah Rahman",
    customerPhone: "012-345 6789",
    customerEmail: "buyer@example.test",
    address: "12 Jalan Buku",
    province: "Johor",
    city: "Johor Bahru",
    district: "Johor Bahru",
    postalCode: "80000",
    variantKey: String(variantId),
    quantity: 2,
    shippingCost: 800,
    paymentMethod: "doku",
    adClickIds: JSON.stringify({
      _fbp: "fb.1.1700000000000.browser",
      _fbc: "fb.1.1700000000000.click",
      meta_external_id: "0123456789abcdef0123456789abcdef",
    }),
    dokuPaymentAttempt: {
      id: attemptId,
      providerConfigId: 1,
      environment: "sandbox",
      configRevision: 1,
      merchantInvoice,
      idempotencyKey: `idempotency-${suffix}`,
      requestFingerprint: `fingerprint-${suffix}`,
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    },
  });
  const providerReference = `provider-${suffix}`;
  await database.prepare(`
    UPDATE payment_attempts
    SET provider_reference = ?, local_status = 'pending', initiated_at = ?, updated_at = ?
    WHERE id = ?
  `).bind(providerReference, new Date().toISOString(), new Date().toISOString(), attemptId).run();
  return { ...persisted, attemptId, merchantInvoice, providerReference };
}

function paymentFact(
  order: Awaited<ReturnType<typeof seedDokuOrder>>,
  providerStatus: string,
  providerState: string,
  eventKey: string,
): DokuNotificationFact {
  return {
    providerReference: order.providerReference,
    merchantInvoice: order.merchantInvoice,
    amountSen: order.totalAmount,
    channel: "INTERNET_BANKING_FPX",
    providerStatus,
    providerState,
    eventKey,
  };
}

test("DOKU status mapping requires an unambiguous completed success", () => {
  assert.equal(mapDokuNotificationStatus({
    providerStatus: "SUCCESS",
    providerState: "COMPLETED",
  }), "paid");
  assert.equal(mapDokuNotificationStatus({
    providerStatus: "SUCCESS",
    providerState: "FAILED",
  }), "attention_required");
  assert.equal(mapDokuNotificationStatus({
    providerStatus: "FAILED",
    providerState: "COMPLETED",
  }), "attention_required");
});

test("known pending and terminal failures map without coercing unknown states", () => {
  assert.equal(mapDokuNotificationStatus({
    providerStatus: "PENDING",
    providerState: "INIT",
  }), "pending");
  assert.equal(mapDokuNotificationStatus({
    providerStatus: "FAILED",
    providerState: "FAILED",
  }), "failed");
  assert.equal(mapDokuNotificationStatus({
    providerStatus: "EXPIRED",
    providerState: "EXPIRED",
  }), "expired");
  assert.equal(mapDokuNotificationStatus({
    providerStatus: "PENDING",
    providerState: "WAITING_REVIEW",
  }), "attention_required");
  assert.equal(mapDokuNotificationStatus({
    providerStatus: "PENDING",
    providerState: "PENDING",
    orderStatus: "ORDER_EXPIRED",
  }), "expired");
});

test("authoritative DOKU success atomically owns one canonical Meta Purchase", async () => {
  const order = await seedDokuOrder(36001, "purchase-owner");
  const config = { id: 1, environment: "sandbox" as const, configRevision: 1 };
  assert.equal((await database.prepare(`
    SELECT COUNT(*) AS count FROM capi_event_outbox WHERE event_name = 'Purchase'
  `).first<{ count: number }>())?.count, 0);

  await applyDokuPaymentFact(
    database,
    config,
    paymentFact(order, "PENDING", "PROCESSING", "pending-first"),
    "status",
  );
  assert.equal((await database.prepare(`
    SELECT COUNT(*) AS count FROM capi_event_outbox WHERE event_name = 'Purchase'
  `).first<{ count: number }>())?.count, 0);

  const success = paymentFact(order, "SUCCESS", "COMPLETED", "success-first");
  assert.equal((await applyDokuPaymentFact(database, config, success, "notification")).status, "paid");
  await applyDokuPaymentFact(database, config, { ...success, eventKey: "success-reconcile" }, "reconciliation");

  const rows = await database.prepare(`
    SELECT event_id, payload_json FROM capi_event_outbox WHERE event_name = 'Purchase'
  `).all<{ event_id: string; payload_json: string }>();
  assert.equal(rows.results.length, 1);
  assert.equal(rows.results[0]?.event_id, `purchase:${order.orderNumber}`);
  const event = JSON.parse(rows.results[0]?.payload_json || "{}")?.data?.[0];
  assert.equal(event.event_id, `purchase:${order.orderNumber}`);
  assert.equal(event.event_source_url, "https://shop.example");
  assert.deepEqual(event.custom_data, {
    content_name: "Jurnal Settlement",
    content_ids: ["p36000-v36001"],
    content_type: "product",
    value: 65.8,
    currency: "MYR",
    order_id: order.orderNumber,
  });
  assert.equal(event.user_data.fbp, "fb.1.1700000000000.browser");
  assert.equal(event.user_data.fbc, "fb.1.1700000000000.click");
  assert.match(event.user_data.external_id[0], /^[a-f0-9]{64}$/);
  assert.notEqual(event.user_data.external_id[0], event.user_data.ph[0]);
});

test("DOKU failure never queues Purchase", async () => {
  const order = await seedDokuOrder(36002, "failed-no-purchase");
  await applyDokuPaymentFact(
    database,
    { id: 1, environment: "sandbox", configRevision: 1 },
    paymentFact(order, "FAILED", "FAILED", "failed-terminal"),
    "notification",
  );
  assert.equal((await database.prepare(`
    SELECT COUNT(*) AS count FROM capi_event_outbox
    WHERE event_id = ?
  `).bind(`purchase:${order.orderNumber}`).first<{ count: number }>())?.count, 0);
});
