import assert from "node:assert/strict";
import test from "node:test";
import { prepareMetaCapiPayload, sendPreparedMetaCapi } from "./meta-capi.ts";

test("Meta CAPI Purchase uses MYR, Malaysia identity, and hashed advanced matching", async () => {
  const payload = await prepareMetaCapiPayload({
    eventName: "Purchase",
    eventId: "purchase:MY-1001",
    eventSourceUrl: "https://shop.example/order-status",
    userData: {
      phone: "012-345 6789",
      name: "Nur Aisyah",
      email: "Buyer@Example.com",
      city: "Johor Bahru",
      state: "Johor",
      postcode: "80000",
      fbp: "fb.1.1700000000000.browser",
    },
    customData: {
      contentName: "Buku Ujian",
      contentIds: ["p1-v2"],
      value: 46.9,
      orderNumber: "MY-1001",
    },
  });
  const event = payload.data[0];

  assert.equal(event.custom_data.currency, "MYR");
  assert.equal(event.custom_data.value, 46.9);
  assert.equal(event.custom_data.order_id, "MY-1001");
  assert.deepEqual(event.custom_data.content_ids, ["p1-v2"]);
  assert.notEqual((event.user_data.ph as string[])[0], "60123456789");
  assert.notEqual((event.user_data.country as string[])[0], "my");
  assert.equal((event.user_data.ph as string[])[0].length, 64);
  assert.equal((event.user_data.country as string[])[0].length, 64);
});

test("Meta CAPI transport keeps the token out of the URL and classifies invalid credentials as terminal", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  let requestedUrl = "";
  let authorization = "";
  globalThis.fetch = async (input, init) => {
    requestedUrl = String(input);
    authorization = new Headers(init?.headers).get("authorization") || "";
    return new Response(JSON.stringify({ error: { code: 190, message: "provider detail" } }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  };

  const result = await sendPreparedMetaCapi({ data: [] }, "123456789", "local-test-token");

  assert.doesNotMatch(requestedUrl, /local-test-token|access_token/i);
  assert.equal(authorization, "Bearer local-test-token");
  assert.equal(result.success, false);
  assert.equal(result.retryable, false);
  assert.equal(result.providerCode, 190);
  assert.equal(result.reason, "Meta CAPI menolak access token.");
  assert.doesNotMatch(JSON.stringify(result), /provider detail/);
});

test("PageView payload omits invented commerce fields", async () => {
  const payload = await prepareMetaCapiPayload({
    eventName: "PageView",
    eventId: "pageview:local-test",
    eventSourceUrl: "https://shop.example/",
  });
  assert.deepEqual(payload.data[0]?.custom_data, {});
});
