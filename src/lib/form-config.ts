import type { Product, ProductVariant } from "../data/products";

export function resolveFormVariant(
  product: Product,
  key?: string,
): ProductVariant | undefined {
  if (!key) return product.variants[0];
  const normalized = key.trim();
  return product.variants.find((variant) => variant.id === normalized);
}

function formParams(
  product: Pick<Product, "productId">,
  variant?: Pick<ProductVariant, "id">,
) {
  const params = new URLSearchParams({ product_id: product.productId });
  if (variant) params.set("variant_id", variant.id);
  return params;
}

export function buildFormUrl(
  product: Pick<Product, "productId">,
  variant?: Pick<ProductVariant, "id">,
) {
  return `/full-form?${formParams(product, variant).toString()}`;
}

export function buildEmbedFormUrl(
  product: Pick<Product, "productId">,
  variant?: Pick<ProductVariant, "id">,
) {
  return `/embed/form?${formParams(product, variant).toString()}`;
}
