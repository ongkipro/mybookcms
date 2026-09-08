import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { ADS_CURRENCY, ADS_IDR_PER_MYR, adsValueFromMyr, myrMajorFromSen } from "./ads-signal-policy.ts";

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
  assert.match(base, /currency:\s*adsCurrency/);
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

test("fixed Ads rate converts MYR sen precisely without changing commerce units", () => {
  for (const [sen, idr] of [[0, 0], [1, 41], [1890, 77490], [3290, 134890], [6580, 269780]]) {
    assert.equal(adsValueFromMyr(myrMajorFromSen(sen)), idr);
  }
  assert.equal(ADS_CURRENCY, "IDR");
  assert.equal(ADS_IDR_PER_MYR, 4100);
});

test("actual browser tracking converts Pixel, GTM and Google once; Meta ingress stays MYR", async () => {
  const base = read("src/components/storefront/tracking/AdsBase.astro");
  const scripts = [...base.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]);
  const trackScript = scripts.find(script => script.includes("window.__MYBOOK_TRACK__ ="));
  const googleScript = scripts.find(script => script.includes("window.__MYBOOK_GOOGLE_PURCHASE__ ="));
  assert.ok(trackScript && googleScript);
  const pixel: any[][] = [];
  const posted: any[] = [];
  const windowStub: Record<string, any> = { dataLayer: [], fbq: (...args: any[]) => pixel.push(args) };
  const documentStub = { title: "Fixture", createElement: () => ({}), head: { appendChild: () => undefined } };
  new Function("window", "document", "googleAdsId", "googleAdsLabel", "adsCurrency", "adsIdrPerMyr", googleScript)(
    windowStub, documentStub, "AW-123456789", "fixture", ADS_CURRENCY, ADS_IDR_PER_MYR,
  );
  new Function("window", "document", "crypto", "fetch", "metaPixelId", "purchaseOnly", "adsCurrency", "adsIdrPerMyr", trackScript)(
    windowStub, documentStub, globalThis.crypto,
    async (_url: string, options: any) => { posted.push(JSON.parse(options.body)); return {}; },
    "123456789", false, ADS_CURRENCY, ADS_IDR_PER_MYR,
  );
  for (const eventName of ["ViewContent", "InitiateCheckout", "Lead", "Purchase"]) {
    const eventId = eventName === "Purchase" ? "purchase:FIXTURE" : eventName + ":FIXTURE";
    windowStub.__MYBOOK_TRACK__(eventName, { event_id: eventId, content_id: "p10001-v10002", value: 32.9, order_number: "FIXTURE" });
    const browser = pixel.at(-1)!;
    const ingress = posted.at(-1)!;
    assert.equal(browser[2].value, 134890);
    assert.equal(browser[2].currency, "IDR");
    assert.equal(browser[3].eventID, ingress.event_id);
    assert.equal(ingress.value, 32.9);
    const dataLayer = windowStub.dataLayer.at(-1).ecommerce;
    assert.equal(dataLayer.value, 134890);
    assert.equal(dataLayer.currency, "IDR");
    assert.equal(dataLayer.items[0].item_id, "p10001-v10002");
  }
  windowStub.__MYBOOK_TRACK__("PageView", {});
  assert.equal(pixel.at(-1)![2].value, undefined);
  assert.equal(pixel.at(-1)![2].currency, undefined);
  windowStub.__MYBOOK_TRACK__("ViewContent", {value: 0});
  assert.equal(pixel.at(-1)![2].value, 0);
  windowStub.__MYBOOK_GOOGLE_PURCHASE__(32.9, "FIXTURE", {sha256_email_address: "fixture-hash"});
  const google = windowStub.dataLayer.at(-1);
  assert.equal(google[0], "event");
  assert.deepEqual(google[2], { send_to: "AW-123456789/fixture", value: 134890, currency: "IDR", transaction_id: "FIXTURE" });
});
