import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after, before } from "node:test";
import { getPlatformProxy, type PlatformProxy } from "wrangler";
import { saveDokuConfigDraft } from "./doku-config.ts";
import {
  DOKU_API_VERSIONS,
} from "./doku-client.ts";
import {
  DokuCheckoutError,
  createDokuHostedCheckout,
  type DokuCheckoutInput,
} from "./doku-checkout.ts";
import { createDokuGlobalResponseSignature } from "./doku-signature.ts";
import { splitMigrationStatements } from "./schema-version.ts";

type TestEnv = { OMS_DB: D1Database };

const ROOT_SECRET = "test-auth-secret-that-is-at-least-32-characters";
const CLIENT_ID = "BRN-001-0000001";
const API_KEY = "doku_ak_test_example_123456";
const SECRET_KEY = "doku_sk_test_example_654321";
const NOW = new Date("2026-09-01T05:30:00.000Z");

let platform: PlatformProxy<TestEnv>;
let database: D1Database;
let platformDirectory = "";

before(async () => {
  platformDirectory = mkdtempSync(join(tmpdir(), "mybookcms-doku-checkout-"));
  const configPath = join(platformDirectory, "wrangler.jsonc");
  writeFileSync(configPath, JSON.stringify({
    name: "mybookcms-doku-checkout",
    compatibility_date: "2026-08-01",
    d1_databases: [{
      binding: "OMS_DB",
      database_name: "doku-checkout",
      database_id: "00000000-0000-4000-8000-000000000002",
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
      .bind(1, "DOKU Checkout Store", "doku-checkout", NOW.toISOString()),
    database
      .prepare(
        "INSERT INTO products (id, store_id, title, slug, is_active, created_at) VALUES (?, ?, ?, ?, 1, ?)",
      )
      .bind(30001, 1, "Jurnal Fokus Malaysia", "jurnal-fokus-malaysia", NOW.toISOString()),
  ]);
  await saveDokuConfigDraft(database, ROOT_SECRET, {
    environment: "sandbox",
    clientId: CLIENT_ID,
    apiKey: API_KEY,
    secretKey: SECRET_KEY,
    enabledChannels: ["INTERNET_BANKING_FPX", "EWALLET_TNG"],
  });
});

after(async () => {
  await platform?.dispose();
  if (platformDirectory) rmSync(platformDirectory, { recursive: true, force: true });
});

async function seedVariant(id: number, stock = 3) {
  await database
    .prepare(
      "INSERT INTO product_variants (id, product_id, sku, title, price, weight_grams, stock) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(id, 30001, `DOKU-${id}`, `Varian ${id}`, 3290, 500, stock)
    .run();
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
    clientIp: "203.0.113.20",
    userAgent: "MyBookCMS checkout test browser",
  };
}

async function signedResponse(body: string, signatureBody = body) {
  const responseTimestamp = new Date(NOW.getTime() + 1_000).toISOString();
  return new Response(body, {
    headers: {
      "Client-Id": CLIENT_ID,
      "Response-Timestamp": responseTimestamp,
      "API-Version": DOKU_API_VERSIONS.createCheckout,
      Signature: await createDokuGlobalResponseSignature({
        clientId: CLIENT_ID,
        responseTimestamp,
        rawBody: signatureBody,
        secretKey: SECRET_KEY,
      }),
      "Content-Type": "application/json",
    },
  });
}

function unsignedResponse(body: string) {
  return new Response(body, {
    headers: {
      "Client-Id": CLIENT_ID,
      "Response-Timestamp": new Date(NOW.getTime() + 1_000).toISOString(),
      "API-Version": DOKU_API_VERSIONS.createCheckout,
      "Content-Type": "application/json",
    },
  });
}

function successFetch(observe: (payload: Record<string, any>, headers: Headers) => Promise<void> | void) {
  return (async (_url: string | URL | Request, init?: RequestInit) => {
    const rawBody = new TextDecoder().decode(init?.body as ArrayBuffer);
    const payload = JSON.parse(rawBody) as Record<string, any>;
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

function unsignedSuccessFetch(observe: (payload: Record<string, any>) => Promise<void> | void) {
  return (async (_url: string | URL | Request, init?: RequestInit) => {
    const payload = JSON.parse(
      new TextDecoder().decode(init?.body as ArrayBuffer),
    ) as Record<string, any>;
    await observe(payload);
    return unsignedResponse(JSON.stringify({
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

test("disabled DOKU is refused before order persistence or provider transport", async () => {
  const variantId = 31000;
  await seedVariant(variantId);
  let calls = 0;
  await assert.rejects(
    createDokuHostedCheckout(database, ROOT_SECRET, checkoutInput(variantId, "doku-disabled-token-31000"), {
      fetch: (async () => {
        calls += 1;
        throw new Error("must not run");
      }) as typeof fetch,
      now: () => NOW,
    }),
    (error: unknown) => error instanceof DokuCheckoutError && error.code === "DOKU_UNAVAILABLE",
  );
  assert.equal(calls, 0);
  assert.equal(
    (await database.prepare("SELECT COUNT(*) AS count FROM orders WHERE submit_token = ?")
      .bind("doku-disabled-token-31000").first<{ count: number }>())?.count,
    0,
  );
  await database.prepare("UPDATE payment_provider_configs SET is_enabled = 1 WHERE provider = 'doku'").run();
});

test("a known but disabled channel is refused before order persistence or provider transport", async () => {
  const variantId = 31007;
  const token = "doku-disabled-channel-token-31007";
  await seedVariant(variantId);
  let calls = 0;
  await assert.rejects(
    createDokuHostedCheckout(database, ROOT_SECRET, {
      ...checkoutInput(variantId, token),
      selectedChannel: "CREDIT_CARD",
    }, {
      fetch: (async () => {
        calls += 1;
        throw new Error("must not run");
      }) as typeof fetch,
      now: () => NOW,
    }),
    (error: unknown) => error instanceof DokuCheckoutError && error.code === "DOKU_UNAVAILABLE",
  );
  assert.equal(calls, 0);
  assert.equal(
    (await database.prepare("SELECT COUNT(*) AS count FROM orders WHERE submit_token = ?")
      .bind(token).first<{ count: number }>())?.count,
    0,
  );
});

test("one submit commits order, stock, and attempt before one authoritative DOKU call", async () => {
  const variantId = 31001;
  const token = "doku-authoritative-token-31001";
  await seedVariant(variantId);
  let calls = 0;
  let committedBeforeFetch: Record<string, number> | null = null;
  const fetchImplementation = successFetch(async (payload, headers) => {
    calls += 1;
    const counts = await database.prepare(`
      SELECT
        (SELECT COUNT(*) FROM orders WHERE submit_token = ?) AS orders_count,
        (SELECT COUNT(*) FROM payment_attempts pa JOIN orders o ON o.id = pa.order_id WHERE o.submit_token = ?) AS attempts_count,
        (SELECT stock FROM product_variants WHERE id = ?) AS stock
    `).bind(token, token, variantId).first<Record<string, number>>();
    committedBeforeFetch = counts;
    assert.equal(payload.order.amount, 40.9);
    assert.equal(payload.order.currency, "MYR");
    assert.equal(payload.customer.phone, "+60123456789");
    assert.deepEqual(payload.checkout_experience.payment_channels, ["INTERNET_BANKING_FPX"]);
    assert.match(payload.checkout_experience.callback_url, /^https:\/\/shop\.example\/payment\/doku\/return\?/);
    assert.match(payload.checkout_experience.callback_url_cancel, /^https:\/\/shop\.example\/payment\/doku\/cancel\?/);
    const callback = new URL(payload.checkout_experience.callback_url);
    assert.equal(callback.searchParams.has("status_token"), false);
    assert.match(callback.searchParams.get("return_token") || "", /^[a-f0-9]{64}$/);
    assert.match(payload.metadata.device_id, /^[a-f0-9]{64}$/);
    assert.equal(JSON.stringify(payload).includes("203.0.113.20"), false);
    assert.equal(JSON.stringify(payload).includes("MyBookCMS checkout test browser"), false);
    assert.match(headers.get("Idempotency-Id") || "", /^checkout_[a-f0-9]{64}$/);
  });

  const first = await createDokuHostedCheckout(database, ROOT_SECRET, checkoutInput(variantId, token), {
    fetch: fetchImplementation,
    now: () => NOW,
  });
  assert.deepEqual(committedBeforeFetch, { orders_count: 1, attempts_count: 1, stock: 2 });
  assert.equal(first.order.totalAmount, 4090);
  assert.match(first.payment.checkoutUrl, /^https:\/\/sandbox\.doku\.com\/checkout-link-v3\/pay_[a-f0-9]{40}$/);

  const retry = await createDokuHostedCheckout(database, ROOT_SECRET, {
    ...checkoutInput(variantId, token),
    clientIp: "2001:db8::20",
    userAgent: "MyBookCMS retry on another browser",
  }, {
    fetch: fetchImplementation,
    now: () => NOW,
  });
  assert.equal(retry.order.id, first.order.id);
  assert.equal(retry.payment.attemptId, first.payment.attemptId);
  assert.equal(calls, 1);
  assert.equal(
    (await database.prepare("SELECT channel FROM payment_attempts WHERE id = ?")
      .bind(first.payment.attemptId).first<{ channel: string }>())?.channel,
    "INTERNET_BANKING_FPX",
  );
  assert.equal(
    (await database.prepare("SELECT stock FROM product_variants WHERE id = ?").bind(variantId).first<{ stock: number }>())?.stock,
    2,
  );
  assert.equal(
    (await database.prepare("SELECT COUNT(*) AS count FROM capi_event_outbox WHERE event_name = 'Purchase'").first<{ count: number }>())?.count,
    0,
  );
});

test("a DOKU-style signature-absent response persists one exactly correlated pending attempt", async () => {
  const variantId = 31006;
  const token = "doku-unsigned-correlated-token-31006";
  await seedVariant(variantId);
  let calls = 0;
  const result = await createDokuHostedCheckout(database, ROOT_SECRET, checkoutInput(variantId, token), {
    fetch: unsignedSuccessFetch(() => { calls += 1; }),
    now: () => NOW,
  });
  assert.equal(calls, 1);
  assert.match(result.payment.checkoutUrl, /^https:\/\/sandbox\.doku\.com\/checkout-link-v3\//);
  const attempts = await database.prepare(`
    SELECT COUNT(*) AS count, MAX(local_status) AS local_status,
      MAX(provider_reference) AS provider_reference, MAX(checkout_url) AS checkout_url
    FROM payment_attempts pa JOIN orders o ON o.id = pa.order_id
    WHERE o.submit_token = ?
  `).bind(token).first<Record<string, unknown>>();
  assert.equal(attempts?.count, 1);
  assert.equal(attempts?.local_status, "pending");
  assert.equal(attempts?.provider_reference, result.payment.providerReference);
  assert.equal(attempts?.checkout_url, result.payment.checkoutUrl);
});

test("an unauthenticated response stores only a sanitized failure and retries the same attempt", async () => {
  const variantId = 31002;
  const token = "doku-failed-token-31002";
  await seedVariant(variantId);
  await assert.rejects(
    createDokuHostedCheckout(database, ROOT_SECRET, checkoutInput(variantId, token), {
      fetch: (async () => new Response('{"credential":"must not persist"}')) as typeof fetch,
      now: () => NOW,
    }),
    (error: unknown) => error instanceof DokuCheckoutError && error.code === "DOKU_PROVIDER_FAILED",
  );
  const failed = await database.prepare(`
    SELECT pa.id, pa.checkout_url, pa.error_class, pa.local_status
    FROM payment_attempts pa JOIN orders o ON o.id = pa.order_id
    WHERE o.submit_token = ?
  `).bind(token).first<{ id: string; checkout_url: string | null; error_class: string; local_status: string }>();
  assert.ok(failed);
  assert.equal(failed.checkout_url, null);
  assert.equal(failed.error_class, "signature");
  assert.equal(failed.local_status, "created");

  let calls = 0;
  const recovered = await createDokuHostedCheckout(database, ROOT_SECRET, checkoutInput(variantId, token), {
    fetch: successFetch(() => { calls += 1; }),
    now: () => NOW,
  });
  assert.equal(recovered.payment.attemptId, failed.id);
  assert.equal(calls, 1);
  assert.equal(
    (await database.prepare("SELECT stock FROM product_variants WHERE id = ?").bind(variantId).first<{ stock: number }>())?.stock,
    2,
  );
});

test("tampered and amount-mismatched responses persist no checkout URL", async () => {
  for (const [variantId, kind] of [[31004, "tampered"], [31005, "amount"]] as const) {
    const token = `doku-${kind}-token-${variantId}`;
    await seedVariant(variantId);
    await assert.rejects(
      createDokuHostedCheckout(database, ROOT_SECRET, checkoutInput(variantId, token), {
        fetch: (async (_url, init) => {
          const request = JSON.parse(
            new TextDecoder().decode(init?.body as ArrayBuffer),
          ) as Record<string, any>;
          const body = JSON.stringify({
            id: request.id,
            order: {
              amount: kind === "amount" ? 99.99 : request.order.amount,
              invoice_number: request.order.invoice_number,
              currency: "MYR",
              expired_at: request.order.expired_at,
            },
            payment: {
              checkout_url: `https://sandbox.doku.com/checkout-link-v3/${request.id}`,
              status: "PENDING",
              state: "INIT",
            },
          });
          return signedResponse(
            body,
            kind === "tampered" ? '{"signed":"different bytes"}' : body,
          );
        }) as typeof fetch,
        now: () => NOW,
      }),
      (error: unknown) => error instanceof DokuCheckoutError && error.code === "DOKU_PROVIDER_FAILED",
    );
    const attempt = await database.prepare(`
      SELECT pa.checkout_url, pa.error_class
      FROM payment_attempts pa JOIN orders o ON o.id = pa.order_id
      WHERE o.submit_token = ?
    `).bind(token).first<{ checkout_url: string | null; error_class: string }>();
    assert.deepEqual(attempt, { checkout_url: null, error_class: "signature" });
  }
});

test("a reused submit token with changed buyer intent is rejected without another provider call", async () => {
  const variantId = 31003;
  const token = "doku-conflict-token-31003";
  await seedVariant(variantId);
  let calls = 0;
  const fetchImplementation = successFetch(() => { calls += 1; });
  await createDokuHostedCheckout(database, ROOT_SECRET, checkoutInput(variantId, token), {
    fetch: fetchImplementation,
    now: () => NOW,
  });
  await assert.rejects(
    createDokuHostedCheckout(database, ROOT_SECRET, {
      ...checkoutInput(variantId, token),
      address: "99 Jalan Berbeza, Taman Fokus",
    }, {
      fetch: fetchImplementation,
      now: () => NOW,
    }),
    (error: unknown) => error instanceof DokuCheckoutError && error.code === "DOKU_CONFLICT",
  );
  await assert.rejects(
    createDokuHostedCheckout(database, ROOT_SECRET, {
      ...checkoutInput(variantId, token),
      selectedChannel: "EWALLET_TNG",
    }, {
      fetch: fetchImplementation,
      now: () => NOW,
    }),
    (error: unknown) => error instanceof DokuCheckoutError && error.code === "DOKU_CONFLICT",
  );
  assert.equal(calls, 1);
});
