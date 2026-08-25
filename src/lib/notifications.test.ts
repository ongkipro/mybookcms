import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOrderNotification,
  buildPaymentNotification,
  canReceiveCommerceNotifications,
} from "./notifications.ts";

test("Malaysia order notifications show MYR and a local destination", () => {
  const order = buildOrderNotification({
    orderNumber: "MYB-10001",
    customerName: "Aisyah",
    totalAmount: 118_400,
    district: "Bangsar",
    city: "Kuala Lumpur",
  });
  assert.equal(order.title, "Order baru MYB-10001");
  assert.match(order.body, /RM\s*1,184\.00/);
  assert.match(order.body, /Bangsar, Kuala Lumpur/);
});

test("commerce notifications exclude the advertiser role", () => {
  assert.equal(canReceiveCommerceNotifications("owner"), true);
  assert.equal(canReceiveCommerceNotifications("advertiser"), false);
  assert.match(buildPaymentNotification({ orderNumber: "MYB-10001", customerName: "Aisyah", totalAmount: 118_400 }).body, /RM\s*1,184\.00/);
});
