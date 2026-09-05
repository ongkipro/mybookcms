# MyBookCMS Product Requirements

> Verified against disk: 2026-09-04 @ MyBookCMS working tree
>
> The single requirements source for this product. `TASKS.md` is the single
> execution queue and holds acceptance evidence. Inherited AdsBookCMS
> requirements (`REQ-1`-`REQ-172`) are **not** part of this product; tasks that
> cite them are quarantined in `docs/lineage/inherited-tasks.md`.

## Goal

Provide a single-store direct-commerce system for Malaysia with deterministic
local fulfilment, optional secure Malaysia online payments, and merchant-owned
operations that remain usable when an external payment channel is disabled.

## Market contract

The framing every requirement below assumes. Where this section and a numbered
requirement disagree, the requirement wins.

**Territory.** Domestic Malaysia only: Peninsular Malaysia, Sabah, Sarawak, and
Labuan. Cross-border delivery is out of contract. Four shipping zones map the
complete official postcode directory with no gap and no overlap: `peninsular`
`01000`-`86999`, `labuan` `87000`-`87033`, `sabah` `88000`-`91400` (the upper
bound includes Kalabakan `91400`), `sarawak` `93000`-`98859`.

**Language.** Public surfaces — storefront, product pages, checkout, legal
pages, and landing pages — are one `ms-MY` document language with no selector,
no locale cookie, and no translation fallback. This extends to the address bar:
public route slugs are Malay (`REQ-203`). Malay owns customer
actions, transactions, trust, address, help, legal, errors, and accessibility.
Familiar retail and digital terms — COD, WhatsApp, checkout — and merchant
product names may stay English inside Malay sentence structure. The operator
admin is Indonesian by design, with English technical labels where useful; this
is a deliberate split, not drift.

**Money.** Every stored amount is MYR integer sen. Formatting happens at the
presentation boundary through `Intl`, never in storage or arithmetic.

**Payment.** The current runtime keeps COD and manual bank transfer independent
and conditionally offers DOKU Malaysia hosted Checkout only for a healthy,
enabled configuration. This is locally verified behavior, not sandbox or live
provider evidence. senangPay merchants use the migrated DOKU platform and the
same DOKU Global API boundary; MyBookCMS does not maintain a second legacy
senangPay adapter.

**Fulfilment.** Manual, operator-driven. `shipping_queued_at` alone decides
Pengiriman queue membership; `shipping_status` is an independent marker. Neither
changes the other. The system does not collect, require, display, or export
courier, service, or tracking evidence — that is sent through WhatsApp outside
the database.

**Known ceiling.** Active rate bands cover 1 g to 5000 g. A cart above the
highest active band cannot be quoted and checkout refuses it. See `REQ-204`.

## Requirements

Accepted requirements are normative. A row marked `Proposal` is **not**
accepted and no task may implement it until it is.

| ID | Requirement | Status |
| --- | --- | --- |
| REQ-173 | Store and calculate monetary values as MYR integer sen; format public values with Malaysia conventions. | Implemented locally |
| REQ-174 | Superseded by REQ-185. | Superseded |
| REQ-175 | Superseded by REQ-185. | Superseded |
| REQ-176 | Superseded by REQ-216. The current implementation remains COD/manual transfer until the DOKU phase is delivered. | Superseded |
| REQ-177 | A clean migration chain provisions the active canonical Malaysia zones, complete official postcode coverage, 16 state/WP first-kilogram rules, and five broad fallback weight bands per zone. A valid five-digit postcode and cart weight resolve one active D1-owned zone/rate rule, including explicit Labuan and Kalabakan policy; the accepted quote is snapshotted with the order. | Verified locally |
| REQ-178 | Invalid/unmapped postcode, missing band, or active overlap refuses checkout before order persistence. | Implemented locally |
| REQ-179 | Authorized operators can maintain postcode zones and MYR weight-rate bands with validation against active gaps and overlaps. | Implemented locally |
| REQ-180 | The runtime has no external logistics dependency. Its former payment-provider prohibition is superseded by REQ-216; shipping and fulfilment remain local and manual. | Implemented locally; payment clause superseded |
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
| REQ-193 | Authorized owner, admin, and advertiser roles can configure Meta Pixel/CAPI and Google Tag Manager/Ads from an AdsBookCMS-aligned **Ads & Tracking** admin group. Configured browser tags, attribution storage, and server CAPI load directly for this Malaysia storefront. Browser and server events use one event identity, Malaysia `+60` matching, canonical product/variant content IDs, and MYR product value. Accepted COD/manual-transfer order persistence writes the server-authoritative Purchase into the same D1 batch as the order; the capability-verified thanks page emits the deduplicated browser leg without waiting for paid, delivered, or another admin status. Meta CAPI tokens are encrypted at rest, and a scheduled outbox drain retries delivery independently of storefront traffic. Google click IDs are retained, while offline Google Ads API upload remains outside this version. TikTok and provider logistics/payment integrations are not restored. | Verified locally |
| REQ-194 | The public product catalog shall expose one read-only Google Merchant-compatible RSS 2.0 feed at `/feed/google-catalog.xml` for both Google Merchant Center and Meta Commerce Manager. It contains only the active, in-stock, published MyBookCMS catalog. Each sellable variant has the canonical ID `p{productId}-v{variantId}`, an MYR price, and a landing URL that preselects the same variant through `?variant_id=`. Multi-variant products publish `item_group_id`, `item_group_title`, and `variant_option`; the feed never invents GTIN, MPN, brand, or Google Product Category. Both channel admin pages link to the same URL, while the Google page provides read-only local diagnostics. No platform API submission, approval, or shipping configuration is implied. | Implemented locally |
| REQ-195 | Ads overview and Google configuration retain the AdsBookCMS channel-card, KPI, tab, configuration, tutorial, catalog-table, and inspector hierarchy while reporting only implemented Malaysia facts. PDP, CMS landing pages, native landing templates, shared checkout, and thanks use one canonical variant event identity. Order submission returns the persisted order-item subtotal and canonical content ID; Purchase uses that server-authoritative merchandise value only, excluding shipping, COD fee, admin fee, and every other order-level charge. The thanks page presents complete product, payment, destination, status, and WhatsApp confirmation context for COD/manual transfer without restoring a provider flow. | Verified locally |
| REQ-196 | Meta configuration shall retain the AdsBookCMS compact card hierarchy while using the installed shadcn component system: Pixel ID and CAPI token form two equal desktop columns and one mobile column; Test Event Code and its action share one bounded subsection; Save owns the footer. Stored tokens remain masked and non-revealable, draft/delete states are explicit, destructive selection disables token testing, field feedback is associated and accessible, and controls are at least 44 px without page overflow. | Verified locally |
| REQ-197 | MyBookCMS shall own the complete Meta signal integrity boundary. CAPI credentials have an explicit database, environment, empty, or invalid source; database tokens must be encrypted and never appear in request URLs or browser responses; an invalid database secret fails closed. Product events are rebuilt from the active D1 catalog, configured accepted-order Purchase is transactionally enqueued from authoritative order input, and the thanks-page browser leg is deduplicated against it. The outbox prevents concurrent duplicate delivery, drains every minute independently of new browser traffic, applies bounded retry/terminal classification, and prunes completed records under a documented retention policy. | Verified locally |
| REQ-198 | Accepted-order persistence shall remain schema-compatible across the complete forward migration chain. Duplicate submission and oversell must leave no orphan order, item, stock decrement, or advertising event; terminal transition and deletion restore reserved stock at most once. | Verified locally |
| REQ-199 | Product and Content operators shall use one authenticated image-upload boundary. It must bound the multipart request before parsing, cap image bytes at 2 MB, verify an allowlisted MIME type against file signatures, generate non-user-controlled R2 keys, constrain derivative siblings, and apply one hourly abuse policy. | Verified locally |
| REQ-200 | CI shall run with read-only repository token scope, pin external actions to reviewed full commit SHAs, and fail when Wrangler-generated binding declarations drift from `wrangler.jsonc`. Worker entrypoint types shall consume generated bindings without an unsafe double cast. | Verified locally |
| REQ-201 | Tests that deliberately exercise production error logging shall capture and assert the exact safe signal. Unexpected `console.error` output must remain visible and capable of failing the owning test or CI investigation. | Verified locally |
| REQ-202 | The public privacy notice shall describe the advertising and measurement processing the storefront actually performs, including which identity fields are hashed before transmission and which are not. No legal page may deny processing that another legal page or the running storefront discloses. | Implemented locally |
| REQ-203 | Public route slugs shall be Malay. A retired slug shall answer exactly one permanent redirect to its Malay replacement, preserving the query string, and only the Malay form shall appear as canonical, in the sitemap, and in internal links. `/api/*` paths and `/admin/*` routes are contracts rather than public copy and are explicitly out of scope: the operator admin stays Indonesian with English technical labels. | Implemented locally |
| REQ-204 | A cart the active rate bands cannot carry shall be refused with the buyer's own weight and the real ceiling, both read from the active merchant rules rather than restated as a constant. | Implemented locally |
| REQ-205 | The weight ceiling shall also be surfaced before the final checkout step, not only at refusal. | Withdrawn — unreachable while checkout is single-unit; see A-202 |
| REQ-206 | The seller bank list shall cover the retail banks a Malaysian merchant is likely to collect a manual transfer into. | Implemented locally |
| REQ-207 | A buyer-facing surface shall not mix Indonesian into Malay copy. One rendered component carrying both languages is a defect regardless of whether each word is individually understood. | Implemented locally |
| REQ-208 | A legal page the product cites in its own copy shall be reachable from the storefront, not only from `sitemap.xml`. | Implemented locally |
| REQ-211 | The public privacy notice shall be published in Bahasa Malaysia **and** English on one page, Malay first, with no language selector. PDPA 2010 s.7(3) requires the notice in the national and English languages; `REQ-185` bars a selector. Stacking both on one document satisfies each. Scope is the notice only — the rest of the storefront stays `ms-MY`. | Proposal |
| REQ-212 | The notice shall be reachable at the point the buyer is first asked for personal data, not only from the footer, per PDPA 2010 s.7(2)(a). | Proposal |
| REQ-210 | The repository shall contain no host or network address belonging to one developer's machine. Seeds, fixtures and docs use documentation addresses. | Implemented locally |
| REQ-209 | An authorized operator can record the merchant's own pickup address — contact name, Malaysian mobile, street address, and postcode — validated by the same rules the buyer's address uses. It is stored complete or not at all, and its city and state are resolved from the postcode directory rather than stored, so they cannot disagree with the postcode. This is operator reference data: nothing is transmitted to any logistics provider. | Implemented locally |
| REQ-213 | Advertising attribution shall preserve the most recent paid-click identity across later UTM-only visits, replace it only when a new paid click arrives, and use one random first-party Meta visitor identity across browser Pixel and server CAPI events. Google tags shall initialize regional Consent Mode before either GTM or direct Ads configuration, and a verified Purchase shall provide Malaysia-normalized first-party matching data to the direct Google Ads conversion without changing the accepted-order Purchase taxonomy, canonical transaction ID, MYR merchandise value, or single-owner rule for each Google Ads conversion action. | Verified locally 2026-09-01 |
| REQ-214 | Buyer checkout shall use one canonical `full` Malaysia form. `middle` and `hybrid` shall not remain selectable or independently executable buyer modes; retired public form URLs and embed mode requests shall converge on the full-form contract without dropping query attribution. This supersedes only the three-mode clause of REQ-186; the established checkout hierarchy and interaction baseline remain unchanged. | Verified locally 2026-09-01 |
| REQ-215 | The repository shall ship only MyBookCMS product artifacts. Named Indonesia-only provider/runtime references, stale upstream operating procedures, and empty placeholders shall be removed; forward-only migration history and explicit `docs/lineage/` provenance shall remain intact. Malaysia's established hybrid language voice is product copy and is not a checkout mode or foreign artifact. | Verified locally 2026-09-01 |
| REQ-216 | Where an operator enables online payment, checkout shall create one DOKU Malaysia hosted Checkout session through `POST /v3/checkouts`; COD and manual transfer shall remain independently configurable fallbacks. Only Owner/Admin may enable or disable COD. When COD is disabled, every buyer-facing availability read shall omit it and every order-submission path shall refuse it before writing an order, item, stock reservation, or advertising event. senangPay's migrated DOKU platform shall use this same adapter and state model, not a parallel legacy senangPay integration. Direct Payment, Cards-only APIs, tokenisation, recurring billing, split settlement, payout, and BNPL are outside the first release. | Accepted; COD enforcement pending A-232; DOKU implementation verified locally 2026-09-01; sandbox remains A-221 |
| REQ-217 | Only owner/admin roles shall configure the DOKU environment, Client ID, API Key, encrypted Secret Key, and enabled channels. Secrets shall remain server-only, masked and non-revealable, bound to the DOKU provider context at rest, absent from logs and responses, and fail closed when incomplete, plaintext, or undecryptable. Sandbox and production credentials shall never be interchangeable. | Verified locally 2026-09-01; no production credential used |
| REQ-218 | When a buyer chooses DOKU, the system shall persist the authoritative order, stock reservation, and one payment attempt before calling DOKU; create Checkout from D1-owned MYR totals and normalized Malaysia customer data; use a unique bounded invoice/reference and idempotency identity; validate the provider response under REQ-219 and the narrow Checkout compatibility profile in REQ-227; and store only the provider identifiers, checkout URL, expiry, channel/status facts, and sanitized failure classification required to resume safely. | Verified locally 2026-09-02; A-221R passed sandbox transport re-smoke and broader sandbox lifecycle remains A-221 |
| REQ-219 | Every outbound DOKU Global request and every inbound Payment Notification shall use the documented HMAC-SHA256 Global signature over the exact raw body bytes, timestamp, client identity, and request target. Create/Retrieve Checkout responses shall verify the same signature whenever DOKU supplies it and otherwise may be accepted only under REQ-227. The system shall reject an invalid present signature, stale timestamp, mismatched target, wrong environment, non-MYR amount, or re-serialized digest before any payment or order transition. The Cards-only signature scheme shall not be accepted. | Verified locally 2026-09-02; response exception implemented by A-221R |
| REQ-220 | D1 shall own an append-auditable payment-attempt lifecycle linked to exactly one order. Provider reference, merchant invoice, and idempotency identity shall be unique; repeated create, return, notification, status retrieval, or scheduled reconciliation shall converge on one monotonic local result without duplicating an order, decrementing stock twice, or reviving a terminal payment. | Verified locally 2026-09-01 |
| REQ-221 | When a valid DOKU Payment Notification is received, the system shall acknowledge only after an idempotent local transition. `SUCCESS`/completed shall mark the online order paid once; failed or expired terminal outcomes shall release still-reserved stock once; unknown or contradictory states shall remain inspectable and shall not be coerced to paid. Browser redirects shall never constitute payment evidence. | Verified locally 2026-09-01 |
| REQ-222 | DOKU return, result, and cancel routes shall preserve the checkout-issued order capability, expose no customer or credential data, and resolve display state from the local payment record plus a strictly validated and correlated server-to-server status retrieval under REQ-219/REQ-227 when reconciliation is needed. A callback capability in the query string shall be validated server-side, exchanged for a bounded Secure HttpOnly SameSite cookie, and removed by redirect before any page shell, advertising tag, analytics code, referrer, DOM, or browser storage can observe it. The capability shall expire server-side 24 hours after the associated payment attempt is created, regardless of cookie renewal; expiry shall refuse status and retry access without calling DOKU. A buyer shall be able to retry an eligible failed/expired initiation inside that window without creating a second order or losing attribution; if the prior terminal attempt released stock, retry shall atomically revalidate and reserve the same order items or refuse when stock is no longer available. | Accepted; 24-hour capability expiry pending A-240; otherwise verified locally 2026-09-01; response profile amended by REQ-227 |
| REQ-223 | The canonical full checkout shall present COD, manual transfer, and only the DOKU channels enabled for that install; explain the redirect before leaving the store; preserve accessible loading, failure, cancel, pending, and recovery states; and render one consistent Malay checkout/confirmation hierarchy at 390 px and 1280 px. This work requires the repository's designer/vision handoff and depends on REQ-214. | Verified locally 2026-09-01; sandbox remains A-221 |
| REQ-224 | The operator shall be able to inspect redacted DOKU configuration health and payment attempts, reconcile a pending attempt, and distinguish configuration, authentication, signature, timeout, provider, and local-transition failures without seeing secrets or raw customer payloads. Scheduled reconciliation shall be bounded, idempotent, and limited to eligible non-terminal attempts. | Verified locally 2026-09-01 |
| REQ-225 | A DOKU order shall emit the existing canonical Meta/Google Purchase exactly once only after server-authoritative online payment success. COD/manual-transfer Purchase timing remains unchanged. All channels retain the same order transaction ID, canonical product identity, MYR merchandise value, click attribution, and browser/server deduplication contract. | Verified locally 2026-09-01; no live Ads request used |
| REQ-226 | Before a DOKU-enabled install accepts live traffic, its operator shall receive an exact webhook URL and sandbox-to-production checklist; the privacy/payment copy shall disclose DOKU processing in Malay and English where legally required; and release evidence shall cover signed notifications, duplicate delivery, pending reconciliation, success, failure, expiry, cancel/return, stock safety, Ads deduplication, and secret-redacted logs. | Verified locally 2026-09-02; A-221 sandbox evidence pending |
| REQ-227 | DOKU Checkout Create/Retrieve responses that omit `Signature` may be accepted only from the fixed HTTPS DOKU Checkout origin after strict transport-envelope validation: exact configured Client ID, exact requested API version, fresh canonical response timestamp, JSON media type, bounded body, absence of Cards-only `Request-Id`, and exact checkout ID, merchant invoice where present in the request, MYR amount, and D1-owned attempt correlation. A present signature remains mandatory to verify and an invalid or malformed signature shall never fall back to the unsigned profile. This exception shall not apply to requests, Payment Notifications, redirects, other DOKU API families, or arbitrary hosts; redirects remain non-authoritative and payment transitions require the existing D1 correlations and monotonic lifecycle. | Verified locally and against sandbox create/retrieve transport 2026-09-02 |
| REQ-228 | When an Owner or Admin manages Malaysia shipping policy, the admin shall present state/WP tariff overrides, zone/postcode coverage, and fallback weight bands as separate URL-addressable task panels. Switching panels or collapsing a zone shall not save, refetch, or discard a valid unsaved tariff draft; the existing D1 policy, role boundary, and immediate/explicit mutation semantics shall remain unchanged. | Verified locally 2026-09-04 |
| REQ-229 | An Owner or Admin shall be able to open one read-only `Log sistem` panel from the admin shell header and from the settings hub, at one URL-addressable admin route, listing the newest system events the runtime already persists — migration status, scheduled CAPI outbox outcomes, DOKU attempt and reconciliation events, operator notifications, and headless API audit events — in reverse chronological order with a stable label, severity, time, safe correlation id, and a link to the owning admin surface. The panel is `no-store`, bounded in count and age, never mutates state, and exposes no secret, token, password hash, click id, customer contact, address, request body, or provider payload. Customer Service and Advertiser roles have no access. | Verified locally 2026-09-04 |
| REQ-230 | Privileged admin mutations — store settings, payment configuration revisions, Ads credential changes, API key issue/revoke, operator role or password changes, and login lockouts — and scheduler-level failures shall be recorded as append-only, actor-attributed, redacted system events in D1 with bounded retention. A mutation and its event commit in one D1 batch; a scheduler failure is recorded best-effort and never fails the schedule. No API edits or deletes an event. | Proposal |
| REQ-231 | Repository documentation that claims verification against disk shall describe only routes, endpoints, tables, bindings, migrations, schedules, and role grants that exist in `src/` or `wrangler.jsonc` at the revision it names, and `docs/CODE-MAP.md` shall be held to that by an executable check. A contradiction between such a document and the code is a documentation defect, fixed at the document. | Verified locally 2026-09-04 |

## Admin access

Scope: everything between an operator opening the admin and reaching a working
dashboard — the login screen at `/hello`, the first-run credential, the forced
password rotation, and the session that carries them. Not the dashboard itself.
`LOGIN-*` is a separate id namespace and never overlaps `REQ-*`.

Malaysia localization must not change credential, session, or role behaviour;
the admin stays Indonesian (`id-ID`).

### Why this is specified

**A fresh install could not be opened.** The seeded credential accepted only a
password supplied through `BOOTSTRAP_ADMIN_PASSWORD`, which nothing sets on a
new Worker, so a brand-new install had an admin account no password could open.
Fixed 2026-08-16; `LOGIN-1` pins it.

**The login screen is the only unauthenticated admin surface**, so its failure
modes are security-relevant in a way the dashboard's are not.

### First-run access

| ID | Requirement | Status |
| --- | --- | --- |
| LOGIN-1 | A newly installed store shall be openable with the documented default credential `admin` / `admin` without any environment configuration. | Implemented |
| LOGIN-2 | Where `BOOTSTRAP_ADMIN_PASSWORD` is configured, it shall replace the default entirely rather than sit alongside it, and a value shorter than 16 characters shall be rejected outright rather than degrading to the default. | Implemented |
| LOGIN-3 | A session created from the default credential shall reach nothing except password rotation and logout — no order, customer, payment, provider key or setting. | Implemented — enforced in `src/middleware.ts`, not by convention |
| LOGIN-4 | The replacement password shall not be the default, the username, or shorter than 8 characters. | Implemented |
| LOGIN-5 | Once rotated, the default shall no longer open the account. | Implemented |
| LOGIN-6 | The login screen shall state, before the operator asks, that the default credential is `admin` / `admin` on a fresh install and must be replaced immediately. | Implemented — shown only while a database binding exists, no `BOOTSTRAP_ADMIN_PASSWORD` is configured, and the stored hash is still the seeded one. The copy is built from the same constants that open the account, so it cannot announce a credential that does not work |
| LOGIN-7 | The install shall make the un-rotated state visible wherever the operator looks, not only on the profile screen they are redirected to. | Implemented — middleware passes the state into the shell; a persistent security banner shows and navigation reduces to Profile plus Logout |

**On the risk.** A known default on a publicly reachable admin is a real
exposure, accepted deliberately. The mitigation is that it opens nothing:
`LOGIN-3` confines the session to changing its own password, so the window is an
operator inconvenience rather than a data exposure. On the normal path the
install wizard (`REQ-6` upstream, ADR-004) collects the operator's own password
and writes it with `must_change_password = 0`, so `LOGIN-1` is the fallback for
an install whose credential was never claimed, not the way in.

### The login screen

Route `/hello`, deliberately not `/admin/login`, and disallowed in `robots.txt`.

| ID | Requirement | Status |
| --- | --- | --- |
| LOGIN-10 | The screen shall render its own identity — store name and logo resolved at runtime — never a placeholder or another store's brand. | Implemented — resolved from `Astro.locals.tenant` per request; the product default is a neutral mark rather than a store's |
| LOGIN-11 | Username and password shall be a single form submitting in one action, with no multi-step reveal. | Implemented |
| LOGIN-12 | The password field shall offer a show/hide toggle reachable by keyboard and labelled for a screen reader. | Implemented |
| LOGIN-13 | A failed attempt shall say the credential is wrong without revealing which half was wrong, and shall not disclose whether the username exists. | Implemented — the message was generic but the **timing was not**: an unknown username returned immediately while a known one paid for PBKDF2. Every branch now performs one verification. Measured over HTTP: unknown 188/193/272 ms, known 194/198/193 ms |
| LOGIN-14 | An error shall be announced to assistive technology, not only rendered. | Implemented — `role="alert"` |
| LOGIN-15 | Every interactive target shall be at least 44x44 px and every input at least 16 px, so a mobile browser does not zoom on focus. | Implemented — Chromium touch-size validation at 320 and 390 CSS px |
| LOGIN-16 | The screen shall be usable at 320 px wide without horizontal scrolling and shall respect `env(safe-area-inset-*)`. | Implemented — measured document width equalled viewport at 320/390/768/1280 |
| LOGIN-17 | Submission shall be disabled while in flight and shall show that it is working, so a slow network does not produce a double submit. | Implemented — a `pageshow` handler resets the lock, which previously survived a back/forward-cache restore and locked the operator out |
| LOGIN-18 | The screen shall carry no marketing, no third-party assets, and no imagery that cannot be shipped to a merchant's own customers. | Implemented 2026-08-16 — **recorded as done before it was.** The vendor advertisement had been replaced with the reference store's brand mark, which every install would have worn; the stage is now colour only. A Google Fonts stylesheet and two preconnects for an unapplied family were announcing every operator's address to a third party; removed |
| LOGIN-19 | Repeated failures shall be rate-limited per identifier and per address, and no ceiling shall be reachable by someone who knows only the username. | Implemented — three buckets over a 15-minute window: `username\|ip` at 5 is the brake, the address at 20 absorbs mobile CGNAT, the identifier at 50 backstops a distributed attempt. Spent only on failure. The identifier ceiling was reachable and did lock operators out, so it now denies only an address that has itself failed for that account. Known ceiling: the KV counter is not atomic, so a parallel guesser is damped rather than braked |

### Session

| ID | Requirement | Status |
| --- | --- | --- |
| LOGIN-20 | The session shall be a signed token in an `HttpOnly`, `SameSite=Lax` cookie, never in storage a script can read. It shall carry `Secure` whenever the request is HTTPS and omit it only for an explicitly plain-HTTP local development request, where a browser would otherwise reject the session entirely. | Implemented — cookie security derives from `Astro.url.protocol`. `import.meta.env.PROD` is not evidence of request transport: `wrangler dev` serves a production build over HTTP, the exact shape that made Tailscale login loop back to `/hello` |
| LOGIN-21 | Rotating a credential shall invalidate every existing session for it. | Implemented — `admin_credentials.updated_at` is the revision |
| LOGIN-22 | A corrupt or foreign cookie shall degrade to "no session", never to an error page. | Implemented — 15 malformed shapes covered by test |
| LOGIN-23 | A session shall not outlive 24 hours regardless of the token's own claims. | Implemented |
| LOGIN-24 | After login the operator shall land on the default route for their role, and on the rotation screen when rotation is due. | Implemented |

`LOGIN-3`'s rotation gate was once *unreachable rather than wrong*: it is a
correct default-deny allowlist, but middleware classified paths from the raw
request URL, so `//admin/...` never reached the gate. Fixed 2026-08-17; the gate
itself needed no change. `ADR-023` records why classification must read Astro's
normalized `context.url`.

## Non-goals

- Cross-border delivery, tax calculation, real-time courier quotation, external
  dispatch, automated translation, or a public multi-language selector.
- A parallel legacy senangPay adapter, direct card handling, card tokenisation,
  subscriptions/recurring billing, split settlement, payout, BNPL, or storing
  PAN/CVV. The first online-payment release uses DOKU hosted Checkout only.
- Multi-tenant runtime routing or shared merchant data.
- A redesign of the inherited AdsBookCMS admin, PDP, checkout, or WhatsApp CRM
  interaction model.
- TikTok Ads, platform catalog API submission or approval automation, or Google
  Ads offline conversion upload.
- Single sign-on, OAuth, or an external identity provider.
- Two-factor authentication. Worth doing later; it is not what stands between
  this product and its first install.
- Self-service password reset by email. There is no mail transport, and an
  installable product should not require one to be reachable.
- A separate mobile login screen. One responsive screen, not two.

Acceptance evidence and dependencies are maintained in `TASKS.md`.
