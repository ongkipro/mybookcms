import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after, before } from "node:test";
import { getPlatformProxy, type PlatformProxy } from "wrangler";
import {
  applyDokuPaymentFact,
  DokuPaymentLifecycleError,
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
      channel: "INTERNET_BANKING_FPX",
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
  // A genuine contradiction: the provider says it succeeded and the state says
  // it failed. Nobody can act on that without looking, so it stays here.
  assert.equal(mapDokuNotificationStatus({
    providerStatus: "SUCCESS",
    providerState: "FAILED",
  }), "attention_required");
  assert.equal(mapDokuNotificationStatus({
    providerStatus: "SUCCESS",
    providerState: "COMPLETED",
    orderStatus: "ORDER_EXPIRED",
  }), "attention_required");
});

test("a terminal state is not a success: FAILED/COMPLETED is a plain failure", () => {
  // A-281 / REQ-221. **This inverts an assertion committed alongside the
  // function**, which read `FAILED`/`COMPLETED` as `attention_required`. That
  // was the same misreading the function carried: DOKU uses `COMPLETED` for
  // *terminal*, not for *succeeded*. A sandbox card decline observed on
  // 2026-09-13 returns exactly this pair — `status: "FAILED"`,
  // `state: "COMPLETED"`, `processor.response_code: "14"` — so the old
  // assertion was pinning a bug rather than a contract.
  assert.equal(mapDokuNotificationStatus({
    providerStatus: "FAILED",
    providerState: "COMPLETED",
  }), "failed");

  // Expiry was stranded the same way, and REQ-221 wants these releasing stock
  // too: "failed or expired terminal outcomes shall release still-reserved
  // stock once".
  assert.equal(mapDokuNotificationStatus({
    providerStatus: "EXPIRED",
    providerState: "COMPLETED",
  }), "expired");
  assert.equal(mapDokuNotificationStatus({
    providerStatus: "PENDING",
    providerState: "COMPLETED",
    orderStatus: "ORDER_EXPIRED",
  }), "expired");

  // The two observed-from-DOKU combinations that were already right.
  assert.equal(mapDokuNotificationStatus({
    providerStatus: "SUCCESS",
    providerState: "COMPLETED",
  }), "paid");
  assert.equal(mapDokuNotificationStatus({
    providerStatus: "PENDING",
    providerState: "INITIATE",
  }), "pending");
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
    value: 269780,
    currency: "IDR",
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

test("a provider fact for a different channel cannot transition the attempt", async () => {
  const order = await seedDokuOrder(36003, "channel-mismatch");
  await assert.rejects(
    applyDokuPaymentFact(
      database,
      { id: 1, environment: "sandbox", configRevision: 1 },
      {
        ...paymentFact(order, "SUCCESS", "COMPLETED", "wrong-channel"),
        channel: "EWALLET_TNG",
      },
      "notification",
    ),
    (error: unknown) => error instanceof DokuPaymentLifecycleError && error.code === "DOKU_PAYMENT_MISMATCH",
  );
  const state = await database.prepare(`
    SELECT pa.local_status, o.payment_status
    FROM payment_attempts pa JOIN orders o ON o.id = pa.order_id
    WHERE pa.id = ?
  `).bind(order.attemptId).first<{ local_status: string; payment_status: string }>();
  assert.deepEqual(state, { local_status: "pending", payment_status: "pending" });
});

test("an attempt without a persisted allowlisted channel cannot settle from any fact source", async () => {
  for (const [index, channel] of [null, "UNKNOWN"].entries()) {
    const order = await seedDokuOrder(36900 + index, `unbound-channel-${index}`);
    await database.prepare("UPDATE payment_attempts SET channel = ? WHERE id = ?")
      .bind(channel, order.attemptId).run();
    const eventsBefore = await database.prepare("SELECT COUNT(*) AS count FROM payment_events WHERE payment_attempt_id = ?")
      .bind(order.attemptId).first<{ count: number }>();
    for (const source of ["notification", "status", "reconciliation"] as const) {
      await assert.rejects(applyDokuPaymentFact(database,
        { id: 1, environment: "sandbox", configRevision: 1 },
        { ...paymentFact(order, "SUCCESS", "COMPLETED", `unbound-${index}-${source}`), channel: channel ?? "INTERNET_BANKING_FPX" }, source),
        (error: unknown) => error instanceof DokuPaymentLifecycleError && error.code === "DOKU_PAYMENT_MISMATCH");
    }
    const state = await database.prepare(`SELECT pa.local_status, o.payment_status
      FROM payment_attempts pa JOIN orders o ON o.id = pa.order_id WHERE pa.id = ?`)
      .bind(order.attemptId).first();
    assert.deepEqual(state, { local_status: "pending", payment_status: "pending" });
    const events = await database.prepare("SELECT COUNT(*) AS count FROM payment_events WHERE payment_attempt_id = ?")
      .bind(order.attemptId).first<{ count: number }>();
    assert.equal(events?.count, eventsBefore?.count);
    const purchases = await database.prepare("SELECT COUNT(*) AS count FROM capi_event_outbox WHERE event_id = ?")
      .bind(`purchase:${order.orderNumber}`).first<{ count: number }>();
    assert.equal(purchases?.count, 0);
  }
});

test("a declined card releases its reserved stock, which is the harm A-281 names", async () => {
  // REQ-221: "failed or expired terminal outcomes shall release still-reserved
  // stock once". The status mapping is only the mechanism; this is the harm.
  // Before A-281 a decline resolved to `attention_required`, and
  // `applyDokuPaymentFact` restores stock and writes `payment_status = 'failed'`
  // only for a `failed` or `expired` target — so the stock stayed reserved
  // indefinitely and the order never reached a terminal payment status. On a
  // real store that strands inventory on the commonest outcome after success.
  const order = await seedDokuOrder(36021, "declined-card");
  const config = { id: 1, environment: "sandbox" as const, configRevision: 1 };

  const stockOf = async () => (await database.prepare(
    "SELECT stock FROM product_variants WHERE id = ?",
  ).bind(36021).first<{ stock: number }>())?.stock;
  const paymentStatusOf = async () => (await database.prepare(
    "SELECT payment_status FROM orders WHERE id = ?",
  ).bind(order.id).first<{ payment_status: string }>())?.payment_status;

  const reserved = await stockOf();
  assert.ok(
    typeof reserved === "number" && reserved < 5,
    `the fixture must leave stock reserved, or this asserts nothing (got ${reserved})`,
  );

  // The exact pair a DOKU card decline sends, observed 2026-09-13.
  const declined = paymentFact(order, "FAILED", "COMPLETED", "card-declined");
  assert.equal((await applyDokuPaymentFact(database, config, declined, "notification")).status, "failed");

  assert.equal(await stockOf(), 5, "the reserved unit must go back on the shelf");
  assert.equal(await paymentStatusOf(), "failed", "the order must reach a terminal payment status");
});
