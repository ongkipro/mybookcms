import { z } from 'zod';
import { DOKU_PAYMENT_CHANNELS } from './doku-config.ts';
import {
  isValidMalaysiaCustomerName,
  isValidMalaysiaDeliveryAddress,
  isValidMalaysiaPhone,
  MAX_CUSTOMER_NAME_LENGTH,
  MAX_DELIVERY_ADDRESS_LENGTH,
  MIN_CUSTOMER_NAME_LENGTH,
  MIN_DELIVERY_ADDRESS_LENGTH,
  normalizeMalaysiaCustomerName,
  normalizeMalaysiaDeliveryAddress,
  normalizeMalaysiaPhone,
} from './validation.ts';
export const normalizePhoneNumber = normalizeMalaysiaPhone;

export const orderSubmitSchema = z.object({
  customer_name: z.string().transform(normalizeMalaysiaCustomerName).pipe(
    z.string()
      .min(MIN_CUSTOMER_NAME_LENGTH, 'Nama penuh terlalu pendek (minimum 2 aksara).')
      .max(MAX_CUSTOMER_NAME_LENGTH, 'Nama penuh terlalu panjang (maksimum 100 aksara).')
      .refine(isValidMalaysiaCustomerName, {
        message: 'Nama penuh mengandungi aksara yang tidak dibenarkan.',
      }),
  ),
  // Normalize first, then run the one canonical Malaysia mobile check.
  customer_phone: z.string().transform(normalizeMalaysiaPhone).pipe(
    z.string().refine(isValidMalaysiaPhone, {
      message: 'Nombor telefon Malaysia tidak sah. Contoh: 0123456789',
    }),
  ),
  customer_email: z.string().trim().email('E-mel pembayaran tidak sah').max(160).optional().or(z.literal('')),
  address: z.string().transform(normalizeMalaysiaDeliveryAddress).pipe(
    z.string()
      .min(MIN_DELIVERY_ADDRESS_LENGTH, 'Alamat lengkap terlalu pendek (minimum 10 aksara).')
      .max(MAX_DELIVERY_ADDRESS_LENGTH, 'Alamat lengkap terlalu panjang (maksimum 500 aksara).')
      .refine(isValidMalaysiaDeliveryAddress, {
        message: 'Alamat lengkap mesti mengandungi nama jalan atau kawasan.',
      }),
  ),
  district: z.string().trim().min(2, 'Bandar atau daerah mesti diisi').max(120),
  province: z.string().trim().min(2, 'Negeri mesti diisi').max(120),
  postal_code: z.string().trim().regex(/^\d{5}$/, 'Poskod mesti mengandungi 5 digit'),
  location_id: z.coerce.number().int().positive().optional(),
  payment_method: z.enum(['cod', 'manual_transfer', 'doku']).default('cod'),
  doku_channel: z.enum(DOKU_PAYMENT_CHANNELS).optional(),
  seller_bank_account_id: z.coerce.number().int().positive().optional(),
  variant_id: z.union([z.string(), z.number().transform(String)]).pipe(
    z.string().trim().min(1, 'Varian produk harus dipilih').max(120),
  ),
  quantity: z.coerce.number().int().min(1).max(100).default(1),
  submit_token: z.string().trim().min(16, 'Token submit tidak valid').max(120),
  website: z.string().optional(), // Honeypot field
}).superRefine((input, context) => {
  if (input.payment_method !== 'doku' && input.doku_channel) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['doku_channel'],
      message: 'Saluran DOKU hanya sah untuk pembayaran DOKU',
    });
  }
  if (input.payment_method === 'cod') return;
  if (input.payment_method === 'manual_transfer') {
    if (!input.seller_bank_account_id) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['seller_bank_account_id'],
        message: 'Akaun bank mesti dipilih',
      });
    }
    return;
  }
  if (input.payment_method === 'doku') {
    if (!input.doku_channel) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['doku_channel'],
        message: 'Pilih saluran pembayaran DOKU',
      });
    }
    if (!input.customer_email) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customer_email'],
        message: 'E-mel diperlukan untuk pembayaran DOKU',
      });
    }
  }
});

export type OrderSubmitInput = z.infer<typeof orderSubmitSchema>;
