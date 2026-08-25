import assert from "node:assert/strict";
import test from "node:test";
import { POST as readHeadlessOrderStatus } from "../pages/api/v1/orders/status.ts";
import { hashApiKeySecret } from "./developer-api-keys.ts";
import { loadPublicOrderStatus } from "./order-status.ts";

function createStatusDatabase(keyHash: string) {
  const auditStatuses: number[] = [];
  const database = {
    prepare(query: string) {
      let values: unknown[] = [];
      const statement = {
        bind(...bound: unknown[]) {
          values = bound;
          return statement;
        },
        async first() {
          if (query.includes("SELECT headless_allowed_origins")) {
            return { headless_allowed_origins: null };
          }
          if (query.includes("FROM developer_api_keys")) {
            return {
              id: 41,
              key_hash: keyHash,
              scopes: "orders:read",
              rate_limit_per_minute: 10,
              daily_quota: 100,
            };
          }
          if (query.includes("INSERT INTO developer_api_key_usage")) {
            return { request_count: 1 };
          }
          if (query.includes("FROM orders o")) {
            const [firstIdentity, secondIdentity, token] = values;
            if (
              firstIdentity !== "ORD-OWNED-001" ||
              secondIdentity !== "ORD-OWNED-001" ||
              token !== "status-token-owned"
            ) {
              return null;
            }
            return {
              order_number: "ORD-OWNED-001",
              total_amount: 175000,
              payment_method: "cod",
              payment_status: "unpaid",
              shipping_status: "pending",
              content_ids: "p10001-v20001",
              content_name: "Everyday Planner",
            };
          }
          return null;
        },
        async run() {
          if (query.includes("INSERT INTO headless_api_audit_events")) {
            auditStatuses.push(Number(values[3]));
          }
          return { success: true, meta: { changes: 1 } };
        },
      };
      return statement;
    },
  } as unknown as D1Database;
  return { database, auditStatuses };
}

async function callStatusRoute(database: D1Database, secret: string, body: Record<string, unknown>) {
  return readHeadlessOrderStatus({
    request: new Request("https://store.example/api/v1/orders/status", {
      method: "POST",
      headers: { "content-type": "application/json", "x-app-key": secret },
      body: JSON.stringify(body),
    }),
    locals: { runtimeEnv: { OMS_DB: database } },
  } as never);
}

test("headless order status requires the checkout-issued identity and token without leaking another order", async () => {
  const secret = "mybook_live_order_status_test_secret";
  const { database, auditStatuses } = createStatusDatabase(await hashApiKeySecret(secret));

  const denied = await callStatusRoute(database, secret, {
    order_number: "ORD-OWNED-001",
    status_token: "wrong-token",
  });
  assert.equal(denied.status, 404);
  const deniedPayload = await denied.json() as {
    success: boolean;
    error: { code: string; message: string };
  };
  assert.equal(deniedPayload.success, false);
  assert.equal(deniedPayload.error.code, "ORDER_NOT_FOUND");
  assert.doesNotMatch(JSON.stringify(deniedPayload), /175000|unpaid|pending/);
  assert.deepEqual(auditStatuses, [404]);

  const allowed = await callStatusRoute(database, secret, {
    order_number: "ORD-OWNED-001",
    status_token: "status-token-owned",
  });
  assert.equal(allowed.status, 200);
  const allowedPayload = await allowed.json() as {
    success: boolean;
    order: { order_number: string; total_amount: number; status: string };
  };
  assert.equal(allowedPayload.success, true);
  assert.deepEqual(allowedPayload.order, {
    is_paid: false,
    order_number: "ORD-OWNED-001",
    payment_method: "cod",
    payment_status: "unpaid",
    status: "pending",
    total_amount: 175000,
    product_value_myr: 0,
    content_ids: ["p10001-v20001"],
    content_name: "Everyday Planner",
    payment: null,
  });
  assert.deepEqual(auditStatuses, [404, 200]);
});

test("manual-transfer status exposes bank details without a provider channel", async () => {
  const database = {
    prepare() {
      return {
        bind() { return this; },
        async first() {
          return {
            order_number: "INV-10042",
            total_amount: 4690,
            payment_method: "manual_transfer",
            payment_status: "pending",
            shipping_status: "pending",
            seller_bank_code: "MAYBANK",
            seller_bank_name: "Maybank",
            seller_account_holder: "MyBookCMS Malaysia",
            seller_account_number: "114012345678",
          };
        },
      };
    },
  } as unknown as D1Database;

  const status = await loadPublicOrderStatus(database, "INV-10042", "status-token");
  assert.equal(status?.payment?.bank_code, "MAYBANK");
  assert.equal("channel_code" in (status?.payment ?? {}), false);
  assert.equal(status?.status, "pending");
  assert.equal("fulfilment" in (status ?? {}), false);
});

test("pending order status exposes merchandise-only advertising value for the thanks-page Purchase", async () => {
  const database = {
    prepare() {
      return {
        bind() { return this; },
        async first() {
          return {
            order_number: "INV-FEE-SAFE",
            total_amount: 5090,
            product_value_sen: 3290,
            content_ids: "p10001-v20002",
            content_name: "Everyday Planner",
            payment_method: "cod",
            payment_status: "unpaid",
            shipping_status: "pending",
          };
        },
      };
    },
  } as unknown as D1Database;

  const status = await loadPublicOrderStatus(database, "INV-FEE-SAFE", "status-token");
  assert.equal(status?.total_amount, 5090);
  assert.equal(status?.product_value_myr, 32.9);
  assert.deepEqual(status?.content_ids, ["p10001-v20002"]);
  assert.equal(status?.content_name, "Everyday Planner");
  assert.equal(status?.status, "pending");
  assert.equal("purchase_eligible" in (status ?? {}), false);
});
