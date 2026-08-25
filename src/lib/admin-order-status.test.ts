import assert from "node:assert/strict";
import test from "node:test";
import { resolveAdminOrderStatus } from "./admin-order-status.ts";

const base = {
  payment_method: "cod",
  payment_status: "unpaid",
  shipping_status: "pending",
  shipping_queued_at: null,
};

test("admin order status follows the visible operational lifecycle", () => {
  assert.equal(resolveAdminOrderStatus(base), "new");
  assert.equal(resolveAdminOrderStatus({ ...base, payment_method: "manual_transfer" }), "waiting");
  assert.equal(resolveAdminOrderStatus({ ...base, shipping_queued_at: "2026-08-24 08:00:00" }), "queued");
  assert.equal(resolveAdminOrderStatus({ ...base, shipping_status: "processing" }), "in_transit");
  assert.equal(resolveAdminOrderStatus({ ...base, shipping_status: "shipped" }), "in_transit");
  assert.equal(resolveAdminOrderStatus({ ...base, shipping_status: "delivered" }), "delivered");
  assert.equal(resolveAdminOrderStatus({ ...base, shipping_status: "returned" }), "returned");
  assert.equal(resolveAdminOrderStatus({ ...base, shipping_status: "cancelled" }), "cancelled");
});

test("terminal and payment cancellation precedence cannot be masked by queue state", () => {
  assert.equal(resolveAdminOrderStatus({
    ...base,
    payment_method: "manual_transfer",
    payment_status: "refunded",
    shipping_queued_at: "2026-08-24 08:00:00",
  }), "cancelled");
  assert.equal(resolveAdminOrderStatus({
    ...base,
    payment_status: "refunded",
    shipping_status: "returned",
  }), "returned");
});
