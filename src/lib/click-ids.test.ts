import assert from "node:assert/strict";
import test from "node:test";
import {
  CLICK_ID_COOKIE,
  META_EXTERNAL_ID_COOKIE,
  hasAdClickId,
  mergeClickIds,
  parseClickIds,
  parseClickIdsFromUrl,
  parseOrderAttribution,
  readMetaBrowserIds,
  readOrderAttribution,
  serializeClickIds,
} from "./click-ids.ts";

test("Malaysia ad click IDs retain Google, Meta, and UTM attribution only", () => {
  const ids = parseClickIdsFromUrl(new URL(
    "https://shop.example/book?gclid=google-1&fbclid=meta-1&utm_source=facebook&ttclid=tiktok-1",
  ));

  assert.equal(ids.gclid, "google-1");
  assert.equal(ids.fbclid, "meta-1");
  assert.match(ids._fbc || "", /^fb\.1\.\d+\.meta-1$/);
  assert.equal(ids.utm_source, "facebook");
  assert.equal("ttclid" in ids, false);
  assert.deepEqual(parseClickIds(serializeClickIds(ids)), ids);
});

test("malformed stored attribution fails closed", () => {
  assert.deepEqual(parseClickIds("not-json"), {});
  assert.deepEqual(parseClickIds(JSON.stringify({ gclid: "bad value with spaces" })), {});
  assert.deepEqual(parseClickIds(JSON.stringify({
    _fbp: "not-a-meta-browser-id",
    _fbc: "not-a-meta-click-id",
  })), {});
  assert.deepEqual(parseClickIdsFromUrl(new URL(
    "https://shop.example/?_fbp=not-a-meta-browser-id&_fbc=not-a-meta-click-id",
  )), {});
});

test("UTM-only follow-up keeps the paid click while a new paid click replaces it", () => {
  const google = parseClickIdsFromUrl(new URL(
    "https://shop.example/book?gclid=paid-google&utm_source=google&utm_campaign=launch",
  ));
  const whatsapp = parseClickIdsFromUrl(new URL(
    "https://shop.example/book?utm_source=whatsapp&utm_campaign=followup",
  ));
  assert.equal(hasAdClickId(google), true);
  assert.equal(hasAdClickId(whatsapp), false);
  assert.deepEqual(mergeClickIds(google, whatsapp), {
    gclid: "paid-google",
    utm_source: "whatsapp",
    utm_campaign: "followup",
  });

  const meta = parseClickIdsFromUrl(new URL("https://shop.example/book?fbclid=paid-meta"));
  const replaced = mergeClickIds(google, meta);
  assert.equal(replaced.gclid, undefined);
  assert.equal(replaced.fbclid, "paid-meta");
  assert.match(replaced._fbc || "", /^fb\.1\.\d+\.paid-meta$/);
});

test("Meta browser identity accepts only the advertiser-issued random shape", () => {
  const externalId = "0123456789abcdef0123456789abcdef";
  const request = new Request("https://shop.example/api/meta-event", {
    headers: {
      cookie: `${META_EXTERNAL_ID_COOKIE}=${externalId}; _fbp=fb.1.1700000000001.browser`,
    },
  });
  assert.deepEqual(readMetaBrowserIds(request), {
    externalId,
    fbp: "fb.1.1700000000001.browser",
    fbc: undefined,
  });
  const malformed = new Request("https://shop.example/api/meta-event", {
    headers: { cookie: `${META_EXTERNAL_ID_COOKIE}=60123456789; _fbp=invalid` },
  });
  assert.deepEqual(readMetaBrowserIds(malformed), {
    externalId: undefined,
    fbp: undefined,
    fbc: undefined,
  });
});

test("order attribution persists browser-generated Meta IDs with the click context", () => {
  const externalId = "0123456789abcdef0123456789abcdef";
  const clickIds = encodeURIComponent(serializeClickIds({
    gclid: "google-1",
    _fbc: "fb.1.1700000000000.click",
  }));
  const request = new Request("https://shop.example/api/submit-order", {
    headers: {
      cookie: `${CLICK_ID_COOKIE}=${clickIds}; ${META_EXTERNAL_ID_COOKIE}=${externalId}; _fbp=fb.1.1700000000001.browser`,
    },
  });

  assert.deepEqual(readOrderAttribution(request), {
    gclid: "google-1",
    _fbc: "fb.1.1700000000000.click",
    _fbp: "fb.1.1700000000001.browser",
    meta_external_id: externalId,
  });
  assert.deepEqual(parseOrderAttribution(serializeClickIds(readOrderAttribution(request))), {
    gclid: "google-1",
    _fbc: "fb.1.1700000000000.click",
    _fbp: "fb.1.1700000000001.browser",
    meta_external_id: externalId,
  });
});

test("order attribution never accepts Meta advertiser identity from a landing URL", () => {
  const ids = parseClickIdsFromUrl(new URL(
    "https://shop.example/book?meta_external_id=0123456789abcdef0123456789abcdef&gclid=google-1",
  ));
  assert.equal("meta_external_id" in ids, false);
  assert.equal(parseOrderAttribution(JSON.stringify({ meta_external_id: "60123456789" })).meta_external_id, undefined);
});
