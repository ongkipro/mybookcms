# MyBookCMS Product Requirements

> Verified against disk: 2026-08-24 @ MyBookCMS working tree

## Goal

Provide a single-store direct-commerce system for Malaysia that a merchant can
operate without external courier or payment service dependencies.

## Requirements

| ID | Requirement | Status |
| --- | --- | --- |
| REQ-173 | Store and calculate monetary values as MYR integer sen; format public values with Malaysia conventions. | Implemented locally |
| REQ-174 | Superseded by REQ-185. | Superseded |
| REQ-175 | Superseded by REQ-185. | Superseded |
| REQ-176 | Checkout offers only COD and manual bank transfer; no automatic payment settlement is performed. | Implemented locally |
| REQ-177 | A valid Malaysia five-digit postcode and cart weight resolve one active D1-owned zone/rate rule, including explicit Labuan policy; the accepted quote is snapshotted with the order. | Implemented locally |
| REQ-178 | Invalid/unmapped postcode, missing band, or active overlap refuses checkout before order persistence. | Implemented locally |
| REQ-179 | Authorized operators can maintain postcode zones and MYR weight-rate bands with validation against active gaps and overlaps. | Implemented locally |
| REQ-180 | The runtime has no external logistics or payment-provider dependency. | Implemented locally |
| REQ-181 | Superseded by REQ-192. | Superseded |
| REQ-182 | Conversion preserves catalog, stock, authentication, authorization, and privacy safeguards. | Verified locally |
| REQ-183 | When a buyer searches a Malaysian city, state, or postcode, checkout shall offer a selectable local directory result, populate the destination fields, and calculate the D1-owned shipping quote without an external runtime dependency. | Implemented locally |
| REQ-184 | Authorized operators can maintain an individual MYR weight-band rate for every Malaysian state and Federal Territory, while a broad zone rate remains an explicit fallback. | Implemented locally |
| REQ-185 | Public surfaces use one `ms-MY` document language with a controlled Malaysia-market hybrid voice: Malay owns actions, transactions, trust, address, help, legal, errors, and accessibility; familiar retail/digital terms and merchant product names may remain English. No public or admin language selector, locale cookie, translation fallback, or locale query is active. | Implemented locally |
| REQ-186 | The AdsBookCMS interaction and visual baseline remains the product contract: Order Management keeps its desktop table/mobile-card split and direct plus staged WhatsApp CRM actions; order detail keeps the operator editing and CRM workflow; public PDP/checkout keeps the established form hierarchy; and `middle`, `full`, and `hybrid` form modes keep their existing roles. Malaysia changes substitute MYR, Malaysia destinations, COD/manual transfer, and manual fulfilment without redesigning those surfaces. | Verified locally |
| REQ-187 | An authorized operator can explicitly move a closing order from Order Management into or out of a local Pengiriman queue without changing its fulfilment status or calling an external service. Pengiriman exposes only queued orders, retains their lifecycle history, and exports the complete server-filtered queue as formula-safe CSV. | Verified locally |
| REQ-188 | The Malaysia destination search shall retain the inherited AdsBookCMS floating-field interaction: 16 px buyer input, visible loading/empty/error states, keyboard-selectable results, a compact selected-address summary, and identical desktop/mobile information hierarchy without a replacement map, modal, or multistep address flow. | Verified locally |
| REQ-189 | Reference shipping policy shall use explicit one-kilogram bands through 5 kg, prefer an active state/WP override for the requested weight, fall back to its active broad zone band when no matching state override exists, and preserve accepted historical quote snapshots when reference rates are recalibrated. | Verified locally |
| REQ-190 | The canonical checkout form shall accept only bounded human receiver names, normalized Malaysian mobile numbers, meaningful bounded street addresses, a trusted selected location, a fresh variant/location quote, and an active valid payment method. Each incomplete or invalid buyer field exposes AdsBookCMS-style inline feedback, and the primary action remains visibly disabled until every requirement for the active form mode is satisfied. | Verified locally |
| REQ-191 | Admin Order Management shall use one Indonesian operational status taxonomy derived from payment, local queue membership, and stored fulfilment state: Baru, Menunggu, Masuk Pengiriman, Dalam Pengiriman, Selesai, Dikembalikan, and Dibatalkan. Queue entry/exit and persisted lifecycle transitions live in the row/card Aksi menu rather than an inline switch; the existing AdsBookCMS table/mobile-card and WhatsApp CRM workflows remain unchanged. | Verified locally |
| REQ-192 | `shipping_queued_at` is the sole Pengiriman queue-membership fact: entering sets it, leaving clears it, and neither action changes `shipping_status`. Shipping status is an independent manual marker that requires no courier, service, tracking number, or external confirmation. The system does not collect, display, validate, or export those evidence fields; shipment details are communicated outside the system through WhatsApp. Authorized operators can still edit a trusted Malaysia destination and MYR shipping cost, with server-side re-quote/override and consistent order totals. | Verified locally |
| REQ-193 | Authorized owner, admin, and advertiser roles can configure Meta Pixel/CAPI and Google Tag Manager/Ads from an AdsBookCMS-aligned **Ads & Tracking** admin group. Browser and server events use one event identity, Malaysia `+60` matching, canonical product/variant content IDs, and MYR product value. The capability-verified thanks page is the Purchase trigger for both COD and manual transfer; it does not wait for paid, delivered, or another admin status. Meta CAPI tokens are encrypted at rest and its outbox deduplicates/retries delivery. Google click IDs are retained, while offline Google Ads API upload remains explicitly outside this version. TikTok and provider logistics/payment integrations are not restored. | Verified locally |
| REQ-194 | The public product catalog shall expose one read-only Google Merchant-compatible RSS 2.0 feed at `/feed/google-catalog.xml` for both Google Merchant Center and Meta Commerce Manager. It contains only the active, in-stock, published MyBookCMS catalog. Each sellable variant has the canonical ID `p{productId}-v{variantId}`, an MYR price, and a landing URL that preselects the same variant through `?variant_id=`. Multi-variant products publish `item_group_id`, `item_group_title`, and `variant_option`; the feed never invents GTIN, MPN, brand, or Google Product Category. Both channel admin pages link to the same URL, while the Google page provides read-only local diagnostics. No platform API submission, approval, or shipping configuration is implied. | Implemented locally |
| REQ-195 | Ads overview and Google configuration retain the AdsBookCMS channel-card, KPI, tab, configuration, tutorial, catalog-table, and inspector hierarchy while reporting only implemented Malaysia facts. PDP, CMS landing pages, native landing templates, shared checkout, and thanks use one canonical variant event identity. Order submission returns the persisted order-item subtotal and canonical content ID; Purchase uses that server-authoritative merchandise value only, excluding shipping, COD fee, admin fee, and every other order-level charge. The thanks page presents complete product, payment, destination, status, and WhatsApp confirmation context for COD/manual transfer without restoring a provider flow. | Verified locally |
| REQ-196 | Meta configuration shall retain the AdsBookCMS compact card hierarchy while using the installed shadcn component system: Pixel ID and CAPI token form two equal desktop columns and one mobile column; Test Event Code and its action share one bounded subsection; Save owns the footer. Stored tokens remain masked and non-revealable, draft/delete states are explicit, destructive selection disables token testing, field feedback is associated and accessible, and controls are at least 44 px without page overflow. | Verified locally |
| REQ-197 | MyBookCMS shall own the complete Meta signal integrity boundary. CAPI credentials have an explicit database, environment, empty, or invalid source; database tokens must be encrypted and never appear in request URLs or browser responses; an invalid database secret fails closed. Product events are rebuilt from the active D1 catalog, order events are rebuilt from the capability-owned order and its stored Meta attribution, and the outbox prevents concurrent duplicate delivery, applies bounded retry/terminal classification, and prunes completed records under a documented retention policy. | Verified locally |

## Non-goals

- Cross-border delivery, tax calculation, real-time provider quotation, external
  dispatch, automatic payment settlement, automated translation, or a public
  multi-language selector.
- Multi-tenant runtime routing or shared merchant data.
- A redesign of the inherited AdsBookCMS admin, PDP, checkout, or WhatsApp CRM
  interaction model.
- TikTok Ads, platform catalog API submission or approval automation, or Google
  Ads offline conversion upload.

Acceptance evidence and dependencies are maintained in `TASKS.md`.
