-- Local preview catalogue only. This intentionally contains fictional data
-- and must never be run with `--remote`.

INSERT INTO stores (
  id, name, slug, created_at, support_whatsapp, site_url, description, logo,
  tagline, theme_color, locale, storefront_template, admin_name,
  is_cod_enabled
)
VALUES (
  1, 'MyBookCMS Malaysia', 'mybookcms', '2026-08-23T00:00:00.000Z',
  '+60123456789', 'http://198.51.100.10:8789',
  'Pilihan buku dan alat tulis untuk pembaca Malaysia.', '/images/mybook-mark.webp',
  'Baca lebih, hidup lebih.', '#0f766e', 'ms-MY', 'compact-market', 'MyBookCMS Admin', 1
)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name, slug = excluded.slug, support_whatsapp = excluded.support_whatsapp,
  site_url = excluded.site_url, description = excluded.description, logo = excluded.logo,
  tagline = excluded.tagline, theme_color = excluded.theme_color, locale = excluded.locale,
  storefront_template = excluded.storefront_template, admin_name = excluded.admin_name,
  is_cod_enabled = 1;

INSERT INTO seller_bank_accounts (
  store_id, bank_code, account_holder, account_number, is_active, display_order, created_at, updated_at
)
SELECT 1, 'MAYBANK', 'MyBookCMS Malaysia', '114012345678', 1, 1,
  '2026-08-23T00:00:00.000Z', '2026-08-23T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM seller_bank_accounts WHERE store_id = 1 AND bank_code = 'MAYBANK');

-- Remove the early inherited preview fixtures. These fixed IDs belong only to
-- local demo data and are never referenced by a fresh MyBookCMS order.
DELETE FROM product_variants WHERE product_id IN (1, 2, 3);
DELETE FROM products WHERE id IN (1, 2, 3);

-- Public catalog IDs are intentionally five digits because feeds and product
-- URLs use that invariant.

INSERT INTO products (id, store_id, title, slug, category, is_active, created_at, image_url)
VALUES
  (10001, 1, 'Jurnal Fokus Harian', 'jurnal-fokus-harian', 'Alat tulis', 1, '2026-08-23T00:00:00.000Z', '/images/preview-stationery-flatlay.png'),
  (10002, 1, 'Set Buku Catatan Minimal', 'set-buku-catatan-minimal', 'Buku', 1, '2026-08-23T00:01:00.000Z', '/images/preview-stationery-flatlay.png'),
  (10003, 1, 'Planner Mingguan 2026', 'planner-mingguan-2026', 'Planner', 1, '2026-08-23T00:02:00.000Z', '/images/preview-stationery-flatlay.png')
ON CONFLICT(id) DO UPDATE SET
  title = excluded.title, slug = excluded.slug, category = excluded.category,
  is_active = excluded.is_active, image_url = excluded.image_url;

INSERT INTO product_variants (id, product_id, sku, title, price, compare_price, weight_grams, stock)
VALUES
  (10001, 10001, 'MYB-JFH-A5', 'A5', 2490, 2990, 350, 80),
  (10002, 10001, 'MYB-JFH-B5', 'B5', 3290, 3990, 500, 60),
  (10003, 10002, 'MYB-SBM-3', 'Set 3 buku', 1890, 2290, 450, 120),
  (10004, 10003, 'MYB-PMW-2026', 'Edisi 2026', 3990, 4590, 650, 45)
ON CONFLICT(id) DO UPDATE SET
  product_id = excluded.product_id, sku = excluded.sku, title = excluded.title,
  price = excluded.price, compare_price = excluded.compare_price,
  weight_grams = excluded.weight_grams, stock = excluded.stock;

-- The storefront publishes one controlled Malaysia-market hybrid presentation.
-- Migration 0051's English siblings remain NULL for forward compatibility.
INSERT INTO storefront_content (
  store_id, content_key, content_type, draft_json, published_json,
  draft_json_en, published_json_en, version, generated_by, updated_at,
  published_at, published_at_en
) VALUES (
  1, 'home', 'home',
  '{"hero":{"title":"Buku untuk rutin yang lebih teratur","description":"Pilihan jurnal dan planner praktikal untuk pembaca di Malaysia.","ratingLabel":"Pesanan diproses setiap hari"},"catalog":{"eyebrow":"Koleksi","title":"Pilih buku anda","description":"Harga dalam MYR dan penghantaran seluruh Malaysia."},"solutionsHeading":{"eyebrow":"Panduan","title":"Ketahui lebih lanjut","description":"Halaman pilihan daripada kedai kami."},"proofsHeading":{"eyebrow":"Ulasan","title":"Cerita pembeli","description":"Pengalaman pembeli yang telah disahkan."},"heroHighlights":[{"label":"Sedia dihantar","icon":"package"}],"heroSlides":[],"solutions":[],"proofs":[]}',
  '{"hero":{"title":"Buku untuk rutin yang lebih teratur","description":"Pilihan jurnal dan planner praktikal untuk pembaca di Malaysia.","ratingLabel":"Pesanan diproses setiap hari"},"catalog":{"eyebrow":"Koleksi","title":"Pilih buku anda","description":"Harga dalam MYR dan penghantaran seluruh Malaysia."},"solutionsHeading":{"eyebrow":"Panduan","title":"Ketahui lebih lanjut","description":"Halaman pilihan daripada kedai kami."},"proofsHeading":{"eyebrow":"Ulasan","title":"Cerita pembeli","description":"Pengalaman pembeli yang telah disahkan."},"heroHighlights":[{"label":"Sedia dihantar","icon":"package"}],"heroSlides":[],"solutions":[],"proofs":[]}',
  NULL,
  NULL,
  1, 'manual', '2026-08-23T18:00:00.000Z', '2026-08-23T18:00:00.000Z', NULL
)
ON CONFLICT(content_key) DO UPDATE SET
  draft_json = excluded.draft_json, published_json = excluded.published_json,
  draft_json_en = excluded.draft_json_en, published_json_en = excluded.published_json_en,
  version = storefront_content.version + 1, generated_by = excluded.generated_by,
  updated_at = excluded.updated_at, published_at = excluded.published_at,
  published_at_en = excluded.published_at_en;

INSERT INTO storefront_content (
  store_id, content_key, content_type, draft_json, published_json,
  draft_json_en, published_json_en, version, generated_by, updated_at,
  published_at, published_at_en
) VALUES
  (1, 'product:10001', 'product',
   '{"contentName":"Jurnal Fokus Harian","headline":"Mulakan hari dengan fokus yang jelas","subheadline":"Jurnal ringkas untuk keutamaan, nota dan refleksi harian.","seoTitle":"Jurnal Fokus Harian untuk Rutin Teratur","seoDescription":"Jurnal harian praktikal dengan pilihan saiz A5 dan B5 untuk pembaca Malaysia.","image":"/images/preview-stationery-flatlay.png","heroImage":"/images/preview-stationery-flatlay.png","tag":"Jurnal harian","relatedCategories":["Alat tulis"],"description":"Susun keutamaan dan catatan penting dalam format yang mudah digunakan setiap hari.","benefits":["Ruang fokus harian","Mudah dibawa"],"keyPoints":["Pilihan A5 dan B5","Kertas sesuai untuk nota harian"],"idealFor":["Pelajar","Profesional"],"offerText":"Pilih saiz yang sesuai untuk rutin anda.","ctaText":"Buat pesanan","reviews":[]}',
   '{"contentName":"Jurnal Fokus Harian","headline":"Mulakan hari dengan fokus yang jelas","subheadline":"Jurnal ringkas untuk keutamaan, nota dan refleksi harian.","seoTitle":"Jurnal Fokus Harian untuk Rutin Teratur","seoDescription":"Jurnal harian praktikal dengan pilihan saiz A5 dan B5 untuk pembaca Malaysia.","image":"/images/preview-stationery-flatlay.png","heroImage":"/images/preview-stationery-flatlay.png","tag":"Jurnal harian","relatedCategories":["Alat tulis"],"description":"Susun keutamaan dan catatan penting dalam format yang mudah digunakan setiap hari.","benefits":["Ruang fokus harian","Mudah dibawa"],"keyPoints":["Pilihan A5 dan B5","Kertas sesuai untuk nota harian"],"idealFor":["Pelajar","Profesional"],"offerText":"Pilih saiz yang sesuai untuk rutin anda.","ctaText":"Buat pesanan","reviews":[]}',
   NULL,
   NULL,
   1, 'manual', '2026-08-23T18:00:00.000Z', '2026-08-23T18:00:00.000Z', NULL),
  (1, 'product:10002', 'product',
   '{"contentName":"Set Buku Catatan Minimal","headline":"Tiga buku untuk nota yang lebih kemas","subheadline":"Set buku catatan ringan untuk kerja, idea dan senarai harian.","seoTitle":"Set Buku Catatan Minimal 3 Buku","seoDescription":"Set tiga buku catatan minimal untuk kegunaan harian di Malaysia.","image":"/images/preview-stationery-flatlay.png","heroImage":"/images/preview-stationery-flatlay.png","tag":"Set 3 buku","relatedCategories":["Buku"],"variantLabels":[{"variantId":10003,"label":"Set 3 buku"}],"description":"Asingkan nota mengikut projek tanpa membawa buku yang berat.","benefits":["Tiga buku dalam satu set","Reka bentuk ringkas"],"keyPoints":["Sesuai untuk nota harian"],"idealFor":["Kerja","Belajar"],"offerText":"Satu set untuk tiga kegunaan.","ctaText":"Buat pesanan","reviews":[]}',
   '{"contentName":"Set Buku Catatan Minimal","headline":"Tiga buku untuk nota yang lebih kemas","subheadline":"Set buku catatan ringan untuk kerja, idea dan senarai harian.","seoTitle":"Set Buku Catatan Minimal 3 Buku","seoDescription":"Set tiga buku catatan minimal untuk kegunaan harian di Malaysia.","image":"/images/preview-stationery-flatlay.png","heroImage":"/images/preview-stationery-flatlay.png","tag":"Set 3 buku","relatedCategories":["Buku"],"variantLabels":[{"variantId":10003,"label":"Set 3 buku"}],"description":"Asingkan nota mengikut projek tanpa membawa buku yang berat.","benefits":["Tiga buku dalam satu set","Reka bentuk ringkas"],"keyPoints":["Sesuai untuk nota harian"],"idealFor":["Kerja","Belajar"],"offerText":"Satu set untuk tiga kegunaan.","ctaText":"Buat pesanan","reviews":[]}',
   NULL,
   NULL,
   1, 'manual', '2026-08-23T18:00:00.000Z', '2026-08-23T18:00:00.000Z', NULL),
  (1, 'product:10003', 'product',
   '{"contentName":"Planner Mingguan 2026","headline":"Lihat minggu anda dalam satu pandangan","subheadline":"Planner mingguan untuk jadual, tugasan dan nota penting sepanjang 2026.","seoTitle":"Planner Mingguan 2026 Malaysia","seoDescription":"Planner mingguan 2026 untuk menyusun jadual dan tugasan harian.","image":"/images/preview-stationery-flatlay.png","heroImage":"/images/preview-stationery-flatlay.png","tag":"Edisi 2026","relatedCategories":["Planner"],"variantLabels":[{"variantId":10004,"label":"Edisi 2026"}],"description":"Rancang tujuh hari dengan ruang yang jelas untuk jadual dan keutamaan.","benefits":["Paparan satu minggu","Ruang keutamaan"],"keyPoints":["Edisi bertarikh 2026"],"idealFor":["Perancangan kerja","Rutin keluarga"],"offerText":"Rancang 2026 dengan lebih tersusun.","ctaText":"Buat pesanan","reviews":[]}',
   '{"contentName":"Planner Mingguan 2026","headline":"Lihat minggu anda dalam satu pandangan","subheadline":"Planner mingguan untuk jadual, tugasan dan nota penting sepanjang 2026.","seoTitle":"Planner Mingguan 2026 Malaysia","seoDescription":"Planner mingguan 2026 untuk menyusun jadual dan tugasan harian.","image":"/images/preview-stationery-flatlay.png","heroImage":"/images/preview-stationery-flatlay.png","tag":"Edisi 2026","relatedCategories":["Planner"],"variantLabels":[{"variantId":10004,"label":"Edisi 2026"}],"description":"Rancang tujuh hari dengan ruang yang jelas untuk jadual dan keutamaan.","benefits":["Paparan satu minggu","Ruang keutamaan"],"keyPoints":["Edisi bertarikh 2026"],"idealFor":["Perancangan kerja","Rutin keluarga"],"offerText":"Rancang 2026 dengan lebih tersusun.","ctaText":"Buat pesanan","reviews":[]}',
   NULL,
   NULL,
   1, 'manual', '2026-08-23T18:00:00.000Z', '2026-08-23T18:00:00.000Z', NULL)
ON CONFLICT(content_key) DO UPDATE SET
  draft_json = excluded.draft_json, published_json = excluded.published_json,
  draft_json_en = excluded.draft_json_en, published_json_en = excluded.published_json_en,
  version = storefront_content.version + 1, generated_by = excluded.generated_by,
  updated_at = excluded.updated_at, published_at = excluded.published_at,
  published_at_en = excluded.published_at_en;
