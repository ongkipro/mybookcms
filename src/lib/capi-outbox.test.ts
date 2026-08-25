import assert from "node:assert/strict";
import test from "node:test";
import { deliverCapiEvent } from "./capi-outbox.ts";
import type { PreparedMetaPayload } from "./meta-capi.ts";

const payload: PreparedMetaPayload = {
  data: [{
    event_name: "Purchase",
    event_time: 1,
    event_id: "purchase:INV-1",
    event_source_url: "https://shop.example/thanks",
    action_source: "website",
    user_data: {},
    custom_data: { currency: "MYR", value: 32.9 },
  }],
};

test("an outbox delivery lease prevents concurrent sends of the same event", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  let claimed = false;
  let delivered = 0;
  let fetches = 0;
  const database = {
    prepare(query: string) {
      return {
        bind() { return this; },
        async first() {
          if (!query.includes("RETURNING event_name")) return null;
          if (claimed) return null;
          claimed = true;
          return { event_name: "Purchase", event_id: "purchase:INV-1", payload_json: JSON.stringify(payload), attempts: 0 };
        },
        async run() {
          if (query.includes("status = 'delivered'")) delivered += 1;
          return { success: true, meta: { changes: 1 } };
        },
      };
    },
  } as unknown as D1Database;
  globalThis.fetch = async () => {
    fetches += 1;
    return new Response(JSON.stringify({ events_received: 1 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  await Promise.all([
    deliverCapiEvent(database, "Purchase", "purchase:INV-1", "12345", "token"),
    deliverCapiEvent(database, "Purchase", "purchase:INV-1", "12345", "token"),
  ]);

  assert.equal(fetches, 1);
  assert.equal(delivered, 1);
});

test("a rejected access token moves the outbox event directly to failed", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  let failureBind: unknown[] = [];
  const database = {
    prepare(query: string) {
      return {
        bind(...values: unknown[]) {
          if (query.includes("SET status = ?, attempts")) failureBind = values;
          return this;
        },
        async first() {
          return query.includes("RETURNING event_name")
            ? { event_name: "Purchase", event_id: "purchase:INV-1", payload_json: JSON.stringify(payload), attempts: 0 }
            : null;
        },
        async run() { return { success: true, meta: { changes: 1 } }; },
      };
    },
  } as unknown as D1Database;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { code: 190 } }), {
    status: 400,
    headers: { "content-type": "application/json" },
  });

  assert.equal(await deliverCapiEvent(database, "Purchase", "purchase:INV-1", "12345", "token"), false);
  assert.equal(failureBind[0], "failed");
  assert.equal(failureBind[1], 1);
  assert.equal(failureBind[2], null);
});
