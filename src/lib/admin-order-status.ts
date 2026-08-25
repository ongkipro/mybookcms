export const ADMIN_ORDER_STATUSES = [
  "new",
  "waiting",
  "queued",
  "in_transit",
  "delivered",
  "returned",
  "cancelled",
] as const;

export type AdminOrderStatus = (typeof ADMIN_ORDER_STATUSES)[number];

export type AdminOrderStatusSource = {
  payment_method: string;
  payment_status: string;
  shipping_status: string;
  shipping_queued_at: string | null;
};

const PAID_STATUSES = new Set(["paid", "settled", "success"]);
const CANCELLED_PAYMENT_STATUSES = new Set(["failed", "refunded", "cancelled"]);

export function resolveAdminOrderStatus(order: AdminOrderStatusSource): AdminOrderStatus {
  if (order.shipping_status === "returned") return "returned";
  if (order.shipping_status === "cancelled" || CANCELLED_PAYMENT_STATUSES.has(order.payment_status)) {
    return "cancelled";
  }
  if (order.shipping_status === "delivered") return "delivered";
  if (["processing", "shipped"].includes(order.shipping_status)) return "in_transit";
  if (order.shipping_status === "pending" && order.shipping_queued_at) return "queued";
  if (
    order.shipping_status === "pending" &&
    order.payment_method === "manual_transfer" &&
    !PAID_STATUSES.has(order.payment_status)
  ) {
    return "waiting";
  }
  return "new";
}
