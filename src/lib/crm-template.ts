import { formatMyr } from './storefront-locale.ts';
import { normalizeMalaysiaPhone } from './validation.ts';

export type CrmOrderContext = {
  customerName?: string;
  customerPhone?: string;
  address?: string;
  district?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  orderNumber?: string;
  productName?: string;
  productPrice?: number;
  comparePrice?: number;
  shippingCost?: number;
  totalAmount?: number;
  sellerName?: string;
  bankAccounts?: string;
  epaymentLink?: string;
  orderDetailsLink?: string;
  paymentDetails?: string;
  paymentLink?: string;
  storeName?: string;
  detailUrl?: string;
};

export const defaultCrmTemplates: Record<string, string> = {
  welcome:
    'Hai {{name}}, terima kasih atas pesanan anda!\n\n- Produk: {{product_name}}\n- Harga: {{product_price}}\n- Penghantaran: {{shipping_cost}}\n- Jumlah: 1\n- Jumlah bayaran: {{total_price}}\n- Nama: {{name}}\n- Telefon: {{phone}}\n- Alamat: {{address}}\n\nSila sahkan butiran ini supaya pesanan boleh diproses.',
  1:
    'Hai {{name}}, terima kasih kerana berminat dengan {{product_name}} pada harga {{product_price}}. Adakah apa-apa yang boleh kami bantu sebelum anda meneruskan pesanan?',
  2:
    'Hai {{name}}, pesanan {{product_name}} anda masih belum selesai.\n\n- Harga: {{product_price}}\n- Jumlah: {{total_price}}\n- Alamat: {{address}}, {{district}}, {{city}}\n\nBayaran pindahan bank: {{bank_accounts}}\nButiran pesanan: {{order_details_link}}\n\nHubungi kami jika anda memerlukan bantuan. {{seller_name}}',
  3:
    'Hai {{name}}, bayaran untuk {{product_name}} ({{product_price}}) masih belum diterima. Sila gunakan akaun berikut jika anda mahu meneruskan: {{bank_accounts}}. Terima kasih, {{seller_name}}',
  4:
    'Hai {{name}}, pesanan {{product_name}} anda masih menunggu bayaran. Anda boleh membuat pindahan ke {{bank_accounts}}. Kami sedia membantu jika ada pertanyaan. {{seller_name}}',
  5:
    'Hai {{name}}, ini peringatan terakhir untuk pesanan {{product_name}} pada harga {{product_price}}. Jika anda mahu meneruskan, sila pindahkan bayaran ke {{bank_accounts}}. Terima kasih, {{seller_name}}',
  6:
    'Hai {{name}}, kami masih belum menerima bayaran untuk {{product_name}} ({{product_price}}). Balas mesej ini jika anda memerlukan bantuan. Terima kasih, {{seller_name}}',
  7:
    'Hai {{name}}, bayaran {{total_price}} untuk {{product_name}} telah diterima. Pesanan sedang diproses untuk dihantar ke:\n{{address}}, {{district}}, {{city}}\n\nKemas kini penghantaran akan dihantar melalui WhatsApp. {{seller_name}}',
  8:
    'Hai {{name}}, pesanan {{product_name}} anda telah dihantar. Butiran pesanan: {{order_details_link}}\n\nTerima kasih, {{seller_name}}',
  9:
    'Hai {{name}}, {{product_name}} kini ditawarkan pada {{product_price}} berbanding {{compare_price}}, selagi stok masih ada.',
  redirect:
    'Hai, saya telah membuat pesanan {{product_name}} atas nama {{name}}. Sila semak butiran pesanan saya.',
};

export const CRM_TEMPLATE_KEYS = [
  'welcome',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  'redirect',
] as const;

export function parseCrmTemplates(value: string | null) {
  if (!value) return { ...defaultCrmTemplates };
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return Object.fromEntries(
      CRM_TEMPLATE_KEYS.map((key) => [
        key,
        typeof parsed[key] === 'string'
          ? parsed[key].trim().slice(0, 1200) || defaultCrmTemplates[key]
          : defaultCrmTemplates[key],
      ]),
    );
  } catch {
    return { ...defaultCrmTemplates };
  }
}

const normalizeUtf8 = (value: string): string => value.normalize('NFC');

export function renderCrmMessage(template: string, ctx: CrmOrderContext): string {
  const fullAddress = [
    ctx.address,
    ctx.district || '',
    ctx.city,
    ctx.province,
    ctx.postalCode,
  ]
    .filter(Boolean)
    .join(', ');

  const fmtPrice = (val?: number) => formatMyr(val ?? 0);

  const seller = ctx.sellerName || ctx.storeName || 'Kedai Kami';

  const rawProductPrice =
    ctx.productPrice && ctx.productPrice > 0
      ? ctx.productPrice
      : (ctx.totalAmount != null && ctx.totalAmount > 0
          ? Math.max(0, ctx.totalAmount - (ctx.shippingCost || 0))
          : 0);
  const productPriceStr = fmtPrice(rawProductPrice);

  const rawTotalAmount =
    ctx.totalAmount && ctx.totalAmount > 0
      ? ctx.totalAmount
      : (rawProductPrice > 0 ? rawProductPrice + (ctx.shippingCost || 0) : 0);
  const totalStr = fmtPrice(rawTotalAmount);

  const shippingStr = fmtPrice(ctx.shippingCost ?? 0);
  const comparePriceStr = ctx.comparePrice && ctx.comparePrice > 0
    ? fmtPrice(ctx.comparePrice)
    : (rawProductPrice > 0 ? fmtPrice(Math.round(rawProductPrice * 1.3)) : 'RM180.00');

  const replacements: Record<string, string> = {
    name: ctx.customerName || 'Pelanggan',
    customer_name: ctx.customerName || 'Pelanggan',

    product_name: ctx.productName || 'Produk',
    item_name: ctx.productName || 'Produk',

    product_price: productPriceStr,
    price: productPriceStr,

    compare_price: comparePriceStr,

    shipping_cost: shippingStr,
    shipping_cost_cod_cost: totalStr,

    total_price: totalStr,
    total_amount: totalStr,
    total: totalStr,

    phone: ctx.customerPhone || '',
    customer_phone: ctx.customerPhone || '',

    address: ctx.address || fullAddress || '',
    full_address: fullAddress || ctx.address || '',

    district: ctx.district || '',
    city: ctx.city || '',
    province: ctx.province || '',
    postal_code: ctx.postalCode || '',

    seller_name: seller,
    store_name: seller,

    bank_accounts:
      ctx.bankAccounts ||
      ctx.paymentDetails ||
      'Butiran pindahan bank belum tersedia',
    bank_account:
      ctx.bankAccounts ||
      ctx.paymentDetails ||
      'Butiran pindahan bank belum tersedia',
    epayment_link:
      ctx.epaymentLink || ctx.paymentLink || 'Pautan pembayaran tidak digunakan',
    payment_link:
      ctx.epaymentLink || ctx.paymentLink || 'Pautan pembayaran tidak digunakan',
    order_details_link:
      ctx.orderDetailsLink || ctx.detailUrl || 'Pautan butiran belum tersedia',
    // Legacy stored templates remain readable without depending on DB evidence.
    receipt_number: '[isi manual di WhatsApp]',
    courier: '[isi manual di WhatsApp]',

    order_number: ctx.orderNumber || '',
  };

  const normalizedReplacements = Object.fromEntries(
    Object.entries(replacements).map(([key, value]) => [
      key,
      normalizeUtf8(value),
    ]),
  );

  return normalizeUtf8(template)
    .replace(/{{\s*([^{}\s]+)\s*}}/g, (token, rawKey: string) => {
      const key = rawKey
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[.-]/g, '_')
        .toLowerCase()
        .trim();
      return normalizedReplacements[key] ?? token;
    })
    .normalize('NFC');
}

export function buildWaUrl(phone: string, text: string): string {
  const cleanPhone = normalizeMalaysiaPhone(phone || '');
  const cleanText = text
    .normalize('NFC')
    .replace(/[\uFE0E\uFE0F](?![\uFE0E\uFE0F])/g, '')
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/g, '');
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(cleanText)}`;
}
