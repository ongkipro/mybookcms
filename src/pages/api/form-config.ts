import type { APIRoute } from "astro";
import { jsonError, jsonOk } from "../../lib/api";
import {
  buildEmbedFormUrl,
  buildEmbedFormUrls,
  buildFormUrl,
  buildFormUrls,
  parseFormMode,
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
  const requestedMode = parseFormMode(
    String(url.searchParams.get("form") || "hybrid").toLowerCase(),
  );

  if (!productKey) {
    return jsonError("product_id wajib diisi.", 400, {
      code: "PRODUCT_ID_REQUIRED",
    });
  }
  if (!requestedMode) {
    return jsonError("form harus middle, full, atau hybrid.", 400, {
      code: "FORM_MODE_INVALID",
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

  const formUrls = buildFormUrls(product, selectedVariant);
  const embedUrls = buildEmbedFormUrls(product, selectedVariant);

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
        requested_mode: requestedMode,
        resolved_mode: requestedMode === "middle" ? "middle" : "full",
        market: "MY",
        render_url: buildFormUrl(requestedMode, product, selectedVariant),
        urls: formUrls,
        embed_url: buildEmbedFormUrl(requestedMode, product, selectedVariant),
        embed_urls: embedUrls,
      },
    },
    200,
    { "cache-control": PUBLIC_CACHE_CONTROL },
  );
};
