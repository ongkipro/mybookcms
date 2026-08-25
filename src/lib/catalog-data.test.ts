import assert from "node:assert/strict";
import test from "node:test";
import type { Product } from "../data/products.ts";
import { mergeStorefrontCatalog } from "./catalog-data.ts";

function runtimePresentation(productId: string): Product {
  return {
    slug: "presentation-slug",
    productId,
    productName: "Presentation Name",
    contentName: "Merchant presentation",
    headline: "Merchant-authored headline",
    subheadline: "Merchant-authored subheadline",
    seoTitle: "Merchant SEO title",
    seoDescription: "Merchant SEO description",
    price: 1,
    image: "/images/logo.svg",
    heroImage: "/images/logo.svg",
    images: ["/images/logo.svg"],
    tag: "Merchant tag",
    category: "Presentation category",
    relatedCategories: ["Merchant category"],
    variantLabels: [{ variantId: 60001, label: "Localized black" }],
    description: "Merchant-authored description",
    benefits: ["Merchant benefit"],
    keyPoints: ["Merchant key point"],
    idealFor: ["Merchant audience"],
    offerText: "Merchant offer",
    ctaText: "Merchant CTA",
    reviews: [],
    variants: [],
  };
}

const completeProductRow = {
  id: 50001,
  title: "Beg Kerja Harian",
  slug: "beg-kerja-harian",
  category: "Beg",
  image_url: "/assets/uploads/beg.webp",
  is_active: 1,
};

const completeVariantRows = [
  {
    id: 60001,
    product_id: 50001,
    sku: "BEG-HITAM",
    title: "Hitam",
    price: 12000,
    compare_price: 15000,
    stock: 50,
  },
  {
    id: 60002,
    product_id: 50001,
    sku: "BEG-COKLAT",
    title: "Coklat",
    price: 20000,
    compare_price: null,
    stock: 0,
  },
];

test("empty D1 product rows always produce an empty public catalog", () => {
  assert.deepEqual(
    mergeStorefrontCatalog([], [], [runtimePresentation("50001")]),
    [],
  );
});

test("D1 owns commerce identity while published content localizes display labels", () => {
  const products = mergeStorefrontCatalog(
    [completeProductRow],
    completeVariantRows,
    [
      runtimePresentation("50001"),
      runtimePresentation("99999"),
    ],
  );

  assert.equal(products.length, 1);
  assert.equal(products[0].productId, "50001");
  assert.equal(products[0].productName, "Merchant presentation");
  assert.equal(products[0].slug, "beg-kerja-harian");
  assert.equal(products[0].category, "Merchant category");
  assert.equal(products[0].image, "/assets/uploads/beg.webp");
  assert.equal(products[0].heroImage, "/assets/uploads/beg.webp");
  assert.deepEqual(products[0].images, ["/assets/uploads/beg.webp"]);
  assert.equal(products[0].headline, "Merchant-authored headline");
  assert.equal(products[0].price, 12000);
  assert.deepEqual(products[0].variants, [
    {
      catalogId: 60001,
      sku: "BEG-HITAM",
      id: "60001",
      label: "Localized black",
      price: 12000,
      comparePrice: 15000,
    },
  ]);
  assert.ok(!products.some((product) => product.productId === "99999"));
});

test("active products fail closed without complete merchant data", () => {
  const invalidProducts = [
    { ...completeProductRow, is_active: 0 },
    { ...completeProductRow, title: " " },
    { ...completeProductRow, slug: " " },
    { ...completeProductRow, image_url: null },
  ];

  for (const product of invalidProducts) {
    assert.deepEqual(
      mergeStorefrontCatalog([product], completeVariantRows),
      [],
    );
  }

  for (const variant of [
    { ...completeVariantRows[0], title: " " },
    { ...completeVariantRows[0], price: 0 },
    { ...completeVariantRows[0], stock: 0 },
    { ...completeVariantRows[0], stock: null },
  ]) {
    assert.deepEqual(
      mergeStorefrontCatalog([completeProductRow], [variant]),
      [],
    );
  }
});

test("missing D1 product image is never replaced with a bundled brand asset", () => {
  const products = mergeStorefrontCatalog(
    [{ ...completeProductRow, image_url: null }],
    completeVariantRows,
    [runtimePresentation("50001")],
  );

  assert.deepEqual(products, []);
  assert.doesNotMatch(JSON.stringify(products), /\/images\/logo\.svg/);
});
