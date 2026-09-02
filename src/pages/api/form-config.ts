import type { APIRoute } from "astro";
import { jsonError, jsonOk } from "../../lib/api";
import {
  buildEmbedFormUrl,
  buildFormUrl,
  resolveFormVariant,
} from "../../lib/form-config";
import { getStorefrontProduct } from "../../lib/catalog";

export const prerender = false;

const PUBLIC_CACHE_CONTROL =
  "public, max-age=60, s-maxage=300, stale-while-revalidate=600";

export const GET: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  const productKey = String(url.searchParams.get("product_id") || "").trim();
  const variantKey = String(url.searchParams.get("variant_id") || "").trim();

  if (!productKey) {
    return jsonError("product_id wajib diisi.", 400, {
      code: "PRODUCT_ID_REQUIRED",
    });
  }
  const product = await getStorefrontProduct(locals, productKey);
  if (!product) {
    return jsonError("Produk aktif tidak ditemukan.", 404, {
      code: "PRODUCT_NOT_FOUND",
    });
  }

  const selectedVariant = resolveFormVariant(product, variantKey);
  if (!selectedVariant) {
    return jsonError("Varian aktif tidak ditemukan untuk produk ini.", 404, {
      code: "VARIANT_NOT_FOUND",
    });
  }

  return jsonOk(
    {
      product: {
        id: product.catalogId,
        slug: product.slug,
        name: product.productName,
        image: product.image,
        price: product.price,
        compare_price: product.comparePrice,
      },
      variants: product.variants.map((variant) => ({
        id: variant.catalogId,
        label: variant.label,
        price: variant.price,
        compare_price: variant.comparePrice ?? variant.price,
      })),
      selected_variant: {
        id: selectedVariant.catalogId,
        label: selectedVariant.label,
        price: selectedVariant.price,
        compare_price: selectedVariant.comparePrice ?? selectedVariant.price,
      },
      form: {
        market: "MY",
        render_url: buildFormUrl(product, selectedVariant),
        embed_url: buildEmbedFormUrl(product, selectedVariant),
      },
    },
    200,
    { "cache-control": PUBLIC_CACHE_CONTROL },
  );
};
