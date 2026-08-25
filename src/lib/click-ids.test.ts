import assert from "node:assert/strict";
import test from "node:test";
import { CLICK_ID_COOKIE, parseClickIds, parseClickIdsFromUrl, readOrderAttribution, serializeClickIds } from "./click-ids.ts";

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
});

test("order attribution persists browser-generated Meta IDs with the click context", () => {
  const clickIds = encodeURIComponent(serializeClickIds({
    gclid: "google-1",
    _fbc: "fb.1.1700000000000.click",
  }));
  const request = new Request("https://shop.example/api/submit-order", {
    headers: {
      cookie: `${CLICK_ID_COOKIE}=${clickIds}; _fbp=fb.1.1700000000001.browser`,
    },
  });

  assert.deepEqual(readOrderAttribution(request), {
    gclid: "google-1",
    _fbc: "fb.1.1700000000000.click",
    _fbp: "fb.1.1700000000001.browser",
  });
});
