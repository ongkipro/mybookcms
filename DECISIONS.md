# MyBookCMS Decisions

> Verified against disk: 2026-08-24 @ MyBookCMS working tree

## ADR-001 — One install is one store

**Decision:** Each store has its own Worker, D1, KV, R2, domain, and secrets.

**Consequences:** There is no tenant routing or shared merchant database. An
install can be migrated, deployed, and recovered independently.

## ADR-002 — D1-owned Malaysia shipping policy

**Decision:** Shipping eligibility and price are resolved from internal
five-digit postcode zones and weight-rate bands.

**Consequences:** Pricing remains deterministic and editable by operators.
Checkout fails closed on invalid/unmapped postcode, overlap, or missing rate.

## ADR-003 — MYR integer sen

**Decision:** Persist all money as integer MYR sen.

**Consequences:** Arithmetic avoids floating-point errors; formatting happens
only at the public/admin/event boundary.

## ADR-004 — COD and manual bank transfer

**Decision:** Checkout offers COD and merchant-selected manual bank transfer.

**Consequences:** Manual transfer remains pending until an operator confirms it;
payment setup has no dependency on a third-party settlement service.

## ADR-005 — One Malaysia-market public voice

**Decision:** Public surfaces use one `ms-MY` document language with controlled
Malaysia-market Malay/English usage; the operator admin remains Indonesian with
English technical labels where useful.

**Consequences:** There is no visitor language selector, locale cookie/query,
translation fallback, or operator locale choice. Merchant content publishes one
hybrid presentation. Legacy bilingual columns remain dormant for migration
compatibility.

## ADR-006 — Capability-scoped public order status

**Decision:** Public order status requires the order identity plus the random
checkout-issued status capability. The hosted page renders the current status
only; courier and tracking evidence are outside the stored/API contract.

**Consequences:** The status page is `noindex` and `no-store`, removes fragment
credentials after reading them, and does not offer phone-number lookup or render
customer/address data.

## ADR-007 — Queue membership is independent from shipping status

**Decision:** `shipping_queued_at` alone owns Pengiriman membership, while
`shipping_status` is an independent manual marker. Entry, exit, and marker
changes never mutate one another and do not require courier/tracking evidence.

**Consequences:** Releasing any progressed order removes it from Pengiriman
without erasing its marker. Trusted Malaysia destination and MYR shipping-cost
edits re-quote persisted item weight and refresh totals atomically. Legacy
courier/tracking columns remain dormant instead of forcing a destructive table
rebuild.

## ADR-008 — Advertising Purchase follows collected commerce value

**Decision:** Order submission emits Lead. Meta and Google Purchase may represent
manual transfer only after `payment_status` is paid, and COD only after
`shipping_status` is delivered. Meta CAPI is the durable server leg; its token
is encrypted in D1 and its outbox deduplicates on event name plus event ID.

**Consequences:** Campaign optimization is not trained on uncollected COD or
unverified transfer orders. Google click IDs are retained for attribution, but
there is no Google Ads API offline uploader until credentials, consent, and an
operator-approved upload lifecycle exist.

## ADR-009 — Google Merchant catalog is a local, variant-level projection

**Decision:** Publish a public RSS 2.0 Google Merchant feed from the existing
published storefront catalog, one in-stock variant per item, using the canonical
`p{productId}-v{variantId}` identity and a URL that selects the same variant.

**Consequences:** The CMS does not add Merchant credentials, taxonomy guessing,
or a separate catalog database. It omits unverified GTIN, MPN, brand, and Google
Product Category rather than fabricating them. The protected Google Ads page can
diagnose local feed readiness, but Merchant Center fetch, approval, target
language, and shipping configuration remain external operator responsibilities.

## ADR-010 — Advertising value is the persisted merchandise subtotal

**Decision:** The checkout persistence boundary returns the canonical
`p{productId}-v{variantId}` identity and persisted order-item subtotal in integer
sen. Shared checkout carries those server facts to the thanks page. Browser,
dataLayer, Google Ads, and Meta signals convert only that subtotal to MYR major
units; no consumer derives advertising value from the payable order total.

**Consequences:** Shipping, COD fee, admin fee, and future order-level charges
can change the customer amount payable without changing advertising revenue.
PDP and all CMS/native landing pages reuse `BaseLayout` plus the shared checkout
tracking contract instead of installing page-owned pixels or event adapters.

## ADR-011 — Verified thanks confirmation owns Purchase timing

**Decision:** Superseding the timing portion of ADR-008, the no-store thanks page
is the Purchase trigger for both COD and manual transfer. It must re-resolve the
persisted order with the checkout-issued status token before emitting. Paid,
delivered, queue membership, and later admin status changes neither gate nor
create a Purchase.

**Consequences:** Browser Meta, Meta CAPI, GTM, and direct Google Ads share the
confirmed order number as their deduplication/transaction identity. Refreshes
remain harmless through the browser once guard, Meta outbox uniqueness, and
Google `transaction_id`. A buyer who never reaches the verified thanks page does
not generate this Purchase signal.

## ADR-012 — One catalog URL serves Google and Meta

**Decision:** Extend ADR-009's Google Merchant-compatible RSS 2.0 projection as
the single catalog URL for both Google Merchant Center and Meta Commerce
Manager. Both admin channel pages reference `/feed/google-catalog.xml`; a second
Meta feed, redirect alias, or separate catalog database is not created.

**Consequences:** Product IDs, MYR prices, variant landing URLs, availability,
and content stay byte-identical across catalog consumers and storefront events.
Each platform still owns its external import validation, shipping policy,
approval, and diagnostics. The CMS does not claim those external outcomes or
fabricate missing merchant identifiers.

Historical decisions and implementation evidence are preserved only in
`BUILD-LOG.md` and `TASKS.md`.
