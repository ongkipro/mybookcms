import assert from "node:assert/strict";
import test from "node:test";
import { resolveStoreSiteUrl } from "./store-site-url.ts";

test("an untouched value never blocks an edit to another field", () => {
  // The exact shape the local seed writes. Before this, saving a pickup
  // address on a seeded install failed with "Alamat toko harus memakai https"
  // — an error about a field the operator had not touched.
  const seeded = "http://198.51.100.10:8787";
  const result = resolveStoreSiteUrl(seeded, seeded);
  assert.ok(result.ok);
  assert.equal(result.value, seeded, "the stored value is grandfathered as-is");
});

test("the https rule still applies the moment the value is actually changed", () => {
  const seeded = "http://198.51.100.10:8787";
  const changed = resolveStoreSiteUrl("http://kedai.example", seeded);
  assert.ok(!changed.ok);
  assert.match(changed.error, /https/);

  // Grandfathering must not survive an edit that only differs by port or path.
  const nearlySame = resolveStoreSiteUrl("http://198.51.100.10:8788", seeded);
  assert.ok(!nearlySame.ok, "a different address is a change, however small");
});

test("a valid https value is normalized to its origin", () => {
  const result = resolveStoreSiteUrl("https://kedai.example/produk?x=1", null);
  assert.ok(result.ok);
  assert.equal(result.value, "https://kedai.example", "path and query are dropped");
});

test("empty clears the value; unparseable is refused on its own terms", () => {
  const cleared = resolveStoreSiteUrl("", "https://kedai.example");
  assert.ok(cleared.ok && cleared.value === null);

  const broken = resolveStoreSiteUrl("kedai.example", null);
  assert.ok(!broken.ok);
  assert.match(broken.error, /tidak valid/);
});

test("a stored value is only grandfathered against itself", () => {
  // A fresh install with nothing stored must not be able to submit http.
  const fresh = resolveStoreSiteUrl("http://kedai.example", null);
  assert.ok(!fresh.ok, "an empty stored value grandfathers nothing");
});
