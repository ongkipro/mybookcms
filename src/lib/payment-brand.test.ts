import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizePaymentBrandCode,
  paymentBrandAsset,
} from "./payment-brand.ts";

test("payment brands expose COD and Malaysia bank options without provider assets", () => {
  assert.equal(paymentBrandAsset("cod"), "/images/payment/cod.webp");
  assert.equal(paymentBrandAsset("MAYBANK"), "");
  assert.equal(paymentBrandAsset("UNSUPPORTED"), "");
});

test("payment brand normalization remains frontend-safe", () => {
  assert.equal(normalizePaymentBrandCode(" maybank "), "MAYBANK");
  assert.equal(normalizePaymentBrandCode("bank_islam"), "BANK_ISLAM");
});
