import assert from "node:assert/strict";
import test from "node:test";
import {
  DOKU_API_VERSIONS,
  DokuClient,
  DokuClientError,
  assertDokuMyrPayload,
  dokuBasicAuthorization,
} from "./doku-client.ts";
import { createDokuGlobalResponseSignature } from "./doku-signature.ts";

const CLIENT_ID = "BRN-0239-1709018494325";
const API_KEY = "api-key-test";
const SECRET_KEY = "doku-test-secret";
const REQUEST_TIME = new Date("2026-08-11T06:39:29Z");
const RESPONSE_TIME = "2026-08-11T06:39:30Z";

async function signedResponse(
  body: string,
  options: {
    status?: number;
    clientId?: string;
    signatureBody?: string;
    timestamp?: string;
    apiVersion?: string;
    contentType?: string;
    extraHeaders?: Record<string, string>;
  } = {},
) {
  const clientId = options.clientId ?? CLIENT_ID;
  const timestamp = options.timestamp ?? RESPONSE_TIME;
  const signature = await createDokuGlobalResponseSignature({
    clientId,
    responseTimestamp: timestamp,
    rawBody: options.signatureBody ?? body,
    secretKey: SECRET_KEY,
  });
  return new Response(body, {
    status: options.status ?? 200,
    headers: {
      "Client-Id": clientId,
      "Response-Timestamp": timestamp,
      Signature: signature,
      "API-Version": options.apiVersion ?? DOKU_API_VERSIONS.createCheckout,
      "Content-Type": options.contentType ?? "application/json",
      ...options.extraHeaders,
    },
  });
}

function unsignedResponse(
  body: string,
  options: {
    status?: number;
    clientId?: string;
    timestamp?: string;
    apiVersion?: string;
    contentType?: string;
    extraHeaders?: Record<string, string>;
  } = {},
) {
  return new Response(body, {
    status: options.status ?? 200,
    headers: {
      "Client-Id": options.clientId ?? CLIENT_ID,
      "Response-Timestamp": options.timestamp ?? RESPONSE_TIME,
      "API-Version": options.apiVersion ?? DOKU_API_VERSIONS.createCheckout,
      "Content-Type": options.contentType ?? "application/json",
      ...options.extraHeaders,
    },
  });
}

function client(fetchImplementation: typeof fetch, timeoutMs = 1_000) {
  return new DokuClient({
    environment: "sandbox",
    clientId: CLIENT_ID,
    apiKey: API_KEY,
    secretKey: SECRET_KEY,
    fetch: fetchImplementation,
    now: () => REQUEST_TIME,
    timeoutMs,
  });
}

test("create Checkout sends Basic auth, endpoint version, idempotency, and exact signed body", async () => {
  const rawBody = '{"id":"ID-1","order":{"amount":10.25,"currency":"MYR","invoice_number":"INV-1"}}';
  let observed: { url: string; init: RequestInit } | undefined;
  const doku = client(async (url, init) => {
    observed = { url: String(url), init: init ?? {} };
    return signedResponse(
      '{"id":"ID-1","order":{"amount":10.25,"currency":"MYR","invoice_number":"INV-1"},"payment":{"amount":10.25,"currency":"MYR","status":"PENDING"}}',
    );
  });

  const result = await doku.createCheckout<{ payment: { status: string } }>({
    rawBody,
    idempotencyId: "checkout-idempotency-1",
    expectedAmountSen: 1025,
  });
  assert.equal(result.data.payment.status, "PENDING");
  assert.equal(observed?.url, "https://api-sandbox.doku.com/v3/checkouts");
  const headers = new Headers(observed?.init.headers);
  assert.equal(headers.get("Authorization"), "Basic YXBpLWtleS10ZXN0Og==");
  assert.equal(headers.get("Client-Id"), CLIENT_ID);
  assert.equal(headers.get("Request-Timestamp"), "2026-08-11T06:39:29.000Z");
  assert.equal(headers.get("API-Version"), DOKU_API_VERSIONS.createCheckout);
  assert.equal(headers.get("Idempotency-Id"), "checkout-idempotency-1");
  assert.match(headers.get("Signature") ?? "", /^HMACSHA256=[A-Za-z0-9+/]{43}=$/);
  assert.deepEqual(new Uint8Array(observed?.init.body as ArrayBuffer), new TextEncoder().encode(rawBody));
  assert.equal(observed?.init.redirect, "manual");
});

test("retrieve Checkout uses its endpoint contract and signs a bodyless GET", async () => {
  let observed: RequestInit | undefined;
  const doku = client(async (_url, init) => {
    observed = init;
    return signedResponse(
      '{"id":"ID-192837465","order":{"amount":10.25,"currency":"MYR"},"payment":{"amount":10.25,"currency":"MYR","status":"SUCCESS"}}',
      { apiVersion: DOKU_API_VERSIONS.retrieveCheckout },
    );
  });
  await doku.retrieveCheckout({ checkoutId: "ID-192837465", expectedAmountSen: 1025 });
  const headers = new Headers(observed?.headers);
  assert.equal(observed?.method, "GET");
  assert.equal(observed?.body, undefined);
  assert.equal(headers.get("API-Version"), DOKU_API_VERSIONS.retrieveCheckout);
  assert.equal(headers.has("Idempotency-Id"), false);
});

test("MYR and D1-owned amount mismatch is refused before or after transport", async () => {
  assert.throws(
    () => assertDokuMyrPayload({ order: { amount: 10.251, currency: "MYR" } }, 1025),
    (error: unknown) => error instanceof DokuClientError && error.code === "DOKU_AMOUNT_MISMATCH",
  );
  let calls = 0;
  const doku = client(async () => {
    calls += 1;
    return signedResponse('{"id":"ID-MISMATCH","order":{"amount":9,"currency":"MYR","invoice_number":"INV-MISMATCH"}}');
  });
  await assert.rejects(
    doku.createCheckout({
      rawBody: '{"id":"ID-MISMATCH","order":{"amount":10.25,"currency":"USD","invoice_number":"INV-MISMATCH"}}',
      idempotencyId: "currency-mismatch",
      expectedAmountSen: 1025,
    }),
    (error: unknown) => error instanceof DokuClientError && error.code === "DOKU_AMOUNT_MISMATCH",
  );
  assert.equal(calls, 0);

  await assert.rejects(
    doku.createCheckout({
      rawBody: '{"id":"ID-MISMATCH","order":{"amount":10.25,"currency":"MYR","invoice_number":"INV-MISMATCH"}}',
      idempotencyId: "response-mismatch",
      expectedAmountSen: 1025,
    }),
    (error: unknown) => error instanceof DokuClientError && error.code === "DOKU_AMOUNT_MISMATCH",
  );
});

test("a partial secondary payment fact cannot contradict the complete order amount", () => {
  assert.doesNotThrow(() => assertDokuMyrPayload({
    order: { amount: 10.25, currency: "MYR" },
    payment: { currency: "MYR", status: "PENDING" },
  }, 1025));
  for (const payment of [
    { currency: "USD", status: "PENDING" },
    { amount: 9, status: "PENDING" },
  ]) {
    assert.throws(
      () => assertDokuMyrPayload({
        order: { amount: 10.25, currency: "MYR" },
        payment,
      }, 1025),
      (error: unknown) => error instanceof DokuClientError && error.code === "DOKU_AMOUNT_MISMATCH",
    );
  }
});

test("the narrow signature-absent Checkout envelope accepts exact create and retrieve correlations", async () => {
  const createBody = '{"id":"ID-UNSIGNED","order":{"amount":10.25,"currency":"MYR","invoice_number":"INV-UNSIGNED"},"payment":{"amount":10.25,"currency":"MYR","status":"PENDING"}}';
  const created = await client(async () => unsignedResponse(createBody)).createCheckout<{ id: string }>({
    rawBody: '{"id":"ID-UNSIGNED","order":{"amount":10.25,"currency":"MYR","invoice_number":"INV-UNSIGNED"}}',
    idempotencyId: "unsigned-create",
    expectedAmountSen: 1025,
  });
  assert.equal(created.data.id, "ID-UNSIGNED");

  const retrieved = await client(async () => unsignedResponse(
    '{"id":"ID-UNSIGNED","order":{"amount":10.25,"currency":"MYR","invoice_number":"INV-UNSIGNED"},"payment":{"amount":10.25,"currency":"MYR","status":"SUCCESS"}}',
    { apiVersion: DOKU_API_VERSIONS.retrieveCheckout },
  )).retrieveCheckout<{ id: string }>({ checkoutId: "ID-UNSIGNED", expectedAmountSen: 1025 });
  assert.equal(retrieved.data.id, "ID-UNSIGNED");
});

test("invalid Checkout envelopes and a present invalid signature fail closed", async () => {
  const request = {
    rawBody: '{"id":"ID-REFUSE","order":{"amount":10.25,"currency":"MYR","invoice_number":"INV-REFUSE"}}',
    idempotencyId: "signature-refusal",
    expectedAmountSen: 1025,
  };
  const validBody = '{"id":"ID-REFUSE","order":{"amount":10.25,"currency":"MYR","invoice_number":"INV-REFUSE"}}';
  for (const fetchImplementation of [
    async () => new Response("{}", { status: 200 }),
    async () => unsignedResponse(validBody, { clientId: "BRN-WRONG" }),
    async () => unsignedResponse(validBody, { timestamp: "2026-08-11T06:30:00Z" }),
    async () => unsignedResponse(validBody, { apiVersion: "wrong-version" }),
    async () => unsignedResponse(validBody, { contentType: "text/plain" }),
    async () => unsignedResponse(validBody, { extraHeaders: { "Request-Id": "cards-shape" } }),
    async () => unsignedResponse(validBody, { extraHeaders: { Signature: "not-a-global-signature" } }),
    async () =>
      signedResponse(validBody, {
        signatureBody: '{"order":{"amount":9,"currency":"MYR"}}',
      }),
  ]) {
    await assert.rejects(
      client(fetchImplementation as typeof fetch).createCheckout(request),
      (error: unknown) =>
        error instanceof DokuClientError &&
        ["DOKU_RESPONSE_HEADERS", "DOKU_RESPONSE_SIGNATURE"].includes(error.code),
    );
  }
});

test("Checkout identity and create invoice mismatches fail after envelope authentication", async () => {
  const request = {
    rawBody: '{"id":"ID-CORRELATED","order":{"amount":10.25,"currency":"MYR","invoice_number":"INV-CORRELATED"}}',
    idempotencyId: "identity-refusal",
    expectedAmountSen: 1025,
  };
  for (const body of [
    '{"id":"ID-WRONG","order":{"amount":10.25,"currency":"MYR","invoice_number":"INV-CORRELATED"}}',
    '{"id":"ID-CORRELATED","order":{"amount":10.25,"currency":"MYR","invoice_number":"INV-WRONG"}}',
  ]) {
    await assert.rejects(
      client(async () => unsignedResponse(body)).createCheckout(request),
      (error: unknown) => error instanceof DokuClientError && error.code === "DOKU_RESPONSE_BODY",
    );
  }
});

test("timeouts and signed provider errors expose only bounded classifications", async () => {
  const timeoutClient = client(
    ((_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      })) as typeof fetch,
    100,
  );
  await assert.rejects(
    timeoutClient.retrieveCheckout({ checkoutId: "ID-timeout", expectedAmountSen: 1025 }),
    (error: unknown) =>
      error instanceof DokuClientError &&
      error.code === "DOKU_TIMEOUT" &&
      !error.message.includes(SECRET_KEY),
  );

  const providerBody = '{"error":"credential detail that must not escape"}';
  await assert.rejects(
    client(async () => signedResponse(providerBody, {
      status: 401,
      apiVersion: DOKU_API_VERSIONS.retrieveCheckout,
    })).retrieveCheckout({
      checkoutId: "ID-provider-error",
      expectedAmountSen: 1025,
    }),
    (error: unknown) =>
      error instanceof DokuClientError &&
      error.code === "DOKU_HTTP" &&
      error.status === 401 &&
      !error.message.includes("credential detail"),
  );
});

test("provider bodies are bounded before signature or JSON processing", async () => {
  const oversized = "x".repeat(256 * 1024 + 1);
  await assert.rejects(
    client(async () =>
      new Response(oversized, {
        headers: {
          "Client-Id": CLIENT_ID,
          "Response-Timestamp": RESPONSE_TIME,
          Signature: "HMACSHA256=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
          "API-Version": DOKU_API_VERSIONS.retrieveCheckout,
          "Content-Type": "application/json",
        },
      })).retrieveCheckout({ checkoutId: "ID-oversized", expectedAmountSen: 1025 }),
    (error: unknown) =>
      error instanceof DokuClientError && error.code === "DOKU_RESPONSE_BODY",
  );
});

test("configuration, identities, and Cards-only target shapes fail before fetch", async () => {
  assert.equal(dokuBasicAuthorization(API_KEY), "Basic YXBpLWtleS10ZXN0Og==");
  assert.throws(() => dokuBasicAuthorization("key:password"), /DOKU_CONFIGURATION/);
  assert.throws(
    () =>
      new DokuClient({
        environment: "constructor" as "sandbox",
        clientId: CLIENT_ID,
        apiKey: API_KEY,
        secretKey: SECRET_KEY,
      }),
    /DOKU_CONFIGURATION/,
  );
  let calls = 0;
  const doku = client(async () => {
    calls += 1;
    throw new Error("must not run");
  });
  await assert.rejects(
    doku.retrieveCheckout({ checkoutId: "../credit-card/v1/payment-page", expectedAmountSen: 1025 }),
    (error: unknown) => error instanceof DokuClientError && error.code === "DOKU_INVALID_REQUEST",
  );
  await assert.rejects(
    doku.createCheckout({
      rawBody: '{"id":"ID-CARDS","order":{"amount":10.25,"currency":"MYR","invoice_number":"INV-CARDS"}}',
      idempotencyId: "x".repeat(256),
      expectedAmountSen: 1025,
    }),
    (error: unknown) => error instanceof DokuClientError && error.code === "DOKU_INVALID_REQUEST",
  );
  assert.equal(calls, 0);
});
