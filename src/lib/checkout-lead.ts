import { z } from 'zod';
import { isValidMalaysiaCustomerName, isValidMalaysiaDeliveryAddress, isValidMalaysiaPhone, normalizeMalaysiaCustomerName, normalizeMalaysiaDeliveryAddress, normalizeMalaysiaPhone } from './validation.ts';
import { DuplicateSubmissionError, persistOrder } from './order-persistence.ts';
import { resolveMalaysiaLocation } from './malaysia-locations.ts';
import { quoteMalaysiaShippingFromD1 } from './malaysia-shipping.ts';
import type { AcceptedOrderMetaContext } from './accepted-order-meta.ts';

export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'not_interested'] as const;
export const leadIdentitySchema = z.object({
  customer_name: z.string().max(200).transform(normalizeMalaysiaCustomerName).refine(isValidMalaysiaCustomerName, 'Nama lengkap tidak valid.'),
  customer_phone: z.string().max(40).transform(normalizeMalaysiaPhone).refine(isValidMalaysiaPhone, 'Nomor Malaysia tidak valid.'),
  variant_id: z.coerce.number().int().positive(),
});
export const captureLeadSchema = leadIdentitySchema.extend({
  submit_token: z.string().regex(/^[a-f0-9]{64}$/),
  website: z.string().max(0).optional(),
});
export const convertLeadSchema = leadIdentitySchema.extend({
  id: z.number().int().positive(),
  address: z.string().max(500).transform(normalizeMalaysiaDeliveryAddress).refine(isValidMalaysiaDeliveryAddress, 'Alamat lengkap tidak valid.'),
  location_id: z.coerce.number().int().positive(),
  shipping_cost: z.number().int().nonnegative(),
});
export const followUpSchema = z.object({
  id: z.number().int().positive(),
  follow_up_status: z.enum(LEAD_STATUSES),
  follow_up_note: z.string().trim().max(1000).optional(),
});

export class CheckoutLeadError extends Error {
  readonly status: number;
  constructor(message: string, status = 409) { super(message); this.status = status; }
}

export async function captureCheckoutLead(database: D1Database, input: z.infer<typeof captureLeadSchema>) {
  const variant = await database.prepare('SELECT pv.id FROM product_variants pv JOIN products p ON p.id = pv.product_id WHERE pv.id = ? AND p.is_active = 1')
    .bind(input.variant_id).first();
  if (!variant) throw new CheckoutLeadError('Varian tidak tersedia.', 422);
  const now = new Date().toISOString();
  // Never reopen converted records; late capture after checkout is a safe no-op.
  await database.prepare(`INSERT INTO checkout_leads
    (capture_token, customer_name, customer_phone, variant_id, created_at, updated_at)
    SELECT ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM orders WHERE submit_token = ?)
    ON CONFLICT(capture_token) DO UPDATE SET customer_name = excluded.customer_name,
      customer_phone = excluded.customer_phone, variant_id = excluded.variant_id, updated_at = excluded.updated_at
    WHERE checkout_leads.converted_at IS NULL`)
    .bind(input.submit_token, input.customer_name, input.customer_phone, input.variant_id, now, now, input.submit_token).run();
}

export async function convertCheckoutLead(database: D1Database, input: z.infer<typeof convertLeadSchema>, metaPurchase?: AcceptedOrderMetaContext) {
  const lead = await database.prepare(`SELECT capture_token, converted_at, converted_order_id FROM checkout_leads WHERE id = ?`)
    .bind(input.id).first<{capture_token: string; converted_at: string | null; converted_order_id: number | null}>();
  if (!lead) throw new CheckoutLeadError('Lead tidak ditemukan.', 404);
  const existingOrder = async () => {
    const order = await database.prepare('SELECT order_number FROM orders WHERE submit_token = ?').bind(lead.capture_token).first<{order_number: string}>();
    if (!order) throw new CheckoutLeadError('Lead sudah dikonversi; order tidak lagi tersedia.');
    return { order_number: order.order_number, already_converted: true };
  };
  if (lead.converted_at) return existingOrder();
  const location = await resolveMalaysiaLocation(database, input.location_id);
  const quote = await quoteMalaysiaShippingFromD1(database, {postcode: location.postcode, variantKey: String(input.variant_id), quantity: 1});
  if (input.shipping_cost !== quote.amountSen) throw new CheckoutLeadError('Tarif berubah. Pilih ulang lokasi untuk memeriksa total terbaru.');
  try {
    const order = await persistOrder(database, {
      submitToken: lead.capture_token, customerName: input.customer_name, customerPhone: input.customer_phone,
      address: input.address, district: location.city, city: location.city, province: location.state, postalCode: location.postcode,
      variantKey: String(input.variant_id), quantity: 1, shippingCost: quote.amountSen, paymentMethod: 'cod',
      shippingZoneCode: quote.zoneCode, shippingRateRuleId: quote.rateRuleId, shippingAmountSen: quote.amountSen,
      metaPurchase,
    });
    return { order_number: order.orderNumber, already_converted: false };
  } catch (error) {
    if (error instanceof DuplicateSubmissionError || (error instanceof Error && error.message.includes('LEAD_ALREADY_CONVERTED'))) return existingOrder();
    throw error;
  }
}
