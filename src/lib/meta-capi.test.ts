import assert from "node:assert/strict";
import test from "node:test";
import { POST as metaEventRoute } from "../pages/api/meta-event.ts";
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
      externalId: "0123456789abcdef0123456789abcdef",
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
  assert.notEqual((event.user_data.external_id as string[])[0], (event.user_data.ph as string[])[0]);
});

test("Meta CAPI omits external_id instead of inventing one from the buyer phone", async () => {
  const payload = await prepareMetaCapiPayload({
    eventName: "Purchase",
    eventId: "purchase:MY-1002",
    eventSourceUrl: "https://shop.example/",
    userData: { phone: "012-345 6789" },
  });

  assert.equal(payload.data[0]?.user_data.external_id, undefined);
  assert.ok(payload.data[0]?.user_data.ph);
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

test("Meta event ingress refuses DOKU Purchase before authoritative paid status", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  let providerCalled = false;
  let outboxWrites = 0;
  globalThis.fetch = async () => {
    providerCalled = true;
    return new Response("{}", { status: 200 });
  };
  const database = {
    prepare(query: string) {
      let values: unknown[] = [];
      const statement = {
        bind(...bound: unknown[]) { values = bound; return statement; },
        async first() {
          if (query.includes("FROM stores")) {
            return {
              meta_pixel_id: "1234567890",
              meta_capi_token: null,
              google_tag_manager_id: null,
              google_ads_conversion_id: null,
              google_ads_conversion_label: null,
            };
          }
          if (query.includes("FROM orders o")) {
            assert.deepEqual(values, ["INV-DOKU-PENDING", "status-token"]);
            return {
              id: 1,
              order_number: "INV-DOKU-PENDING",
              customer_name: "Nur Aisyah",
              customer_phone: "+60123456789",
              customer_email: null,
              city: "Johor Bahru",
              province: "Johor",
              postal_code: "80000",
              product_value_sen: 3290,
              content_name: "Jurnal",
              content_ids: "p1-v2",
              ad_click_ids: null,
              payment_method: "doku",
              payment_status: "pending",
            };
          }
          return null;
        },
        async run() {
          if (query.includes("capi_event_outbox")) outboxWrites += 1;
          return { success: true, meta: { changes: 1 } };
        },
        async all() { return { success: true, results: [] }; },
      };
      return statement;
    },
  } as unknown as D1Database;

  const response = await metaEventRoute({
    request: new Request("https://shop.example/api/meta-event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event_name: "Purchase",
        event_id: "purchase:browser-controlled",
        order_number: "INV-DOKU-PENDING",
        status_token: "status-token",
      }),
    }),
    locals: {
      runtimeEnv: {
        OMS_DB: database,
        META_CAPI_ACCESS_TOKEN: "test-only-token",
      },
    },
  } as never);

  assert.equal(response.status, 409);
  assert.equal(outboxWrites, 0);
  assert.equal(providerCalled, false);
});
