import assert from "node:assert/strict";
import test from "node:test";
import {
  assertDokuGlobalTarget,
  buildDokuGlobalRequestComponent,
  buildDokuGlobalResponseComponent,
  createDokuGlobalRequestSignature,
  createDokuGlobalResponseSignature,
  dokuBodyDigest,
  isFreshDokuTimestamp,
  readDokuGlobalSignatureHeaders,
  verifyDokuGlobalRequestSignature,
  verifyDokuGlobalResponseSignature,
} from "./doku-signature.ts";

const CLIENT_ID = "BRN-0239-1709018494325";
const SECRET_KEY = "doku-test-secret";
const REQUEST_TIMESTAMP = "2026-08-11T06:39:29Z";
const RESPONSE_TIMESTAMP = "2026-08-11T06:39:30Z";
const NOW = Date.parse(RESPONSE_TIMESTAMP);

test("Global POST vector hashes the exact raw bytes and signs the documented component order", async () => {
  const rawBody = '{"order":{"amount":10.25,"currency":"MYR"}}';
  assert.equal(
    await dokuBodyDigest(rawBody),
    "el2bNyc5l8LJQFykYaWxXoFgIXFJHtVfwt47GqQoS28=",
  );
  assert.equal(
    await buildDokuGlobalRequestComponent({
      clientId: CLIENT_ID,
      requestTimestamp: REQUEST_TIMESTAMP,
      requestTarget: "/v3/checkouts",
      rawBody,
    }),
    `${CLIENT_ID}\n${REQUEST_TIMESTAMP}\n/v3/checkouts\nel2bNyc5l8LJQFykYaWxXoFgIXFJHtVfwt47GqQoS28=`,
  );
  assert.equal(
    await createDokuGlobalRequestSignature({
      clientId: CLIENT_ID,
      requestTimestamp: REQUEST_TIMESTAMP,
      requestTarget: "/v3/checkouts",
      rawBody,
      secretKey: SECRET_KEY,
    }),
    "HMACSHA256=R0BUPIVvyC2kIWCsn4dyvuxeZQmToShEGQWLt0RDCEs=",
  );
  assert.notEqual(await dokuBodyDigest(`${rawBody}\n`), await dokuBodyDigest(rawBody));
});

test("Global GET vector omits the digest line entirely", async () => {
  const requestTarget = "/v3/checkouts/ID-192837465";
  assert.equal(
    await buildDokuGlobalRequestComponent({
      clientId: CLIENT_ID,
      requestTimestamp: REQUEST_TIMESTAMP,
      requestTarget,
    }),
    `${CLIENT_ID}\n${REQUEST_TIMESTAMP}\n${requestTarget}`,
  );
  assert.equal(
    await createDokuGlobalRequestSignature({
      clientId: CLIENT_ID,
      requestTimestamp: REQUEST_TIMESTAMP,
      requestTarget,
      secretKey: SECRET_KEY,
    }),
    "HMACSHA256=KYxKG4LiqdXtWAeXqD9ZxzvY2l/oOZuzk/vc6SqiJko=",
  );
});

test("Global response uses Response-Timestamp and exact response digest", async () => {
  const rawBody = '{"payment":{"amount":10.25,"currency":"MYR","status":"PENDING"}}';
  assert.equal(
    await buildDokuGlobalResponseComponent({
      clientId: CLIENT_ID,
      responseTimestamp: RESPONSE_TIMESTAMP,
      rawBody,
    }),
    `${CLIENT_ID}\n${RESPONSE_TIMESTAMP}\n8ClTNAV+di92izGZGQW+EIe1F1EtpszqxPG1NPyW1yc=`,
  );
  assert.equal(
    await createDokuGlobalResponseSignature({
      clientId: CLIENT_ID,
      responseTimestamp: RESPONSE_TIMESTAMP,
      rawBody,
      secretKey: SECRET_KEY,
    }),
    "HMACSHA256=GfxyvgptWI99S6lWkBAH1au2IyM5LPvPuFKARcSGS6U=",
  );
});

test("verification rejects tampering, wrong target, malformed signatures, and stale timestamps", async () => {
  const rawBody = '{"order":{"amount":10.25,"currency":"MYR"}}';
  const signature = await createDokuGlobalRequestSignature({
    clientId: CLIENT_ID,
    requestTimestamp: REQUEST_TIMESTAMP,
    requestTarget: "/v3/checkouts",
    rawBody,
    secretKey: SECRET_KEY,
  });
  const input = {
    clientId: CLIENT_ID,
    requestTimestamp: REQUEST_TIMESTAMP,
    requestTarget: "/v3/checkouts",
    rawBody,
    secretKey: SECRET_KEY,
    signature,
    now: NOW,
  };
  assert.equal(await verifyDokuGlobalRequestSignature(input), true);
  assert.equal(
    await verifyDokuGlobalRequestSignature({ ...input, rawBody: `${rawBody} ` }),
    false,
  );
  assert.equal(
    await verifyDokuGlobalRequestSignature({ ...input, requestTarget: "/v3/payments" }),
    false,
  );
  assert.equal(
    await verifyDokuGlobalRequestSignature({ ...input, signature: "HMACSHA256=not-base64" }),
    false,
  );
  assert.equal(
    await verifyDokuGlobalRequestSignature({ ...input, now: NOW + 300_001 }),
    false,
  );
  assert.equal(isFreshDokuTimestamp(REQUEST_TIMESTAMP, { now: NOW - 301_001 }), false);
  assert.equal(isFreshDokuTimestamp("2026-02-30T06:39:29Z", { now: NOW }), false);
});

test("response verification is native-HMAC checked and freshness bounded", async () => {
  const rawBody = '{"payment":{"amount":10.25,"currency":"MYR","status":"PENDING"}}';
  const signature = await createDokuGlobalResponseSignature({
    clientId: CLIENT_ID,
    responseTimestamp: RESPONSE_TIMESTAMP,
    rawBody,
    secretKey: SECRET_KEY,
  });
  assert.equal(
    await verifyDokuGlobalResponseSignature({
      clientId: CLIENT_ID,
      responseTimestamp: RESPONSE_TIMESTAMP,
      rawBody,
      secretKey: SECRET_KEY,
      signature,
      now: NOW,
    }),
    true,
  );
  assert.equal(
    await verifyDokuGlobalResponseSignature({
      clientId: CLIENT_ID,
      responseTimestamp: RESPONSE_TIMESTAMP,
      rawBody: `${rawBody}\n`,
      secretKey: SECRET_KEY,
      signature,
      now: NOW,
    }),
    false,
  );
});

test("Cards-only component shapes are refused at the Global boundary", () => {
  for (const target of [
    "/credit-card/v1/payment-page",
    "/check-three-d-secure",
    "/cancellation/credit-card/refund",
    "/tokenization/v2/delete-token",
    "/orders/v1/status/INV-1",
  ]) {
    assert.throws(() => assertDokuGlobalTarget(target), /DOKU_CARDS_SIGNATURE_NOT_ALLOWED/);
  }
  assert.throws(
    () =>
      readDokuGlobalSignatureHeaders(
        new Headers({
          "Client-Id": CLIENT_ID,
          "Request-Id": "cards-request-id",
          "Request-Timestamp": REQUEST_TIMESTAMP,
          Signature: "HMACSHA256=ignored",
        }),
        "request",
      ),
    /DOKU_CARDS_SIGNATURE_NOT_ALLOWED/,
  );
});
