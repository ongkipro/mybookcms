import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after, before } from "node:test";
import { getPlatformProxy, type PlatformProxy } from "wrangler";
import { POST as notificationRoute } from "../pages/api/payments/doku/notifications.ts";
import { saveDokuConfigDraft } from "./doku-config.ts";
import { createDokuHostedCheckout, type DokuCheckoutInput } from "./doku-checkout.ts";
import {
  createDokuGlobalRequestSignature,
  createDokuGlobalResponseSignature,
} from "./doku-signature.ts";
import { splitMigrationStatements } from "./schema-version.ts";

type TestEnv = { OMS_DB: D1Database };

const ROOT_SECRET = "notification-test-auth-secret-at-least-32-chars";
const CLIENT_ID = "BRN-001-0000001";
const API_KEY = "doku_ak_test_example_123456";
const SECRET_KEY = "doku_sk_test_example_654321";
const TARGET = "/api/payments/doku/notifications";
const TEST_NOW = new Date();

let platform: PlatformProxy<TestEnv>;
let database: D1Database;
let platformDirectory = "";

before(async () => {
  platformDirectory = mkdtempSync(join(tmpdir(), "mybookcms-doku-notification-"));
  const configPath = join(platformDirectory, "wrangler.jsonc");
  writeFileSync(configPath, JSON.stringify({
    name: "mybookcms-doku-notification",
    compatibility_date: "2026-08-01",
    d1_databases: [{
      binding: "OMS_DB",
      database_name: "doku-notification",
      database_id: "00000000-0000-4000-8000-000000000003",
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
    database.prepare("INSERT INTO stores (id, name, slug, created_at) VALUES (?, ?, ?, ?)")
      .bind(1, "DOKU Notification Store", "doku-notification", TEST_NOW.toISOString()),
    database.prepare(`
      INSERT INTO products (id, store_id, title, slug, is_active, created_at)
      VALUES (?, ?, ?, ?, 1, ?)
    `).bind(32000, 1, "Jurnal Notifikasi", "jurnal-notifikasi", TEST_NOW.toISOString()),
  ]);
  await saveDokuConfigDraft(database, ROOT_SECRET, {
    environment: "sandbox",
    clientId: CLIENT_ID,
    apiKey: API_KEY,
    secretKey: SECRET_KEY,
    enabledChannels: ["INTERNET_BANKING_FPX", "EWALLET_TNG"],
  });
  await database.prepare("UPDATE payment_provider_configs SET is_enabled = 1").run();
});

after(async () => {
  await platform?.dispose();
  if (platformDirectory) rmSync(platformDirectory, { recursive: true, force: true });
});

async function seedVariant(id: number, stock = 3) {
  await database.prepare(`
    INSERT INTO product_variants
      (id, product_id, sku, title, price, weight_grams, stock)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(id, 32000, `NOTIFY-${id}`, `Varian ${id}`, 3290, 500, stock).run();
}

function checkoutInput(variantId: number, submitToken: string): DokuCheckoutInput {
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
    requestUrl: "https://shop.example/api/submit-order",
    clientIp: "203.0.113.30",
    userAgent: "MyBookCMS notification test browser",
  };
}

async function createAttempt(variantId: number, token: string) {
  await seedVariant(variantId);
  return createDokuHostedCheckout(database, ROOT_SECRET, checkoutInput(variantId, token), {
    now: () => TEST_NOW,
    fetch: (async (_url, init) => {
      const requestPayload = JSON.parse(
        new TextDecoder().decode(init?.body as ArrayBuffer),
      ) as {
        id: string;
        order: { amount: number; invoice_number: string; expired_at: string };
      };
      const body = JSON.stringify({
        id: requestPayload.id,
        order: {
          amount: requestPayload.order.amount,
          invoice_number: requestPayload.order.invoice_number,
          currency: "MYR",
          expired_at: requestPayload.order.expired_at,
        },
        payment: {
          checkout_url: `https://sandbox.doku.com/checkout-link-v3/${requestPayload.id}`,
          status: "PENDING",
          state: "INIT",
        },
      });
      const responseTimestamp = new Date(TEST_NOW.getTime() + 1_000).toISOString();
      return new Response(body, {
        headers: {
          "Client-Id": CLIENT_ID,
          "Response-Timestamp": responseTimestamp,
          Signature: await createDokuGlobalResponseSignature({
            clientId: CLIENT_ID,
            responseTimestamp,
            rawBody: body,
            secretKey: SECRET_KEY,
          }),
        },
      });
    }) as typeof fetch,
  });
}

type AttemptFacts = {
  attempt_id: string;
  provider_reference: string;
  merchant_invoice: string;
  amount_sen: number;
  local_status: string;
  order_id: number;
  payment_status: string;
  stock_restored_at: string | null;
};

async function attemptFacts(token: string) {
  const facts = await database.prepare(`
    SELECT pa.id AS attempt_id, pa.provider_reference, pa.merchant_invoice,
      pa.amount_sen, pa.local_status, o.id AS order_id, o.payment_status,
      o.stock_restored_at
    FROM payment_attempts pa JOIN orders o ON o.id = pa.order_id
    WHERE o.submit_token = ?
  `).bind(token).first<AttemptFacts>();
  assert.ok(facts);
  return facts;
}

function notificationPayload(
  facts: AttemptFacts,
  status: string,
  state: string,
  extra: Record<string, unknown> = {},
) {
  return {
    id: facts.provider_reference,
    order: {
      amount: facts.amount_sen / 100,
      invoice_number: facts.merchant_invoice,
      currency: "MYR",
    },
    payment: {
      channel: "INTERNET_BANKING_FPX",
      type: "SALE",
      amount: facts.amount_sen / 100,
      currency: "MYR",
      status,
      state,
    },
    ...extra,
  };
}

async function sendNotification(
  payload: Record<string, unknown>,
  options: {
    signatureTarget?: string;
    signatureBody?: string;
    timestamp?: string;
    requestId?: string;
  } = {},
) {
  const rawBody = JSON.stringify(payload);
  const timestamp = options.timestamp ?? TEST_NOW.toISOString();
  const headers = new Headers({
    "Content-Type": "application/json",
    "Client-Id": CLIENT_ID,
    "Request-Timestamp": timestamp,
    Signature: await createDokuGlobalRequestSignature({
      clientId: CLIENT_ID,
      requestTimestamp: timestamp,
      requestTarget: options.signatureTarget ?? TARGET,
      rawBody: options.signatureBody ?? rawBody,
      secretKey: SECRET_KEY,
    }),
  });
  if (options.requestId) headers.set("Request-Id", options.requestId);
  return notificationRoute({
    request: new Request(`https://shop.example${TARGET}`, {
      method: "POST",
      headers,
      body: rawBody,
    }),
    locals: { runtimeEnv: { OMS_DB: database, AUTH_SECRET: ROOT_SECRET } },
  } as unknown as Parameters<typeof notificationRoute>[0]);
}

async function notificationEventCount(attemptId: string) {
  return (await database.prepare(`
    SELECT COUNT(*) AS count FROM payment_events
    WHERE payment_attempt_id = ? AND source = 'notification'
  `).bind(attemptId).first<{ count: number }>())?.count ?? 0;
}

async function stock(variantId: number) {
  return (await database.prepare("SELECT stock FROM product_variants WHERE id = ?")
    .bind(variantId).first<{ stock: number }>())?.stock;
}

test("signed success commits paid once before 2xx and ignores duplicate/additive fields", async () => {
  const variantId = 32001;
  const token = "notification-success-token-32001";
  await createAttempt(variantId, token);
  const facts = await attemptFacts(token);
  const payload = notificationPayload(facts, "SUCCESS", "COMPLETED");

  assert.equal((await sendNotification(payload)).status, 204);
  const settled = await attemptFacts(token);
  assert.equal(settled.local_status, "paid");
  assert.equal(settled.payment_status, "paid");
  assert.equal(await stock(variantId), 2);
  assert.equal(await notificationEventCount(facts.attempt_id), 1);

  assert.equal((await sendNotification({ ...payload, future_provider_field: { accepted: true } })).status, 204);
  assert.equal(await notificationEventCount(facts.attempt_id), 1);

  assert.equal((await sendNotification(notificationPayload(facts, "FAILED", "FAILED"))).status, 204);
  const afterLateFailure = await attemptFacts(token);
  assert.equal(afterLateFailure.local_status, "paid");
  assert.equal(afterLateFailure.payment_status, "paid");
  assert.equal(await stock(variantId), 2);
});

test("failed and expired outcomes release still-reserved stock exactly once", async () => {
  for (const [variantId, terminal] of [[32002, "FAILED"], [32003, "EXPIRED"]] as const) {
    const token = `notification-${terminal.toLowerCase()}-token-${variantId}`;
    await createAttempt(variantId, token);
    const facts = await attemptFacts(token);
    const payload = notificationPayload(facts, terminal, terminal);
    assert.equal((await sendNotification(payload)).status, 204);
    const released = await attemptFacts(token);
    assert.equal(released.local_status, terminal.toLowerCase());
    assert.equal(released.payment_status, "failed");
    assert.ok(released.stock_restored_at);
    assert.equal(await stock(variantId), 3);
    assert.equal((await sendNotification(payload)).status, 204);
    assert.equal(await stock(variantId), 3);
    assert.equal(await notificationEventCount(facts.attempt_id), 1);

    assert.equal((await sendNotification(notificationPayload(facts, "SUCCESS", "COMPLETED"))).status, 204);
    const afterLateSuccess = await attemptFacts(token);
    assert.equal(afterLateSuccess.local_status, terminal.toLowerCase());
    assert.equal(afterLateSuccess.payment_status, "failed");
    assert.equal(await stock(variantId), 3);
  }
});

test("unknown state remains attention-required and can later settle from signed truth", async () => {
  const variantId = 32004;
  const token = "notification-unknown-token-32004";
  await createAttempt(variantId, token);
  const facts = await attemptFacts(token);
  assert.equal((await sendNotification(notificationPayload(facts, "PENDING", "WAITING_REVIEW"))).status, 204);
  assert.equal((await attemptFacts(token)).local_status, "attention_required");
  assert.equal((await attemptFacts(token)).payment_status, "pending");
  assert.equal(await stock(variantId), 2);

  assert.equal((await sendNotification(notificationPayload(facts, "SUCCESS", "COMPLETED"))).status, 204);
  assert.equal((await attemptFacts(token)).local_status, "paid");
  assert.equal((await attemptFacts(token)).payment_status, "paid");
  assert.equal(await stock(variantId), 2);
});

test("invalid Global authenticity and Cards headers are rejected before mutation", async () => {
  const variantId = 32005;
  const token = "notification-signature-token-32005";
  await createAttempt(variantId, token);
  const facts = await attemptFacts(token);
  const payload = notificationPayload(facts, "SUCCESS", "COMPLETED");
  const stale = new Date(TEST_NOW.getTime() - 10 * 60 * 1000).toISOString();

  assert.equal((await sendNotification(payload, { signatureTarget: "/wrong-target" })).status, 401);
  assert.equal((await sendNotification(payload, { signatureBody: "{}" })).status, 401);
  assert.equal((await sendNotification(payload, { timestamp: stale })).status, 401);
  assert.equal((await sendNotification(payload, { requestId: "cards-shape" })).status, 401);
  assert.equal((await attemptFacts(token)).local_status, "pending");
  assert.equal((await attemptFacts(token)).payment_status, "pending");
  assert.equal(await notificationEventCount(facts.attempt_id), 0);
});

test("signed amount, currency, invoice, and provider-reference mismatches never mutate", async () => {
  const variantId = 32006;
  const token = "notification-mismatch-token-32006";
  await createAttempt(variantId, token);
  const facts = await attemptFacts(token);
  const base = notificationPayload(facts, "SUCCESS", "COMPLETED");

  const cases = [
    { ...base, order: { ...(base.order as object), amount: 99.99 } },
    { ...base, payment: { ...(base.payment as object), currency: "USD" } },
    { ...base, order: { ...(base.order as object), invoice_number: "MYB-WRONG" } },
    { ...base, id: "DOKU-WRONG" },
  ];
  for (const payload of cases) {
    assert.notEqual((await sendNotification(payload)).status, 204);
  }
  assert.equal((await attemptFacts(token)).local_status, "pending");
  assert.equal((await attemptFacts(token)).payment_status, "pending");
  assert.equal(await stock(variantId), 2);
  assert.equal(await notificationEventCount(facts.attempt_id), 0);
});
