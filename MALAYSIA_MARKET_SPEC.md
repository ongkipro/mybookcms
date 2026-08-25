# MyBookCMS Malaysia Market Specification

> Verified against disk: 2026-08-24 @ MyBookCMS working tree

## Market scope

MyBookCMS serves domestic Malaysia: Peninsular Malaysia, Sabah, Sarawak, and
Labuan. Cross-border delivery is outside this contract.

## Language

- Public documents use `ms-MY` with no language selector.
- Malay owns customer actions, transactions, trust, address, help, legal,
  errors, and accessibility copy. Familiar terms such as COD, WhatsApp,
  checkout, merchant product names, and verified merchandising badges may
  remain English inside Malay sentence structure.
- Merchant-authored content has one hybrid presentation, not parallel Malay and
  English translations.
- The operator admin remains Indonesian, with English technical labels where
  useful.

## Money and payment

- All stored amounts are MYR integer sen.
- Public and event formatting uses `Intl` at the boundary.
- Checkout methods are COD and manual bank transfer only.
- Manual transfer presents an active seller bank account and requires operator
  confirmation before it is paid.

## Shipping

- Addresses use a five-digit Malaysia postcode.
- Checkout searches a local snapshot of the official Malaysia postcode
  directory by city, state, or exact postcode. The selected D1 row, not typed
  hidden fields, owns the structured destination.
- D1 maps active inclusive postcode ranges to a Malaysia zone.
- D1 maps zone plus cart weight to one active MYR rate band.
- Active postcode ranges may not overlap. Checkout refuses malformed/unmapped
  postcodes, missing bands, or ambiguous active rules.
- Labuan requires an explicit active zone/rate policy; it is never inferred from
  Peninsular or East Malaysia pricing.
- An active state/Federal Territory weight band takes precedence over its broad
  zone fallback. All 13 states and three Federal Territories are configurable.

## Pengiriman operations

The operator manages shipment work manually. `shipping_queued_at` alone decides
whether an order appears in Pengiriman; `shipping_status` is an independent
operational marker. Entering or leaving the queue never changes that marker, and
changing the marker never changes queue membership. The active system does not
collect, require, display, or export courier, service, or tracking evidence.
Shipment evidence is sent manually through WhatsApp outside the database.

Authorized operators may edit the street address, select a trusted Malaysia
city/state/postcode row, and override the MYR shipping amount. A destination
change re-quotes the persisted order-item weight against current D1 policy;
shipping and total values update together. Customer status requires the
checkout-issued secure capability and exposes only the order number and current
status, never customer, address, courier, or tracking data.

## Advertising signals

- Admin configuration covers Meta Pixel/CAPI, Google Tag Manager, and Google
  Ads only; owner, admin, and advertiser roles may access it.
- Customer telephone matching uses Malaysia country code `+60`; CAPI country is
  `my`, advertising currency is `MYR`, and product value excludes shipping.
- The capability-verified thanks page triggers Purchase for both COD and manual
  transfer without waiting for paid, delivered, or another admin status.
- Meta browser/CAPI legs share one event identity and CAPI retries from a
  deduplicated D1 outbox. The CAPI token is encrypted at rest.
- `gclid`, `gbraid`, `wbraid`, `_fbp`, `_fbc`, `fbclid`, and bounded UTM values
  are retained with the order. Google offline conversion upload is not part of
  this version.
- The public catalog is one read-only Google Merchant-compatible RSS 2.0 feed
  at `/feed/google-catalog.xml` for both Google Merchant Center and Meta
  Commerce Manager. It contains active, in-stock, published variants only,
  with MYR prices and `?variant_id=` landing links. Platform shipping,
  scheduled fetch, product approval, and target-language setup remain operator
  configuration; the CMS shows a hybrid-language warning and does not call
  platform catalog APIs.

## Exclusions

The product has no external courier or payment-provider integration, real-time
provider rate lookup, automatic settlement, automated dispatch, TikTok Ads,
catalog API submission/approval automation, or Google Ads offline upload.
