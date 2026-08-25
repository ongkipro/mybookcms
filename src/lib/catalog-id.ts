/** Canonical public Product ID. MyBookCMS product IDs are five-digit integers. */
export function catalogProductId(value: string | number) {
  const normalized = String(value).trim();
  return /^\d{5,}$/.test(normalized) ? normalized : "";
}

export function parseCatalogOfferId(value: string) {
  const match = /^p([1-9]\d*)-v([1-9]\d*)$/.exec(value.trim());
  if (!match) return null;
  const productId = Number(match[1]);
  const variantId = Number(match[2]);
  return Number.isSafeInteger(productId) && Number.isSafeInteger(variantId)
    ? { productId, variantId }
    : null;
}
