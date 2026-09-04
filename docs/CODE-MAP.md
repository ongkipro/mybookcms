# MyBookCMS Code Map

> Verified against disk: 2026-09-04 @ MyBookCMS working tree (branch `malaysia-market-audit`)

A page-by-page navigation index of the repository. It answers "which file
serves this URL, what does it import, which API does it call, and which table
does it touch". It does not define behaviour: `ARCHITECTURE.md` owns the
design, `PRD.md` owns requirements, and code wins over this file.

**Keeping it true.** Three changes make this file wrong: adding, removing, or
repointing a route; adding, removing, or changing the methods of an API
endpoint; adding a migration that creates or drops a table. Any change of those
three kinds updates this map in the same commit — sections 3-7 for routes and
endpoints, section 10 for tables. Everything else here tolerates drift until
the next full pass, and a stale line is a bug in this file, never a reason to
distrust the code.

Regenerate the raw inventory this map was built from with:

```bash
find src -type f | sort                       # file list
grep -rhoE "fetch\(\s*['\"\`]/api[^'\"\`?]*" src | sort -u   # browser -> API edges
grep -rlE "^export (const|async function) (GET|POST|PUT|PATCH|DELETE)" src/pages/api
```

## 1. Request pipeline

Every request passes through the same chain before a page or API handler runs.

| Step | File | What it decides |
| --- | --- | --- |
| Worker entry | `src/worker.ts` | `fetch` hands off to Astro. `scheduled` (cron `* * * * *`) drains the Meta CAPI outbox and reconciles due DOKU payments. |
| Middleware | `src/middleware.ts` | Schema upgrade gate (503 when D1 is behind), `www` -> canonical 301, installer redirect when no store row, native landing-page takeover 308, embed `frame-ancestors` CSP, admin session + role + password-rotation gate, CSRF origin check on unsafe `/api/admin` methods, security headers, click-id cookie capture. |
| Layouts | `src/layouts/BaseLayout.astro` (public), `AdminLayout.astro` (admin, `noindex`), `EmbedLayout.astro` (iframe form, `noindex`) | BaseLayout owns SEO meta, JSON-LD, header/footer, and the single ads tracking loader. |
| Bindings | `wrangler.jsonc`, `src/worker-configuration.d.ts` (generated), `src/env.d.ts` (hand-written extras) | `OMS_DB` (D1), `SESSION` (KV), `ASSET_BUCKET` (R2), `AI`, `ASSETS`. Secrets `AUTH_SECRET`, `INSTALL_TOKEN`. |

Admin role model (`src/lib/auth.ts`): `owner` reaches everything; `admin` reaches everything except `/admin/settings/access` and its API; `advertiser` reaches dashboard, products, landing pages, content, ads, profile; `customer_service` reaches dashboard, orders, shipping, profile. Every role lands on `/admin/dashboard`.

## 2. Directory map

```
src/
  worker.ts              Cloudflare entry (fetch + scheduled)
  middleware.ts          request gate described above
  layouts/               3 layouts
  pages/                 63 .astro routes + 46 .ts endpoints, 41 of them under /api (see sections 3-7)
  components/
    admin/               21 React components + admin-navigation.ts (sidebar manifest) + AdminPageHeader.astro
    storefront/          Astro components: forms/, home/, shared/, seo/, tracking/, templates/
    ui/                  21 shadcn primitives
  lib/                   79 modules + 82 *.test.ts (see section 9)
  data/                  static content: legal pages, home copy, native landing register
  db/migrations/         0000-0059, forward-only, hand-authored
  styles/                foundation.css (all surfaces), storefront.css, admin.css, form-hybrid.css, landing-pages/
  hooks/use-mobile.ts
public/                  favicons, logo, payment icons, mybook-form-widget.js (embed custom element)
scripts/                 landing Tailwind safelist generator, local D1 seed SQL
docs/                    LANDING-PAGES.md, CODE-MAP.md, lineage/ (upstream history, not a backlog), research/
```

## 3. Public storefront pages

All use `BaseLayout` unless noted. `GeoIpResolvedForm` is a thin wrapper around `MalaysiaCheckoutForm`, the only checkout component.

| Route | File | Renders | Data / libs | Notes |
| --- | --- | --- | --- | --- |
| `/` | `pages/index.astro` | `templates/CompactMarketHome` -> `home/HeroSection`, `ProductsSection`, `LandingPagesSection` | `catalog`, `tenant-content`, `storefront-template`, `daily-rotation` | Unknown template id renders 503. |
| `/produk` | `pages/produk/index.astro` | `PageIntro`, `ProductListItem` | `catalog`, `storefront-locale` | Catalog list. |
| `/produk/[slug]` | `pages/produk/[slug].astro` | `ProductImageGallery`, `Breadcrumb`, `RatingStars`, `GeoIpResolvedForm` | `catalog`, `landing-pages`, `storefront-locale` | PDP with inline checkout. `?variant_id=` preselects (feed links land here). Emits ViewContent through BaseLayout. |
| `/[slug]` | `pages/[slug].astro` | CMS landing page sections + `GeoIpResolvedForm` | `landing-pages` (`getLandingPageBySlug`, `parseShortcodes`), `catalog`, `auth` (for `?preview=1`) | Unknown slug that matches a product -> 308 to `/produk/{slug}`; inactive page -> 404 unless an admin previews; product-page takeover -> 308 to the product URL. Imports `styles/landing-pages/landing.css`. |
| `/halaman` | `pages/halaman/index.astro` | `PageIntro`, `Icon` | `landing-pages` | Public list of active landing pages. Read-only. |
| `/contoh-landing` | `pages/contoh-landing.astro` | `RatingStars`, `GeoIpResolvedForm` | `catalog`, `landing-pages` | Sample native Astro landing page, `noindex`. Copy it to make a real one, then register in `data/native-landing-pages.ts`. |
| `/full-form` | `pages/full-form.astro` | `GeoIpResolvedForm` | `catalog`, `form-config` | The only executable checkout URL. No product -> redirect `/produk`. |
| `/embed/form` | `pages/embed/form.astro` | `EmbedLayout` + `GeoIpResolvedForm` | `catalog`, `embed-markup`, `form-config` | Iframe target for `public/mybook-form-widget.js`. CSP `frame-ancestors` from store allowlist. |
| `/thanks` | `pages/thanks.astro` | order confirmation | `catalog`, `public-store`, `storefront-locale`; calls `POST /api/order-status` | `no-store`, `noindex`, header/footer hidden. Resolves order with `order_number` + status token, then emits browser Purchase. |
| `/jejak-pesanan` | `pages/jejak-pesanan.astro` | order status lookup | calls `POST /api/order-status` | `noindex`. |
| `/payment/doku/return` | `pages/payment/doku/return.astro` | DOKU buyer return | `doku-payment-access`, `checkout-navigation` | Exchanges query capability for HttpOnly cookie, then resolves state. `noindex`. |
| `/payment/doku/result` | `pages/payment/doku/result.astro` | DOKU result + Ads settlement | same + `tracking/AdsBase` | Reads `orders`, `order_items`, `products`, `product_variants` for the single DOKU Purchase. |
| `/payment/doku/cancel` | `pages/payment/doku/cancel.astro` | DOKU cancel recovery | `doku-payment-access`, `checkout-navigation` | Retry entry point. |
| `/tentang` | `pages/tentang.astro` | `PageIntro` | static | About. |
| `/testimoni` | `pages/testimoni.astro` | `PageIntro` | static | `noindex`. |
| `/hubungi-kami` | `pages/hubungi-kami.astro` | `LegalPage` | `data/legal`, `public-store` | Contact, WhatsApp from store row. |
| `/dasar-privasi` | `pages/dasar-privasi.astro` | `LegalPage` | `data/legal` | Privacy (PDPA). |
| `/dasar-kuki` | `pages/dasar-kuki.astro` | `LegalPage` | inline | Cookie policy. |
| `/terma-syarat` | `pages/terma-syarat.astro` | `LegalPage` | `data/legal` | Terms. |
| `/penghantaran` | `pages/penghantaran.astro` | `LegalPage` | `data/legal` | Shipping policy. |
| `/disclaimer` | `pages/disclaimer.astro` | `LegalPage` | `data/legal` | `noindex`. |
| `/sitemap` | `pages/sitemap.astro` | HTML sitemap | `catalog`, `landing-pages` | `noindex`. |
| `/404` | `pages/404.astro` | not-found with product suggestions | `catalog`, `image-derivative` | Target of `Astro.rewrite('/404')`. |
| `/install` | `pages/install.astro` | installer wizard, no layout | calls `POST /api/install` | Only reachable while no store row exists; installed store -> `/hello`. |
| `/hello` | `pages/hello.astro` | admin login form, self-posting | `admin-credentials`, `auth`, `rate-limit` | Own origin check. Success -> `/admin/dashboard`, or `/admin/profile` when password rotation is due. |

### Redirect aliases and tombstones

| Route | Target | Status |
| --- | --- | --- |
| `/form-full`, `/form-hybrid`, `/form-middle`, `/hybrid-form`, `/middle-form`, `/geoipform` | `/full-form` (query preserved) | 308 |
| `/kebijakan-privasi` | `/dasar-privasi` | 308 |
| `/kebijakan-cookie` | `/dasar-kuki` | 308 |
| `/kontak` | `/hubungi-kami` | 308 |
| `/syarat-ketentuan` | `/terma-syarat` | 308 |
| `/pengiriman` | `/penghantaran` | 308 |
| `/order-status` | `/jejak-pesanan` | 308 |
| `/payment` | `/thanks` | 308 |
| `/landing-page` | `/halaman` | 308 |
| `/solusi-terbaru` | `/produk` | 301 |
| `/admin` | `/admin/dashboard` | 302 |
| `POST /api/submit-middle-order` | none | 410 `no-store` tombstone |

### Feeds, SEO, binary assets

| Route | File | Purpose |
| --- | --- | --- |
| `/sitemap.xml` | `pages/sitemap.xml.ts` | XML sitemap from `catalog` + `landing-pages`. |
| `/robots.txt` | `pages/robots.txt.ts` | Robots with sitemap pointer. |
| `/feed/google-catalog.xml` | `pages/feed/google-catalog.xml.ts` | RSS 2.0 Google/Meta product feed, one row per variant, `<g:id>` = `p{productId}-v{variantId}`. Built by `lib/google-catalog.ts`. |
| `/media/[...key]` | `pages/media/[...key].ts` | Streams R2 `ASSET_BUCKET` objects (merchant uploads). |
| `/assets/[...key]` | `pages/assets/[...key].ts` | Same bucket; when a derivative key is missing it falls back to the original object. |

## 4. Public and buyer API

| Route | File | Methods | Libs | Notes |
| --- | --- | --- | --- | --- |
| `/api/submit-order` | `pages/api/submit-order.ts` | POST | `order-schema`, `validation`, `malaysia-locations`, `malaysia-shipping`, `order-persistence`, `doku-checkout`, `click-ids`, `accepted-order-meta`, `rate-limit` | The checkout. Re-quotes shipping from D1, persists order + items + stock decrement + CAPI outbox in one batch. DOKU choice creates the hosted checkout after persistence. |
| `/api/shipping-rates` | `pages/api/shipping-rates.ts` | GET | `malaysia-shipping`, `rate-limit` | Quote by trusted location id + cart weight. |
| `/api/shipping-options` | `pages/api/shipping-options.ts` | GET | re-exports `shipping-rates` | Alias. |
| `/api/locations` | `pages/api/locations.ts` | GET | `malaysia-locations`, `rate-limit` | Postcode/city/state search over `malaysia_postcodes`. |
| `/api/payment-methods` | `pages/api/payment-methods.ts` | GET | `doku-config`, `payment-brand` | COD, active seller bank accounts, DOKU channels when healthy. |
| `/api/form-config` | `pages/api/form-config.ts` | GET | `catalog`, `form-config` | Product/variant bootstrap for the form. |
| `/api/order-status` | `pages/api/order-status.ts` | POST | `order-status` | Requires `order_number` + `public_status_token`. |
| `/api/meta-event` | `pages/api/meta-event.ts` | POST | `ads-config`, `meta-capi`, `capi-outbox`, `catalog-id`, `click-ids`, `ads-signal-policy`, `rate-limit` | Browser-initiated CAPI leg (ViewContent, InitiateCheckout, Lead, fallback Purchase). Rebuilds value from D1. |
| `/api/payments/doku/notifications` | `pages/api/payments/doku/notifications.ts` | POST | `doku-notification`, `doku-payment-lifecycle` | Webhook. Verifies raw-body HMAC before JSON parse; one D1 batch. |
| `/api/payments/doku/status` | `pages/api/payments/doku/status.ts` | POST (405 otherwise) | `doku-payment-access` | Cookie-capability status read for the buyer pages. |
| `/api/payments/doku/retry` | `pages/api/payments/doku/retry.ts` | POST (405 otherwise) | `doku-payment-access`, `rate-limit` | Buyer retry of a failed/expired attempt. |
| `/api/install` | `pages/api/install.ts` | POST | `install`, `auth`, `tenant` | Installer; requires `INSTALL_TOKEN`. |

## 5. Headless API (`/api/v1`)

Authenticated by `X-App-Key` or `Authorization: Bearer` (legacy `x-api-key`), scoped, rate-limited, audit-logged through `lib/headless-api.ts` (`validateHeadlessRequest`). CORS from `stores.headless_allowed_origins`. Client SDK and journey helper live in `lib/headless-client.ts`; the OpenAPI document in `lib/headless-openapi.ts`. Contract doc: `STOREFRONT_INTEGRATION.md`.

| Route | File | Methods | Backing lib |
| --- | --- | --- | --- |
| `/api/v1/openapi.json` | `pages/api/v1/openapi.json.ts` | GET | `headless-openapi` |
| `/api/v1/storefront` | `pages/api/v1/storefront.ts` | GET | `tenant-content` |
| `/api/v1/products` | `pages/api/v1/products/index.ts` | GET | `catalog` |
| `/api/v1/products/[slug]` | `pages/api/v1/products/[slug].ts` | GET | `catalog` |
| `/api/v1/geo/districts` | `pages/api/v1/geo/districts.ts` | GET | `malaysia-locations` |
| `/api/v1/geo/shipping-rates` | `pages/api/v1/geo/shipping-rates.ts` | GET, POST | `malaysia-shipping` |
| `/api/v1/checkout` | `pages/api/v1/checkout.ts` | POST | same stack as `/api/submit-order` |
| `/api/v1/orders/status` | `pages/api/v1/orders/status.ts` | POST | `order-status` |

## 6. Admin pages

All use `AdminLayout` (sidebar from `components/admin/admin-navigation.ts`, shell in `AdminShell.tsx`, notifications in `NotificationBell.tsx` -> `/api/admin/notifications`). Islands hydrate with `client:load` unless noted.

| Route | File | Island / body | Calls | Roles |
| --- | --- | --- | --- | --- |
| `/admin/dashboard` | `pages/admin/dashboard.astro` | `AnalyticsDashboard` (`client:only`) | `/api/admin/analytics` | all |
| `/admin/orders` | `pages/admin/orders/index.astro` | `OrdersTable` | `/api/admin/orders` | owner, admin, CS |
| `/admin/orders/[invoice]` | `pages/admin/orders/[invoice].astro` | `OrderDetail` | `/api/admin/orders/{invoice}` | owner, admin, CS |
| `/admin/shipping` | `pages/admin/shipping.astro` | `ShippingOperations` | `/api/admin/shipping`, `/api/admin/orders` | owner, admin, CS |
| `/admin/products` | `pages/admin/products.astro` | `ProductCatalog` | `/api/admin/products` | owner, admin, advertiser |
| `/admin/products/new` | `pages/admin/products/new.astro` | `ProductForm` | `/api/admin/products`, `/api/admin/media` | owner, admin, advertiser |
| `/admin/products/edit?id=` | `pages/admin/products/edit.astro` | `ProductForm` | same | owner, admin, advertiser |
| `/admin/landing-pages` | `pages/admin/landing-pages/index.astro` | `LandingPageCatalog` | `/api/admin/landing-pages` | owner, admin, advertiser |
| `/admin/landing-pages/new` | `pages/admin/landing-pages/new.astro` | `LandingPageEditor` (`client:only`) | `/api/admin/landing-pages`, `/api/admin/products` | owner, admin, advertiser |
| `/admin/landing-pages/[id]/edit` | `pages/admin/landing-pages/[id]/edit.astro` | `LandingPageEditor` (`client:only`) | `/api/admin/landing-pages/{id}` | owner, admin, advertiser |
| `/admin/content` | `pages/admin/content.astro` | `ContentWorkbench` | `/api/admin/content`, `/api/admin/media` | owner, admin, advertiser. Not in the sidebar; linked from `/admin/settings/store`. |
| `/admin/expeditions` | `pages/admin/expeditions.astro` | `ExpeditionSettings` | `/api/admin/expeditions` | owner, admin |
| `/admin/ads` | `pages/admin/ads.astro` | inline script hub | `/api/admin/ads` | owner, admin, advertiser |
| `/admin/ads/meta` | `pages/admin/ads/meta.astro` | inline form (`meta-admin-form`) | `/api/admin/ads` | owner, admin, advertiser |
| `/admin/ads/google` | `pages/admin/ads/google.astro` | inline form + feed diagnostics | `/api/admin/ads`, `/api/admin/ads/google-catalog` | owner, admin, advertiser |
| `/admin/payments` | `pages/admin/payments.astro` | `SellerBankAccounts`, `DokuPaymentSettings` | `/api/admin/seller-bank-accounts`, `/api/admin/payments` | owner, admin |
| `/admin/settings` | `pages/admin/settings.astro` | card hub | none | owner, admin |
| `/admin/settings/store` | `pages/admin/settings/store.astro` | inline form | `/api/admin/settings` | owner, admin |
| `/admin/settings/crm` | `pages/admin/settings/crm.astro` | inline form | `/api/admin/settings` | owner, admin |
| `/admin/settings/developer` | `pages/admin/settings/developer.astro` | `HeadlessApiManagement` | `/api/admin/settings/developer`, `/api/admin/settings` | owner, admin |
| `/admin/settings/access` | `pages/admin/settings/access.astro` | `AccessManager` | `/api/admin/access` | owner only |
| `/admin/profile` | `pages/admin/profile.astro` | inline form | `/api/admin/profile` | all; the only page allowed while password rotation is pending |

## 7. Admin API

All under `/api/admin`, session-gated by middleware, CSRF-checked on unsafe methods. Handlers use `lib/api.ts` (`jsonOk`, `jsonError`).

| Route | File | Methods | Libs | Tables |
| --- | --- | --- | --- | --- |
| `/api/admin/analytics` | `analytics.ts` | GET | `admin-date-filter` | `orders` |
| `/api/admin/orders` | `orders/index.ts` | GET, POST, DELETE | `admin-order-status`, `order-lifecycle`, `crm-template`, `admin-date-filter` | `orders`, `order_items`, `products`, `product_variants`, `stores` |
| `/api/admin/orders/[id]` | `orders/[id].ts` | GET, POST, PATCH, DELETE | `order-lifecycle`, `admin-order-delivery`, `malaysia-locations`, `malaysia-shipping`, `payment-operations`, `doku-reconciliation`, `notifications`, `crm-template` | same + `malaysia_postcodes` |
| `/api/admin/shipping` | `shipping.ts` | GET, PATCH | `admin-order-delivery`, `malaysia-shipping`, `order-lifecycle` | `orders`, `order_items`, `malaysia_postcodes` |
| `/api/admin/products` | `products.ts` | GET, POST, PATCH, PUT, DELETE | `catalog-data`, `product-mutation` | `products`, `product_variants`, `order_items`, `stores` |
| `/api/admin/media` | `media.ts` | POST | `admin-upload` | R2 only. Only image-upload boundary; 2 MB cap, KV hourly limit. |
| `/api/admin/landing-pages` | `landing-pages/index.ts` | GET, POST | `landing-pages` | `landing_pages`, `landing_sections` |
| `/api/admin/landing-pages/[id]` | `landing-pages/[id].ts` | GET, PUT, DELETE | `landing-pages` | same |
| `/api/admin/content` | `content.ts` | GET, PUT | `storefront-content`, `ai-content-instructions` (Workers AI) | `storefront_content`, `products`, `product_variants`, `stores` |
| `/api/admin/expeditions` | `expeditions.ts` | GET, POST, PATCH | `malaysia-states` | `shipping_zones`, `shipping_postcode_ranges`, `shipping_rate_rules` |
| `/api/admin/ads` | `ads.ts` | GET, PUT | `ads-config`, `ads-secret`, `meta-capi`, `rate-limit` | `stores` |
| `/api/admin/ads/google-catalog` | `ads/google-catalog.ts` | GET | `google-catalog`, `catalog` | read-only feed diagnostics |
| `/api/admin/payments` | `payments.ts` | GET, PUT, PATCH, DELETE | `doku-config` | `stores`, `payment_provider_configs` |
| `/api/admin/seller-bank-accounts` | `seller-bank-accounts.ts` | GET, POST, PUT, DELETE | `seller-bank-account` | `seller_bank_accounts`, `stores` |
| `/api/admin/settings` | `settings.ts` | GET, PUT, POST | `store-site-url`, `store-pickup`, `embed-security`, `headless-api`, `crm-template`, `storefront-template` | `stores` |
| `/api/admin/settings/developer` | `settings/developer.ts` | GET, POST, PATCH, DELETE | `developer-api-keys` | `developer_api_keys`, `headless_api_audit_events` |
| `/api/admin/access` | `access.ts` | GET, POST, PATCH, DELETE | `admin-credentials`, `auth` | `admin_credentials` |
| `/api/admin/profile` | `profile.ts` | GET, PUT | `admin-credentials`, `auth` | `admin_credentials` |
| `/api/admin/notifications` | `notifications.ts` | GET, POST | `notifications` | `notifications`, `notification_reads` |
| `/api/admin/logout` | `logout.ts` | POST | `auth` | KV session delete |

## 8. Components

### Admin islands (`src/components/admin/`)

| Component | Lines | Used by | Talks to |
| --- | --- | --- | --- |
| `AdminShell.tsx` + `AppSidebar.tsx` | 430 + 210 | `AdminLayout` | `admin-navigation.ts` |
| `NotificationBell.tsx` | 333 | `AdminShell` | `/api/admin/notifications`; chime via `lib/notification-chime` |
| `AnalyticsDashboard.tsx` | 514 | dashboard | `/api/admin/analytics`; `ui/chart` (recharts) |
| `AdminDateRangeFilter.tsx` | 353 | dashboard, orders | `lib/admin-date-filter` |
| `OrdersTable.tsx` | 518 | orders list | `/api/admin/orders`; `CrmActionGroup` |
| `OrderDetail.tsx` | 732 | order detail | `/api/admin/orders/{invoice}`; `MalaysiaLocationCombobox` |
| `ShippingOperations.tsx` | 294 | shipping queue | `/api/admin/shipping`, `/api/admin/orders` |
| `MalaysiaLocationCombobox.tsx` | 98 | OrderDetail, ShippingOperations | `/api/locations` |
| `CrmActionButton.tsx`, `CrmActionGroup.tsx` | 112 + 131 | orders | `lib/crm-template` (WhatsApp templates) |
| `ProductCatalog.tsx` | 1232 | products | `/api/admin/products`; embed snippet via `lib/embed-markup` |
| `ProductForm.tsx` | 696 | products new/edit | `/api/admin/products`, `/api/admin/media` |
| `LandingPageCatalog.tsx` | 968 | landing pages | `/api/admin/landing-pages` |
| `LandingPageEditor.tsx` | 839 | landing page new/edit | `/api/admin/landing-pages/{id}`, `/api/admin/products` |
| `ContentWorkbench.tsx` | 317 | content | `/api/admin/content`, `/api/admin/media` |
| `ExpeditionSettings.tsx` | 692 | expeditions | `/api/admin/expeditions` |
| `SellerBankAccounts.tsx` | 449 | payments | `/api/admin/seller-bank-accounts`; `lib/payment-brand` |
| `DokuPaymentSettings.tsx` | 482 | payments | `/api/admin/payments` |
| `HeadlessApiManagement.tsx` | 536 | settings/developer | `/api/admin/settings/developer` |
| `AccessManager.tsx` | 998 | settings/access | `/api/admin/access` |
| `AdminPageHeader.astro` | 26 | every admin page | static header |

### Storefront (`src/components/storefront/`)

| Path | Role |
| --- | --- |
| `forms/MalaysiaCheckoutForm.astro` (696) | The checkout. Calls `/api/locations`, `/api/shipping-rates`, `/api/payment-methods`, `/api/submit-order`. Uses `lib/validation`, `form-config`, `checkout-navigation`, `catalog`. Styled by `styles/form-hybrid.css`. |
| `forms/GeoIpResolvedForm.astro` | Wrapper every page imports; keep using this name. |
| `templates/CompactMarketHome.astro` | Home composition, the only active storefront template. |
| `home/HeroSection`, `ProductsSection`, `LandingPagesSection` | Home sections. |
| `ProductImageGallery.astro` | PDP gallery. |
| `shared/` | `SiteHeader`, `SiteFooter`, `SiteBrand`, `Breadcrumb`, `PageIntro`, `LegalPage`, `ProductListItem`, `RatingStars`, `Icon` (Iconify lucide). |
| `seo/JsonLdSchema.astro` | JSON-LD from `lib/json-ld`. |
| `tracking/AdsBase.astro` (190) | Single Meta Pixel / GTM / Google Ads loader; posts to `/api/meta-event`. Rendered by `BaseLayout` and the DOKU result page. |
| `landing-pages/` | Empty boundary reserved for native landing components (README only). |

### UI primitives (`src/components/ui/`)

shadcn: badge, button, card, chart, checkbox, collapsible, command, dialog, dropdown-menu, input, pagination, select, separator, sheet, sidebar, skeleton, sonner, switch, table, textarea, tooltip. Astro pages use `lib/ui-variants.ts` + `lib/cn.ts` for the same classes without React.

## 9. Library modules by domain (`src/lib/`)

Each module has a sibling `*.test.ts` unless marked (no test). Run all with `npm test`.

| Domain | Modules |
| --- | --- |
| Auth and admin | `auth` (JWT HS256, roles, route grants), `admin-credentials`, `rate-limit` (KV window + login lockout), `admin-upload`, `admin-date-filter`, `admin-order-status`, `admin-order-delivery`, `notifications`, `notification-chime`, `operational-alerts` (no test; webhook alerts) |
| Tenant and install | `tenant` (store row -> `locals.tenant`), `tenant-contract` (no test), `tenant-content` (no test), `install`, `store-site-url`, `store-pickup`, `storefront-template`, `schema-version` (migration gate), `bundled-migrations` (no test), `version` (no test; `CMS_VERSION.schemaVersion` must match latest migration), `env` (no test) |
| Catalog and content | `catalog` (no test; public projection), `catalog-data` (admin rows), `catalog-id` (no test; `p{id}-v{id}`), `product-mutation`, `storefront-content` (home/product published copy), `ai-content-instructions`, `storefront-locale` (`formatMyr`), `image-derivative`, `daily-rotation` |
| Landing pages | `landing-pages` (CMS pages + shortcodes, 869 lines), `native-landing-pages` (register validation), `embed-markup` (snippet + version), `embed-security` (frame-ancestors), `form-config` |
| Orders and shipping | `order-schema` (zod submit schema), `validation` (Malaysia phone/name rules), `order-persistence` (order number + one batch write), `order-lifecycle` (status transitions, stock restoration), `order-status` (public token read), `malaysia-locations`, `malaysia-shipping` (zone/weight quote), `malaysia-states` (no test), `crm-template` (WhatsApp messages), `public-store` (no test) |
| Payments | `payment-brand`, `seller-bank-account`, `payment-operations` (redacted admin view), `doku-config` (encrypted credentials), `doku-signature` (Global HMAC), `doku-client`, `doku-checkout` (hosted checkout create), `doku-notification`, `doku-payment-lifecycle`, `doku-payment-access` (buyer capability, 1165 lines), `doku-reconciliation` (cron), `encrypted-secret` (AES-GCM) |
| Advertising | `ads-config`, `ads-secret`, `ads-signal-policy`, `click-ids` (cookie + UTM), `meta-capi` (Graph v26.0), `meta-identity` (no test; hashing inputs), `meta-admin-form`, `capi-outbox` (lease/retry/prune), `accepted-order-meta` (no test), `google-catalog` (feed XML) |
| Headless | `headless-api` (auth, scopes, CORS, audit), `headless-client` (SDK), `headless-openapi`, `developer-api-keys` |
| Rendering helpers | `json-ld`, `json-script`, `html-escape`, `checkout-navigation`, `ui-variants` (no test), `cn` (no test), `api` (no test), `utils` (empty) |

Test-only modules with no runtime sibling: `admin-analytics`, `admin-bootstrap`, `admin-navigation`, `admin-orders-list`, `brand-contamination`, `doku-schema`, `expedition-settings`, `full-form-cutover`, `legal-content`, `malaysia-market`, `meta-event`, `middleware-path-source`, `mobile-layout-guard`, `sample-product-removal`, `shipping-bootstrap`, `shipping-queue`, `submit-middle-order`, `system-precision`, `task-queue`.

## 10. Database (D1, 25 live tables)

Schema is the migration chain `src/db/migrations/0000` through `0059`. Tables created and later dropped (`courier_rules`, `warehouses`, `pickup_schedules`, `payment_transactions`, `provider_dispatch_locks`, `payment_reconciliation_audits`, `orders_mybookcms_cutover`) are not listed.

| Table | Created in | Owning code |
| --- | --- | --- |
| `stores` | 0000 (+45 ALTERs) | `tenant`, `settings`, `ads-config`, `doku-config`, `embed-security`, `store-pickup` |
| `products`, `product_variants` | 0000 | `catalog`, `catalog-data`, `product-mutation` |
| `orders` | 0000, rebuilt 0049, `ad_click_ids` restored 0057 | `order-persistence`, `order-lifecycle`, `order-status`, admin orders/shipping |
| `order_items` | 0000 | same |
| `admin_credentials` | 0007 | `admin-credentials`, `auth`, middleware |
| `storefront_content` | 0012 | `storefront-content`, `tenant-content` |
| `seller_bank_accounts` | 0023 | `seller-bank-account`, `/api/payment-methods` |
| `landing_pages`, `landing_sections` | 0027 | `landing-pages`, middleware takeover read |
| `developer_api_keys` | 0030 | `developer-api-keys`, `headless-api` |
| `order_number_counters` | 0037 | `order-persistence` |
| `developer_api_key_usage`, `headless_api_audit_events` | 0038 | `headless-api` |
| `storefront_templates` | 0039 | `storefront-template` |
| `notifications`, `notification_reads` | 0045 | `notifications` |
| `shipping_zones`, `shipping_postcode_ranges`, `shipping_rate_rules` | 0048, policy seeded 0056 | `malaysia-shipping`, `/api/admin/expeditions` |
| `malaysia_postcodes` | 0050 | `malaysia-locations` |
| `capi_event_outbox` | 0026, restored 0055 | `capi-outbox`, `/api/meta-event` |
| `payment_provider_configs`, `payment_attempts`, `payment_events` | 0059 | `doku-config`, `doku-checkout`, `doku-payment-lifecycle`, `doku-reconciliation` |

Local commands: `npm run db:migrate:local`, `npm run db:seed:malaysia:local`, `npm run db:seed:preview:local`.

## 11. Static data, styles, public, scripts

| Path | Purpose |
| --- | --- |
| `src/data/legal.ts` | Legal page copy (privacy, terms, shipping, contact, disclaimer) parameterised by tenant. |
| `src/data/home.ts`, `content.ts`, `site.ts`, `products.ts` | Static home copy, testimonials, footer nav, product types. |
| `src/data/native-landing-pages.ts` | Register of hand-authored `src/pages/<slug>.astro` landing routes. Currently empty. |
| `src/styles/foundation.css` | Shared by public, admin, and embed. Anything here ships everywhere. |
| `src/styles/storefront.css` | Public tokens (also imported by `EmbedLayout`). |
| `src/styles/admin.css` | Admin only. |
| `src/styles/form-hybrid.css` (1184) | Checkout form styling. |
| `src/styles/landing-pages/` | Route-specific landing CSS; `landing-safelist.html` generated by `scripts/generate-landing-safelist.mjs`. |
| `public/mybook-form-widget.js` | `<mybook-form-widget>` custom element that iframes `/embed/form` (snippet version 4). |
| `public/images/`, favicons | Placeholder brand assets replaced per install. |
| `scripts/seed-*.sql` | Local D1 seeds. |
| `.github/workflows/ci.yml` | `npm ci`, `npm run check`, `npm test`, `npm run build`. |

## 12. Documents

| File | Owns |
| --- | --- |
| `AGENTS.md` | Working agreement, source-of-truth order, safety. |
| `PRD.md` | Requirements (`REQ-173`+, `LOGIN-*`). |
| `TASKS.md` | Execution queue (`## Open queue` only). |
| `STATUS.md` | Current verified state. |
| `BUILD-LOG.md` | History. |
| `ARCHITECTURE.md` | Shape actually built. |
| `DECISIONS.md` | ADR-001 onward. |
| `PLAN.md` | DOKU Malaysia delivery plan. |
| `RELEASE.md`, `INSTALLATION.md`, `OBSERVABILITY.md` | Release, install, logging contracts. |
| `DESIGN-SYSTEM.md`, `design-tokens.md` | Visual tokens per surface. |
| `STOREFRONT_INTEGRATION.md` | Headless consumer contract. |
| `docs/LANDING-PAGES.md` | Authoring CMS vs native landing pages. |
| `docs/lineage/` | Upstream AdsBookCMS history. Not a backlog. |
| `docs/research/` | Malaysia shipping research. |

## 13. Where to look when

| Task | Start here |
| --- | --- |
| Change a checkout field or validation | `lib/order-schema.ts`, `lib/validation.ts`, `components/storefront/forms/MalaysiaCheckoutForm.astro`, `pages/api/submit-order.ts`, `pages/api/v1/checkout.ts` |
| Change shipping pricing | `lib/malaysia-shipping.ts`, `pages/api/admin/expeditions.ts`, migrations 0048/0053/0056 |
| Change order statuses or stock rules | `lib/order-lifecycle.ts`, `lib/admin-order-status.ts` |
| Add an admin page | `pages/admin/<x>.astro` + island in `components/admin/`, grant in `lib/auth.ts` route tables, entry in `components/admin/admin-navigation.ts` |
| Add an admin API | `pages/api/admin/<x>.ts`, grant in `lib/auth.ts` `ADMIN_API_ROUTES` / `ROLE_API_ROUTES` |
| Add a native landing page | copy `pages/contoh-landing.astro`, register in `data/native-landing-pages.ts`, read `docs/LANDING-PAGES.md` |
| Add a DB column | new migration `src/db/migrations/0060_*.sql`, bump `lib/version.ts` `schemaVersion` |
| Touch DOKU | `lib/doku-*.ts`, `pages/api/payments/doku/`, `pages/payment/doku/`, `PLAN.md`, ADR-021 |
| Touch Meta/Google tracking | `components/storefront/tracking/AdsBase.astro`, `lib/meta-capi.ts`, `lib/capi-outbox.ts`, `pages/api/meta-event.ts`, `lib/google-catalog.ts` |
| Change public copy or legal text | `data/legal.ts`, `lib/storefront-content.ts`, `/admin/content` |
| Change embed behaviour | `public/mybook-form-widget.js`, `pages/embed/form.astro`, `lib/embed-markup.ts` (bump snippet version), `lib/embed-security.ts` |
| Change session, login, or roles | `lib/auth.ts`, `lib/admin-credentials.ts`, `pages/hello.astro`, `src/middleware.ts` |
