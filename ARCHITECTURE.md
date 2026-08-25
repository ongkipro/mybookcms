# MyBookCMS Architecture

> Verified against disk: 2026-08-25 @ MyBookCMS working tree

MyBookCMS is a single-store commerce CMS for Malaysia. One install owns one
Cloudflare Worker, D1 database, KV namespace, R2 bucket, domain, and operator
team. The repository is the product template; it does not deploy a store.

## Runtime

- Astro SSR renders public pages and the Indonesian operator admin.
- React islands provide the interactive admin workspaces and checkout controls.
- Cloudflare Workers supplies the runtime; D1 is the authoritative store data;
  KV is used for sessions and bounded counters; R2 stores merchant media.
- Binding names are fixed: `OMS_DB`, `SESSION`, `ASSET_BUCKET`, `AI`, and
  `ASSETS`.
- `worker-configuration.d.ts` is generated from `wrangler.jsonc`; the hand-written
  `env.d.ts` contains only Astro/application globals and optional install values.
  `npm run check` runs Wrangler's drift check before Astro and TypeScript.

## Market contract

- Public locale is fixed to `ms-MY`. There is no visitor locale query, cookie,
  selector, fallback, or locale-dependent cache variation.
- Home and product content use the primary draft/publication columns for one
  controlled Malaysia-market hybrid presentation. English columns added by
  migration `0051` remain dormant because migrations are forward-only.
  D1 product/variant IDs, slug, stock, price, and image remain operational
  authority; published content owns display name, category, and variant labels.
- The admin remains Indonesian, with English technical labels where useful.
- Monetary values are stored as MYR integer sen. Formatting is performed at the
  presentation or event boundary with `Intl`.
- Checkout accepts only COD and manual bank transfer. Manual transfer requires
  a selected active seller bank account.

## Shipping and fulfilment

Shipping is internal policy, not an external service. D1 stores the official
city/state/postcode snapshot, active five-digit postcode ranges, Malaysia
zones, state/WP weight-rate bands, and broad fallback bands. Migration `0056`
makes that policy part of every clean schema: four active zones, complete
official postcode coverage including Sabah `91400`, sixteen active state/WP
first-kilogram rules, and five active fallback bands per zone. Quote resolution
rejects malformed/unmapped postcodes, overlapping active ranges, an untrusted
location mismatch, and missing weight bands before an order is written. The
market scope is Peninsular Malaysia, Sabah, Sarawak, and Labuan.

Reference policy has exact one-kilogram bands through 5 kg. Resolution first
selects an active state/WP rule that covers the requested weight; if that scope
has no matching band, it selects the active broad rule for the destination zone
and weight. It never selects a state rule merely because another band for that
state exists. Reference-rate migrations deactivate only unchanged reference
rows, so merchant edits and accepted-order snapshots remain stable unless an
authenticated operator explicitly edits that order's destination or amount.

The public destination control reuses the AdsBookCMS floating-field and inline
result-list contract. Local D1 search owns loading, empty, recoverable error,
keyboard-active, selected, and change states. Selection writes the trusted
location ID, city, state, and postcode used by the quote; buyer-entered street
text cannot override those pricing fields.

An operator handles an accepted order manually. Active runtime records only the
local status marker and does not collect, validate, display, or export courier,
service, or tracking evidence. Those details are communicated directly through
WhatsApp. `/order-status` requires the checkout-issued order identity and status
capability, is `noindex`/`no-store`, and renders only the current status.

`orders.shipping_queued_at` is the independent operator decision that places an
order in the local Pengiriman workspace. It does not change `shipping_status`,
call an external service, or imply dispatch. Entry and exit have no payment,
address, status, or legacy-evidence guard. Clearing the timestamp removes the
row immediately even when its independent status marker has progressed.

Admin address edits select a trusted Malaysia directory row and re-quote the
actual persisted item weight from D1. An explicit non-negative MYR override may
replace that amount. Destination, quote snapshot, shipping amount, and order
total are written together; queue membership and status are not changed.

The authenticated Pengiriman API owns both the queued read model and CSV export.
JSON is bounded for the interactive workspace; CSV applies the same server-side
search/status filter to the complete queue and neutralizes spreadsheet-formula
prefixes before returning a no-store UTF-8 attachment.

## Advertising signals

The authenticated **Ads & Tracking** workspace follows the inherited AdsBookCMS
menu hierarchy and is available only to owner, admin, and advertiser roles. D1
owns validated Meta Pixel, Google Tag Manager, Google Ads conversion ID, and
Purchase label values. A Meta CAPI credential has one explicit source:
`database`, `environment`, `none`, or `invalid`. A database token must be
AES-GCM encrypted with an `AUTH_SECRET`-derived key; a plaintext or undecryptable
database value fails closed instead of silently falling through to the
environment. The admin browser receives only the source and, for a valid D1
token, its mask. An environment-managed token is usable but neither revealable
nor removable through the database form.

Configured storefront events load directly and share deterministic `event_id`
values between browser and Meta CAPI legs. Canonical item identity is
`p{productId}-v{variantId}`; event money crosses the boundary as MYR major units
while D1 remains integer sen. Malaysia advanced matching normalizes telephone
numbers to country code `60`, uses country `my`, and hashes identity fields
before transmission. The server stores bounded Google/Meta click identifiers
and UTM attribution with the order, including browser-issued `_fbp` and `_fbc`
values when present. CAPI delivery targets the verified Meta Graph API `v26.0`
endpoint and sends its credential only in the `Authorization: Bearer` header,
with a bounded timeout and sanitized provider failure classification.

When Meta Pixel and CAPI are configured, accepted COD and manual-transfer order
persistence prepares the authoritative Purchase from the selected D1 variant,
accepted quantity, customer identity, and stored attribution. The order, item,
stock decrement, and pending CAPI outbox row share one D1 batch. The
capability-protected thanks page re-resolves the order with `order_number` plus
the checkout-issued status token and emits the browser Meta/GTM/Google leg with
the same `purchase:{orderNumber}` identity; Meta deduplicates it against the
server row. Neither leg waits for paid, delivered, or an admin status change.

ViewContent and InitiateCheckout accept only a canonical variant identity and
rebuild the name and MYR value from the active, in-stock D1 catalog. Lead and
the fallback thanks-page Purchase route rebuild order identity, merchandise
subtotal, and customer matching from the capability-owned order. The Meta CAPI
outbox has a unique event-name/event-id constraint, an atomic five-minute
delivery lease, one-minute scheduled draining independent of browser traffic,
bounded retry and terminal failure classification, and bounded retention
pruning (seven days after delivery; thirty days after terminal failure). Google
offline conversion upload remains unimplemented. Empty or invalid configuration
renders no corresponding vendor script or outbound request.

The order persistence response returns two advertising facts from the accepted
variant and line item: canonical `p{productId}-v{variantId}` identity and
`product_value_sen`. The shared checkout stores those exact server values for
the no-store thanks page. Transactional server Purchase and the
capability-protected thanks path derive merchandise value independently from
authoritative D1/order facts. Shipping, COD fee, admin fee, and any other
order-level charge are never advertising revenue.

Migration `0057` restores `orders.ad_click_ids`, which migration `0049` omitted
while rebuilding the table. The column is part of the order transaction and the
capability-protected fallback event read; migrations remain forward-only.

`BaseLayout` owns the store tracking loader. PDP, CMS landing pages, and the
native landing template emit `ViewContent` through its one global contract and
render the same shared checkout component. A new landing page therefore cannot
legitimately add its own pixel, conversion script, content identity, or value
calculation.

## Shared Google and Meta product catalog

`GET /feed/google-catalog.xml` is a public, read-only RSS 2.0 document using the
Google product namespace. The same canonical URL is submitted to Google
Merchant Center and Meta Commerce Manager; no second Meta feed or alias exists.
It is generated from the same D1-backed storefront projection as public catalog
pages, so inactive products, unpublished content, and out-of-stock variants are
omitted. It performs no platform catalog API call, credential lookup, or remote
write.

The feed grain is one sellable variant. Its stable `<g:id>` is
`p{productId}-v{variantId}`, matching storefront advertising content identity.
Each row links to `/produk/{slug}?variant_id={variantId}`, allowing the landing
page to select the item whose MYR price and availability were submitted. A
multi-variant product adds `item_group_id`, `item_group_title`, and a
`variant_option`; a single-variant product does not claim a synthetic group.

Titles, descriptions, category/product type, images, price, and availability
come only from published merchant content and operational catalog data. Prices
are converted from integer MYR sen to the `NN.NN MYR` feed format. The runtime
does not infer or fabricate GTIN, MPN, brand, or Google Product Category; those
attributes remain absent until the merchant can provide verified data. Because
the storefront uses a Malaysia hybrid voice, diagnostics warn the operator to
select a compatible target language during platform setup. Shipping policy is
configured separately in each platform and is not asserted by this feed.

The authorized Google Ads page reads local feed counts, validation warnings,
sample rows, and the feed URL through a protected read-only diagnostics endpoint;
the Meta page links to the same URL. Neither page persists platform catalog
credentials nor represents scheduled fetch, approval, or platform-side product
status as a CMS fact.

## Inherited interface contract

Malaysia market adaptation does not redefine the AdsBookCMS interaction model.
Order Management retains a desktop table, responsive mobile cards, bulk manual
actions, direct WhatsApp contact, and the ten-stage CRM sequence. Order detail
retains customer/address editing, item/payment context, manual shipping, and
CRM template actions.

Public PDP and checkout retain the inherited product gallery, variant card,
floating-field form, destination result states, payment card, order summary,
primary CTA, and trust strip. `/middle-form` is the short form confirmed by CS;
`/full-form` and `/hybrid-form` render the complete Malaysia address, quote, and
payment flow. Embeds and landing pages pass the configured mode through rather
than coercing every entry point to one route.

## Security and data invariants

- Browser input is never pricing, stock, or shipping authority.
- Stock reservation/restoration and order lifecycle transitions use shared
  lifecycle code; direct status writes must not bypass it.
- `/api/admin/media` is the only authenticated image-upload boundary. It caps
  the request stream before multipart parsing, verifies a 2 MB image against an
  allowlisted signature, generates the R2 key, constrains derivative siblings,
  and applies one KV hourly policy to Product and Content uploads.
- The clean migration chain and order lifecycle execute against workerd-backed
  D1 tests for duplicate, oversell, terminal restoration, and deletion
  invariants; fake statement-order tests do not substitute for D1 semantics.
- Secrets remain server-only and are never returned by an admin API.
- Advertising tokens are encrypted at rest; click-attribution cookies used by
  order persistence are HttpOnly and bounded to approved Meta/Google/UTM keys.
- Headless API keys are hashed, scoped, rate-limited, and audit logged.
- Migrations in `src/db/migrations/` are hand-authored and forward-only. Do not
  edit an applied migration; add a new one.

## Current limitations

The Malaysia cutover is validated only against the isolated local D1 and local
Worker runtime. Remote migration, deployment, and production behaviour are not
claimed. Historical implementation details belong only in `BUILD-LOG.md`.
