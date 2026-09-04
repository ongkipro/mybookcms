import type { APIRoute } from "astro";
import { z } from "zod";
import { jsonError, jsonOk } from "../../../lib/api.ts";
import { getRuntimeEnv } from "../../../lib/env.ts";
import {
  applyOrderLifecycleMutation,
  OrderLifecycleError,
  type OrderLifecycleState,
} from "../../../lib/order-lifecycle.ts";
import { resolveAdminOrderDeliveryPatch } from "../../../lib/admin-order-delivery.ts";
import { MalaysiaLocationError } from "../../../lib/malaysia-locations.ts";
import { MalaysiaShippingError } from "../../../lib/malaysia-shipping.ts";

export const prerender = false;

const shippingStatuses = ["pending", "processing", "shipped", "delivered", "returned", "cancelled"] as const;

const updateSchema = z.object({
  orderId: z.number().int().positive(),
  shippingStatus: z.enum(shippingStatuses),
  address: z.string().trim().min(10).max(500).optional(),
  locationId: z.number().int().positive().optional(),
  shippingCost: z.number().int().min(0).max(10_000_000).optional(),
}).strict();

type ShipmentRow = {
  id: number;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  address: string;
  district: string;
  city: string;
  province: string;
  postcode: string | null;
  shippingStatus: string;
  paymentMethod: string;
  paymentStatus: string;
  totalAmount: number;
  shippingCost: number;
  shippingZoneCode: string | null;
  locationId: number | null;
  items: string;
  totalQuantity: number;
  totalWeightGrams: number;
  createdAt: string;
  queuedAt: string;
};

const getDatabase = (locals: App.Locals) => {
  const database = getRuntimeEnv(locals)?.OMS_DB as D1Database | undefined;
  return database?.prepare ? database : null;
};

function shipmentWhere(status: string, query: string) {
  const clauses = ["o.shipping_queued_at IS NOT NULL"];
  const bindings: unknown[] = [];
  if (status) {
    clauses.push("o.shipping_status = ?");
    bindings.push(status);
  }
  if (query) {
    clauses.push("(o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_phone LIKE ? OR o.city LIKE ? OR o.province LIKE ? OR o.postal_code LIKE ?)");
    const needle = `%${query}%`;
    bindings.push(needle, needle, needle, needle, needle, needle);
  }
  return { where: `WHERE ${clauses.join(" AND ")}`, bindings };
}

function shipmentSelect(where: string, limit = "") {
  return `
    SELECT o.id, o.order_number AS orderNumber, o.customer_name AS customerName,
      o.customer_phone AS customerPhone, o.address, o.district, o.city,
      o.province, o.postal_code AS postcode, o.shipping_status AS shippingStatus,
      o.payment_method AS paymentMethod, o.payment_status AS paymentStatus,
      o.total_amount AS totalAmount, o.shipping_cost AS shippingCost,
      o.shipping_zone_code AS shippingZoneCode,
      (
        SELECT p.id FROM malaysia_postcodes p
        WHERE p.postcode = o.postal_code AND p.city = o.city AND p.state = o.province
        ORDER BY p.id LIMIT 1
      ) AS locationId,
      o.created_at AS createdAt, o.shipping_queued_at AS queuedAt,
      COALESCE((
        SELECT GROUP_CONCAT(summary, ' | ') FROM (
          SELECT p.title || CASE WHEN pv.title <> '' THEN ' - ' || pv.title ELSE '' END || ' x' || oi.quantity AS summary
          FROM order_items oi
          INNER JOIN product_variants pv ON pv.id = oi.variant_id
          INNER JOIN products p ON p.id = pv.product_id
          WHERE oi.order_id = o.id ORDER BY oi.id
        )
      ), '') AS items,
      COALESCE((SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.order_id = o.id), 0) AS totalQuantity,
      COALESCE((
        SELECT SUM(oi.quantity * COALESCE(pv.weight_grams, 0))
        FROM order_items oi INNER JOIN product_variants pv ON pv.id = oi.variant_id
        WHERE oi.order_id = o.id
      ), 0) AS totalWeightGrams
    FROM orders o
    ${where}
    ORDER BY o.shipping_queued_at DESC, o.id DESC
    ${limit}
  `;
}

function myrDecimal(amountSen: number) {
  return (Number(amountSen || 0) / 100).toFixed(2);
}

function formatMyt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false, timeZone: "Asia/Kuala_Lumpur",
  }).format(date).replace(",", "");
}

function csvCell(value: unknown) {
  let text = String(value ?? "").replace(/\r\n?/g, "\n");
  if (/^\s*[=+\-@]/.test(text) || /^[\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function shipmentsCsv(rows: ShipmentRow[]) {
  const headers = [
    "order_number", "created_at_myt", "customer_name", "customer_phone",
    "address", "district", "city", "state", "postcode", "payment_method",
    "payment_status", "cod_amount_myr", "shipping_zone", "shipping_cost_myr",
    "shipping_status", "items",
    "total_quantity", "total_weight_grams",
  ];
  const lines = rows.map((row) => [
    row.orderNumber, formatMyt(row.createdAt), row.customerName, row.customerPhone,
    row.address, row.district, row.city, row.province, row.postcode,
    row.paymentMethod, row.paymentStatus,
    row.paymentMethod === "cod" ? myrDecimal(row.totalAmount) : "0.00",
    row.shippingZoneCode, myrDecimal(row.shippingCost), row.shippingStatus, row.items,
    row.totalQuantity, row.totalWeightGrams,
  ].map(csvCell).join(","));
  return `\uFEFF${headers.map(csvCell).join(",")}\r\n${lines.join("\r\n")}${lines.length ? "\r\n" : ""}`;
}

export const GET: APIRoute = async ({ locals, url }) => {
  const database = getDatabase(locals);
  if (!database) return jsonError("Database pengiriman belum tersedia.", 503);
  const status = String(url.searchParams.get("status") || "").trim().toLowerCase();
  const query = String(url.searchParams.get("q") || "").trim().slice(0, 100);
  const format = String(url.searchParams.get("format") || "json").trim().toLowerCase();
  if (status && !shippingStatuses.includes(status as (typeof shippingStatuses)[number])) {
    return jsonError("Filter status pengiriman tidak valid.", 400);
  }
  if (!["json", "csv"].includes(format)) return jsonError("Format export tidak valid.", 400);
  const { where, bindings } = shipmentWhere(status, query);
  try {
    if (format === "csv") {
      const result = await database.prepare(shipmentSelect(where)).bind(...bindings).all<ShipmentRow>();
      const rows = result.results ?? [];
      const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date());
      return new Response(shipmentsCsv(rows), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="mybookcms-pengiriman-${date}.csv"`,
          "Cache-Control": "no-store",
          "X-Export-Count": String(rows.length),
        },
      });
    }
    const [rowsResult, countResult] = await database.batch([
      database.prepare(shipmentSelect(where, "LIMIT 200")).bind(...bindings),
      database.prepare(`SELECT COUNT(*) AS total FROM orders o ${where}`).bind(...bindings),
    ]);
    const total = Number((countResult.results?.[0] as { total?: unknown } | undefined)?.total || 0);
    return jsonOk({ data: { shipments: rowsResult.results ?? [], total, limit: 200 } });
  } catch (error) {
    console.error("manual-shipping-list", error);
    return jsonError(format === "csv" ? "CSV pengiriman gagal dibuat." : "Daftar pengiriman gagal dimuat.", 500);
  }
};

export const PATCH: APIRoute = async ({ locals, request }) => {
  const database = getDatabase(locals);
  if (!database) return jsonError("Database pengiriman belum tersedia.", 503);
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Perubahan pengiriman tidak valid.", 400);
  const body = parsed.data;
  try {
    const current = await database.prepare(`
      SELECT id, payment_method, payment_status, shipping_status,
        stock_restored_at, shipping_queued_at
      FROM orders WHERE id = ?
    `).bind(body.orderId).first<OrderLifecycleState & { shipping_queued_at?: string | null }>();
    if (!current) return jsonError("Order tidak ditemukan.", 404);
    if (!current.shipping_queued_at) return jsonError("Order belum masuk Pengiriman.", 409);
    const delivery = await resolveAdminOrderDeliveryPatch(database, {
      orderId: body.orderId,
      address: body.address,
      locationId: body.locationId,
      shippingCostSen: body.shippingCost,
      role: locals.admin?.role,
    });
    // Refuse rather than silently drop it: an operator whose amount vanished
    // without a word would reasonably assume it saved.
    if (delivery.shippingCostRefused) {
      return jsonError("Peran Anda tidak dapat mengubah shipping_cost.", 403, {
        code: "PERMISSION_DENIED",
        fields: ["shipping_cost"],
      });
    }
    if (delivery.destinationChangeRefused) {
      return jsonError(
        "Destinasi pesanan yang sudah dikirim atau lunas hanya dapat diubah oleh owner atau admin.",
        403,
        { code: "PERMISSION_DENIED", fields: ["location_id"] },
      );
    }
    const assignments = ["shipping_status = ?", ...delivery.assignments];
    const values = [body.shippingStatus, ...delivery.values];
    const mutation = database.prepare(`
      UPDATE orders
      SET ${assignments.join(", ")}
      WHERE id = ? AND shipping_queued_at IS NOT NULL
    `).bind(...values, body.orderId);
    const result = await applyOrderLifecycleMutation(
      database,
      current,
      { shippingStatus: body.shippingStatus },
      mutation,
    );
    if (!result.updated) return jsonError("Order berubah atau sudah keluar dari Pengiriman.", 409);
    return jsonOk({ message: "Pengiriman diperbarui.", data: result });
  } catch (error) {
    if (error instanceof OrderLifecycleError) return jsonError(error.message, error.status);
    if (error instanceof MalaysiaLocationError || error instanceof MalaysiaShippingError) {
      return jsonError(error.message, 422);
    }
    console.error("manual-shipping-update", error);
    return jsonError("Pengiriman gagal disimpan.", 500);
  }
};
