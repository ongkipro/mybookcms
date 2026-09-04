# MyBookCMS Decisions

> Verified against disk: 2026-09-04 @ MyBookCMS working tree

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

**Status:** Superseded for the online-payment boundary by ADR-021. COD and
manual transfer remain supported fallbacks.

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

## ADR-021 — One DOKU Malaysia hosted-payment boundary

- **Status:** Accepted
- **Date:** 2026-09-01
- **Deciders:** MyBookCMS product owner
- **Supersedes:** ADR-004 only where it prohibited online settlement; ADR-011
  only for the Purchase timing of DOKU-paid orders

### Context

At this decision's acceptance, MyBookCMS accepted COD and operator-verified
manual transfer and needed automated payment without restoring AutoLaris or an
Indonesia payment taxonomy. The official
[senangPay DOKU integration guide](https://guide.senangpay.com/doku-api-integration-guide)
states that merchants have migrated to the DOKU platform and directs custom
integrations to the DOKU Malaysia API.

The viable choices were a legacy senangPay adapter, DOKU's direct Payment/Card
APIs, or DOKU hosted Checkout. Parallel senangPay and DOKU adapters would create
two credential, signature, webhook, and status models for the same provider
group. Direct APIs would make MyBookCMS own channel-specific bank/e-wallet/card
interaction and materially enlarge its PCI and failure surface.

### Decision

Use one optional DOKU Malaysia Global API adapter based on hosted
`POST /v3/checkouts`. Treat senangPay as the merchant/onboarding route to that
same DOKU platform, not as a second runtime adapter. D1 remains authoritative
for orders, stock, payment attempts, lifecycle, and advertising identity. DOKU
is authoritative only for its payment outcome. Browser return parameters are
never payment evidence; signed notifications and signed server-to-server status
retrieval drive reconciliation.

The first release supports only merchant-enabled FPX, Touch 'n Go, GrabPay,
ShopeePay, and Credit Card channels exposed by hosted Checkout. BNPL, legacy
Cards-only APIs, tokenisation, recurring billing, refunds, payout, and split
settlement require separate accepted requirements.

### Consequences

- **Positive:** one payment state machine, one Global signature scheme, hosted
  channel UX, retained COD/manual fallbacks, and no PAN/CVV handling in
  MyBookCMS.
- **Negative:** checkout and payment reconciliation now depend on DOKU
  availability; encrypted credentials, idempotent attempts, webhook replay
  protection, expiry handling, and an operator recovery surface become
  mandatory.
- **Neutral:** production credentials, DOKU Back Office webhook registration,
  remote migration, sandbox/vendor tests, and deployment remain explicit
  install-owner approval gates.

## ADR-022 — Narrow DOKU Checkout response-envelope compatibility

- **Status:** Accepted
- **Date:** 2026-09-02
- **Deciders:** MyBookCMS product owner
- **Amends:** ADR-021 response authentication only

### Context

Approved A-221 sandbox traffic proved that DOKU accepted signed Malaysia
Checkout create and retrieve requests and returned matching successful JSON,
but both responses omitted `Signature`. The current official Checkout OpenAPI
models no response headers and DOKU Malaysia's published Checkout collection
does not assert a response signature, while the generic Global integrity guide
states that responses are signed. Requiring a missing header makes hosted
Checkout unusable; accepting arbitrary unsigned JSON would make a payment
boundary unauthenticated.

### Decision

Keep all outbound requests and Payment Notifications under the existing Global
HMAC contract. For only the fixed HTTPS DOKU Checkout create/retrieve endpoints,
verify `Signature` whenever it is present. If and only if it is absent, accept
the response after exact Client ID and API version checks, a fresh canonical
response timestamp, JSON media type, bounded raw body, rejection of Cards-only
`Request-Id`, and exact checkout ID, invoice, MYR amount, and D1 attempt
correlation. A malformed or invalid present signature fails closed and never
enters the compatibility path. Browser redirects remain non-authoritative.

### Consequences

- **Positive:** the adapter interoperates with the observed DOKU Malaysia
  Checkout contract without weakening notification authenticity or local
  payment-state invariants.
- **Negative:** an unsigned Checkout response has transport-origin and strict
  correlation assurance rather than response-body HMAC assurance, so this
  exception must stay endpoint-specific and observable.
- **Neutral:** Direct Payment, Cards-only APIs, BNPL, refunds, channel changes,
  production activation, webhook registration, and deployment remain outside
  this decision.
