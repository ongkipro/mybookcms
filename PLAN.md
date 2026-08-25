# PLAN — MyBookCMS Malaysia Delivery

## Outcome

MyBookCMS is an independent Malaysia-market commerce CMS. Public storefronts
use one `ms-MY` document language with a controlled Malay/English market voice;
the admin uses Indonesian with common English technical terms. All persisted
money is integer sen and all public money is formatted as MYR.

## Implemented workstreams

1. Isolate the repository and local D1 under the MyBookCMS identity.
2. Limit checkout to COD and manual bank transfer.
3. Quote domestic shipping from D1 postcode zones and inclusive weight bands.
4. Support Peninsular Malaysia, Sabah, Sarawak, and Labuan.
5. Keep Pengiriman manual: local queue membership and status markers only;
   shipment evidence is communicated directly through WhatsApp.
6. Remove inherited external logistics, automatic payment, Meta Commerce feed,
   TikTok, and obsolete partial-lead runtime surfaces.
7. Seed fictional Malaysia catalogue, bank, and shipping data for preview.
8. Localize the full public storefront and retain Indonesian admin operations.
9. Verify schema, unit tests, type checks, build, API flows, and browser-visible
   desktop/mobile pages before release.
10. Search an official local Malaysia city/state/postcode snapshot during checkout.
11. Prefer editable state/WP weight-band rates before the broad-zone fallback.
12. Keep one adaptive Malaysia-market public voice without a language selector.
13. Publish one hybrid home/product presentation; keep legacy bilingual columns
    dormant for forward-migration compatibility.
14. Let a buyer check the current order status with the checkout-issued
    capability without exposing customer, address, courier, or tracking data.
15. Let operators edit a trusted Malaysia destination and MYR shipping cost;
    re-quote actual persisted item weight and refresh the order total atomically.
16. Restore AdsBookCMS-aligned Meta Pixel/CAPI and Google GTM/Ads configuration
    with Malaysia identity, MYR values, server-authoritative Purchase timing,
    encrypted Meta credentials, and a retryable deduplicated CAPI outbox.
17. Publish a read-only, variant-level Google Merchant RSS feed from the
    published MyBookCMS catalog; keep Merchant Center submission, approvals,
    and shipping configuration outside the CMS.

## Release boundary

- Local development and local D1 verification are authorized.
- Remote D1 writes, deployment, DNS, and production publication require a
  separate explicit approval.
- Merchant rates are editable D1 policy, not live quotes from a courier API.
- Reference rates and their evidence are documented in
  `docs/research/MALAYSIA_SHIPPING_2026-08-23.md`.
