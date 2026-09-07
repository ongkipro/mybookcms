# MyBookCMS Development Map

> Audited against the 2026-09-07 working tree at base `62f634d`, including the
> local A-232/A-241/A-242/A-243 closures. This is an evidence index, not a release
> certification. Code and executable checks remain authoritative.

[CODE-MAP](CODE-MAP.md) locates implementation. This map records the limits of
verification; [PRD](../PRD.md) defines requirements and [TASKS](../TASKS.md#open-queue)
owns accepted work. Closed task evidence is in [STATUS](../STATUS.md).

**Evidence vocabulary.** “Direct runtime” means the named test sends requests
through the freshly built Worker using isolated D1/KV and fictional credentials.
“Static references” means the named test mentions the route or source file; it
makes no claim that the rendered route was exercised. A missing citation means
this map offers no verdict, not that all lower-level behavior is untested.
Browser evidence is limited to the cited task's flow and viewports. No provider
sandbox or production conclusion follows from local checks.

The four A-249 blind spots now have direct route tests. A-232's COD control is
closed; A-248 privacy copy is locally verified and A-245 recovery remains open.
A-234's switch and desktop shell now have fresh browser evidence and passing
Lighthouse accessibility/contrast checks at 390/1280 px. Old lineage identifiers are not backlog owners here.

## Buyer and public pages

| Route | Automated evidence and limit | Browser evidence and limit | Open gap or bounded state |
| --- | --- | --- | --- |
| `/404` | No direct route evidence cited; lower-level coverage not assessed here. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/[slug]` | [route-surface.test.ts](../src/lib/route-surface.test.ts) — Direct runtime: product/takeover redirects, missing slug, authorized draft preview, stale-session refusal. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/contoh-landing` | No direct route evidence cited; lower-level coverage not assessed here. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/dasar-kuki` | No direct route evidence cited; lower-level coverage not assessed here. | No browser verdict cited. | No open page-specific verdict claimed; A-248 is limited to the privacy notice. |
| `/dasar-privasi` | [malaysia-market.test.ts](../src/lib/malaysia-market.test.ts): bilingual content order and unchanged DOKU disclosure digest. | [STATUS A-248](../STATUS.md#a-248--bilingual-privacy-notice-closure-2026-09-07): language order, anchor, single heading and overflow at 390/1280 px. | Owner-approved notice implemented locally; no publication claim. |
| `/disclaimer` | No direct route evidence cited; lower-level coverage not assessed here. | No browser verdict cited. | No open page-specific verdict claimed; A-248 is limited to the privacy notice. |
| `/embed/form` | Static references: [full-form-cutover.test.ts](../src/lib/full-form-cutover.test.ts). No direct runtime verdict inferred. | [STATUS A-241](../STATUS.md#a-241--fresh-http-checkout-audit-2026-09-07), [A-242](../STATUS.md#a-242--channel-contract-and-settlement-closure-2026-09-07): 390/1280 px; [A-248](../STATUS.md#a-248--bilingual-privacy-notice-closure-2026-09-07): privacy links before name, new-tab keyboard navigation and preserved input. | No open page-specific verdict claimed. |
| `/full-form` | No direct route evidence cited; lower-level coverage not assessed here. | [STATUS A-241](../STATUS.md#a-241--fresh-http-checkout-audit-2026-09-07), [A-242](../STATUS.md#a-242--channel-contract-and-settlement-closure-2026-09-07): 390/1280 px; [A-248](../STATUS.md#a-248--bilingual-privacy-notice-closure-2026-09-07): privacy links before name, new-tab keyboard navigation and preserved input. | No open page-specific verdict claimed. |
| `/halaman` | No direct route evidence cited; lower-level coverage not assessed here. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/hello` | Static references: [auth.test.ts](../src/lib/auth.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/hubungi-kami` | No direct route evidence cited; lower-level coverage not assessed here. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/` | Static references: [auth.test.ts](../src/lib/auth.test.ts), [headless-openapi.test.ts](../src/lib/headless-openapi.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/install` | No direct route evidence cited; lower-level coverage not assessed here. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/jejak-pesanan` | Static references: [malaysia-market.test.ts](../src/lib/malaysia-market.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/payment/doku/cancel` | Static references: [doku-payment-access.test.ts](../src/lib/doku-payment-access.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | [TASKS Open queue](../TASKS.md#open-queue): A-245: REQ-232 remains Proposal; disabled-channel recovery decision pending. |
| `/payment/doku/result` | Static references: [doku-payment-access.test.ts](../src/lib/doku-payment-access.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/payment/doku/return` | No direct route evidence cited; lower-level coverage not assessed here. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/penghantaran` | No direct route evidence cited; lower-level coverage not assessed here. | No browser verdict cited. | No open page-specific verdict claimed; A-248 is limited to the privacy notice. |
| `/produk/[slug]` | [route-surface.test.ts](../src/lib/route-surface.test.ts) — Direct runtime: variant selection/fallback, executed ViewContent payload, COD trust copy. | [STATUS A-241](../STATUS.md#a-241--fresh-http-checkout-audit-2026-09-07), [A-242](../STATUS.md#a-242--channel-contract-and-settlement-closure-2026-09-07): 390/1280 px; [A-248](../STATUS.md#a-248--bilingual-privacy-notice-closure-2026-09-07): privacy links before name, new-tab keyboard navigation and preserved input. | No open page-specific verdict claimed. |
| `/produk` | No direct route evidence cited; lower-level coverage not assessed here. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/sitemap` | Static references: [malaysia-market.test.ts](../src/lib/malaysia-market.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/tentang` | No direct route evidence cited; lower-level coverage not assessed here. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/terma-syarat` | No direct route evidence cited; lower-level coverage not assessed here. | No browser verdict cited. | No open page-specific verdict claimed; A-248 is limited to the privacy notice. |
| `/testimoni` | No direct route evidence cited; lower-level coverage not assessed here. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/thanks` | Static references: [malaysia-market.test.ts](../src/lib/malaysia-market.test.ts), [ads-signal-policy.test.ts](../src/lib/ads-signal-policy.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |

## Admin pages

| Route | Automated evidence and limit | Browser evidence and limit | Open gap or bounded state |
| --- | --- | --- | --- |
| `/admin/ads/google` | No direct route evidence cited; lower-level coverage not assessed here. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/admin/ads/meta` | [route-surface.test.ts](../src/lib/route-surface.test.ts) — Direct runtime: role gates and stored-token masking. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/admin/ads` | Static references: [auth.test.ts](../src/lib/auth.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/admin/content` | Static references: [admin-credentials.test.ts](../src/lib/admin-credentials.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/admin/dashboard` | Static references: [auth.test.ts](../src/lib/auth.test.ts), [system-precision.test.ts](../src/lib/system-precision.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/admin/expeditions` | No direct route evidence cited; lower-level coverage not assessed here. | [STATUS A-234](../STATUS.md#a-234--approved-desktop-contrast-closure-2026-09-07): switch surface, 390/1280 px; shared-shell contrast verified on `/admin/settings/log` | No open page-specific verdict claimed. |
| `/admin/landing-pages/[id]/edit` | No direct route evidence cited; lower-level coverage not assessed here. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/admin/landing-pages` | Static references: [admin-navigation.test.ts](../src/lib/admin-navigation.test.ts), [malaysia-market.test.ts](../src/lib/malaysia-market.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/admin/landing-pages/new` | Static references: [auth.test.ts](../src/lib/auth.test.ts). No direct runtime verdict inferred. | [STATUS A-234](../STATUS.md#a-234--approved-desktop-contrast-closure-2026-09-07): switch surface, 390/1280 px; shared-shell contrast verified on `/admin/settings/log` | No open page-specific verdict claimed. |
| `/admin/orders/[invoice]` | No direct route evidence cited; lower-level coverage not assessed here. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/admin/orders` | Static references: [auth.test.ts](../src/lib/auth.test.ts), [admin-credentials.test.ts](../src/lib/admin-credentials.test.ts). No direct runtime verdict inferred. | [STATUS A-234](../STATUS.md#a-234--approved-desktop-contrast-closure-2026-09-07): switch surface, 390/1280 px; shared-shell contrast verified on `/admin/settings/log` | No open page-specific verdict claimed. |
| `/admin/payments` | Static references: [mobile-layout-guard.test.ts](../src/lib/mobile-layout-guard.test.ts). No direct runtime verdict inferred. | [STATUS A-232](../STATUS.md#a-232--owneradmin-cod-control-closure-2026-09-07): Owner/Admin, 390/1280 px; [A-234](../STATUS.md#a-234--approved-desktop-contrast-closure-2026-09-07): switch and shell verification. | A-232 closed: COD control verified; A-234 shared-shell Lighthouse check passes on `/admin/settings/log` (see browser evidence). |
| `/admin/products/edit` | Static references: [system-precision.test.ts](../src/lib/system-precision.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/admin/products/new` | No direct route evidence cited; lower-level coverage not assessed here. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/admin/products` | Static references: [auth.test.ts](../src/lib/auth.test.ts), [admin-credentials.test.ts](../src/lib/admin-credentials.test.ts). No direct runtime verdict inferred. | [STATUS A-234](../STATUS.md#a-234--approved-desktop-contrast-closure-2026-09-07): switch surface, 390/1280 px; shared-shell contrast verified on `/admin/settings/log` | No open page-specific verdict claimed. |
| `/admin/profile` | Static references: [auth.test.ts](../src/lib/auth.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/admin/settings/access` | Static references: [admin-navigation.test.ts](../src/lib/admin-navigation.test.ts), [auth.test.ts](../src/lib/auth.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/admin/settings/crm` | No direct route evidence cited; lower-level coverage not assessed here. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/admin/settings/developer` | [route-surface.test.ts](../src/lib/route-surface.test.ts) — Direct runtime: role gates, one-time key issuance, listing redaction and revocation. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/admin/settings/log` | Static references: [auth.test.ts](../src/lib/auth.test.ts). No direct runtime verdict inferred. | [STATUS A-234](../STATUS.md#a-234--approved-desktop-contrast-closure-2026-09-07): Lighthouse accessibility 100 / contrast PASS, 390/1280 px | [TASKS Open queue](../TASKS.md#open-queue): A-226: REQ-230 remains Proposal; redacted event-history decision pending. |
| `/admin/settings/store` | Static references: [system-precision.test.ts](../src/lib/system-precision.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/admin/settings` | Static references: [auth.test.ts](../src/lib/auth.test.ts), [admin-credentials.test.ts](../src/lib/admin-credentials.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/admin/shipping` | No direct route evidence cited; lower-level coverage not assessed here. | [STATUS A-234](../STATUS.md#a-234--approved-desktop-contrast-closure-2026-09-07): switch surface, 390/1280 px; shared-shell contrast verified on `/admin/settings/log` | No open page-specific verdict claimed. |

## Endpoints, feeds and assets

| Route | Automated evidence and limit | Browser evidence and limit | Open gap or bounded state |
| --- | --- | --- | --- |
| `/api/admin/access` | Static references: [auth.test.ts](../src/lib/auth.test.ts), [system-precision.test.ts](../src/lib/system-precision.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/api/admin/ads/google-catalog` | No direct route evidence cited; lower-level coverage not assessed here. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/api/admin/ads` | Static references: [auth.test.ts](../src/lib/auth.test.ts), [route-surface.test.ts](../src/lib/route-surface.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/api/admin/analytics` | Static references: [admin-analytics.test.ts](../src/lib/admin-analytics.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/api/admin/content` | No direct route evidence cited; lower-level coverage not assessed here. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/api/admin/expeditions` | Static references: [expedition-settings.test.ts](../src/lib/expedition-settings.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/api/admin/landing-pages/[id]` | No direct route evidence cited; lower-level coverage not assessed here. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/api/admin/landing-pages` | No direct route evidence cited; lower-level coverage not assessed here. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/api/admin/logout` | Static references: [auth.test.ts](../src/lib/auth.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/api/admin/media` | Static references: [admin-upload.test.ts](../src/lib/admin-upload.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/api/admin/notifications` | No direct route evidence cited; lower-level coverage not assessed here. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/api/admin/orders/[id]` | Static references: [doku-reconciliation.test.ts](../src/lib/doku-reconciliation.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/api/admin/orders` | Static references: [shipping-queue.test.ts](../src/lib/shipping-queue.test.ts), [auth.test.ts](../src/lib/auth.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/api/admin/payments` | Static references: [auth.test.ts](../src/lib/auth.test.ts), [doku-config.test.ts](../src/lib/doku-config.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/api/admin/products` | Static references: [auth.test.ts](../src/lib/auth.test.ts), [system-precision.test.ts](../src/lib/system-precision.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/api/admin/profile` | Static references: [auth.test.ts](../src/lib/auth.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/api/admin/seller-bank-accounts` | No direct route evidence cited; lower-level coverage not assessed here. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/api/admin/settings/developer` | Static references: [route-surface.test.ts](../src/lib/route-surface.test.ts), [system-precision.test.ts](../src/lib/system-precision.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/api/admin/settings` | Static references: [payment-availability.test.ts](../src/lib/payment-availability.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | [STATUS A-232](../STATUS.md#a-232--owneradmin-cod-control-closure-2026-09-07): local COD availability and submission-refusal evidence. |
| `/api/admin/shipping` | Static references: [shipping-queue.test.ts](../src/lib/shipping-queue.test.ts), [auth.test.ts](../src/lib/auth.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/api/admin/system-log` | Static references: [auth.test.ts](../src/lib/auth.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/api/form-config` | Static references: [full-form-cutover.test.ts](../src/lib/full-form-cutover.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/api/install` | Static references: [install.test.ts](../src/lib/install.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/api/locations` | No direct route evidence cited; lower-level coverage not assessed here. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/api/meta-event` | Static references: [meta-event.test.ts](../src/lib/meta-event.test.ts), [meta-capi.test.ts](../src/lib/meta-capi.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/api/order-status` | Static references: [malaysia-market.test.ts](../src/lib/malaysia-market.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/api/payment-methods` | Static references: [malaysia-market.test.ts](../src/lib/malaysia-market.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | [STATUS A-232](../STATUS.md#a-232--owneradmin-cod-control-closure-2026-09-07): local COD availability and submission-refusal evidence. |
| `/api/payments/doku/notifications` | Static references: [doku-notification.test.ts](../src/lib/doku-notification.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/api/payments/doku/retry` | Static references: [doku-payment-access.test.ts](../src/lib/doku-payment-access.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/api/payments/doku/status` | Static references: [doku-payment-access.test.ts](../src/lib/doku-payment-access.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/api/shipping-options` | No direct route evidence cited; lower-level coverage not assessed here. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/api/shipping-rates` | No direct route evidence cited; lower-level coverage not assessed here. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/api/submit-order` | Static references: [malaysia-market.test.ts](../src/lib/malaysia-market.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | [STATUS A-232](../STATUS.md#a-232--owneradmin-cod-control-closure-2026-09-07): local COD availability and submission-refusal evidence. |
| `/api/v1/checkout` | Static references: [malaysia-market.test.ts](../src/lib/malaysia-market.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | [STATUS A-232](../STATUS.md#a-232--owneradmin-cod-control-closure-2026-09-07): local COD availability and submission-refusal evidence. |
| `/api/v1/geo/districts` | No direct route evidence cited; lower-level coverage not assessed here. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/api/v1/geo/shipping-rates` | No direct route evidence cited; lower-level coverage not assessed here. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/api/v1/openapi.json` | No direct route evidence cited; lower-level coverage not assessed here. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/api/v1/orders/status` | Static references: [order-status.test.ts](../src/lib/order-status.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/api/v1/products/[slug]` | Static references: [full-form-cutover.test.ts](../src/lib/full-form-cutover.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/api/v1/products` | Static references: [full-form-cutover.test.ts](../src/lib/full-form-cutover.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/api/v1/storefront` | Static references: [malaysia-market.test.ts](../src/lib/malaysia-market.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | [STATUS A-232](../STATUS.md#a-232--owneradmin-cod-control-closure-2026-09-07): local COD availability and submission-refusal evidence. |
| `/assets/[...key]` | No direct route evidence cited; lower-level coverage not assessed here. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/feed/google-catalog.xml` | Static references: [google-catalog.test.ts](../src/lib/google-catalog.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/media/[...key]` | No direct route evidence cited; lower-level coverage not assessed here. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/robots.txt` | No direct route evidence cited; lower-level coverage not assessed here. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/sitemap.xml` | Static references: [malaysia-market.test.ts](../src/lib/malaysia-market.test.ts). No direct runtime verdict inferred. | No browser verdict cited. | No open page-specific verdict claimed. |

## Aliases and tombstones

| Route | Automated evidence and limit | Browser evidence and limit | Open gap or bounded state |
| --- | --- | --- | --- |
| `/admin` | [CODE-MAP](CODE-MAP.md#redirect-aliases-and-tombstones) inventory only; behavioral coverage outside A-249. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/api/submit-middle-order` | [CODE-MAP](CODE-MAP.md#redirect-aliases-and-tombstones) inventory only; behavioral coverage outside A-249. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/form-full` | [CODE-MAP](CODE-MAP.md#redirect-aliases-and-tombstones) inventory only; behavioral coverage outside A-249. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/form-hybrid` | [CODE-MAP](CODE-MAP.md#redirect-aliases-and-tombstones) inventory only; behavioral coverage outside A-249. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/form-middle` | [CODE-MAP](CODE-MAP.md#redirect-aliases-and-tombstones) inventory only; behavioral coverage outside A-249. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/geoipform` | [CODE-MAP](CODE-MAP.md#redirect-aliases-and-tombstones) inventory only; behavioral coverage outside A-249. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/hybrid-form` | [CODE-MAP](CODE-MAP.md#redirect-aliases-and-tombstones) inventory only; behavioral coverage outside A-249. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/kebijakan-cookie` | [CODE-MAP](CODE-MAP.md#redirect-aliases-and-tombstones) inventory only; behavioral coverage outside A-249. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/kebijakan-privasi` | [CODE-MAP](CODE-MAP.md#redirect-aliases-and-tombstones) inventory only; behavioral coverage outside A-249. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/kontak` | [CODE-MAP](CODE-MAP.md#redirect-aliases-and-tombstones) inventory only; behavioral coverage outside A-249. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/landing-page` | [CODE-MAP](CODE-MAP.md#redirect-aliases-and-tombstones) inventory only; behavioral coverage outside A-249. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/middle-form` | [CODE-MAP](CODE-MAP.md#redirect-aliases-and-tombstones) inventory only; behavioral coverage outside A-249. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/order-status` | [CODE-MAP](CODE-MAP.md#redirect-aliases-and-tombstones) inventory only; behavioral coverage outside A-249. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/payment` | [CODE-MAP](CODE-MAP.md#redirect-aliases-and-tombstones) inventory only; behavioral coverage outside A-249. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/pengiriman` | [CODE-MAP](CODE-MAP.md#redirect-aliases-and-tombstones) inventory only; behavioral coverage outside A-249. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/solusi-terbaru` | [CODE-MAP](CODE-MAP.md#redirect-aliases-and-tombstones) inventory only; behavioral coverage outside A-249. | No browser verdict cited. | No open page-specific verdict claimed. |
| `/syarat-ketentuan` | [CODE-MAP](CODE-MAP.md#redirect-aliases-and-tombstones) inventory only; behavioral coverage outside A-249. | No browser verdict cited. | No open page-specific verdict claimed. |

## Keeping this true

Every task that adds, changes or removes a route must update its row here in the
same task and include this file in its Surface. Cite the exact test, STATUS
section or Open queue task behind a verdict. Remove obsolete conclusions when
that evidence changes. This rule also appears at the TASKS queue entrypoint and
in CODE-MAP. Run `node --experimental-strip-types --test src/lib/development-map.test.ts src/lib/code-map.test.ts` to check inventory and local citation integrity.
The guard checks documentation structure, not behavioral adequacy or historical
browser artifacts; those still require review and the cited task's evidence.
