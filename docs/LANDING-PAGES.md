# Landing Page Authoring

> Verified against disk: 2026-09-04 @ MyBookCMS working tree

MyBookCMS supports two landing-page owners:

- CMS pages are authored by an operator and stored in D1.
- Native Astro pages are authored in the repository and registered in
  `src/data/native-landing-pages.ts`.

Both answer at `/<slug>`. A published landing page may also claim one product
URL. In that state `/produk/<product-slug>` is canonical and the landing slug
redirects there. The D1 partial unique index prevents two pages from claiming
the same product.

## CMS builder

`/admin/landing-pages/new` and `/admin/landing-pages/<id>/edit` provide the complete
operator builder (Owner/Admin/Advertiser): headline, paragraph, numbered list,
bullet list, image, HTML, and Malaysia checkout sections. The responsive canvas
uses the public 480 px content width. Sections support editing, local preview,
reordering, duplication, removal, and navigation. Title, manual slug, product,
draft/publication status, and SEO remain on the settings panel. New pages start
as drafts. A failed load blocks editing; failed saves retain input; leaving an
unsaved page invokes the browser's warning. A manually edited slug is preserved.

Structured content lives in `landing_sections.content_config`; migration
`0063_landing_content.sql` preserves all existing HTML/form rows. The shared
`src/lib/landing-content.ts` validates bounded content and escapes typed output.
HTML remains trusted operator-authored public markup; its admin preview strips
active markup and custom CSS, so it does not claim exact public parity. The saved
preview uses `?preview=1` and validates current Owner/Admin/Advertiser sessions;
anonymous and Customer Service sessions cannot reveal a draft.

Image upload reuses `/api/admin/media` (JPEG/PNG/WebP/GIF/AVIF, 2 MB maximum).
Failures preserve the previous image. Saving is disabled during upload. Changing
the bound product clears explicit form variants; server validation rejects any
variant belonging to another product. Form title and ready-state button text are
customizable; required-field guidance and hosted DOKU action labels retain their
meaning. Without an explicit form, the public renderer supplies the shared full
Malaysia checkout automatically. No Indonesian checkout mode is imported.

Local regression: build, then run
`node --experimental-strip-types scripts/verify-landing-builder.mts` with local
Chromium CDP at `http://127.0.0.1:9396` (override with `CDP_URL`). It uses fictional
isolated Worker/D1/KV/R2 fixtures and does not mutate the running store.

## Native page contract

A native route resolves the product from D1, renders through `BaseLayout`, and
uses the shared Malaysia checkout. `BaseLayout` owns the store tracking loader,
while `GeoIpResolvedForm` owns the canonical product/variant event identity and
the server-authoritative merchandise value carried to `/thanks`. A landing page
must not add advertising pixels, catalog feeds, provider trackers, event
handlers, or a second order form.

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import GeoIpResolvedForm from '../components/storefront/forms/GeoIpResolvedForm.astro';
import { getStorefrontProduct } from '../lib/catalog';
import '../styles/landing-pages/landing.css';

export const prerender = false;

const product = await getStorefrontProduct(Astro.locals, 'replace-product-slug');
if (!product) return Astro.rewrite('/404');
---

<BaseLayout
  title={`${product.productName} — ${Astro.locals.tenant.name}`}
  description={product.seoDescription}
  image={product.heroImage}
>
  <!-- truthful offer sections -->
  <GeoIpResolvedForm productSlug={product.slug} />
</BaseLayout>
```

Register the matching file in `src/data/native-landing-pages.ts`. The registry
slug must equal the route filename and must include a title, product slug, and
short description. Removing a native page means removing both its registry row
and route file in the same change.

## Content and locale

- Public copy is Malay (`ms-MY`) or English (`en-MY`).
- Prices use the shared MYR formatter and are always sourced from D1.
- Product IDs, variant IDs, stock, shipping rates, and payment methods are
  operational facts and must not be duplicated in prose.
- Advertising revenue uses the persisted order-item subtotal only. Shipping,
  COD fees, admin fees, and any other order-level charges are excluded from
  `Purchase` value even when they are included in the amount payable.
- Reviews, ratings, scarcity, guarantees, and certifications require verified
  merchant evidence.
- Do not add `Buy Now`, `Shop Now`, or equivalent calls to action unless the
  merchant explicitly requests them.

## Layout and SEO

- Reuse `BaseLayout`, `foundation.css`, `storefront.css`, and
  `styles/landing-pages/landing.css`.
- Keep one semantic `h1`, descriptive headings, a canonical URL, unique title,
  unique description, and truthful image alt text.
- Route-specific CSS belongs in `src/styles/landing-pages/<slug>.css` and is
  imported only by that route.
- The public reading column is 480 CSS px. Components must not create a second
  competing maximum width.

## Editor interaction

On mobile, new pages start in Pengaturan and existing pages start in Konten.
Both panels remain mounted so switching views preserves unsaved input. Desktop
shows settings and canvas together. Required-field save errors reopen settings;
a successful save returns to content with the server-normalized draft.

Tambah bagian is initially collapsed on mobile edit pages and open on new
pages or desktop. Susunan halaman provides a collapsible, type-labeled outline
with the active section marked. Section actions use labeled 44 px icon buttons.
Deleting a section focuses its neighbor; deleting the last section opens the add
palette and focuses its first control. Selesai mengedit bagian closes the inline
editor; Simpan is still required to persist the draft.

## Verification

Run the repository checks, then open the route at approximately 390 px and
1280 px. Confirm no page-level horizontal overflow, no console/request errors,
the Malaysia postcode quote works, the payment methods offered are exactly the
ones the install has enabled — COD and manual transfer always, plus one hosted
DOKU choice where a healthy DOKU configuration is enabled — the order succeeds,
and the canonical/sitemap behavior matches the page state.
