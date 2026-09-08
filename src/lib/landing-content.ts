import { formatMyr, type StorefrontLocale } from "./storefront-locale.ts";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function firstDefinedNumber(...values: unknown[]) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      const number = Number(value);
      if (Number.isFinite(number)) return number;
    }
  }
  return 0;
}

export type ShortcodeProduct = {
  title?: string;
  productName?: string;
  name?: string;
  price?: number | string;
  compare_price?: number | string | null;
  comparePrice?: number | string | null;
  variants?: Array<{
    price?: number | string;
    compare_price?: number | string | null;
    comparePrice?: number | string | null;
  }>;
};

export function parseShortcodes(
  html: string,
  product: ShortcodeProduct,
  csPhone = "",
  locale: StorefrontLocale | string = "ms-MY",
): string {
  const firstVariant = Array.isArray(product?.variants)
    ? product.variants[0]
    : undefined;
  const price = firstDefinedNumber(product?.price, firstVariant?.price);
  const comparePrice = firstDefinedNumber(
    product?.compare_price,
    product?.comparePrice,
    firstVariant?.compare_price,
    firstVariant?.comparePrice,
  );
  const discountPercent =
    comparePrice > price && comparePrice > 0
      ? `${Math.round(((comparePrice - price) / comparePrice) * 100)}%`
      : "0%";
  const replacements: Record<string, string> = {
    product_name: escapeHtml(
      product?.title ?? product?.productName ?? product?.name ?? "",
    ),
    product_price: formatMyr(price, locale),
    compare_price: formatMyr(comparePrice, locale),
    discount_percent: discountPercent,
    cs_whatsapp: escapeHtml(csPhone),
  };

  return html.replace(
    /(?:\{\{|\[)\s*(product_name|product_price|compare_price|discount_percent|cs_whatsapp)\s*(?:\}\}|\])/g,
    (_match, shortcode: string) => replacements[shortcode] ?? _match,
  );
}


export const LANDING_SECTION_TYPES = ['headline', 'paragraph', 'numbered_list', 'bullet_list', 'image', 'html', 'form'] as const;
export type LandingSectionType = typeof LANDING_SECTION_TYPES[number];
export type LandingContentConfig = {
  text?: string;
  align?: 'left' | 'center' | 'right';
  size?: 'small' | 'medium' | 'large';
  items?: string[];
  src?: string;
  alt?: string;
};
export class LandingContentError extends Error {}

export function normalizeLandingContent(type: LandingSectionType, value: unknown): LandingContentConfig | null {
  if (type === 'html' || type === 'form') return null;
  if (value != null && (typeof value !== 'object' || Array.isArray(value))) throw new LandingContentError('Konfigurasi section tidak valid.');
  const source = (value ?? {}) as Record<string, unknown>;
  const text = (key: string, limit: number) => {
    const value = source[key] ?? '';
    if (typeof value !== 'string' || value.length > limit) throw new LandingContentError(`${key} maksimal ${limit} karakter.`);
    return value;
  };
  if (type === 'headline' || type === 'paragraph') {
    const align = source.align ?? 'left';
    const size = source.size ?? 'medium';
    if (!['left', 'center', 'right'].includes(String(align)) || !['small', 'medium', 'large'].includes(String(size))) throw new LandingContentError('Perataan atau ukuran teks tidak valid.');
    return {text: text('text', type === 'headline' ? 500 : 10000), align: align as LandingContentConfig['align'], ...(type === 'headline' ? {size: size as LandingContentConfig['size']} : {})};
  }
  if (type === 'numbered_list' || type === 'bullet_list') {
    const items = source.items ?? [];
    if (!Array.isArray(items) || items.length > 100 || items.some(item => typeof item !== 'string' || item.length > 1000)) throw new LandingContentError('Daftar maksimal 100 baris, masing-masing 1.000 karakter.');
    return {items: items.map(item => item.trim()).filter(Boolean)};
  }
  if (type === 'image') {
    const src = text('src', 2000).trim();
    if (src && !isLandingImageUrl(src)) throw new LandingContentError('Gunakan URL gambar HTTP(S) atau path gambar lokal.');
    return {src, alt: text('alt', 500)};
  }
  throw new LandingContentError('Jenis section tidak valid.');
}

export function isLandingImageUrl(value: string) {
  if (/^\/(?!\/)/.test(value) && !/[\\\u0000-\u001f]/.test(value)) return true;
  try { return /^https?:$/.test(new URL(value).protocol) && !/[\u0000-\u001f]/.test(value); } catch { return false; }
}

/** Structured text is escaped, never treated as merchant-supplied HTML. */
export function renderLandingContent(type: LandingSectionType, input: unknown): string {
  const config = normalizeLandingContent(type, input);
  if (!config) return '';
  if (type === 'headline') return `<h2 class="lp-headline lp-size-${config.size} lp-align-${config.align}">${escapeHtml(config.text)}</h2>`;
  if (type === 'paragraph') return `<p class="lp-paragraph lp-align-${config.align}">${escapeHtml(config.text)}</p>`;
  if (type === 'numbered_list' || type === 'bullet_list') {
    const tag = type === 'numbered_list' ? 'ol' : 'ul';
    return `<${tag}>${config.items?.map(item => `<li>${escapeHtml(item)}</li>`).join('') ?? ''}</${tag}>`;
  }
  if (type === 'image' && config.src) return `<img src="${escapeHtml(config.src)}" alt="${escapeHtml(config.alt)}" loading="lazy" decoding="async" />`;
  return '';
}
