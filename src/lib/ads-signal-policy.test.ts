import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { myrMajorFromSen } from "./ads-signal-policy.ts";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("advertising values convert integer sen to MYR major units", () => {
  assert.equal(myrMajorFromSen(4690), 46.9);
  assert.equal(myrMajorFromSen(0), 0);
});

test("Google consent defaults precede tag configuration and Purchase matching stays Malaysian", () => {
  const base = read("src/components/storefront/tracking/AdsBase.astro");
  const thanks = read("src/pages/thanks.astro");
  assert.ok(base.indexOf("gtag('consent', 'default'") < base.indexOf("gtag('config', googleAdsId)"));
  assert.ok(base.indexOf("gtag('set', 'user_data', userData)") < base.indexOf("gtag('event', 'conversion'"));
  assert.match(base, /currency:\s*'MYR'/);
  assert.match(thanks, /sha256_phone_number/);
  assert.match(thanks, /country:\s*'MY'/);
  assert.match(thanks, /__MYBOOK_GOOGLE_PURCHASE__\?\.\(value, orderNumber, googleUserData\)/);
  assert.match(thanks, /payment_method\s*!==\s*'doku'\s*\|\|\s*statusData\?\.is_paid\s*===\s*true/);
  assert.ok(
    thanks.indexOf("const purchaseEligible") < thanks.indexOf("once(`purchase_${orderNumber}`)"),
    "a pending DOKU response must not consume the browser Purchase dedup key",
  );
});

test("Meta Pixel and CAPI share the first-party visitor identity", () => {
  const base = read("src/components/storefront/tracking/AdsBase.astro");
  const ingress = read("src/pages/api/meta-event.ts");
  const accepted = read("src/lib/accepted-order-meta.ts");
  assert.match(base, /META_EXTERNAL_ID_COOKIE/);
  assert.match(base, /external_id:\s*externalIdHash/);
  assert.match(ingress, /requestBrowserIds\.externalId/);
  assert.match(accepted, /readMetaBrowserIds\(request\)\.externalId/);
});

test("Meta bootstrap mints, stores, hashes, and initializes one visitor identity", async () => {
  const base = read("src/components/storefront/tracking/AdsBase.astro");
  const start = base.indexOf("{metaPixelId && <script is:inline define:vars");
  const match = base.slice(start).match(/<script[^>]*>([\s\S]*?)<\/script>/);
  assert.ok(match);
  let cookie = "";
  const documentStub = {
    get cookie() { return cookie; },
    set cookie(value: string) { cookie = value.split(";")[0]; },
    createElement: () => ({}),
    head: { appendChild: () => undefined },
  };
  const windowStub: Record<string, any> = {
    location: { protocol: "https:" },
  };
  const run = new Function(
    "metaPixelId",
    "metaExternalIdCookie",
    "window",
    "document",
    "crypto",
    "TextEncoder",
    "Uint8Array",
    match[1],
  );
  run(
    "1234567890",
    "mybook_meta_external_id",
    windowStub,
    documentStub,
    globalThis.crypto,
    TextEncoder,
    Uint8Array,
  );
  await windowStub.__MYBOOK_META_READY__;
  const externalId = cookie.split("=")[1];
  assert.match(externalId, /^[a-f0-9]{32}$/);
  const init = windowStub.fbq.queue.find((args: unknown[]) => args[0] === "init");
  assert.equal(init[1], "1234567890");
  assert.match(init[2].external_id, /^[a-f0-9]{64}$/);
});
