import { paymentBrandLabel } from "./payment-brand.ts";
import { buildOrderNotification, recordNotification } from "./notifications.ts";

export type PersistOrderInput = { submitToken: string; customerName: string; customerPhone: string; customerEmail?: string; address: string; province: string; city: string; district: string; postalCode?: string; variantKey: string; quantity: number; shippingCost: number; paymentMethod: "cod" | "manual_transfer"; sellerBankAccountId?: number; shippingZoneCode?: string; shippingRateRuleId?: number; shippingAmountSen?: number; adClickIds?: string };
export type PersistedOrder = { id: number; orderNumber: string; publicStatusToken: string; contentId: string; totalAmount: number; productValue: number; unitPrice: number; sellerBankAccountId?: number; sellerBankCode?: string; sellerBankName?: string; sellerAccountHolder?: string; sellerAccountNumber?: string };
export class DuplicateSubmissionError extends Error {}
export class OrderInputError extends Error {}

export async function allocateOrderNumber(database: D1Database): Promise<string> {
  const row = await database.prepare(`UPDATE order_number_counters SET last_value = last_value + 1, updated_at = ? WHERE counter_name = 'orders' RETURNING last_value`).bind(new Date().toISOString()).first<{ last_value: number }>();
  const value = Number(row?.last_value);
  if (!Number.isInteger(value) || value <= 10000) throw new Error("Nomor order gagal dialokasikan.");
  return `INV-${value}`;
}

export async function persistOrder(database: D1Database, input: PersistOrderInput): Promise<PersistedOrder> {
  const variant = await database.prepare(`SELECT pv.id, pv.product_id, pv.price, pv.stock FROM product_variants pv INNER JOIN products p ON p.id = pv.product_id WHERE (CAST(pv.id AS TEXT) = ? OR pv.sku = ?) AND p.is_active = 1 LIMIT 1`).bind(input.variantKey, input.variantKey).first<{ id: number; product_id: number; price: number; stock: number | null }>();
  if (!variant) throw new OrderInputError("Varian produk tidak ditemukan.");
  if (variant.stock !== null && variant.stock < input.quantity) throw new OrderInputError("Stok produk tidak mencukupi.");
  const store = await database.prepare("SELECT id FROM stores ORDER BY id LIMIT 1").first<{ id: number }>();
  if (!store) throw new Error("Store belum dikonfigurasi.");
  const bank = input.paymentMethod === "manual_transfer" ? await database.prepare(`SELECT id, bank_code, account_holder, account_number FROM seller_bank_accounts WHERE id = ? AND store_id = ? AND is_active = 1 LIMIT 1`).bind(input.sellerBankAccountId || 0, store.id).first<{ id: number; bank_code: string; account_holder: string; account_number: string }>() : null;
  if (input.paymentMethod === "manual_transfer" && !bank) throw new OrderInputError("Rekening transfer tidak tersedia.");
  const orderNumber = await allocateOrderNumber(database);
  const publicStatusToken = crypto.randomUUID();
  const unitPrice = Number(variant.price);
  const productValue = unitPrice * input.quantity;
  const totalAmount = productValue + input.shippingCost;
  const paymentStatus = input.paymentMethod === "cod" ? "unpaid" : "pending";
  try {
    const identity = [orderNumber, input.submitToken] as const;
    const results = await database.batch([
      database.prepare(`INSERT INTO orders (order_number, submit_token, public_status_token, store_id, customer_name, customer_phone, customer_email, address, province, city, district, postal_code, total_amount, shipping_cost, payment_method, payment_status, shipping_status, seller_bank_account_id, seller_bank_code, seller_bank_name, seller_account_holder, seller_account_number, shipping_zone_code, shipping_rate_rule_id, shipping_amount_sen, ad_click_ids, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(orderNumber, input.submitToken, publicStatusToken, store.id, input.customerName, input.customerPhone, input.customerEmail || null, input.address, input.province, input.city, input.district, input.postalCode || null, totalAmount, input.shippingCost, input.paymentMethod, paymentStatus, bank?.id || null, bank?.bank_code || null, bank ? paymentBrandLabel(bank.bank_code) : null, bank?.account_holder || null, bank?.account_number || null, input.shippingZoneCode || null, input.shippingRateRuleId || null, input.shippingAmountSen ?? null, input.adClickIds || null, new Date().toISOString()),
      database.prepare(`INSERT INTO order_items (order_id, variant_id, quantity, unit_price) SELECT id, ?, ?, ? FROM orders WHERE order_number = ? AND submit_token = ?`).bind(variant.id, input.quantity, unitPrice, ...identity),
      database.prepare(`UPDATE product_variants SET stock = stock - ? WHERE id = ? AND stock IS NOT NULL AND EXISTS (SELECT 1 FROM orders WHERE order_number = ? AND submit_token = ?)`).bind(input.quantity, variant.id, ...identity),
      database.prepare(`SELECT id FROM orders WHERE order_number = ? AND submit_token = ? LIMIT 1`).bind(...identity),
    ]);
    const row = results.at(-1)?.results?.[0] as { id?: number } | undefined;
    if (!row?.id) throw new Error("Order gagal disimpan.");
    await recordNotification(database, { type: "order", orderId: row.id, orderNumber, ...buildOrderNotification({ orderNumber, customerName: input.customerName, totalAmount, district: input.district, city: input.city }) });
    return { id: row.id, orderNumber, publicStatusToken, contentId: `p${variant.product_id}-v${variant.id}`, totalAmount, productValue, unitPrice, sellerBankAccountId: bank?.id, sellerBankCode: bank?.bank_code, sellerBankName: bank ? paymentBrandLabel(bank.bank_code) : undefined, sellerAccountHolder: bank?.account_holder, sellerAccountNumber: bank?.account_number };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("submit_token")) throw new DuplicateSubmissionError("Permintaan duplikat terdeteksi. Pesanan sudah diproses.");
    if (message.includes("INSUFFICIENT_STOCK")) throw new OrderInputError("Stok produk tidak mencukupi.");
    throw error;
  }
}
