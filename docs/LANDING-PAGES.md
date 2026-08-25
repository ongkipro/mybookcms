# Landing Page Authoring

> Verified against disk: 2026-08-23 @ MyBookCMS working tree

MyBookCMS supports two landing-page owners:

- CMS pages are authored by an operator and stored in D1.
- Native Astro pages are authored in the repository and registered in
  `src/data/native-landing-pages.ts`.

Both answer at `/<slug>`. A published landing page may also claim one product
URL. In that state `/produk/<product-slug>` is canonical and the landing slug
redirects there. The D1 partial unique index prevents two pages from claiming
the same product.

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

## Verification

Run the repository checks, then open the route at approximately 390 px and
1280 px. Confirm no page-level horizontal overflow, no console/request errors,
the Malaysia postcode quote works, COD/manual transfer are the only payment
methods, the order succeeds, and the canonical/sitemap behavior matches the
page state.
