/**
 * Public storefront language and money rules for the Malaysia-only product.
 * Monetary values are integer sen at every boundary; only this presentation
 * helper turns them into ringgit for a buyer.
 */
export const STOREFRONT_LOCALES = ["ms-MY"] as const;

export type StorefrontLocale = (typeof STOREFRONT_LOCALES)[number];

export function resolveStorefrontLocale(_value?: unknown): StorefrontLocale {
  return "ms-MY";
}

export function isStorefrontLocale(value: unknown): value is StorefrontLocale {
  return STOREFRONT_LOCALES.includes(value as StorefrontLocale);
}

export function formatMyr(
  amountSen: number | string,
  _locale: StorefrontLocale | string = "ms-MY",
): string {
  const numericAmount = Number(amountSen);
  const safeAmountSen = Number.isFinite(numericAmount)
    ? Math.round(numericAmount)
    : 0;

  return new Intl.NumberFormat("ms-MY", {
    style: "currency",
    currency: "MYR",
  }).format(safeAmountSen / 100);
}
