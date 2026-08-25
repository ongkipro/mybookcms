export type PublicPaymentStatus = {
  bank_code: string;
  status: string;
  amount: number;
  total_amount: number;
  account_number: string | null;
  account_holder: string | null;
  bank_name: string | null;
  manual_transfer: boolean;
};

export type PublicOrderStatus = {
  is_paid: boolean;
  order_number: string;
  payment_method: string;
  payment_status: string;
  status: string;
  total_amount: number;
  product_value_myr: number;
  content_ids: string[];
  content_name: string;
  payment: PublicPaymentStatus | null;
};

type PublicOrderStatusRow = {
  order_number?: string;
  total_amount?: number;
  payment_method?: string;
  payment_status?: string;
  shipping_status?: string;
  product_value_sen?: number;
  content_ids?: string;
  content_name?: string;
  seller_bank_code?: string | null;
  seller_bank_name?: string | null;
  seller_account_holder?: string | null;
  seller_account_number?: string | null;
};

export async function loadPublicOrderStatus(
  database: D1Database,
  orderIdentity: string,
  statusToken: string,
): Promise<PublicOrderStatus | null> {
  const orderRow = await database
    .prepare(
      `
      SELECT
        o.order_number,
        o.total_amount,
        o.payment_method,
        o.payment_status,
        o.shipping_status,
        (SELECT COALESCE(SUM(oi.unit_price * oi.quantity), 0) FROM order_items oi WHERE oi.order_id = o.id) AS product_value_sen,
        COALESCE((SELECT GROUP_CONCAT('p' || pv.product_id || '-v' || pv.id) FROM order_items oi INNER JOIN product_variants pv ON pv.id = oi.variant_id WHERE oi.order_id = o.id), '') AS content_ids,
        COALESCE((SELECT GROUP_CONCAT(DISTINCT p.title) FROM order_items oi INNER JOIN product_variants pv ON pv.id = oi.variant_id INNER JOIN products p ON p.id = pv.product_id WHERE oi.order_id = o.id), '') AS content_name,
        o.seller_bank_code,
        o.seller_bank_name,
        o.seller_account_holder,
        o.seller_account_number
      FROM orders o
      WHERE (CAST(o.id AS TEXT) = ? OR o.order_number = ?)
        AND o.public_status_token = ?
      LIMIT 1
    `,
    )
    .bind(orderIdentity, orderIdentity, statusToken)
    .first<PublicOrderStatusRow>();
  if (!orderRow) return null;

  const paymentStatus = (orderRow.payment_status || "unpaid").toLowerCase();
  const shippingStatus = orderRow.shipping_status || "pending";
  const isPaid = ["paid", "settled", "success"].includes(paymentStatus);
  return {
    is_paid: isPaid,
    order_number: orderRow.order_number || orderIdentity,
    payment_method: orderRow.payment_method || "",
    payment_status: paymentStatus,
    status: shippingStatus,
    total_amount: Number(orderRow.total_amount ?? 0),
    product_value_myr: Math.round(Number(orderRow.product_value_sen ?? 0)) / 100,
    content_ids: String(orderRow.content_ids || "").split(",").filter(Boolean),
    content_name: String(orderRow.content_name || ""),
    payment:
      orderRow.payment_method === "manual_transfer"
        ? {
            bank_code: orderRow.seller_bank_code || "",
            status: paymentStatus,
            amount: Number(orderRow.total_amount ?? 0),
            total_amount: Number(orderRow.total_amount ?? 0),
            account_number: orderRow.seller_account_number || null,
            account_holder: orderRow.seller_account_holder || null,
            bank_name: orderRow.seller_bank_name || orderRow.seller_bank_code || null,
            manual_transfer: true,
          }
        : null,
  };
}
