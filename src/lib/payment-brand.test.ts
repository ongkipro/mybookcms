import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDokuPaymentMethod,
  dokuChannelLabel,
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

test("DOKU channel labels expose buyer copy without leaking unknown codes", () => {
  assert.equal(dokuChannelLabel("INTERNET_BANKING_FPX"), "Perbankan dalam talian FPX");
  assert.equal(dokuChannelLabel("EWALLET_TNG"), "Touch 'n Go eWallet");
  assert.equal(dokuChannelLabel("UNKNOWN"), "");
});

test("DOKU publishes one hosted choice with enabled safe labels only", () => {
  assert.equal(buildDokuPaymentMethod([]), null);
  assert.deepEqual(buildDokuPaymentMethod(["EWALLET_TNG", "UNKNOWN"]), {
    code: "DOKU",
    payment_method: "doku",
    name: "Bayar dalam talian melalui DOKU",
    logo_url: "",
    description: "Pilih kaedah bayaran pada halaman selamat DOKU.",
    is_active: true,
    requires_email: true,
    hosted_redirect: true,
    channels: [{ code: "EWALLET_TNG", label: "Touch 'n Go eWallet" }],
  });
});
