import assert from "node:assert/strict";
import test from "node:test";
import type { Product } from "../data/products.ts";
import { buildEmbedFormUrl, buildFormUrl, resolveFormVariant } from "./form-config.ts";

const product = {
  catalogId: 10001,
  productId: "10001",
  variants: [
    { catalogId: 20001, sku: "AUS-500ML", id: "20001", label: "Alpha - 500ml", price: 150000 },
    { catalogId: 20002, sku: "AUS-1L", id: "20002", label: "Alpha - 1 Liter", price: 300000 },
  ],
} as Product;

test("form variants resolve only by canonical D1 variant ID", () => {
  assert.equal(resolveFormVariant(product)?.catalogId, 20001);
  assert.equal(resolveFormVariant(product, "20002")?.catalogId, 20002);
  assert.equal(resolveFormVariant(product, "AUS-1L"), undefined);
  assert.equal(resolveFormVariant(product, "99999999"), undefined);
});

test("generated URLs expose one mode-less full-form contract", () => {
  assert.equal(buildFormUrl(product, product.variants[1]), "/full-form?product_id=10001&variant_id=20002");
  assert.equal(buildEmbedFormUrl(product, product.variants[1]), "/embed/form?product_id=10001&variant_id=20002");
});
