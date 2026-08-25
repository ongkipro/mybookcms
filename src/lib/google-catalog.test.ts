import assert from "node:assert/strict";
import test from "node:test";
import type { Product } from "../data/products.ts";
import { getStorefrontProducts, getStorefrontProductsStrict } from "./catalog.ts";
import {
  buildGoogleCatalog,
  formatGoogleMyr,
  generateGoogleCatalogXml,
  googleCatalogOfferId,
  PUBLIC_CATALOG_FEED_PATH,
} from "./google-catalog.ts";

function product(overrides: Partial<Product> = {}): Product {
  return {
    catalogId: 10001,
    productId: "10001",
    slug: "jurnal-fokus-harian",
    productName: "Jurnal Fokus Harian",
    contentName: "Jurnal Fokus Harian",
    headline: "Susun hari dengan lebih tenang",
    subheadline: "Planner untuk rutin harian.",
    seoTitle: "Jurnal Fokus Harian",
    seoDescription: "Jurnal fokus untuk rutin harian.",
    price: 2490,
    image: "/images/jurnal.png",
    heroImage: "/images/jurnal.png",
    category: "Alat tulis & jurnal",
    relatedCategories: ["Alat tulis & jurnal"],
    description: "Jurnal praktikal untuk menyusun fokus, tugasan, dan catatan penting setiap hari.",
    benefits: ["Ruang catatan yang jelas", "Mudah dibawa"],
    keyPoints: ["Kertas berkualiti"],
    idealFor: ["Kerja", "Belajar"],
    offerText: "Harga mengikut pilihan.",
    ctaText: "Lanjutkan Pesanan",
    reviews: [],
    variants: [
      { catalogId: 10001, id: "10001", label: "A5", price: 2490, comparePrice: 2990 },
      { catalogId: 10002, id: "10002", label: "B5 & Besar", price: 3290 },
    ],
    ...overrides,
  };
}

test("uses the same variant-grain ID and preselected URL as storefront tracking", () => {
  const catalog = buildGoogleCatalog([product()], "https://mybook.example", "en-MY");
  assert.equal(catalog.items[0].id, "p10001-v10001");
  assert.equal(catalog.items[1].id, "p10001-v10002");
  assert.equal(catalog.items[1].link, "https://mybook.example/produk/jurnal-fokus-harian?variant_id=10002");
  assert.deepEqual(catalog.items[1].variantOption, { name: "option", value: "B5 & Besar" });
  assert.equal(catalog.items[1].itemGroupId, "p10001");
});

test("publishes one canonical feed path for Google and Meta consumers", () => {
  assert.equal(PUBLIC_CATALOG_FEED_PATH, "/feed/google-catalog.xml");
});

test("formats MYR exactly and represents compare price as price plus sale_price", () => {
  assert.equal(formatGoogleMyr(2490), "24.90 MYR");
  const first = buildGoogleCatalog([product()], "https://mybook.example", "en-MY").items[0];
  assert.equal(first.price, "29.90 MYR");
  assert.equal(first.salePrice, "24.90 MYR");
});

test("generates escaped RSS 2.0 XML without inventing product identifiers or taxonomy", () => {
  const catalog = buildGoogleCatalog([product()], "https://mybook.example", "en-MY");
  const xml = generateGoogleCatalogXml(catalog, {
    title: "MyBook & Co",
    link: "https://mybook.example",
  });
  assert.match(xml, /xmlns:g="http:\/\/base\.google\.com\/ns\/1\.0"/);
  assert.match(xml, /<g:id>p10001-v10002<\/g:id>/);
  assert.match(xml, /<g:value>B5 &amp; Besar<\/g:value>/);
  assert.match(xml, /<g:sale_price>24\.90 MYR<\/g:sale_price>/);
  assert.doesNotMatch(xml, /<g:(gtin|mpn|brand|google_product_category|identifier_exists)>/);
});

test("rejects unsafe origin, invalid IDs, and invalid prices", () => {
  assert.throws(() => buildGoogleCatalog([product()], "javascript:alert(1)"));
  assert.throws(() => googleCatalogOfferId(0, 1));
  assert.throws(() => formatGoogleMyr(0));
});

test("feed callers can distinguish a database failure from a genuinely empty catalog", async () => {
  const database = {
    prepare: () => ({}),
    batch: async () => { throw new Error("D1 unavailable"); },
  };
  const locals = { runtimeEnv: { OMS_DB: database } } as unknown as App.Locals;
  assert.deepEqual(await getStorefrontProducts(locals), []);
  await assert.rejects(() => getStorefrontProductsStrict(locals), /D1 unavailable/);
});
