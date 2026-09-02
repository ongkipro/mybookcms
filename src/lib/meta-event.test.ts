import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../pages/api/meta-event.ts";

test("a capability-verified paid DOKU order records canonical Purchase from the thanks flow", async () => {
  const outboxRows: unknown[][] = [];
  const database = {
    prepare(query: string) {
      let values: unknown[] = [];
      const statement = {
        bind(...bound: unknown[]) {
          values = bound;
          return statement;
        },
        async first() {
          if (query.includes("FROM stores")) {
            return {
              meta_pixel_id: "12345",
              meta_capi_token: null,
              google_tag_manager_id: null,
              google_ads_conversion_id: null,
              google_ads_conversion_label: null,
            };
          }
          if (query.includes("FROM orders o")) {
            assert.deepEqual(values, ["INV-PENDING-001", "status-token-pending"]);
            return {
              id: 71,
              order_number: "INV-PENDING-001",
              customer_name: "Aisyah Rahman",
              customer_phone: "+60123456789",
              customer_email: "aisyah@example.test",
              city: "Johor Bahru",
              province: "Johor",
              postal_code: "80000",
              product_value_sen: 3290,
              content_name: "Everyday Planner",
              content_ids: "p10001-v10002",
              payment_method: "doku",
              payment_status: "paid",
              ad_click_ids: JSON.stringify({
                _fbp: "fb.1.1700000000000.stored-browser",
                _fbc: "fb.1.1700000000000.stored-click",
              }),
            };
          }
          if (query.includes("FROM capi_event_outbox")) return null;
          return null;
        },
        async run() {
          if (query.includes("INSERT OR IGNORE INTO capi_event_outbox")) {
            outboxRows.push(values);
            return { success: true, meta: { changes: 1 } };
          }
          return { success: true, meta: { changes: 0 } };
        },
        async all() {
          return { success: true, results: [] };
        },
      };
      return statement;
    },
  } as unknown as D1Database;

  const response = await POST({
    request: new Request("https://store.example/api/meta-event", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        referer: "https://store.example/thanks",
        cookie: "_fbp=fb.1.1700000000001.current-browser; _fbc=fb.1.1700000000001.current-click",
      },
      body: JSON.stringify({
        event_name: "Purchase",
        event_id: "browser-value-is-not-authoritative",
        order_number: "INV-PENDING-001",
        status_token: "status-token-pending",
        content_id: "tampered-content-id",
        content_name: "Tampered product",
        value: 999999,
      }),
    }),
    locals: {
      runtimeEnv: {
        OMS_DB: database,
        META_CAPI_ACCESS_TOKEN: "test-capi-token",
      },
    },
  } as never);

  assert.equal(response.status, 200);
  assert.equal(outboxRows.length, 1);
  assert.equal(outboxRows[0]?.[0], "Purchase");
  assert.equal(outboxRows[0]?.[1], "purchase:INV-PENDING-001");

  const payload = JSON.parse(String(outboxRows[0]?.[2])) as {
    data: Array<{
      event_id: string;
      custom_data: {
        content_ids: string[];
        currency: string;
        order_id: string;
        value: number;
      };
      user_data: { fbp?: string; fbc?: string };
    }>;
  };
  assert.deepEqual(payload.data[0]?.custom_data, {
    content_name: "Everyday Planner",
    content_ids: ["p10001-v10002"],
    content_type: "product",
    value: 32.9,
    currency: "MYR",
    order_id: "INV-PENDING-001",
  });
  assert.equal(payload.data[0]?.event_id, "purchase:INV-PENDING-001");
  assert.equal(payload.data[0]?.user_data.fbp, "fb.1.1700000000000.stored-browser");
  assert.equal(payload.data[0]?.user_data.fbc, "fb.1.1700000000000.stored-click");
});

test("product events ignore browser price and name in favor of the active D1 catalog", async () => {
  const outboxRows: unknown[][] = [];
  const database = {
    prepare(query: string) {
      let values: unknown[] = [];
      const statement = {
        bind(...bound: unknown[]) { values = bound; return statement; },
        async first() {
          if (query.includes("FROM stores")) {
            return {
              meta_pixel_id: "12345",
              meta_capi_token: null,
              google_tag_manager_id: null,
              google_ads_conversion_id: null,
              google_ads_conversion_label: null,
            };
          }
          if (query.includes("FROM product_variants pv")) {
            assert.deepEqual(values, [10001, 20002]);
            return { product_id: 10001, variant_id: 20002, content_name: "Everyday Planner", value_sen: 3290 };
          }
          return null;
        },
        async run() {
          if (query.includes("INSERT OR IGNORE INTO capi_event_outbox")) outboxRows.push(values);
          return { success: true, meta: { changes: 1 } };
        },
        async all() { return { success: true, results: [] }; },
      };
      return statement;
    },
  } as unknown as D1Database;

  const response = await POST({
    request: new Request("https://store.example/api/meta-event", {
      method: "POST",
      headers: { "content-type": "application/json", referer: "https://store.example/produk/planner" },
      body: JSON.stringify({
        event_name: "ViewContent",
        event_id: "viewcontent:local-test",
        content_id: "p10001-v20002",
        content_name: "Tampered name",
        value: 999999,
      }),
    }),
    locals: { runtimeEnv: { OMS_DB: database, META_CAPI_ACCESS_TOKEN: "test-capi-token" } },
  } as never);

  assert.equal(response.status, 200);
  assert.equal(outboxRows.length, 1);
  const queued = JSON.parse(String(outboxRows[0]?.[2])) as {
    data: Array<{ custom_data: Record<string, unknown> }>;
  };
  assert.deepEqual(queued.data[0]?.custom_data, {
    content_name: "Everyday Planner",
    content_ids: ["p10001-v20002"],
    content_type: "product",
    value: 32.9,
    currency: "MYR",
  });
});
