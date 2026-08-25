import type { Product, ProductVariant } from "../data/products.ts";

export const PUBLIC_CATALOG_FEED_PATH = "/feed/google-catalog.xml";

export type GoogleCatalogItem = {
  id: string;
  productId: string;
  variantId: string;
  title: string;
  description: string;
  link: string;
  imageLink: string;
  availability: "in_stock";
  condition: "new";
  price: string;
  salePrice?: string;
  productType: string;
  itemGroupId?: string;
  itemGroupTitle?: string;
  variantOption?: { name: string; value: string };
};

export type GoogleCatalogWarning = {
  code: "http-origin" | "language-review" | "missing-identifiers" | "short-description";
  message: string;
};

export type GoogleCatalog = {
  items: GoogleCatalogItem[];
  productCount: number;
  warnings: GoogleCatalogWarning[];
  readiness: "empty" | "review" | "ready";
  readinessLabel: string;
};

const MAX_TITLE_LENGTH = 150;
const MAX_DESCRIPTION_LENGTH = 5_000;

function positiveInteger(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function plainText(value: unknown) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return value.slice(0, maxLength - 1).trimEnd() + "…";
}

function trustedOrigin(siteUrl: string) {
  const parsed = new URL(siteUrl);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Store URL must use HTTP or HTTPS.");
  }
  return new URL("/", parsed).toString();
}

function variantId(variant: ProductVariant) {
  return positiveInteger(variant.catalogId) ?? positiveInteger(variant.id);
}

export function googleCatalogOfferId(productId: unknown, offerVariantId: unknown) {
  const product = positiveInteger(productId);
  const variant = positiveInteger(offerVariantId);
  if (!product || !variant) throw new Error("Google catalog IDs must be positive integers.");
  const id = `p${product}-v${variant}`;
  if (id.length > 50) throw new Error("Google catalog ID exceeds 50 characters.");
  return id;
}

export function formatGoogleMyr(amountInSen: number) {
  if (!Number.isSafeInteger(amountInSen) || amountInSen <= 0) {
    throw new Error("Google catalog price must be a positive integer in sen.");
  }
  return `${(amountInSen / 100).toFixed(2)} MYR`;
}

function feedDescription(product: Product) {
  return truncate(
    plainText([
      product.description,
      ...(product.benefits ?? []),
      ...(product.keyPoints ?? []),
      ...(product.idealFor ?? []),
    ].filter(Boolean).join(" ")),
    MAX_DESCRIPTION_LENGTH,
  );
}

export function buildGoogleCatalog(
  products: readonly Product[],
  siteUrl: string,
  locale = "ms-MY",
): GoogleCatalog {
  const origin = trustedOrigin(siteUrl);
  const items: GoogleCatalogItem[] = [];
  let hasShortDescription = false;

  for (const product of products) {
    const productId = positiveInteger(product.catalogId) ?? positiveInteger(product.productId);
    if (!productId) continue;
    const description = feedDescription(product);
    if (description.length < 80) hasShortDescription = true;
    const productName = plainText(product.contentName || product.productName);
    const productType = plainText(product.category || "Produk");
    const imageLink = new URL(product.heroImage || product.image, origin).toString();
    const isVariantGroup = product.variants.length > 1;

    for (const variant of product.variants) {
      const offerVariantId = variantId(variant);
      if (!offerVariantId || !Number.isSafeInteger(variant.price) || variant.price <= 0) continue;
      const offerId = googleCatalogOfferId(productId, offerVariantId);
      const variantLabel = plainText(variant.label);
      const link = new URL(`/produk/${encodeURIComponent(product.slug)}`, origin);
      link.searchParams.set("variant_id", String(offerVariantId));
      const hasSalePrice = Number.isSafeInteger(variant.comparePrice)
        && Number(variant.comparePrice) > variant.price;

      items.push({
        id: offerId,
        productId: String(productId),
        variantId: String(offerVariantId),
        title: truncate(isVariantGroup && variantLabel ? `${productName} — ${variantLabel}` : productName, MAX_TITLE_LENGTH),
        description,
        link: link.toString(),
        imageLink,
        availability: "in_stock",
        condition: "new",
        price: formatGoogleMyr(hasSalePrice ? Number(variant.comparePrice) : variant.price),
        ...(hasSalePrice ? { salePrice: formatGoogleMyr(variant.price) } : {}),
        productType,
        ...(isVariantGroup
          ? {
              itemGroupId: `p${productId}`,
              itemGroupTitle: productName,
              variantOption: { name: "option", value: variantLabel },
            }
          : {}),
      });
    }
  }

  const warnings: GoogleCatalogWarning[] = [];
  if (!origin.startsWith("https://")) {
    warnings.push({
      code: "http-origin",
      message: "URL toko masih HTTP. Gunakan domain HTTPS sebelum mendaftarkan feed ke Merchant Center.",
    });
  }
  if (locale.toLowerCase().startsWith("ms")) {
    warnings.push({
      code: "language-review",
      message: "Konten storefront memakai gaya hybrid Malay/English. Tinjau konsistensi bahasa sumber, landing page, dan checkout di Merchant Center.",
    });
  }
  if (items.length > 0) {
    warnings.push({
      code: "missing-identifiers",
      message: "GTIN/ISBN, brand, dan MPN belum tersedia di skema produk. Isi identifier yang sah sebelum mengandalkannya untuk listing Google.",
    });
  }
  if (hasShortDescription) {
    warnings.push({
      code: "short-description",
      message: "Sebagian deskripsi produk masih pendek. Lengkapi isi produk di menu Konten agar feed lebih informatif.",
    });
  }

  const productCount = new Set(items.map((item) => item.productId)).size;
  const readiness = items.length === 0 ? "empty" : warnings.length > 0 ? "review" : "ready";
  const readinessLabel = readiness === "empty"
    ? "Tidak ada produk"
    : readiness === "ready"
      ? "XML siap"
      : "XML valid · perlu ditinjau";

  return { items, productCount, warnings, readiness, readinessLabel };
}

export function escapeXml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function generateGoogleCatalogXml(
  catalog: GoogleCatalog,
  channel: { title: string; link: string; description?: string },
) {
  const origin = trustedOrigin(channel.link);
  const rows = catalog.items.map((item) => {
    const grouping = item.itemGroupId && item.itemGroupTitle && item.variantOption
      ? `\n      <g:item_group_id>${escapeXml(item.itemGroupId)}</g:item_group_id>\n      <g:item_group_title>${escapeXml(item.itemGroupTitle)}</g:item_group_title>\n      <g:variant_option>\n        <g:name>${escapeXml(item.variantOption.name)}</g:name>\n        <g:value>${escapeXml(item.variantOption.value)}</g:value>\n      </g:variant_option>`
      : "";
    const salePrice = item.salePrice
      ? `\n      <g:sale_price>${escapeXml(item.salePrice)}</g:sale_price>`
      : "";
    return `    <item>
      <g:id>${escapeXml(item.id)}</g:id>
      <title>${escapeXml(item.title)}</title>
      <description>${escapeXml(item.description)}</description>
      <link>${escapeXml(item.link)}</link>
      <g:image_link>${escapeXml(item.imageLink)}</g:image_link>
      <g:availability>${item.availability}</g:availability>
      <g:condition>${item.condition}</g:condition>
      <g:price>${escapeXml(item.price)}</g:price>${salePrice}
      <g:product_type>${escapeXml(item.productType)}</g:product_type>${grouping}
    </item>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(channel.title)}</title>
    <link>${escapeXml(origin)}</link>
    <description>${escapeXml(channel.description || `Katalog produk ${channel.title}`)}</description>
${rows.join("\n")}
  </channel>
</rss>`;
}
