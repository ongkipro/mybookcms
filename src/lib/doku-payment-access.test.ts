import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after, before } from "node:test";
import vm from "node:vm";
import { getPlatformProxy, type PlatformProxy } from "wrangler";
import {
  buildDokuAccessCookie,
  summarizeDokuPaymentForRecovery,
  DOKU_CHANNEL_DISABLED_MESSAGE,
  DOKU_RETURN_CAPABILITY_TTL_MS,
  exchangeDokuCallbackQuery,
  handleDokuRetryRequest,
  handleDokuStatusRequest,
  loadDokuPaymentAccessFromCookie,
} from "./doku-payment-access.ts";
import { createDokuReturnToken, createDokuHostedCheckout, type DokuCheckoutInput } from "./doku-checkout.ts";
import { saveDokuConfigDraft } from "./doku-config.ts";
import { applyDokuPaymentFact } from "./doku-payment-lifecycle.ts";
import { createDokuGlobalResponseSignature } from "./doku-signature.ts";
import { splitMigrationStatements } from "./schema-version.ts";
import { ALL as retryMethodFallback } from "../pages/api/payments/doku/retry.ts";
import { ALL as statusMethodFallback } from "../pages/api/payments/doku/status.ts";

type TestEnv = { OMS_DB: D1Database };

const ROOT_SECRET = "payment-access-test-auth-secret-at-least-32-chars";
const CLIENT_ID = "BRN-001-0000001";
const API_KEY = "doku_ak_test_example_123456";
const SECRET_KEY = "doku_sk_test_example_654321";
const NOW = new Date("2026-09-01T07:00:00.000Z");

let platform: PlatformProxy<TestEnv>;
let database: D1Database;
let platformDirectory = "";

before(async () => {
  platformDirectory = mkdtempSync(join(tmpdir(), "mybookcms-doku-access-"));
  const configPath = join(platformDirectory, "wrangler.jsonc");
  writeFileSync(configPath, JSON.stringify({
    name: "mybookcms-doku-access",
    compatibility_date: "2026-08-01",
    d1_databases: [{
      binding: "OMS_DB",
      database_name: "doku-access",
      database_id: "00000000-0000-4000-8000-000000000004",
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
      .bind(1, "DOKU Access Store", "doku-access", NOW.toISOString()),
    database.prepare(`
      INSERT INTO products (id, store_id, title, slug, is_active, created_at)
      VALUES (?, ?, ?, ?, 1, ?)
    `).bind(34000, 1, "Jurnal Akses", "jurnal-akses", NOW.toISOString()),
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
  `).bind(id, 34000, `ACCESS-${id}`, `Varian ${id}`, 3290, 500, stock).run();
}

function checkoutInput(variantId: number, submitToken: string): DokuCheckoutInput {
  return {
    submitToken,
    customerName: "Aina Rahman",
    customerPhone: "60123456789",
    customerEmail: "aina@example.com",
    selectedChannel: "INTERNET_BANKING_FPX",
    address: "12 Jalan Buku, Taman Fokus",
    province: "Johor",
    city: "Johor Bahru",
    district: "Johor Bahru",
    postalCode: "80000",
    variantKey: String(variantId),
    quantity: 1,
    shippingCost: 800,
    requestUrl: "https://shop.example/api/submit-order",
    clientIp: "203.0.113.40",
    userAgent: "MyBookCMS payment access test browser",
  };
}

async function signedResponse(body: string, timestamp = new Date(NOW.getTime() + 1_000).toISOString()) {
  return new Response(body, {
    headers: {
      "Client-Id": CLIENT_ID,
      "Content-Type": "application/json",
      "Response-Timestamp": timestamp,
      Signature: await createDokuGlobalResponseSignature({
        clientId: CLIENT_ID,
        responseTimestamp: timestamp,
        rawBody: body,
        secretKey: SECRET_KEY,
      }),
    },
  });
}

function decodeRequestBody(body: BodyInit | null | undefined): string {
  if (typeof body === "string") return body;
  if (body instanceof ArrayBuffer) return new TextDecoder().decode(body);
  if (body instanceof Uint8Array) return new TextDecoder().decode(body);
  return "";
}

function checkoutFetch(observe: (payload: Record<string, any>, headers: Headers) => Promise<void> | void = () => {}) {
  return (async (_url: string | URL | Request, init?: RequestInit) => {
    const payload = JSON.parse(decodeRequestBody(init?.body)) as Record<string, any>;
    await observe(payload, new Headers(init?.headers));
    return signedResponse(JSON.stringify({
      id: payload.id,
      order: {
        amount: payload.order.amount,
        invoice_number: payload.order.invoice_number,
        currency: "MYR",
        expired_at: payload.order.expired_at,
      },
      payment: {
        checkout_url: `https://sandbox.doku.com/checkout-link-v3/${payload.id}`,
        status: "PENDING",
        state: "INIT",
      },
    }));
  }) as typeof fetch;
}

async function createAttempt(variantId: number, token: string, stock = 3) {
  await seedVariant(variantId, stock);
  const result = await createDokuHostedCheckout(database, ROOT_SECRET, checkoutInput(variantId, token), {
    now: () => NOW,
    fetch: checkoutFetch(),
  });
  await database.prepare(`
    UPDATE payment_attempts SET created_at = ?
    WHERE order_id = (SELECT id FROM orders WHERE submit_token = ?)
  `).bind(NOW.toISOString(), token).run();
  return result;
}

type AttemptFacts = {
  attempt_id: string;
  provider_reference: string;
  merchant_invoice: string;
  amount_sen: number;
  local_status: string;
  order_id: number;
  order_number: string;
  payment_status: string;
  stock_restored_at: string | null;
  expires_at: string | null;
  channel: string | null;
  error_class: string | null;
};

async function attemptFacts(token: string) {
  const facts = await database.prepare(`
    SELECT pa.id AS attempt_id, pa.provider_reference, pa.merchant_invoice,
      pa.amount_sen, pa.local_status, o.id AS order_id, o.order_number,
      o.payment_status, o.stock_restored_at, pa.expires_at, pa.channel,
      pa.error_class
    FROM payment_attempts pa JOIN orders o ON o.id = pa.order_id
    WHERE o.submit_token = ?
    -- rowid, not id: the ids are a deterministic hash for the seeded attempt
    -- and random for a retry, so ordering by id tiebreaks lexicographically and
    -- returns either row when both share an injected fixed clock. rowid is
    -- insertion order, which is what every caller means by the newest attempt.
    ORDER BY pa.created_at DESC, pa.rowid DESC
    LIMIT 1
  `).bind(token).first<AttemptFacts>();
  assert.ok(facts);
  return facts;
}

async function attemptCount(token: string) {
  return (await database.prepare(`
    SELECT COUNT(*) AS count
    FROM payment_attempts pa JOIN orders o ON o.id = pa.order_id
    WHERE o.submit_token = ?
  `).bind(token).first<{ count: number }>())?.count ?? 0;
}

async function eventCount(attemptId: string, source: string) {
  return (await database.prepare(`
    SELECT COUNT(*) AS count FROM payment_events
    WHERE payment_attempt_id = ? AND source = ?
  `).bind(attemptId, source).first<{ count: number }>())?.count ?? 0;
}

async function stock(variantId: number) {
  return (await database.prepare("SELECT stock FROM product_variants WHERE id = ?")
    .bind(variantId).first<{ stock: number }>())?.stock;
}

async function returnTokenFor(token: string) {
  const facts = await attemptFacts(token);
  return createDokuReturnToken(ROOT_SECRET, facts.attempt_id, facts.order_number);
}

async function expireAttempt(token: string) {
  const facts = await attemptFacts(token);
  await applyDokuPaymentFact(database, {
    id: 1,
    environment: "sandbox",
    configRevision: 1,
  }, {
    providerReference: facts.provider_reference,
    merchantInvoice: facts.merchant_invoice,
    amountSen: facts.amount_sen,
    channel: "INTERNET_BANKING_FPX",
    providerStatus: "EXPIRED",
    providerState: "EXPIRED",
    eventKey: `expire:${facts.provider_reference}`,
  }, "notification");
}

function signedStatusFetch(
  facts: AttemptFacts,
  status: string,
  state: string,
  overrides: Record<string, unknown> = {},
) {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    assert.match(String(url), new RegExp(`/v3/checkouts/${facts.provider_reference}$`));
    assert.equal(init?.method, "GET");
    assert.equal(init?.body, undefined);
    const body = JSON.stringify({
      id: facts.provider_reference,
      order: {
        amount: facts.amount_sen / 100,
        invoice_number: facts.merchant_invoice,
        currency: "MYR",
        status: status === "SUCCESS" ? "ORDER_SUCCESS" : "ORDER_PENDING",
      },
      payment: {
        amount: facts.amount_sen / 100,
        currency: "MYR",
        channel: "INTERNET_BANKING_FPX",
        status,
        state,
      },
      ...overrides,
    });
    return signedResponse(body);
  }) as typeof fetch;
}

async function accessCookie(token: string) {
  const facts = await attemptFacts(token);
  const returnToken = await createDokuReturnToken(ROOT_SECRET, facts.attempt_id, facts.order_number);
  return buildDokuAccessCookie(facts.order_number, returnToken);
}

function statusRequest(orderNumber: string, cookie: string | null) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (cookie) headers.set("Cookie", cookie);
  return new Request("https://shop.example/api/payments/doku/status", {
    method: "POST",
    headers,
    body: JSON.stringify({ order_number: orderNumber }),
  });
}

function retryRequest(orderNumber: string, cookie: string | null) {
  const headers = new Headers({
    "Content-Type": "application/json",
    "User-Agent": "payment-access-test",
    "CF-Connecting-IP": "203.0.113.44",
  });
  if (cookie) headers.set("Cookie", cookie);
  return new Request("https://shop.example/api/payments/doku/retry", {
    method: "POST",
    headers,
    body: JSON.stringify({ order_number: orderNumber }),
  });
}

test("callback query capability is exchanged for a bounded HttpOnly cookie without mutating payment state", async () => {
  const variantId = 34001;
  const token = "access-callback-token-34001";
  await createAttempt(variantId, token);
  const facts = await attemptFacts(token);
  const returnToken = await returnTokenFor(token);

  const exchange = await exchangeDokuCallbackQuery(
    database,
    ROOT_SECRET,
    new URL(`https://shop.example/payment/doku/result?order_number=${facts.order_number}&return_token=${returnToken}&payment_status=SUCCESS`),
    { now: () => NOW },
  );
  assert.equal(exchange.type, "redirect");
  assert.equal(exchange.headers.get("Location"), "/payment/doku/result");
  assert.equal(exchange.headers.get("Cache-Control"), "no-store");
  assert.equal(exchange.headers.get("Referrer-Policy"), "no-referrer");
  const cookie = exchange.headers.get("Set-Cookie") || "";
  assert.match(cookie, /^__Host-mybook_doku_access=INV-\d+\.[a-f0-9]{64};/);
  assert.match(cookie, /Max-Age=1800/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.equal((await attemptFacts(token)).local_status, "pending");
  assert.equal((await attemptFacts(token)).payment_status, "pending");

  const invalid = await exchangeDokuCallbackQuery(
    database,
    ROOT_SECRET,
    new URL(`https://shop.example/payment/doku/cancel?order_number=${facts.order_number}&return_token=${"0".repeat(64)}`),
    { now: () => NOW },
  );
  assert.equal(invalid.type, "redirect");
  assert.equal(invalid.headers.get("Location"), "/payment/doku/cancel");
  assert.match(invalid.headers.get("Set-Cookie") || "", /^__Host-mybook_doku_access=; Max-Age=0;/);
  assert.equal((await attemptFacts(token)).local_status, "pending");
});

test("status reconciliation requires the checkout capability and signed provider truth before mutation", async () => {
  const variantId = 34002;
  const token = "access-status-token-34002";
  await createAttempt(variantId, token);
  const facts = await attemptFacts(token);
  const cookie = await accessCookie(token);
  let calls = 0;

  const denied = await handleDokuStatusRequest({
    request: statusRequest(facts.order_number, null),
    database,
    rootSecret: ROOT_SECRET,
    clientIp: "203.0.113.9",
    fetch: (async () => { calls += 1; throw new Error("must not call provider"); }) as typeof fetch,
    now: () => NOW,
  });
  assert.equal(denied.status, 404);
  assert.equal(calls, 0);

  const wrongOrder = await handleDokuStatusRequest({
    request: statusRequest("INV-WRONG", cookie),
    database,
    rootSecret: ROOT_SECRET,
    clientIp: "203.0.113.9",
    fetch: (async () => { calls += 1; throw new Error("must not call provider"); }) as typeof fetch,
    now: () => NOW,
  });
  assert.equal(wrongOrder.status, 404);
  assert.equal(calls, 0);

  const oversized = await handleDokuStatusRequest({
    request: new Request("https://shop.example/api/payments/doku/status", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ order_number: facts.order_number, padding: "x".repeat(5000) }),
    }),
    database,
    rootSecret: ROOT_SECRET,
    clientIp: "203.0.113.9",
    fetch: (async () => { calls += 1; throw new Error("must not call provider"); }) as typeof fetch,
    now: () => NOW,
  });
  assert.equal(oversized.status, 404);
  assert.equal(calls, 0);

  const mismatched = await handleDokuStatusRequest({
    request: statusRequest(facts.order_number, cookie),
    database,
    rootSecret: ROOT_SECRET,
    clientIp: "203.0.113.9",
    fetch: signedStatusFetch(facts, "SUCCESS", "COMPLETED", {
      order: {
        amount: 999.99,
        invoice_number: facts.merchant_invoice,
        currency: "MYR",
      },
    }),
    now: () => NOW,
  });
  assert.equal(mismatched.status, 502);
  assert.equal((await attemptFacts(token)).local_status, "pending");
  assert.equal(await eventCount(facts.attempt_id, "status"), 0);

  const reconciled = await handleDokuStatusRequest({
    request: statusRequest(facts.order_number, cookie),
    database,
    rootSecret: ROOT_SECRET,
    clientIp: "203.0.113.9",
    fetch: signedStatusFetch(facts, "SUCCESS", "COMPLETED", { future_provider_field: { tolerated: true } }),
    now: () => NOW,
  });
  assert.equal(reconciled.status, 200);
  assert.equal(reconciled.headers.get("Cache-Control"), "no-store");
  assert.equal(reconciled.headers.get("Referrer-Policy"), "no-referrer");
  const payload = await reconciled.json() as { payment: Record<string, unknown> };
  const body = JSON.stringify(payload);
  assert.match(body, /"local_status":"paid"/);
  assert.doesNotMatch(body, /return_token|status_token|aina@example|60123456789|Jalan Buku/i);
  assert.equal("provider_status" in payload.payment, false);
  assert.equal("provider_state" in payload.payment, false);
  assert.equal("channel" in payload.payment, false);
  assert.equal((await attemptFacts(token)).local_status, "paid");
  assert.equal((await attemptFacts(token)).payment_status, "paid");
  assert.equal(await eventCount(facts.attempt_id, "status"), 1);

  let lateCalls = 0;
  const duplicate = await handleDokuStatusRequest({
    request: statusRequest(facts.order_number, cookie),
    database,
    rootSecret: ROOT_SECRET,
    clientIp: "203.0.113.9",
    fetch: (async () => { lateCalls += 1; throw new Error("must not call after terminal"); }) as typeof fetch,
    now: () => NOW,
  });
  assert.equal(duplicate.status, 200);
  assert.equal(lateCalls, 0);
  assert.equal(await eventCount(facts.attempt_id, "status"), 1);
});

test("status retrieval cannot replace a malformed provider channel with the committed channel", async () => {
  for (const [index, channel] of ["ewallet_tng", "", null, 42, {}, "UNKNOWN"].entries()) {
    const token = `malformed-channel-3490${index}`;
    await createAttempt(34900 + index, token);
    const facts = await attemptFacts(token);
    const response = await handleDokuStatusRequest({
      request: statusRequest(facts.order_number, await accessCookie(token)),
      database, rootSecret: ROOT_SECRET, clientIp: `203.0.113.${100 + index}`,
      fetch: signedStatusFetch(facts, "SUCCESS", "COMPLETED", { payment: {
        amount: facts.amount_sen / 100, currency: "MYR", channel,
        status: "SUCCESS", state: "COMPLETED",
      }}),
      now: () => NOW,
    });
    assert.equal(response.status, 502, `invalid channel case ${index} must be refused`);
    const state = await attemptFacts(token);
    assert.equal(state.local_status, "pending");
    assert.equal(state.payment_status, "pending");
    assert.equal(state.channel, "INTERNET_BANKING_FPX");
    assert.equal(await eventCount(facts.attempt_id, "status"), 0);
  }
});

test("retry reuses the same order, re-reserves restored stock once, and returns no capability or PII", async () => {
  const variantId = 34003;
  const token = "access-retry-token-34003";
  await createAttempt(variantId, token);
  await expireAttempt(token);
  const expired = await attemptFacts(token);
  const cookie = await accessCookie(token);
  assert.equal(expired.local_status, "expired");
  assert.equal(expired.payment_status, "failed");
  assert.ok(expired.stock_restored_at);
  assert.equal(await stock(variantId), 3);

  let providerCalls = 0;
  const response = await handleDokuRetryRequest({
    request: retryRequest(expired.order_number, cookie),
    database,
    rootSecret: ROOT_SECRET,
    clientIp: "203.0.113.44",
    userAgent: "payment-access-test",
    fetch: checkoutFetch((payload, headers) => {
      providerCalls += 1;
      assert.equal(payload.order.amount, 40.9);
      assert.equal(payload.order.currency, "MYR");
      assert.equal(payload.checkout_experience.language, "MS");
      assert.deepEqual(payload.checkout_experience.payment_channels, ["INTERNET_BANKING_FPX"]);
      assert.match(payload.checkout_experience.callback_url, /^https:\/\/shop\.example\/payment\/doku\/return\?/);
      const callback = new URL(payload.checkout_experience.callback_url);
      assert.equal(callback.searchParams.get("order_number"), expired.order_number);
      assert.match(callback.searchParams.get("return_token") || "", /^[a-f0-9]{64}$/);
      assert.equal(callback.searchParams.has("status_token"), false);
      assert.match(headers.get("Idempotency-Id") || "", /^retry_[a-f0-9]{64}$/);
    }),
    now: () => NOW,
  });
  const retryText = await response.text();
  assert.equal(response.status, 200, retryText);
  const retryPayload = JSON.stringify(JSON.parse(retryText));
  const firstRetryUrl = JSON.parse(retryText).checkout_url as string;
  assert.match(retryPayload, /"checkout_url":"https:\/\/sandbox\.doku\.com\/checkout-link-v3\/pay_[a-f0-9]{40}"/);
  assert.doesNotMatch(retryPayload, /return_token|status_token|aina@example|60123456789|Jalan Buku/i);
  assert.match(response.headers.get("Set-Cookie") || "", /^__Host-mybook_doku_access=INV-\d+\.[a-f0-9]{64};/);
  assert.equal(providerCalls, 1);
  assert.equal(await attemptCount(token), 2);
  assert.equal(await stock(variantId), 2);
  const active = await attemptFacts(token);
  assert.equal(active.local_status, "pending");
  assert.equal(active.payment_status, "pending");
  assert.equal(active.stock_restored_at, null);
  assert.equal(active.channel, "INTERNET_BANKING_FPX");
  assert.equal((await loadDokuPaymentAccessFromCookie(
    database,
    ROOT_SECRET,
    cookie,
    expired.order_number,
    { now: () => NOW },
  ))?.attemptId, active.attempt_id);

  const reused = await handleDokuRetryRequest({
    request: retryRequest(expired.order_number, cookie),
    database,
    rootSecret: ROOT_SECRET,
    clientIp: "203.0.113.44",
    userAgent: "payment-access-test",
    fetch: (async () => { providerCalls += 1; throw new Error("active attempt must be reused"); }) as typeof fetch,
    now: () => NOW,
  });
  assert.equal(reused.status, 200);
  assert.equal(providerCalls, 1);
  assert.equal(await attemptCount(token), 2);
  assert.equal(await stock(variantId), 2);

  await database.prepare("UPDATE payment_attempts SET expires_at = ? WHERE id = ?")
    .bind(new Date(NOW.getTime() - 1).toISOString(), active.attempt_id).run();
  let statusCalls = 0;
  let renewalCalls = 0;
  const expiredActiveFetch = (async (url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === "GET") {
      statusCalls += 1;
      return signedStatusFetch(active, "EXPIRED", "EXPIRED")(url, init);
    }
    renewalCalls += 1;
    return checkoutFetch()(url, init);
  }) as typeof fetch;
  const renewed = await handleDokuRetryRequest({
    request: retryRequest(expired.order_number, cookie),
    database,
    rootSecret: ROOT_SECRET,
    clientIp: "203.0.113.44",
    userAgent: "payment-access-test",
    fetch: expiredActiveFetch,
    now: () => NOW,
  });
  const renewedText = await renewed.text();
  assert.equal(renewed.status, 200, renewedText);
  assert.notEqual(JSON.parse(renewedText).checkout_url, firstRetryUrl);
  assert.equal(statusCalls, 1);
  assert.equal(renewalCalls, 1);
  assert.equal(await attemptCount(token), 3);
  assert.equal(await stock(variantId), 2);

  await database.prepare("UPDATE payment_attempts SET created_at = ? WHERE id = ?")
    .bind(new Date(NOW.getTime() - DOKU_RETURN_CAPABILITY_TTL_MS).toISOString(), expired.attempt_id)
    .run();
  assert.equal(await loadDokuPaymentAccessFromCookie(
    database,
    ROOT_SECRET,
    cookie,
    expired.order_number,
    { now: () => NOW },
  ), null, "an expired historical capability must not inherit the newest attempt's lifetime");
});

test("DOKU return capability expires at 24 hours before recovery or provider traffic", async () => {
  const variantId = 34008;
  const token = "access-expired-capability-token-34008";
  await createAttempt(variantId, token);
  const facts = await attemptFacts(token);
  const returnToken = await returnTokenFor(token);
  const cookie = buildDokuAccessCookie(facts.order_number, returnToken);

  await database.prepare("UPDATE payment_attempts SET created_at = ? WHERE id = ?")
    .bind(new Date(NOW.getTime() - DOKU_RETURN_CAPABILITY_TTL_MS + 1).toISOString(), facts.attempt_id)
    .run();
  const insideWindow = await exchangeDokuCallbackQuery(
    database,
    ROOT_SECRET,
    new URL(`https://shop.example/payment/doku/return?order_number=${facts.order_number}&return_token=${returnToken}`),
    { now: () => NOW },
  );
  assert.equal(insideWindow.type, "redirect");
  assert.equal(insideWindow.accepted, true);

  await database.prepare("UPDATE payment_attempts SET created_at = ? WHERE id = ?")
    .bind(new Date(NOW.getTime() - DOKU_RETURN_CAPABILITY_TTL_MS).toISOString(), facts.attempt_id)
    .run();
  for (const route of ["return", "result", "cancel"]) {
    const exchange = await exchangeDokuCallbackQuery(
      database,
      ROOT_SECRET,
      new URL(`https://shop.example/payment/doku/${route}?order_number=${facts.order_number}&return_token=${returnToken}`),
      { now: () => NOW },
    );
    assert.equal(exchange.type, "redirect");
    assert.equal(exchange.accepted, false);
    assert.match(exchange.headers.get("Set-Cookie") || "", /^__Host-mybook_doku_access=; Max-Age=0;/);
  }

  let providerCalls = 0;
  const providerMustNotRun = (async () => {
    providerCalls += 1;
    throw new Error("expired capability must fail before provider traffic");
  }) as typeof fetch;
  const status = await handleDokuStatusRequest({
    request: statusRequest(facts.order_number, cookie),
    database,
    rootSecret: ROOT_SECRET,
    clientIp: "203.0.113.48",
    fetch: providerMustNotRun,
    now: () => NOW,
  });
  const retry = await handleDokuRetryRequest({
    request: retryRequest(facts.order_number, cookie),
    database,
    rootSecret: ROOT_SECRET,
    clientIp: "203.0.113.48",
    userAgent: "payment-access-test",
    fetch: providerMustNotRun,
    now: () => NOW,
  });
  assert.equal(status.status, 404);
  assert.match(await status.text(), /DOKU_ACCESS_DENIED/);
  assert.equal(retry.status, 404);
  assert.match(await retry.text(), /DOKU_ACCESS_DENIED/);
  assert.equal(providerCalls, 0);
  assert.equal(await attemptCount(token), 1);
});

test("retry refuses unavailable stock and paid attempts before creating another attempt", async () => {
  const stockVariantId = 34004;
  const stockToken = "access-no-stock-token-34004";
  await createAttempt(stockVariantId, stockToken, 1);
  await expireAttempt(stockToken);
  const stockFacts = await attemptFacts(stockToken);
  await database.prepare("UPDATE product_variants SET stock = 0 WHERE id = ?").bind(stockVariantId).run();

  const unavailable = await handleDokuRetryRequest({
    request: retryRequest(stockFacts.order_number, await accessCookie(stockToken)),
    database,
    rootSecret: ROOT_SECRET,
    clientIp: "203.0.113.45",
    userAgent: "payment-access-test",
    fetch: (async () => { throw new Error("must not call provider"); }) as typeof fetch,
    now: () => NOW,
  });
  assert.equal(unavailable.status, 409);
  assert.match(await unavailable.text(), /DOKU_STOCK_UNAVAILABLE/);
  assert.equal(await attemptCount(stockToken), 1);
  assert.equal((await attemptFacts(stockToken)).local_status, "expired");

  const paidVariantId = 34005;
  const paidToken = "access-paid-token-34005";
  await createAttempt(paidVariantId, paidToken);
  const paidFacts = await attemptFacts(paidToken);
  await applyDokuPaymentFact(database, {
    id: 1,
    environment: "sandbox",
    configRevision: 1,
  }, {
    providerReference: paidFacts.provider_reference,
    merchantInvoice: paidFacts.merchant_invoice,
    amountSen: paidFacts.amount_sen,
    channel: "INTERNET_BANKING_FPX",
    providerStatus: "SUCCESS",
    providerState: "COMPLETED",
    eventKey: `paid:${paidFacts.provider_reference}`,
  }, "status");

  const refused = await handleDokuRetryRequest({
    request: retryRequest(paidFacts.order_number, await accessCookie(paidToken)),
    database,
    rootSecret: ROOT_SECRET,
    clientIp: "203.0.113.46",
    userAgent: "payment-access-test",
    fetch: (async () => { throw new Error("must not call provider"); }) as typeof fetch,
    now: () => NOW,
  });
  assert.equal(refused.status, 409);
  assert.match(await refused.text(), /DOKU_RETRY_NOT_ALLOWED/);
  assert.equal(await attemptCount(paidToken), 1);
  assert.equal((await attemptFacts(paidToken)).local_status, "paid");
});

test("retry refuses a corrupt persisted money value at the surface, before any provider call", async () => {
  // The defect A-260 fixed lived here: create guarded its money fields and
  // retry divided by 100 raw, so a corrupt sen value was refused on the way in
  // and sent to the provider on the way back. The independent review noted the
  // fix was only asserted against the builder in isolation, never through the
  // surface that had the bug. This is that assertion.
  const variantId = 34095;
  const token = "access-corrupt-amount-token-34095";
  await createAttempt(variantId, token);
  await expireAttempt(token);
  const expired = await attemptFacts(token);
  const cookie = await accessCookie(token);

  // Corrupting `orders.total_amount` cannot reach the builder: `accessFromRow`
  // already refuses a non-integer total and the request dies as 404 at the
  // capability layer — defence in depth that was there before A-260. The line
  // item's `unit_price` is not covered by that check, reaches the builder
  // through `loadRetryOrder`, and is exactly what the old retry path would have
  // divided by 100 and shipped. Written straight to D1 because no code path
  // produces it.
  await database.prepare(`
    UPDATE order_items SET unit_price = ?
    WHERE order_id = (SELECT id FROM orders WHERE order_number = ?)
  `).bind(32.9, expired.order_number).run();

  let providerCalls = 0;
  const response = await handleDokuRetryRequest({
    request: retryRequest(expired.order_number, cookie),
    database,
    rootSecret: ROOT_SECRET,
    clientIp: "203.0.113.44",
    userAgent: "payment-access-test",
    fetch: (async () => {
      providerCalls += 1;
      throw new Error("a corrupt amount must never reach the provider");
    }) as typeof fetch,
    now: () => NOW,
  });

  assert.equal(response.status, 409);
  assert.match(await response.text(), /DOKU_CONFLICT/);
  assert.equal(providerCalls, 0, "the refusal must land before provider transport");
  // A-268: a refusal raised before the provider is contacted still owes the
  // operator a reason. This left `error_class` NULL while a provider failure
  // set it, so the system log rendered the one an operator could actually fix
  // with no reason at all. `local_transition` rather than `provider`, because
  // the corrupt value is on this side and DOKU was never asked.
  // Read the attempt this retry created, not "the newest": both attempts carry
  // the same `created_at` because the clock is injected and fixed, so
  // `attemptFacts` falls through to a lexicographic `id DESC` tiebreak and
  // returns either one. That made this assertion fail about one run in four.
  const refused = await database.prepare(`
    SELECT pa.error_class FROM payment_attempts pa
    JOIN orders o ON o.id = pa.order_id
    WHERE o.submit_token = ? AND pa.local_status = 'created'
  `).bind(token).first<{ error_class: string | null }>();
  assert.equal(refused?.error_class, "local_transition");
});

test("retry refuses when the original channel is no longer enabled", async () => {
  const variantId = 34006;
  const token = "access-disabled-channel-token-34006";
  await createAttempt(variantId, token);
  await expireAttempt(token);
  const terminalCases = [];
  for (const [index, state] of ["paid", "cancelled", "returned"].entries()) {
    const caseToken = `access-disabled-terminal-${state}`;
    await createAttempt(34009 + index, caseToken);
    await expireAttempt(caseToken);
    terminalCases.push({ state, token: caseToken, facts: await attemptFacts(caseToken), cookie: await accessCookie(caseToken) });
  }
  const activeToken = "access-disabled-active-34012";
  await createAttempt(34012, activeToken);
  const activeFacts = await attemptFacts(activeToken);
  const activeCookie = await accessCookie(activeToken);
  const expired = await attemptFacts(token);
  const cookie = await accessCookie(token);
  await database.prepare(`
    UPDATE payment_provider_configs
    SET enabled_channels_json = '["EWALLET_TNG"]'
    WHERE provider = 'doku'
  `).run();
  try {
    let providerCalls = 0;
    const response = await handleDokuRetryRequest({
      request: retryRequest(expired.order_number, cookie),
      database,
      rootSecret: ROOT_SECRET,
      clientIp: "203.0.113.47",
      userAgent: "payment-access-test",
      fetch: (async () => {
        providerCalls += 1;
        throw new Error("must not call provider");
      }) as typeof fetch,
      now: () => NOW,
    });
    assert.equal(response.status, 409);
    const refusal = await response.json() as { code: string; error: string };
    assert.equal(refusal.code, "DOKU_CHANNEL_DISABLED");
    assert.equal(refusal.error, DOKU_CHANNEL_DISABLED_MESSAGE);
    const access = await loadDokuPaymentAccessFromCookie(database, ROOT_SECRET, cookie, undefined, { now: () => NOW });
    assert.ok(access);
    const summary = await summarizeDokuPaymentForRecovery(database, ROOT_SECRET, access);
    assert.equal(summary.can_retry, false);
    assert.equal(summary.retry_blocked_reason, "DOKU_CHANNEL_DISABLED");
    assert.equal(summary.local_status, "expired");
    const status = await handleDokuStatusRequest({
      request: new Request("https://shop.example/api/payments/doku/status", {
        method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json", Origin: "https://shop.example" },
        body: JSON.stringify({ order_number: expired.order_number }),
      }), database, rootSecret: ROOT_SECRET, clientIp: "203.0.113.47", now: () => NOW,
      fetch: (async () => { providerCalls++; throw new Error("must not call provider"); }) as typeof fetch,
    });
    assert.equal(status.status, 200);
    assert.deepEqual((await status.json() as {payment: unknown}).payment, summary);
    const unavailable = await summarizeDokuPaymentForRecovery(database, "fictional-wrong-root", access);
    assert.equal(unavailable.retry_blocked_reason, null);
    assert.equal(unavailable.can_retry, true);
    const paid = await summarizeDokuPaymentForRecovery(database, ROOT_SECRET, { ...access, localStatus: "paid", orderPaymentStatus: "paid" });
    assert.equal(paid.retry_blocked_reason, null);
    assert.equal(paid.can_retry, false);
    assert.equal(providerCalls, 0);
    assert.equal(await attemptCount(token), 1);
    // Terminal order truth takes precedence; each irreversible state owns a fixture.
    for (const fixture of terminalCases) {
      await database.prepare("UPDATE orders SET payment_status = ?, shipping_status = ? WHERE id = ?")
        .bind(fixture.state === "paid" ? "paid" : "failed", fixture.state === "paid" ? "pending" : fixture.state, fixture.facts.order_id).run();
      const before = await attemptFacts(fixture.token);
      const refusal = await handleDokuRetryRequest({
        request: retryRequest(fixture.facts.order_number, fixture.cookie), database, rootSecret: ROOT_SECRET,
        clientIp: "203.0.113.47", userAgent: "payment-access-test", now: () => NOW,
        fetch: (async () => { providerCalls++; throw new Error("must not call provider"); }) as typeof fetch,
      });
      assert.equal(refusal.status, 409);
      assert.equal((await refusal.json() as {code: string}).code, "DOKU_RETRY_NOT_ALLOWED");
      assert.deepEqual(await attemptFacts(fixture.token), before);
      assert.equal(await attemptCount(fixture.token), 1);
    }
    const beforeActive = await attemptFacts(activeToken);
    const activeRefusal = await handleDokuRetryRequest({
      request: retryRequest(activeFacts.order_number, activeCookie), database, rootSecret: ROOT_SECRET,
      clientIp: "203.0.113.47", userAgent: "payment-access-test", now: () => NOW,
      fetch: (async () => { providerCalls++; throw new Error("must not call provider"); }) as typeof fetch,
    });
    assert.equal(activeRefusal.status, 503);
    assert.equal((await activeRefusal.json() as {code: string}).code, "DOKU_UNAVAILABLE");
    assert.deepEqual(await attemptFacts(activeToken), beforeActive);
    assert.equal(await attemptCount(activeToken), 1);
    assert.equal(providerCalls, 0);
    assert.equal(await attemptCount(token), 1);
  } finally {
    await database.prepare(`
      UPDATE payment_provider_configs
      SET enabled_channels_json = '["INTERNET_BANKING_FPX","EWALLET_TNG"]'
      WHERE provider = 'doku'
    `).run();
  }
});

test("DOKU recovery pages keep capabilities out of analytics while result owns paid browser Purchase", () => {
  for (const route of ["return", "cancel"]) {
    const source = readFileSync(new URL(`../pages/payment/doku/${route}.astro`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /BaseLayout|AdsBase|__MYBOOK_TRACK__|__MYBOOK_GOOGLE_PURCHASE__/);
    assert.doesNotMatch(source, /localStorage|sessionStorage/);
    assert.doesNotMatch(source, /return_token|status_token|customerEmail|customerPhone|customerName/);
  }

  const result = readFileSync(new URL("../pages/payment/doku/result.astro", import.meta.url), "utf8");
  assert.doesNotMatch(result, /BaseLayout|return_token|status_token|customerEmail|customerPhone|customerName/);
  assert.match(result, /<AdsBase purchaseOnly\s*\/>/);
  assert.match(result, /local_status\s*!==\s*'paid'/);
  assert.match(result, /eventId:\s*`purchase:\$\{access\.orderNumber\}`/);
  assert.match(result, /__MYBOOK_TRACK__\?\.\('Purchase'/);
  assert.match(result, /__MYBOOK_GOOGLE_PURCHASE__\?\.\(/);

  const adsBase = readFileSync(
    new URL("../components/storefront/tracking/AdsBase.astro", import.meta.url),
    "utf8",
  );
  assert.match(adsBase, /metaPixelId\s*&&\s*!purchaseOnly/);
  assert.match(adsBase, /if \(metaPixelId\s*&&\s*!purchaseOnly\)/);

  const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
  assert.match(
    middleware,
    /if \(!response\.headers\.has\(['"]Referrer-Policy['"]\)\)\s*\{\s*response\.headers\.set\(['"]Referrer-Policy['"], ['"]strict-origin-when-cross-origin['"]\);\s*\}/s,
    "global middleware must preserve the stricter no-referrer policy owned by DOKU recovery routes",
  );
});

test("unsupported DOKU recovery API methods fail closed with private headers", async () => {
  for (const fallback of [statusMethodFallback, retryMethodFallback]) {
    const response = await fallback({} as never);
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("Allow"), "POST");
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.get("Referrer-Policy"), "no-referrer");
    assert.equal(await response.text(), "");
  }
});

test("the buyer-facing capability endpoints stop spending provider calls without bound", async () => {
  // Each call reaches the merchant's DOKU credentials. Neither was bounded,
  // while the checkout endpoints beside them are and the scheduled reconciler
  // leases and backs off. A buyer with their own valid cookie could loop either
  // one and turn a single order into unbounded outbound traffic on the
  // merchant's quota.
  const variantId = 34090;
  const token = "access-ratelimit-token-34090";
  await createAttempt(variantId, token);
  const facts = await attemptFacts(token);
  const cookie = await accessCookie(token);

  const store = new Map<string, string>();
  const sessions = {
    async get(key: string) { return store.get(key) ?? null; },
    async put(key: string, value: string) { store.set(key, value); },
  } as unknown as KVNamespace;

  let providerCalls = 0;
  const attempt = () =>
    handleDokuStatusRequest({
      request: statusRequest(facts.order_number, cookie),
      database,
      rootSecret: ROOT_SECRET,
      sessions,
      clientIp: "203.0.113.77",
      fetch: (async () => {
        providerCalls += 1;
        throw new Error("provider unavailable");
      }) as typeof fetch,
      now: () => NOW,
    });

  const statuses: number[] = [];
  for (let index = 0; index < 20; index += 1) statuses.push((await attempt()).status);

  assert.ok(statuses.includes(429), "an unbounded loop was never refused");
  // The bound is what protects the quota, so the provider must stop being
  // reached once it bites — not merely have its answer discarded.
  assert.ok(
    providerCalls < statuses.length,
    `every one of ${statuses.length} attempts still reached the provider`,
  );

  const refused = await attempt();
  assert.equal(refused.status, 429);
  assert.ok(refused.headers.get("retry-after"), "a refused caller is told when to come back");
  // And the refusal stays uncacheable, like every other response on this path.
  assert.match(refused.headers.get("cache-control") || "", /no-store/);
});

test("without a KV binding the capability bound fails open rather than stranding a payment", async () => {
  // A missing binding must not leave a legitimate buyer unable to recover a
  // payment they already made.
  const variantId = 34091;
  const token = "access-ratelimit-open-34091";
  await createAttempt(variantId, token);
  const facts = await attemptFacts(token);
  const cookie = await accessCookie(token);

  const response = await handleDokuStatusRequest({
    request: statusRequest(facts.order_number, cookie),
    database,
    rootSecret: ROOT_SECRET,
    sessions: undefined,
    clientIp: "203.0.113.78",
    fetch: (async () => { throw new Error("provider unavailable"); }) as typeof fetch,
    now: () => NOW,
  });
  assert.notEqual(response.status, 429);
});

test("recovery client preserves disabled-channel restriction through stale responses", async () => {
const message = 'Fixture channel disabled';
for (const route of ['return', 'result', 'cancel']) {
  const source = readFileSync(`src/pages/payment/doku/${route}.astro`, 'utf8');
  const script = source.match(/<script is:inline define:vars=[^\n]+>\n([\s\S]*?)<\/script>/)![1];
  const nodes = new Map<string, any>();
  const events: string[] = [];
  const document = { getElementById(id: string) {
    if (!nodes.has(id)) nodes.set(id, {textContent:'', disabled:false, _hidden:false,
      set hidden(v: boolean) { this._hidden=v; events.push(`${id}:hidden:${v}`); }, get hidden() {return this._hidden;},
      setAttribute(k: string,v: string){(this as any)[k]=v;}, focus(){events.push(`${id}:focus`);},
      classList:{toggle(k: string,v: boolean){events.push(`${id}:${k}:${v}`);}},
      addEventListener(k: string,v: unknown){(this as any)[k]=v;}
    });
    return nodes.get(id);
  }};
  const initialPayment = { local_status:'failed', can_retry:true, can_reconcile:false, retry_blocked_reason:null, order_number:'FIXTURE', total_amount:100 };
  let reply: any = {success:false,code:'DOKU_PROVIDER_FAILED',error:'Transient failure'};
  let calls = 0;
  vm.runInNewContext(script, {initialPayment, channelDisabledMessage:message, purchaseSignal:null, document, window:{}, Intl, fetch:async()=>{calls++;return{json:async()=>reply};}});
  const retry=document.getElementById('retry-payment');
  await retry.click();
  assert.equal(retry.disabled,false,`${route}: transient retry remains enabled`);
  assert.equal(document.getElementById('payment-message').textContent,'Transient failure');
  events.length=0;
  reply={success:false,code:'DOKU_CHANNEL_DISABLED'};
  await retry.click();
  assert.equal(retry.hidden,true);
  assert.equal(retry.disabled,true);
  assert.ok(events.indexOf('payment-message:focus')<events.indexOf('retry-payment:hidden:true'));
  assert.equal(document.getElementById('contact-store').hidden,false);
  assert.equal(document.getElementById('payment-message').textContent,message);
  const before=calls;
  await retry.click();
  assert.equal(calls,before,'blocked programmatic retry sends nothing');
  reply={success:true,payment:initialPayment};
  await document.getElementById('refresh-status').click();
  assert.equal(retry.hidden,true,'stale response cannot restore retry');
  assert.equal(document.getElementById('payment-message').textContent,message,'success cannot overwrite explanation');
  reply={success:true,payment:{...initialPayment,local_status:'paid',can_retry:false}};
  await document.getElementById('refresh-status').click();
  assert.equal(retry.hidden,true);
  assert.equal(document.getElementById('contact-store').hidden,true);
  assert.notEqual(document.getElementById('payment-message').textContent,message);

}

});
