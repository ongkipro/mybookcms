# MyBookCMS Product Requirements

> Verified against disk: 2026-08-31 @ MyBookCMS working tree
>
> The single requirements source for this product. `TASKS.md` is the single
> execution queue and holds acceptance evidence. Inherited AdsBookCMS
> requirements (`REQ-1`-`REQ-172`) are **not** part of this product; tasks that
> cite them are quarantined in `docs/lineage/inherited-tasks.md`.

## Goal

Provide a single-store direct-commerce system for Malaysia that a merchant can
operate without external courier or payment service dependencies.

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

**Payment.** COD and manual bank transfer only. Manual transfer presents one
active seller bank account and requires operator confirmation before an order
is paid. No automatic settlement exists.

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
| REQ-176 | Checkout offers only COD and manual bank transfer; no automatic payment settlement is performed. | Implemented locally |
| REQ-177 | A clean migration chain provisions the active canonical Malaysia zones, complete official postcode coverage, 16 state/WP first-kilogram rules, and five broad fallback weight bands per zone. A valid five-digit postcode and cart weight resolve one active D1-owned zone/rate rule, including explicit Labuan and Kalabakan policy; the accepted quote is snapshotted with the order. | Verified locally |
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
| REQ-205 | The weight ceiling shall also be surfaced before the final checkout step, not only at refusal. | Proposal |
| REQ-206 | The seller bank list shall cover the retail banks a Malaysian merchant is likely to collect a manual transfer into. | Implemented locally |
| REQ-207 | A buyer-facing surface shall not mix Indonesian into Malay copy. One rendered component carrying both languages is a defect regardless of whether each word is individually understood. | Implemented locally |
| REQ-208 | A legal page the product cites in its own copy shall be reachable from the storefront, not only from `sitemap.xml`. | Implemented locally |
| REQ-210 | The repository shall contain no host or network address belonging to one developer's machine. Seeds, fixtures and docs use documentation addresses. | Implemented locally |
| REQ-209 | An authorized operator can record the merchant's own pickup address — contact name, Malaysian mobile, street address, and postcode — validated by the same rules the buyer's address uses. It is stored complete or not at all, and its city and state are resolved from the postcode directory rather than stored, so they cannot disagree with the postcode. This is operator reference data: nothing is transmitted to any logistics provider. | Implemented locally |

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
| LOGIN-19 | Repeated failures shall be rate-limited per identifier and per address, and no ceiling shall be reachable by someone who knows only the username. | Implemented — three buckets over a 15-minute window: `username\|ip` at 5 is the brake, the address at 20 absorbs mobile CGNAT, the identifier at 50 backstops a distributed attempt. Spent only on failure. The identifier ceiling was reachable and did lock operators out, so it now denies only an address that has itself failed for that account (ADR-014). Known ceiling: the KV counter is not atomic, so a parallel guesser is damped rather than braked |

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
request URL, so `//admin/...` never reached the gate. Fixed 2026-08-17
(ADR-013); the gate itself needed no change.

## Non-goals

- Cross-border delivery, tax calculation, real-time provider quotation, external
  dispatch, automatic payment settlement, automated translation, or a public
  multi-language selector.
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
