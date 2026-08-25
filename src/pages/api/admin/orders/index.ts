import type { APIRoute } from "astro";
import { jsonError, jsonOk } from "../../../../lib/api.ts";
import { parseAdminDateSelection } from "../../../../lib/admin-date-filter.ts";
import { ADMIN_ORDER_STATUSES } from "../../../../lib/admin-order-status.ts";
import { defaultCrmTemplates, parseCrmTemplates } from "../../../../lib/crm-template.ts";
import { getRuntimeEnv } from "../../../../lib/env.ts";
import {
  deleteOrdersRestoringStock,
  OrderLifecycleError,
  updateAdminOrderShippingStatuses,
} from "../../../../lib/order-lifecycle.ts";

export const prerender = false;

const SHIPPING_STATUSES = ["all", "pending", "processing", "shipped", "delivered", "returned", "cancelled"] as const;
const PAYMENT_STATUSES = ["all", "unpaid", "pending", "paid", "failed", "refunded", "cancelled"] as const;
const OPERATIONAL_STATUSES = ["all", ...ADMIN_ORDER_STATUSES] as const;

const ORDER_STATUS_SQL = `CASE
  WHEN o.shipping_status = 'returned' THEN 'returned'
  WHEN o.shipping_status = 'cancelled' OR o.payment_status IN ('failed', 'refunded', 'cancelled') THEN 'cancelled'
  WHEN o.shipping_status = 'delivered' THEN 'delivered'
  WHEN o.shipping_status IN ('processing', 'shipped') THEN 'in_transit'
  WHEN o.shipping_status = 'pending' AND o.shipping_queued_at IS NOT NULL THEN 'queued'
  WHEN o.shipping_status = 'pending' AND o.payment_method = 'manual_transfer'
    AND o.payment_status NOT IN ('paid', 'settled', 'success') THEN 'waiting'
  ELSE 'new'
END`;

type QueueCandidate = {
  id: number;
  order_number: string;
  shipping_queued_at: string | null;
};

export const GET: APIRoute = async ({ locals, url }) => {
  const database = getRuntimeEnv(locals)?.OMS_DB as D1Database | undefined;
  if (!database?.prepare) return jsonError("Database pesanan belum tersedia.", 503);

  const search = String(url.searchParams.get("search") || "").trim().slice(0, 100);
  const operationalStatus = String(url.searchParams.get("order_status") || "all").trim().toLowerCase();
  const legacyShippingStatus = String(url.searchParams.get("shipping_status") || url.searchParams.get("status") || "all").trim().toLowerCase();
  const paymentStatus = String(url.searchParams.get("payment_status") || "all").trim().toLowerCase();
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(100, Math.max(10, Number.parseInt(url.searchParams.get("limit") || "20", 10) || 20));

  if (!OPERATIONAL_STATUSES.includes(operationalStatus as (typeof OPERATIONAL_STATUSES)[number])) {
    return jsonError("Filter status pesanan tidak valid.", 400);
  }
  if (!SHIPPING_STATUSES.includes(legacyShippingStatus as (typeof SHIPPING_STATUSES)[number])) {
    return jsonError("Filter status pengiriman tidak valid.", 400);
  }
  if (!PAYMENT_STATUSES.includes(paymentStatus as (typeof PAYMENT_STATUSES)[number])) {
    return jsonError("Filter status pembayaran tidak valid.", 400);
  }

  const dateSelection = parseAdminDateSelection(url.searchParams);
  if (!dateSelection.resolution.ok) return jsonError(dateSelection.resolution.reason, 422);

  const clauses: string[] = [];
  const bindings: unknown[] = [];
  if (search) {
    clauses.push(`(
      o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_phone LIKE ? OR
      o.city LIKE ? OR o.province LIKE ? OR EXISTS (
        SELECT 1 FROM order_items soi
        INNER JOIN product_variants spv ON spv.id = soi.variant_id
        INNER JOIN products sp ON sp.id = spv.product_id
        WHERE soi.order_id = o.id AND (sp.title LIKE ? OR spv.title LIKE ?)
      )
    )`);
    const needle = `%${search}%`;
    bindings.push(needle, needle, needle, needle, needle, needle, needle);
  }
  if (operationalStatus !== "all") {
    clauses.push(`(${ORDER_STATUS_SQL}) = ?`);
    bindings.push(operationalStatus);
  } else if (legacyShippingStatus !== "all") {
    clauses.push("o.shipping_status = ?");
    bindings.push(legacyShippingStatus);
  }
  if (paymentStatus !== "all") {
    clauses.push("o.payment_status = ?");
    bindings.push(paymentStatus);
  }
  if (dateSelection.resolution.start) {
    clauses.push("date(o.created_at, '+8 hours') >= ? AND date(o.created_at, '+8 hours') <= ?");
    bindings.push(dateSelection.resolution.start, dateSelection.resolution.end);
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const offset = (page - 1) * limit;

  try {
    const [rowsResult, countResult, summaryResult, statusResult, storeResult] = await database.batch([
      database.prepare(`
        SELECT o.id, o.order_number, o.customer_name, o.customer_phone, o.address,
          o.district, o.city, o.province, o.postal_code, o.total_amount, o.shipping_cost,
          o.shipping_amount_sen,
          o.shipping_zone_code, o.payment_method, o.payment_status, o.shipping_status,
          o.shipping_queued_at, o.created_at,
          o.seller_bank_name, o.seller_account_holder, o.seller_account_number,
          ${ORDER_STATUS_SQL} AS operational_status,
          COALESCE((
            SELECT GROUP_CONCAT(p.title, ', ')
            FROM order_items oi
            INNER JOIN product_variants pv ON pv.id = oi.variant_id
            INNER JOIN products p ON p.id = pv.product_id
            WHERE oi.order_id = o.id
          ), '') AS product_name,
          COALESCE((
            SELECT GROUP_CONCAT(pv.title, ', ')
            FROM order_items oi
            INNER JOIN product_variants pv ON pv.id = oi.variant_id
            WHERE oi.order_id = o.id
          ), '') AS variant_name,
          COALESCE((
            SELECT SUM(oi.quantity * oi.unit_price)
            FROM order_items oi WHERE oi.order_id = o.id
          ), 0) AS product_price
        FROM orders o
        ${whereClause}
        ORDER BY o.id DESC
        LIMIT ? OFFSET ?
      `).bind(...bindings, limit, offset),
      database.prepare(`SELECT COUNT(*) AS total_items FROM orders o ${whereClause}`).bind(...bindings),
      database.prepare(`
        SELECT COUNT(*) AS total_orders,
          SUM(CASE WHEN payment_status IN ('unpaid', 'pending') THEN 1 ELSE 0 END) AS unpaid_count,
          SUM(CASE WHEN shipping_queued_at IS NOT NULL THEN 1 ELSE 0 END) AS fulfilment_count,
          COALESCE(SUM(total_amount), 0) AS total_value
        FROM orders
      `),
      database.prepare(`
        SELECT ${ORDER_STATUS_SQL} AS operational_status, COUNT(*) AS count
        FROM orders o
        GROUP BY operational_status
      `),
      database.prepare("SELECT name, crm_templates FROM stores ORDER BY id LIMIT 1"),
    ]);

    const totalItems = Number((countResult.results?.[0] as { total_items?: unknown } | undefined)?.total_items || 0);
    const summary = (summaryResult.results?.[0] || {}) as Record<string, unknown>;
    const statusCounts: Record<string, number> = { all: Number(summary.total_orders || 0) };
    for (const row of statusResult.results || []) {
      const item = row as { operational_status?: unknown; count?: unknown };
      const status = String(item.operational_status || "new");
      statusCounts[status] = Number(statusCounts[status] || 0) + Number(item.count || 0);
    }
    const store = (storeResult.results?.[0] || {}) as { name?: string; crm_templates?: string | null };

    return jsonOk({
      data: (rowsResult.results || []).map((row) => ({
        ...(row as Record<string, unknown>),
        seller_name: store.name || "Toko Kami",
      })),
      pagination: {
        page,
        limit,
        total_items: totalItems,
        total_pages: Math.ceil(totalItems / limit),
      },
      summary: {
        total_orders: Number(summary.total_orders || 0),
        unpaid_count: Number(summary.unpaid_count || 0),
        fulfilment_count: Number(summary.fulfilment_count || 0),
        total_value: Number(summary.total_value || 0),
      },
      status_counts: statusCounts,
      crm_templates: store.crm_templates ? parseCrmTemplates(store.crm_templates) : { ...defaultCrmTemplates },
      meta: { currency: "MYR", timezone: "Asia/Kuala_Lumpur" },
    });
  } catch (error) {
    console.error("admin-orders-list", error);
    return jsonError("Daftar pesanan gagal dimuat.", 500);
  }
};

export const POST: APIRoute = async ({ locals, request }) => {
  const database = getRuntimeEnv(locals)?.OMS_DB as D1Database | undefined;
  if (!database?.prepare) return jsonError("Database pesanan belum tersedia.", 503);
  const body = await request.json().catch(() => null) as { order_ids?: unknown[]; status?: string; queued?: unknown } | null;
  if (!Array.isArray(body?.order_ids) || body.order_ids.length < 1 || body.order_ids.length > 100) {
    return jsonError("Pilih 1-100 pesanan.", 400);
  }
  const rawIds = body.order_ids.map(Number);
  if (rawIds.some((id) => !Number.isInteger(id) || id <= 0)) return jsonError("ID pesanan tidak valid.", 400);
  const ids = [...new Set(rawIds)];

  if (body && Object.prototype.hasOwnProperty.call(body, "queued")) {
    if (typeof body.queued !== "boolean") return jsonError("Status antrean pengiriman tidak valid.", 400);
    const queued = body.queued;
    const placeholders = ids.map(() => "?").join(", ");
    try {
      const rows = await database.prepare(`
        SELECT id, order_number, shipping_queued_at
        FROM orders WHERE id IN (${placeholders})
      `).bind(...ids).all<QueueCandidate>();
      const found = rows.results ?? [];
      const failures = ids
        .filter((id) => !found.some((order) => Number(order.id) === id))
        .map((id) => ({ id, order_number: String(id), reason: "Pesanan tidak ditemukan." }));
      const unchanged: QueueCandidate[] = [];
      const eligible: QueueCandidate[] = [];
      for (const order of found) {
        if (Boolean(order.shipping_queued_at) === queued) unchanged.push(order);
        else eligible.push(order);
      }

      const statements = eligible.map((order) => queued
        ? database.prepare(`
            UPDATE orders SET shipping_queued_at = CURRENT_TIMESTAMP
            WHERE id = ? AND shipping_queued_at IS NULL
          `).bind(order.id)
        : database.prepare(`
            UPDATE orders SET shipping_queued_at = NULL
            WHERE id = ? AND shipping_queued_at IS NOT NULL
          `).bind(order.id));
      const results = statements.length ? await database.batch(statements) : [];
      let updatedCount = 0;
      results.forEach((result, index) => {
        if (Number(result.meta?.changes || 0) > 0) updatedCount += 1;
        else failures.push({
          id: Number(eligible[index].id),
          order_number: eligible[index].order_number,
          reason: "Pesanan berubah saat antrean diperbarui. Muat ulang lalu coba lagi.",
        });
      });
      const action = queued ? "masuk Pengiriman" : "dikeluarkan dari Pengiriman";
      return jsonOk({
        message: `${updatedCount} pesanan ${action}${failures.length ? `, ${failures.length} gagal` : ""}.`,
        queued,
        updated_count: updatedCount,
        unchanged_count: unchanged.length,
        failed_count: failures.length,
        failures,
      });
    } catch (error) {
      console.error("admin-shipping-queue", error);
      return jsonError("Antrean Pengiriman gagal diperbarui.", 500);
    }
  }

  const status = String(body?.status || "");
  if (!["pending", "processing", "shipped", "delivered", "returned", "cancelled"].includes(status)) {
    return jsonError("Status pengiriman tidak valid.", 400);
  }
  try {
    const updated = await updateAdminOrderShippingStatuses(database, ids, status as never);
    return jsonOk({ message: `${updated} pesanan diperbarui.`, updated_count: updated });
  } catch (error) {
    if (error instanceof OrderLifecycleError) return jsonError(error.message, error.status);
    return jsonError("Pesanan gagal diperbarui.", 500);
  }
};

export const DELETE: APIRoute = async ({ locals, request }) => {
  const database = getRuntimeEnv(locals)?.OMS_DB as D1Database | undefined;
  if (!database?.prepare) return jsonError("Database pesanan belum tersedia.", 503);
  const body = await request.json().catch(() => null) as { ids?: unknown[] } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.map(Number) : [];
  try {
    const deleted = await deleteOrdersRestoringStock(database, ids);
    return jsonOk({
      message: `${deleted.length} pesanan dihapus.`,
      deleted_count: deleted.length,
      deleted_ids: deleted.map((order) => order.id),
    });
  } catch (error) {
    if (error instanceof OrderLifecycleError) return jsonError(error.message, error.status);
    return jsonError("Pesanan gagal dihapus.", 500);
  }
};
