# Advertising identity and conversion contract

This guide records the Meta and Google rules agreed on 2026-09-08 for
MyBookCMS. It explains the existing requirements; it does not replace them or
create a separate backlog. [PRD.md](PRD.md) owns requirements,
[TASKS.md](TASKS.md) owns execution, and [STATUS.md](STATUS.md) owns current
verification status. Code and executable evidence win when documents disagree.

Relevant requirements: REQ-193, REQ-194, REQ-195, REQ-197, REQ-213 and REQ-225.

## Product identity

Use one catalog item per sellable variant. Keep the current ID format:

| Meaning | Example |
| --- | --- |
| Internal product ID | `10001` |
| Internal variant ID | `10002` |
| Catalog item ID | `p10001-v10002` |
| Catalog group ID for a multi-variant product | `p10001` |
| Meta `content_ids` | `["p10001-v10002"]` |
| Meta `content_type` | `"product"` |
| Google/GA4 ecommerce `item_id` | `"p10001-v10002"` |

`content_ids` identifies catalog items; it is not required to equal the admin's
numeric product ID. The prefix is a CMS convention, not a Meta requirement.
Numeric IDs are also valid when the catalog uses them consistently.

Two variants with different prices must retain distinct item IDs in this
catalog. Product grouping connects them without losing the selected variant's
identity or price. Even a single-variant product uses the same item-ID format.
Never substitute a group ID while leaving `content_type` as `product`.

Build IDs from immutable database keys. Keep them stable after catalog
submission; do not change them when a title, SKU, slug or price changes. The
owner confirmed that this install's XML had not yet been submitted when this
contract was agreed.

## Shared Google and Meta XML

Both platforms consume `/feed/google-catalog.xml`. There is no separate Meta
feed. Each item's `<g:id>` must match the event's catalog item ID exactly.

- Product links select the corresponding `variant_id`.
- Landing-page price and selected variant must match the advertised item.
- Money is stored as integer MYR sen and serialized as decimal MYR.
- When a valid comparison price is higher than the selling price, XML uses
  the comparison price as `g:price` and the selling price as `g:sale_price`.
- Multi-variant items share `g:item_group_id`.
- Supply truthful variant attributes, including standard attributes such as
  `size` when applicable. Do not invent size, color, ISBN, GTIN, brand or MPN.
- Product and image URLs must use the actual public store domain before
  submission. A placeholder domain is not a publishable feed.

## Event identity and value

| Event | Catalog identity and value |
| --- | --- |
| `ViewContent` | The variant displayed when the event fires and its selling price |
| `InitiateCheckout` | The selected variant and its selling price |
| `Purchase` | Persisted order-item variant IDs and merchandise subtotal |

Purchase value excludes shipping and payment fees under the existing product
contract. The backend owns Purchase IDs and amounts. Browser-provided prices are
not order authority. Abandoned form capture is not a Purchase.

## Advertising currency: fixed IDR conversion

Owner-approved amendment, 2026-09-08: all valued Meta Pixel/CAPI, direct Google
Ads and GTM ecommerce events use **IDR**, at **1 MYR = 4,100 IDR**. This is an
internal fixed advertising rate, not a claim about current market exchange rates.

| Boundary | Currency / value |
| --- | --- |
| Public prices, order database, payments and catalog XML | MYR |
| Internal tracker calls and browser-to-Meta ingress | MYR major units |
| Meta Pixel and prepared CAPI payload | IDR |
| Direct Google Ads conversion | IDR |
| GTM ecommerce payload, including downstream consumers | IDR |

Convert once at the outbound boundary, using the merchandise amount in sen:
`Math.round(valueMyr * 100) * 41`. For example, RM18.90 becomes IDR77,490;
RM32.90 becomes IDR134,890. Do not change only the currency label, convert the
stored order, or convert a prepared payload again. Catalog IDs and event IDs
are unchanged. Events without a monetary value remain valueless.

The rate and currency have one source in
[src/lib/ads-signal-policy.ts](src/lib/ads-signal-policy.ts); browser scripts
receive these constants from Astro. GTM must forward the supplied IDR value
without another currency conversion. Any analytics consuming these ecommerce
events also receives IDR and must interpret the currency field accordingly.

Outbox payloads snapshot currency/value when created. Retries preserve that
snapshot, including older MYR payloads. Do not rewrite queued history or replay
completed Purchases to restate their currency. A browser tab loaded before
cutover still runs its old script; reload it for verification of the new policy.
Changing the fixed rate later requires a deliberate cutover review.

Sending IDR does not by itself establish why ROAS was absent or prove that Meta
or Google received, attributed or matched a conversion.

The event table defines payload meaning, not a claim that every variant change
currently fires another `ViewContent`. Verify actual triggers separately.

## Purchase timing and deduplication

- **COD and manual transfer:** Purchase represents an accepted, persisted
  order, even while payment is unpaid/pending. It is not collected revenue.
- **DOKU:** Purchase is eligible only after server-authoritative successful
  payment. Initiation, redirect, pending, failure and retry are not Purchase.
- **Meta:** paired Pixel/CAPI events use the same event name and event ID.
  Purchase uses `purchase:<order_number>` on both legs. Catalog IDs identify
  the merchandise; the event ID identifies the conversion occurrence.
- **Google Ads:** `transaction_id` is the canonical order number. Never use
  Product ID, Variant ID or a payment-attempt ID as the transaction ID.
- One Google Ads conversion action has one sending owner. If direct Google
  Ads and GTM coexist, GTM must not independently duplicate that action.

Google catalog matching and Google conversion deduplication are separate
concerns: item IDs match merchandise; transaction IDs distinguish purchases.
GA4-shaped dataLayer events alone do not prove a Google Ads remarketing tag is
configured or receiving those events.

## Matching and test evidence

Preserve valid paid-click attribution and Meta browser IDs. Use real customer
data with the established Malaysia normalization and hashing rules. Do not
invent an email or use an order number as a stable customer identity. Never
record access tokens, customer data or full provider payloads in this document.

Keep these evidence levels separate:

1. **Local tests:** ID, amount, normalization, timing and retry contracts.
2. **Browser inspection:** actual Pixel/dataLayer payloads, selected variant,
   event-ID parity and repeat-load behavior. Block vendor requests for isolated
   checks so fixtures do not contaminate live reporting.
3. **Provider receipt:** verify the intended Pixel/Dataset and test code,
   HTTP result, `events_received` and safe diagnostic metadata.
4. **Provider UI:** confirm the event appears in Meta Test Events or Google's
   diagnostics and inspect deduplication/matching there.

HTTP success alone does not prove appearance in Events Manager or attribution.
A successful test PageView does not verify Purchase, catalog matching or ROAS.

Before the IDR amendment, the 2026-09-08 audit verified four local XML items against browser Pixel and
outbound CAPI-ingress payloads, including matching prices. It also identified
follow-up work: placeholder feed URLs, incomplete standard variant attributes,
and a CAPI sender that treats HTTP success as success without validating
`events_received`. These findings do not prove why a particular test event was
absent from Meta's UI. Resolve work through TASKS.md; do not treat this guide as
implementation or provider acceptance evidence.

Google delivery also has explicit limits: direct Purchase depends on the buyer
opening the confirmation/result page; there is no Google offline-upload
fallback. The normal confirmation path supplies enhanced-conversion data,
while the DOKU result call currently supplies value and order number only.

## Code and verification references

- [Catalog XML and item IDs](src/lib/google-catalog.ts)
- [Pixel, GTM and direct Google loader](src/components/storefront/tracking/AdsBase.astro)
- [Meta ingress validation](src/pages/api/meta-event.ts)
- [Meta sender](src/lib/meta-capi.ts)
- [Accepted-order and settled DOKU Meta payloads](src/lib/accepted-order-meta.ts)
- [COD/manual browser confirmation](src/pages/thanks.astro)
- [DOKU browser result](src/pages/payment/doku/result.astro)

Run the existing focused contract tests:

```bash
node --experimental-strip-types --test src/lib/google-catalog.test.ts src/lib/meta-event.test.ts src/lib/meta-capi.test.ts src/lib/capi-outbox.test.ts src/lib/ads-signal-policy.test.ts src/lib/click-ids.test.ts src/lib/doku-payment-lifecycle.test.ts
```

After building, the isolated browser fixture verifies Pixel/CAPI parity, Google
and GTM IDR values, unchanged MYR inputs/catalog, and admin currency copy:

```bash
npm run build
node --experimental-strip-types scripts/verify-ads-currency.mts
```

## Provider references

- [Google item IDs and dynamic remarketing](https://developers.google.com/google-ads/api/docs/dynamic-remarketing/prerequisites)
- [Google transaction-ID deduplication](https://support.google.com/google-ads/answer/6386790?hl=en)
- [Google item grouping and variant attributes](https://support.google.com/merchants/answer/6324507?hl=en)
- [Meta official SDK event request and test code](https://github.com/facebook/facebook-nodejs-business-sdk/blob/main/src/objects/serverside/event-request.js)
- [Meta official SDK response and events received](https://github.com/facebook/facebook-nodejs-business-sdk/blob/main/src/objects/serverside/event-response.js)

Provider references were consulted on 2026-09-08. Recheck current documentation
before changing integration behavior; these links do not establish account-side
configuration or receipt.
