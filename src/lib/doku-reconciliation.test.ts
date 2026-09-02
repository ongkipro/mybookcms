import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after, before } from "node:test";
import { getPlatformProxy, type PlatformProxy } from "wrangler";
import { createDokuHostedCheckout, type DokuCheckoutInput } from "./doku-checkout.ts";
import { DOKU_API_VERSIONS } from "./doku-client.ts";
import { saveDokuConfigDraft } from "./doku-config.ts";
import { createDokuGlobalResponseSignature } from "./doku-signature.ts";
import {
  DokuReconciliationError,
  reconcileDokuOrder,
  reconcileDueDokuPayments,
} from "./doku-reconciliation.ts";
import { splitMigrationStatements } from "./schema-version.ts";
import { GET as getAdminOrder, PATCH as patchAdminOrder, POST as postAdminOrder } from "../pages/api/admin/orders/[id].ts";

type TestEnv = { OMS_DB: D1Database; AUTH_SECRET: string };
const ROOT_SECRET = "doku-reconciliation-test-secret-at-least-32-chars";
const CLIENT_ID = "BRN-001-0000001";
const API_KEY = "doku_ak_test_reconciliation_123";
const SECRET_KEY = "doku_sk_test_reconciliation_456";
const NOW = new Date("2026-09-01T07:00:00.000Z");
let platform: PlatformProxy<TestEnv>;
let database: D1Database;
let platformDirectory = "";

before(async () => {
  platformDirectory = mkdtempSync(join(tmpdir(), "mybookcms-doku-reconciliation-"));
  const configPath = join(platformDirectory, "wrangler.jsonc");
  writeFileSync(configPath, JSON.stringify({
    name: "mybookcms-doku-reconciliation",
    compatibility_date: "2026-08-01",
    vars: { AUTH_SECRET: ROOT_SECRET },
    d1_databases: [{ binding: "OMS_DB", database_name: "reconciliation", database_id: "00000000-0000-4000-8000-000000000216" }],
  }));
  platform = await getPlatformProxy<TestEnv>({ configPath, envFiles: [], persist: false, remoteBindings: false });
  database = platform.env.OMS_DB;
  const migrationsDirectory = new URL("../db/migrations/", import.meta.url);
  for (const file of readdirSync(migrationsDirectory).sort()) {
    if (!file.endsWith(".sql")) continue;
    const sql = readFileSync(new URL(file, migrationsDirectory), "utf8");
    await database.batch(splitMigrationStatements(sql).map((statement) => database.prepare(statement)));
  }
  await database.batch([
    database.prepare("INSERT INTO stores (id, name, slug, created_at) VALUES (1, 'Reconcile Store', 'reconcile', ?)").bind(NOW.toISOString()),
    database.prepare("INSERT INTO products (id, store_id, title, slug, is_active, created_at) VALUES (21600, 1, 'Buku Rekonsiliasi', 'buku-rekonsiliasi', 1, ?)").bind(NOW.toISOString()),
  ]);
  await saveDokuConfigDraft(database, ROOT_SECRET, {
    environment: "sandbox",
    clientId: CLIENT_ID,
    apiKey: API_KEY,
    secretKey: SECRET_KEY,
    enabledChannels: ["INTERNET_BANKING_FPX"],
  });
  await database.prepare("UPDATE payment_provider_configs SET is_enabled = 1").run();
});

after(async () => {
  await platform?.dispose();
  if (platformDirectory) rmSync(platformDirectory, { recursive: true, force: true });
});

function decodeBody(body: BodyInit | null | undefined) {
  if (typeof body === "string") return body;
  if (body instanceof Uint8Array) return new TextDecoder().decode(body);
  if (body instanceof ArrayBuffer) return new TextDecoder().decode(body);
  return "";
}

async function signedResponse(
  body: string,
  apiVersion = DOKU_API_VERSIONS.createCheckout,
) {
  const timestamp = new Date(NOW.getTime() + 1_000).toISOString();
  return new Response(body, { headers: {
    "Client-Id": CLIENT_ID,
    "Content-Type": "application/json",
    "Response-Timestamp": timestamp,
    "API-Version": apiVersion,
    Signature: await createDokuGlobalResponseSignature({ clientId: CLIENT_ID, responseTimestamp: timestamp, rawBody: body, secretKey: SECRET_KEY }),
  } });
}

function unsignedResponse(body: string, apiVersion = DOKU_API_VERSIONS.retrieveCheckout) {
  return new Response(body, { headers: {
    "Client-Id": CLIENT_ID,
    "Content-Type": "application/json",
    "Response-Timestamp": new Date(NOW.getTime() + 1_000).toISOString(),
    "API-Version": apiVersion,
  } });
}

const checkoutFetch = (async (_url: string | URL | Request, init?: RequestInit) => {
  const payload = JSON.parse(decodeBody(init?.body));
  return signedResponse(JSON.stringify({
    id: payload.id,
    order: { amount: payload.order.amount, invoice_number: payload.order.invoice_number, currency: "MYR", expired_at: payload.order.expired_at },
    payment: { checkout_url: `https://sandbox.doku.com/checkout-link-v3/${payload.id}`, status: "PENDING", state: "INIT" },
  }));
}) as typeof fetch;

function input(variantId: number, token: string): DokuCheckoutInput {
  return {
    submitToken: token,
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
    clientIp: "203.0.113.216",
    userAgent: "reconciliation-test",
  };
}

async function seedVariant(id: number, stock = 3) {
  await database.prepare("INSERT INTO product_variants (id, product_id, sku, title, price, weight_grams, stock) VALUES (?, 21600, ?, 'Standard', 3290, 500, ?)")
    .bind(id, `REC-${id}`, stock).run();
}

async function latest(token: string) {
  const row = await database.prepare(`
    SELECT pa.*, o.id AS order_id_value, o.payment_status AS order_payment_status,
      o.stock_restored_at
    FROM payment_attempts pa JOIN orders o ON o.id = pa.order_id
    WHERE o.submit_token = ? ORDER BY pa.created_at DESC, pa.id DESC LIMIT 1
  `).bind(token).first<Record<string, unknown>>();
  assert.ok(row);
  return row;
}

function statusFetch(attempt: Record<string, unknown>, status: string, state: string) {
  return (async () => signedResponse(JSON.stringify({
    id: attempt.provider_reference,
    order: { amount: Number(attempt.amount_sen) / 100, invoice_number: attempt.merchant_invoice, currency: "MYR", status: status === "SUCCESS" ? "ORDER_SUCCESS" : "ORDER_PENDING" },
    payment: { amount: Number(attempt.amount_sen) / 100, currency: "MYR", channel: "INTERNET_BANKING_FPX", status, state },
  }), DOKU_API_VERSIONS.retrieveCheckout)) as typeof fetch;
}

function unsignedStatusFetch(
  attempt: Record<string, unknown>,
  status: string,
  state: string,
  overrides: { id?: unknown; invoice?: unknown } = {},
) {
  return (async () => unsignedResponse(JSON.stringify({
    id: overrides.id ?? attempt.provider_reference,
    order: {
      amount: Number(attempt.amount_sen) / 100,
      invoice_number: overrides.invoice ?? attempt.merchant_invoice,
      currency: "MYR",
      status: status === "SUCCESS" ? "ORDER_SUCCESS" : "ORDER_PENDING",
    },
    payment: {
      amount: Number(attempt.amount_sen) / 100,
      currency: "MYR",
      channel: "INTERNET_BANKING_FPX",
      status,
      state,
    },
  }))) as typeof fetch;
}

test("scheduled reconciliation leases a bounded due attempt and applies signed provider truth", async () => {
  await seedVariant(21601);
  await createDokuHostedCheckout(database, ROOT_SECRET, input(21601, "reconcile-paid-21601"), { now: () => NOW, fetch: checkoutFetch });
  const attempt = await latest("reconcile-paid-21601");
  await database.prepare("UPDATE payment_attempts SET next_reconcile_at = ? WHERE id = ?")
    .bind(NOW.toISOString(), attempt.id).run();
  const originalInfo = console.info;
  console.info = () => {};
  try {
    const outcomes = await reconcileDueDokuPayments(platform.env as unknown as Env, { now: () => NOW, fetch: statusFetch(attempt, "SUCCESS", "COMPLETED") });
    assert.equal(outcomes.length, 1);
    assert.equal(outcomes[0].outcome, "paid");
  } finally {
    console.info = originalInfo;
  }
  const settled = await latest("reconcile-paid-21601");
  assert.equal(settled.local_status, "paid");
  assert.equal(settled.order_payment_status, "paid");
  assert.equal(settled.lease_token, null);
  assert.equal(settled.next_reconcile_at, null);
  const event = await database.prepare("SELECT source FROM payment_events WHERE payment_attempt_id = ? AND source = 'reconciliation' LIMIT 1")
    .bind(attempt.id).first<{ source: string }>();
  assert.equal(event?.source, "reconciliation");
});

test("a signature-absent retrieve settles only the exactly correlated attempt and then converges", async () => {
  await seedVariant(21606);
  await createDokuHostedCheckout(database, ROOT_SECRET, input(21606, "reconcile-unsigned-paid-21606"), { now: () => NOW, fetch: checkoutFetch });
  const attempt = await latest("reconcile-unsigned-paid-21606");
  await database.prepare("UPDATE payment_attempts SET next_reconcile_at = ? WHERE id = ?")
    .bind(NOW.toISOString(), attempt.id).run();
  const originalInfo = console.info;
  console.info = () => {};
  try {
    const first = await reconcileDueDokuPayments(platform.env as unknown as Env, {
      now: () => NOW,
      fetch: unsignedStatusFetch(attempt, "SUCCESS", "COMPLETED"),
    });
    const second = await reconcileDueDokuPayments(platform.env as unknown as Env, {
      now: () => new Date(NOW.getTime() + 1_000),
      fetch: (async () => { throw new Error("terminal attempt must not be retrieved again"); }) as typeof fetch,
    });
    assert.equal(first[0]?.outcome, "paid");
    assert.deepEqual(second, []);
  } finally {
    console.info = originalInfo;
  }
  const settled = await latest("reconcile-unsigned-paid-21606");
  assert.equal(settled.local_status, "paid");
  assert.equal(settled.order_payment_status, "paid");
  assert.equal((await database.prepare("SELECT COUNT(*) AS count FROM payment_events WHERE payment_attempt_id = ? AND source = 'reconciliation'")
    .bind(attempt.id).first<{ count: number }>())?.count, 1);
});

test("a signature-absent retrieve identity mismatch cannot transition D1 state", async () => {
  await seedVariant(21607);
  await createDokuHostedCheckout(database, ROOT_SECRET, input(21607, "reconcile-unsigned-mismatch-21607"), { now: () => NOW, fetch: checkoutFetch });
  const attempt = await latest("reconcile-unsigned-mismatch-21607");
  await database.prepare("UPDATE payment_attempts SET next_reconcile_at = ? WHERE id = ?")
    .bind(NOW.toISOString(), attempt.id).run();
  await assert.rejects(
    reconcileDokuOrder(database, ROOT_SECRET, Number(attempt.order_id_value), {
      now: () => NOW,
      fetch: unsignedStatusFetch(attempt, "SUCCESS", "COMPLETED", { id: "ID-WRONG" }),
    }),
    (error: unknown) => error instanceof DokuReconciliationError && error.code === "PROVIDER_FAILED",
  );
  const unchanged = await latest("reconcile-unsigned-mismatch-21607");
  assert.equal(unchanged.local_status, "pending");
  assert.equal(unchanged.order_payment_status, "pending");
  await database.prepare("UPDATE payment_attempts SET next_reconcile_at = '2099-01-01T00:00:00.000Z' WHERE id = ?")
    .bind(attempt.id).run();
});

test("scheduled reconciliation expires an abandoned uninitiated order and restores stock once", async () => {
  await seedVariant(21602);
  await assert.rejects(() => createDokuHostedCheckout(database, ROOT_SECRET, input(21602, "reconcile-abandoned-21602"), {
    now: () => NOW,
    fetch: (async () => { throw new Error("synthetic provider failure"); }) as typeof fetch,
  }));
  const attempt = await latest("reconcile-abandoned-21602");
  await database.prepare("UPDATE payment_attempts SET expires_at = ?, next_reconcile_at = ? WHERE id = ?")
    .bind(new Date(NOW.getTime() - 1).toISOString(), NOW.toISOString(), attempt.id).run();
  const originalInfo = console.info;
  console.info = () => {};
  try {
    const outcomes = await reconcileDueDokuPayments(platform.env as unknown as Env, { now: () => NOW, fetch: checkoutFetch });
    assert.equal(outcomes.some((outcome) => outcome.attemptId === attempt.id && outcome.outcome === "expired"), true);
  } finally {
    console.info = originalInfo;
  }
  const expired = await latest("reconcile-abandoned-21602");
  assert.equal(expired.local_status, "expired");
  assert.equal(expired.order_payment_status, "failed");
  assert.ok(expired.stock_restored_at);
  assert.equal((await database.prepare("SELECT stock FROM product_variants WHERE id = 21602").first<{ stock: number }>())?.stock, 3);
});

test("manual reconciliation refuses an attempt already leased by the scheduler", async () => {
  await seedVariant(21603);
  await createDokuHostedCheckout(database, ROOT_SECRET, input(21603, "reconcile-leased-21603"), { now: () => NOW, fetch: checkoutFetch });
  const attempt = await latest("reconcile-leased-21603");
  await database.prepare("UPDATE payment_attempts SET lease_token = 'scheduler-lease', lease_until = ? WHERE id = ?")
    .bind(new Date(NOW.getTime() + 60_000).toISOString(), attempt.id).run();
  await assert.rejects(
    () => reconcileDokuOrder(database, ROOT_SECRET, Number(attempt.order_id_value), { now: () => NOW, fetch: statusFetch(attempt, "PENDING", "INIT") }),
    (error: unknown) => error instanceof DokuReconciliationError && error.code === "LEASED",
  );
  await database.prepare("UPDATE payment_attempts SET lease_token = NULL, lease_until = NULL, next_reconcile_at = '2099-01-01T00:00:00.000Z' WHERE id = ?")
    .bind(attempt.id).run();
  await assert.rejects(
    () => reconcileDokuOrder(database, ROOT_SECRET, Number(attempt.order_id_value), { now: () => NOW, fetch: statusFetch(attempt, "PENDING", "INIT") }),
    (error: unknown) => error instanceof DokuReconciliationError && error.code === "COOLDOWN",
  );
});

test("scheduled failures back off, exhaust to attention, and are not leased again", async () => {
  await seedVariant(21604);
  await createDokuHostedCheckout(database, ROOT_SECRET, input(21604, "reconcile-exhausted-21604"), { now: () => NOW, fetch: checkoutFetch });
  const attempt = await latest("reconcile-exhausted-21604");
  await database.prepare("UPDATE payment_attempts SET reconcile_attempts = 7, next_reconcile_at = ? WHERE id = ?")
    .bind(NOW.toISOString(), attempt.id).run();
  let providerCalls = 0;
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    const first = await reconcileDueDokuPayments(platform.env as unknown as Env, {
      now: () => NOW,
      fetch: (async () => { providerCalls += 1; throw new Error("synthetic timeout"); }) as typeof fetch,
    });
    assert.deepEqual(first, []);
    const second = await reconcileDueDokuPayments(platform.env as unknown as Env, {
      now: () => new Date(NOW.getTime() + 86_400_000),
      fetch: (async () => { providerCalls += 1; throw new Error("must not retry exhausted attempt"); }) as typeof fetch,
    });
    assert.deepEqual(second, []);
  } finally {
    console.warn = originalWarn;
  }
  const exhausted = await latest("reconcile-exhausted-21604");
  assert.equal(providerCalls, 1);
  assert.equal(exhausted.local_status, "attention_required");
  assert.equal(exhausted.error_class, "provider");
  assert.equal(exhausted.next_reconcile_at, null);
  assert.equal(exhausted.lease_token, null);
});

test("a failed local payment transition is classified without leaking provider data", async () => {
  await seedVariant(21605);
  await createDokuHostedCheckout(database, ROOT_SECRET, input(21605, "reconcile-local-transition-21605"), { now: () => NOW, fetch: checkoutFetch });
  const attempt = await latest("reconcile-local-transition-21605");
  await database.batch([
    database.prepare("UPDATE payment_attempts SET next_reconcile_at = ? WHERE id = ?").bind(NOW.toISOString(), attempt.id),
    database.prepare(`
      CREATE TRIGGER fail_reconcile_paid_order
      BEFORE UPDATE OF payment_status ON orders
      WHEN NEW.id = ${Number(attempt.order_id_value)} AND NEW.payment_status = 'paid'
      BEGIN
        SELECT RAISE(ABORT, 'synthetic local transition failure');
      END
    `),
  ]);
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    const outcomes = await reconcileDueDokuPayments(platform.env as unknown as Env, {
      now: () => NOW,
      fetch: statusFetch(attempt, "SUCCESS", "COMPLETED"),
    });
    assert.deepEqual(outcomes, []);
  } finally {
    console.warn = originalWarn;
    await database.prepare("DROP TRIGGER fail_reconcile_paid_order").run();
  }
  const failed = await latest("reconcile-local-transition-21605");
  assert.equal(failed.local_status, "pending");
  assert.equal(failed.error_class, "local_transition");
  assert.equal(failed.lease_token, null);
  assert.ok(failed.next_reconcile_at);
});

test("admin order API redacts sensitive fields and forbids DOKU mutation by selector or customer service", async () => {
  const attempt = await latest("reconcile-leased-21603");
  const orderNumber = String((await database.prepare("SELECT order_number FROM orders WHERE id = ?")
    .bind(Number(attempt.order_id_value)).first<{ order_number: string }>())?.order_number);
  const ownerLocals = { runtimeEnv: platform.env, admin: { role: "owner" } };
  const read = await getAdminOrder({ params: { id: orderNumber }, locals: ownerLocals } as never);
  const readText = await read.text();
  assert.equal(read.status, 200, readText);
  assert.doesNotMatch(readText, /submit_token|public_status_token|ad_click_ids|checkout_url|idempotency_key|request_fingerprint|lease_token/);
  assert.match(readText, /"provider":"DOKU"/);
  assert.match(readText, /"config_health":"ready"/);

  const patch = await patchAdminOrder({
    params: { id: orderNumber },
    locals: ownerLocals,
    request: new Request(`https://shop.example/api/admin/orders/${orderNumber}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payment_status: "paid" }),
    }),
  } as never);
  assert.equal(patch.status, 409);
  assert.match(await patch.text(), /provider terverifikasi/);

  const forbidden = await postAdminOrder({
    params: { id: orderNumber },
    locals: { runtimeEnv: platform.env, admin: { role: "customer_service" } },
    request: new Request(`https://shop.example/api/admin/orders/${orderNumber}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reconcile_doku" }),
    }),
  } as never);
  assert.equal(forbidden.status, 403);

  const coolingDown = await postAdminOrder({
    params: { id: orderNumber },
    locals: ownerLocals,
    request: new Request(`https://shop.example/api/admin/orders/${orderNumber}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reconcile_doku" }),
    }),
  } as never);
  assert.equal(coolingDown.status, 409);
  assert.match(await coolingDown.text(), /jadwal pemeriksaan DOKU berikutnya belum tiba/i);
});
