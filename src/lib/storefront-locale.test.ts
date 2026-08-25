import assert from "node:assert/strict";
import test from "node:test";
import {
  formatMyr,
  resolveStorefrontLocale,
} from "./storefront-locale.ts";

test("the Malaysia storefront always resolves to its single public locale", () => {
  assert.equal(resolveStorefrontLocale("ms-MY"), "ms-MY");
  assert.equal(resolveStorefrontLocale("en-MY"), "ms-MY");
  assert.equal(resolveStorefrontLocale("id-ID"), "ms-MY");
  assert.equal(resolveStorefrontLocale(undefined), "ms-MY");
});

test("MYR display converts integer sen through Intl", () => {
  const expected = new Intl.NumberFormat("ms-MY", {
    style: "currency",
    currency: "MYR",
  }).format(890);

  assert.equal(formatMyr(89_000, "ms-MY"), expected);
  assert.equal(formatMyr("89000"), expected);
  assert.equal(formatMyr(Number.NaN), new Intl.NumberFormat("ms-MY", {
    style: "currency",
    currency: "MYR",
  }).format(0));
});
