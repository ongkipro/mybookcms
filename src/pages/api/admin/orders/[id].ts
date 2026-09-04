import type { APIRoute } from "astro";
import { z } from "zod";
import { jsonError, jsonOk } from "../../../../lib/api.ts";
import { getEnvValue, getRuntimeEnv } from "../../../../lib/env.ts";
import { canDeleteOrders, forbiddenOrderFields, type AdminRole } from "../../../../lib/auth.ts";
import { isValidMalaysiaPhone, normalizeMalaysiaPhone } from "../../../../lib/validation.ts";
import {
  applyOrderLifecycleMutation,
  deleteOrdersRestoringStock,
  OrderLifecycleError,
  type OrderLifecycleState,
} from "../../../../lib/order-lifecycle.ts";
import { buildPaymentNotification, recordNotification } from "../../../../lib/notifications.ts";
import { defaultCrmTemplates, parseCrmTemplates } from "../../../../lib/crm-template.ts";
import { resolveAdminOrderDeliveryPatch } from "../../../../lib/admin-order-delivery.ts";
import { MalaysiaLocationError } from "../../../../lib/malaysia-locations.ts";
import { MalaysiaShippingError } from "../../../../lib/malaysia-shipping.ts";
import { DokuReconciliationError, reconcileDokuOrder } from "../../../../lib/doku-reconciliation.ts";
import { loadPaymentOperations, sanitizeAdminOrder } from "../../../../lib/payment-operations.ts";

export const prerender = false;

const updateSchema = z.object({
  customer_name: z.string().trim().min(2).max(100).optional(),
  customer_phone: z.string().trim().max(40).optional(),
  address: z.string().trim().min(10).max(500).optional(),
  location_id: z.number().int().positive().optional(),
  shipping_cost: z.number().int().min(0).max(10_000_000).optional(),
  payment_status: z.enum(["unpaid", "pending", "paid", "failed", "refunded", "cancelled"]).optional(),
  shipping_status: z.enum(["pending", "processing", "shipped", "delivered", "returned", "cancelled"]).optional(),
}).strict();

async function readBoundedPaymentAction(request: Request) {
  if (request.headers.get("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 1_024) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

const databaseFrom = (locals: App.Locals) => {
  const database = getRuntimeEnv(locals)?.OMS_DB as D1Database | undefined;
  return database?.prepare ? database : null;
};

async function loadOrder(database: D1Database, rawKey: string) {
  let key = rawKey.trim();
  try { key = decodeURIComponent(key).trim(); } catch {}
  return database.prepare(`
    SELECT o.*, o.shipping_zone_code AS shipping_zone,
      o.shipping_amount_sen AS quoted_shipping_amount,
      (
        SELECT p.id FROM malaysia_postcodes p
        WHERE p.postcode = o.postal_code AND p.city = o.city AND p.state = o.province
        ORDER BY p.id LIMIT 1
      ) AS location_id
    FROM orders o
    WHERE 1 = 1
      AND (o.order_number = ? OR CAST(o.id AS TEXT) = ? OR o.public_status_token = ?)
    LIMIT 1
  `).bind(key, key, key).first<Record<string, unknown>>();
}

async function responseData(database: D1Database, order: Record<string, unknown>, role: AdminRole, rootSecret: string) {
  const [items, storeResult, paymentOperations] = await Promise.all([
    database.prepare(`
      SELECT oi.id, oi.variant_id, oi.quantity, oi.unit_price,
        pv.title AS variant_title, pv.sku AS variant_sku,
        p.id AS product_id, p.title AS product_title
      FROM order_items oi
      INNER JOIN product_variants pv ON pv.id = oi.variant_id
      INNER JOIN products p ON p.id = pv.product_id
      WHERE oi.order_id = ? ORDER BY oi.id
    `).bind(Number(order.id)).all(),
    database.prepare("SELECT name, crm_templates FROM stores WHERE id = ? LIMIT 1")
      .bind(Number(order.store_id)).first<{ name?: string; crm_templates?: string | null }>(),
    loadPaymentOperations(database, Number(order.id), role, rootSecret),
  ]);
  const store = storeResult || {};
  return {
    ...sanitizeAdminOrder(order),
    seller_name: store.name || "Kedai Kami",
    crm_templates: store.crm_templates ? parseCrmTemplates(store.crm_templates) : { ...defaultCrmTemplates },
    items: items.results ?? [],
    payment_operations: paymentOperations,
  };
}

export const GET: APIRoute = async ({ params, locals }) => {
  const database = databaseFrom(locals);
  if (!database) return jsonError("Database order belum tersedia.", 503);
  const order = await loadOrder(database, String(params.id || ""));
  if (!order) return jsonError("Order tidak ditemukan.", 404);
  return jsonOk({ data: await responseData(database, order, locals.admin!.role, getEnvValue("AUTH_SECRET", getRuntimeEnv(locals))) });
};

export const POST: APIRoute = async ({ params, request, locals }) => {
  const database = databaseFrom(locals);
  if (!database) return jsonError("Database order belum tersedia.", 503);
  if (locals.admin?.role !== "owner" && locals.admin?.role !== "admin") {
    return jsonError("Pemeriksaan DOKU hanya dapat dijalankan Owner atau Admin.", 403);
  }
  const body = await readBoundedPaymentAction(request);
  if (!body || body.action !== "reconcile_doku") return jsonError("Aksi pembayaran tidak valid.", 400);
  const order = await loadOrder(database, String(params.id || ""));
  if (!order) return jsonError("Order tidak ditemukan.", 404);
  if (order.payment_method !== "doku") return jsonError("Order ini tidak menggunakan DOKU.", 409);
  const runtime = getRuntimeEnv(locals);
  const rootSecret = getEnvValue("AUTH_SECRET", runtime);
  if (!rootSecret) return jsonError("Konfigurasi DOKU belum tersedia.", 503);
  try {
    await reconcileDokuOrder(database, rootSecret, Number(order.id));
    const refreshed = await loadOrder(database, String(order.id));
    return jsonOk({
      message: "Status pembayaran DOKU telah diperiksa.",
      data: refreshed ? await responseData(database, refreshed, locals.admin.role, rootSecret) : null,
    });
  } catch (error) {
    if (error instanceof DokuReconciliationError) {
      const message = error.code === "LEASED"
        ? "Status sedang diperiksa oleh proses lain."
        : error.code === "COOLDOWN"
          ? "Jadwal pemeriksaan DOKU berikutnya belum tiba."
        : error.code === "NOT_ELIGIBLE"
          ? "Pembayaran ini tidak memenuhi syarat pemeriksaan."
          : "Status DOKU belum dapat diperiksa.";
      return jsonError(message, error.status);
    }
    return jsonError("Status DOKU belum dapat diperiksa.", 502);
  }
};

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const database = databaseFrom(locals);
  if (!database) return jsonError("Database order belum tersedia.", 503);
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || Object.keys(parsed.data).length === 0) return jsonError("Perubahan order tidak valid.", 400);
  // Route access alone is too coarse here. Customer service reaches this route
  // to correct a name, a phone, an address, or a fulfilment status; it does not
  // set a price or declare an order paid.
  const forbidden = forbiddenOrderFields(locals.admin?.role, parsed.data);
  if (forbidden.length > 0) {
    return jsonError(
      `Peran Anda tidak dapat mengubah ${forbidden.join(" dan ")}.`,
      403,
      { code: "PERMISSION_DENIED", fields: forbidden },
    );
  }
  try {
    const current = await loadOrder(database, String(params.id || ""));
    if (!current) return jsonError("Order tidak ditemukan.", 404);
    const body = parsed.data;
    if (current.payment_method === "doku" && body.payment_status !== undefined) {
      return jsonError("Status pembayaran DOKU hanya dapat berubah dari hasil provider terverifikasi.", 409);
    }
    const normalizedPhone = body.customer_phone === undefined
      ? undefined
      : normalizeMalaysiaPhone(body.customer_phone);
    if (normalizedPhone !== undefined && !isValidMalaysiaPhone(normalizedPhone)) {
      return jsonError("Nomor telefon Malaysia tidak valid.", 422);
    }
    const assignments: string[] = [];
    const values: unknown[] = [];
    const add = (column: string, value: unknown) => { assignments.push(`${column} = ?`); values.push(value); };
    if (body.customer_name !== undefined) add("customer_name", body.customer_name);
    if (normalizedPhone !== undefined) add("customer_phone", normalizedPhone);
    const delivery = await resolveAdminOrderDeliveryPatch(database, {
      orderId: Number(current.id),
      address: body.address,
      locationId: body.location_id,
      shippingCostSen: body.shipping_cost,
    });
    assignments.push(...delivery.assignments);
    values.push(...delivery.values);
    if (body.payment_status !== undefined) add("payment_status", body.payment_status);
    if (body.shipping_status !== undefined) add("shipping_status", body.shipping_status);

    const currentLifecycle: OrderLifecycleState = {
      id: Number(current.id),
      payment_method: String(current.payment_method),
      payment_status: String(current.payment_status),
      shipping_status: String(current.shipping_status),
      stock_restored_at: current.stock_restored_at ? String(current.stock_restored_at) : null,
    };
    const mutation = database.prepare(`UPDATE orders SET ${assignments.join(", ")} WHERE id = ?`)
      .bind(...values, Number(current.id));
    const lifecycleChanged = body.payment_status !== undefined || body.shipping_status !== undefined;
    const updated = lifecycleChanged
      ? (await applyOrderLifecycleMutation(database, currentLifecycle, {
          paymentStatus: body.payment_status,
          shippingStatus: body.shipping_status,
        }, mutation)).updated
      : Boolean((await mutation.run()).meta?.changes);
    if (!updated) return jsonError("Order tidak berubah.", 409);

    const wasPaid = ["paid", "settled", "success"].includes(String(current.payment_status));
    if (body.payment_status === "paid" && !wasPaid) {
      await recordNotification(database, {
        type: "payment",
        orderId: Number(current.id),
        orderNumber: String(current.order_number),
        ...buildPaymentNotification({
          orderNumber: String(current.order_number),
          customerName: body.customer_name ?? String(current.customer_name),
          totalAmount: Number(current.total_amount),
        }),
      });
    }
    const order = await loadOrder(database, String(current.id));
    return jsonOk({ message: `Order ${current.order_number} diperbarui.`, data: order ? await responseData(database, order, locals.admin!.role, getEnvValue("AUTH_SECRET", getRuntimeEnv(locals))) : null });
  } catch (error) {
    if (error instanceof OrderLifecycleError) return jsonError(error.message, error.status);
    if (error instanceof MalaysiaLocationError || error instanceof MalaysiaShippingError) {
      return jsonError(error.message, 422);
    }
    console.error("admin-order-update", error);
    return jsonError("Order gagal diperbarui.", 500);
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  // Permanent, and it restores stock. Customer service cancels instead, which
  // keeps the record.
  if (!canDeleteOrders(locals.admin?.role)) {
    return jsonError("Peran Anda tidak dapat menghapus pesanan.", 403, { code: "PERMISSION_DENIED" });
  }
  const database = databaseFrom(locals);
  if (!database) return jsonError("Database order belum tersedia.", 503);
  const order = await loadOrder(database, String(params.id || ""));
  if (!order) return jsonError("Order tidak ditemukan.", 404);
  try {
    await deleteOrdersRestoringStock(database, [Number(order.id)]);
    return jsonOk({ message: `Order ${order.order_number} dihapus dan stok dipulihkan.` });
  } catch (error) {
    if (error instanceof OrderLifecycleError) return jsonError(error.message, error.status);
    return jsonError("Order gagal dihapus.", 500);
  }
};
