const PAYMENT_STATUSES = new Set([
  "unpaid",
  "pending",
  "paid",
  "settled",
  "success",
  "failed",
  "refunded",
  "cancelled",
]);

export const ADMIN_SHIPPING_STATUSES = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "returned",
  "cancelled",
] as const;

export type AdminShippingStatus = (typeof ADMIN_SHIPPING_STATUSES)[number];

const PAID_PAYMENT_STATUSES = new Set(["paid", "settled", "success"]);
const RELEASING_PAYMENT_STATUSES = new Set(["cancelled", "refunded", "failed"]);
const RELEASING_SHIPPING_STATUSES = new Set(["cancelled", "returned"]);
/**
 * The goods have physically left. Deleting such an order destroys the record of
 * a real fulfilment, and restoring its stock invents inventory that is in a
 * customer's hands — the store then oversells it to somebody else, and the first
 * symptom is a legitimate order it cannot fill.
 *
 * `cancelled` and `returned` are deliberately not here: in both the goods are
 * back, which is exactly when restoring stock is right.
 */
const DISPATCHED_SHIPPING_STATUSES = ["shipped", "delivered"] as const;
const STOCK_RELEASED_SQL =
  "(o.shipping_status IN ('cancelled', 'returned') OR o.payment_status IN ('cancelled', 'refunded', 'failed'))";

export type OrderLifecycleState = {
  id: number;
  payment_method: string;
  payment_status: string;
  shipping_status: string;
  stock_restored_at: string | null;
};

export type OrderLifecycleUpdate = {
  paymentStatus?: string;
  shippingStatus?: string;
};

export type ResolvedOrderLifecycleTransition = {
  paymentStatus: string;
  shippingStatus: string;
  releasesStock: boolean;
};

export type DeletedOrder = {
  id: number;
  order_number: string;
};

export class OrderLifecycleError extends Error {
  readonly status: number;

  constructor(message: string, status = 409) {
    super(message);
    this.name = "OrderLifecycleError";
    this.status = status;
  }
}

export function releasesReservedStock(
  paymentStatus: string,
  shippingStatus: string,
) {
  return (
    RELEASING_SHIPPING_STATUSES.has(shippingStatus) ||
    RELEASING_PAYMENT_STATUSES.has(paymentStatus)
  );
}

/**
 * Canonical policy for manual admin lifecycle markers. MyBookCMS never creates
 * a courier shipment and does not require courier or tracking evidence.
 */
export function resolveAdminOrderTransition(
  current: OrderLifecycleState,
  update: OrderLifecycleUpdate,
): ResolvedOrderLifecycleTransition {
  const paymentStatus = update.paymentStatus ?? current.payment_status;
  const shippingStatus = update.shippingStatus ?? current.shipping_status;

  if (!PAYMENT_STATUSES.has(paymentStatus)) {
    throw new OrderLifecycleError("Status pembayaran tidak valid.", 400);
  }
  if (!ADMIN_SHIPPING_STATUSES.includes(shippingStatus as AdminShippingStatus)) {
    throw new OrderLifecycleError("Status pengiriman tidak valid.", 400);
  }

  const paymentChanged = paymentStatus !== current.payment_status;
  const shippingChanged = shippingStatus !== current.shipping_status;
  if (!paymentChanged && !shippingChanged) {
    return {
      paymentStatus,
      shippingStatus,
      releasesStock: releasesReservedStock(paymentStatus, shippingStatus),
    };
  }

  if (
    paymentChanged &&
    PAID_PAYMENT_STATUSES.has(paymentStatus) &&
    !["cod", "manual_transfer"].includes(current.payment_method)
  ) {
    throw new OrderLifecycleError(
      "Metode pembayaran lama tidak dapat ditandai paid secara manual.",
    );
  }

  const currentReleased =
    Boolean(current.stock_restored_at) ||
    releasesReservedStock(current.payment_status, current.shipping_status);
  const nextReleased = releasesReservedStock(paymentStatus, shippingStatus);
  if (
    currentReleased &&
    shippingChanged &&
    !RELEASING_SHIPPING_STATUSES.has(shippingStatus)
  ) {
    throw new OrderLifecycleError(
      "Order yang stoknya sudah dikembalikan tidak dapat diaktifkan kembali tanpa reservasi stok baru.",
    );
  }
  if (currentReleased && !nextReleased) {
    throw new OrderLifecycleError(
      "Order yang stoknya sudah dikembalikan tidak dapat diaktifkan kembali tanpa reservasi stok baru.",
    );
  }

  if (shippingStatus === "pending" && current.shipping_status !== "pending") {
    throw new OrderLifecycleError(
      "Order yang sudah masuk pengiriman tidak dapat dikembalikan ke status menunggu.",
    );
  }

  return { paymentStatus, shippingStatus, releasesStock: nextReleased };
}


function selectedOrdersCte(orderIds: readonly number[]) {
  return `WITH selected(order_id) AS (VALUES ${orderIds.map(() => "(?)").join(", ")})`;
}

export function buildStockRestorationStatements(
  database: D1Database,
  orderIds: readonly number[],
  requireReleasedState: boolean,
) {
  const cte = selectedOrdersCte(orderIds);
  const releaseGuard = requireReleasedState
    ? ` AND ${STOCK_RELEASED_SQL}`
    : "";
  return [
    database
      .prepare(
        `${cte}, reserved(variant_id, quantity) AS (
          SELECT oi.variant_id, SUM(oi.quantity)
          FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
          JOIN selected s ON s.order_id = o.id
          WHERE o.stock_restored_at IS NULL${releaseGuard}
          GROUP BY oi.variant_id
        )
        UPDATE product_variants
        SET stock = stock + COALESCE(
          (SELECT reserved.quantity FROM reserved WHERE reserved.variant_id = product_variants.id),
          0
        )
        WHERE stock IS NOT NULL
          AND id IN (SELECT variant_id FROM reserved)`,
      )
      .bind(...orderIds),
    database
      .prepare(
        `${cte}
        UPDATE orders AS o
        SET stock_restored_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE o.id IN (SELECT order_id FROM selected)
          AND o.stock_restored_at IS NULL${releaseGuard}`,
      )
      .bind(...orderIds),
  ];
}

export async function applyOrderLifecycleMutation(
  database: D1Database,
  current: OrderLifecycleState,
  update: OrderLifecycleUpdate,
  orderMutation: D1PreparedStatement,
) {
  const transition = resolveAdminOrderTransition(current, update);
  const statements = [orderMutation];
  if (transition.releasesStock) {
    statements.push(
      ...buildStockRestorationStatements(database, [current.id], true),
    );
  }
  const results = await database.batch(statements);
  return {
    updated: Boolean(results[0]?.meta?.changes),
    stockRestored:
      transition.releasesStock && Boolean(results[2]?.meta?.changes),
  };
}

export async function updateAdminOrderShippingStatuses(
  database: D1Database,
  rawOrderIds: readonly number[],
  shippingStatus: AdminShippingStatus,
): Promise<number> {
  const orderIds = Array.from(new Set(rawOrderIds)).filter(
    (orderId) => Number.isInteger(orderId) && orderId > 0,
  );
  if (orderIds.length === 0 || orderIds.length > 100) {
    throw new OrderLifecycleError(
      "Pilih 1 sampai 100 order untuk diperbarui.",
      400,
    );
  }

  const placeholders = orderIds.map(() => "?").join(", ");
  const loaded = await database
    .prepare(
      `SELECT id, payment_method, payment_status, shipping_status,
        stock_restored_at
      FROM orders
      WHERE id IN (${placeholders})`,
    )
    .bind(...orderIds)
    .all<OrderLifecycleState>();
  const orders = loaded.results || [];
  if (orders.length !== orderIds.length) {
    throw new OrderLifecycleError(
      "Satu atau lebih order tidak ditemukan.",
      404,
    );
  }

  const transitions = orders.map((order) =>
    resolveAdminOrderTransition(order, { shippingStatus }),
  );
  const cte = selectedOrdersCte(orderIds);
  const statements = [
    database
      .prepare(
        `${cte}
        UPDATE orders
        SET shipping_status = '${shippingStatus}'
        WHERE id IN (SELECT order_id FROM selected)`,
      )
      .bind(...orderIds),
  ];
  if (transitions.some((transition) => transition.releasesStock)) {
    statements.push(
      ...buildStockRestorationStatements(database, orderIds, true),
    );
  }
  const results = await database.batch(statements);
  return Number(results[0]?.meta?.changes) || 0;
}

/**
 * Restores every still-reserved item and deletes all order-owned rows in one
 * D1 batch transaction. D1 rolls the whole batch back if any statement fails.
 */
export async function deleteOrdersRestoringStock(
  database: D1Database,
  rawOrderIds: readonly number[],
): Promise<DeletedOrder[]> {
  const orderIds = Array.from(new Set(rawOrderIds)).filter(
    (orderId) => Number.isInteger(orderId) && orderId > 0,
  );
  if (orderIds.length === 0 || orderIds.length > 100) {
    throw new OrderLifecycleError(
      "Pilih 1 sampai 100 order untuk dihapus.",
      400,
    );
  }

  const cte = selectedOrdersCte(orderIds);
  const paidOrder = await database
    .prepare(
      `${cte}
      SELECT id
      FROM orders
      WHERE id IN (SELECT order_id FROM selected)
        AND payment_status IN ('paid', 'settled', 'success')
      LIMIT 1`,
    )
    .bind(...orderIds)
    .first<{ id: number }>();
  if (paidOrder) {
    throw new OrderLifecycleError(
      "Order dengan pembayaran terverifikasi tidak dapat dihapus. Gunakan alur refund dan pertahankan catatan order.",
    );
  }

  // The same argument as the paid guard above, for the other half of the
  // transaction. A COD order marked delivered whose operator never got round to
  // marking it paid used to be deletable, and deletion restored its stock —
  // phantom inventory for goods already handed over.
  const dispatchedOrder = await database
    .prepare(
      `${cte}
      SELECT id
      FROM orders
      WHERE id IN (SELECT order_id FROM selected)
        AND shipping_status IN (${DISPATCHED_SHIPPING_STATUSES.map(() => "?").join(", ")})
      LIMIT 1`,
    )
    .bind(...orderIds, ...DISPATCHED_SHIPPING_STATUSES)
    .first<{ id: number }>();
  if (dispatchedOrder) {
    throw new OrderLifecycleError(
      "Order yang sudah dikirim atau diterima tidak dapat dihapus. Tandai dikembalikan lebih dulu jika barang kembali, dan pertahankan catatan order.",
    );
  }
  const statements = [
    ...buildStockRestorationStatements(database, orderIds, false),
    database
      .prepare(
        `${cte}
        DELETE FROM order_items
        WHERE order_id IN (SELECT order_id FROM selected)`,
      )
      .bind(...orderIds),
    database
      .prepare(
        // The two pre-checks above are separate awaited reads, so an order that
        // becomes paid or dispatched between them and this batch would still be
        // deleted with its stock restored. Repeating both predicates here closes
        // that window: the DELETE itself refuses, inside the transaction.
        `${cte}
        DELETE FROM orders
        WHERE id IN (SELECT order_id FROM selected)
          AND payment_status NOT IN ('paid', 'settled', 'success')
          AND shipping_status NOT IN (${DISPATCHED_SHIPPING_STATUSES.map(() => "?").join(", ")})
        RETURNING id, order_number`,
      )
      .bind(...orderIds, ...DISPATCHED_SHIPPING_STATUSES),
  ];
  const results = await database.batch(statements);
  return (results[3]?.results || []) as DeletedOrder[];
}
