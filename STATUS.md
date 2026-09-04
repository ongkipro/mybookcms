# MyBookCMS Status

> Verified against disk: 2026-09-04 @ MyBookCMS working tree

## Current state

The Malaysia cutover is locally integrated. Active buyer-facing money is MYR
integer sen; checkout exposes configured COD/manual transfer and hosted DOKU choices; D1 owns Malaysia postcode/weight
shipping; Pengiriman is manual; the storefront uses one controlled Malaysia
hybrid voice; and inherited external logistics, automatic payment, TikTok, and
Indonesian address runtime paths are removed. Configured Meta Pixel/CAPI and
Google GTM/Ads load directly for this Malaysia storefront. Accepted orders write
server Purchase into the same D1 batch, the thanks-page browser leg deduplicates
against it, and a one-minute schedule drains the outbox independently. Migration
`0057` restores the order-attribution column accidentally omitted by the Malaysia
table rebuild. One read-only Merchant-compatible catalog URL is shared by Google
and Meta.

No remote D1 migration or deployment has been performed for this install.
Therefore no hosted or production behaviour is claimed.

A-220 and A-221R are complete locally. The operator accepted the exact
Malay/English DOKU disclosure and the endpoint-specific response profile in
REQ-227/ADR-022. Every outbound DOKU request remains signed, every Payment
Notification remains exact-raw-byte signed, and a present response signature
must verify. Only fixed-origin Checkout create/retrieve responses may omit it;
those responses must instead pass exact client, API version, fresh timestamp,
JSON/body-bound, Cards-shape, checkout identity, invoice, MYR, and D1
correlation checks. Independent correctness and security reviews passed after
documentation stopped calling this non-HMAC path authenticated.

The redacted sandbox transport re-smoke returned `200` for signed fictional
FPX-only MYR 2.00 create and retrieve requests through the revised production
client. Both signature-absent responses matched the required envelope, ID, and
MYR facts, and create returned an allowlisted DOKU-hosted URL shape. No secret,
signature, provider identifier, full URL, or PII was recorded. A-221 remains
open because only FPX create/retrieve transport is proven: dashboard
channel/webhook setup, hosted browser payment states, notification/resend,
retry, stock, operator diagnostics, and Ads/browser evidence remain untested.
A bounded headless Chrome check reached only the hosted document shell and
rendered no payment controls; a longer attempt timed out, so it is not channel
or payment evidence. Production remains disabled.

REQ-228 and A-224 record the accepted next admin-workspace refinement only.
`/admin/expeditions` will separate state/WP tariffs, zone/postcode coverage,
and fallback weight bands into URL-addressable task panels with collapsible
zone detail and contextual Sheets. The existing shipping policy/API/auth
contract is unchanged until that queued R2 task is executed and browser-verified.

The completed A-205 signal slice preserves a paid click across later
UTM-only visits, replaces it on a new paid click, gives Meta browser/CAPI one
random first-party visitor identity, initializes regional Google Consent Mode
before tag configuration, and attaches Malaysia-normalized enhanced-conversion
matching to the existing direct Google Purchase. It deliberately does not add
Google offline uploads or change the accepted-order Purchase taxonomy.

The repository-purity pass removed a stale AdsBookCMS install procedure and an
unneeded public-directory placeholder. Active source now has a regression guard
against named retired Indonesia providers. Forward-only migrations and
`docs/lineage/` remain because they are schema history and explicit provenance,
not executable product contamination. The TypeScript task-queue diagnostic was
also fixed without weakening its assertions.

REQ-214 is now runtime truth. PDP, CMS landing, direct, embed, public form
configuration, Headless product, and OpenAPI surfaces expose one mode-less full
Malaysia checkout. Operator mode selectors and stored defaults are gone;
legacy stored or query-string mode values are inert. Six retired public routes
perform one query-preserving `308` to `/full-form`, and the retired middle
submission API is a `410 no-store` tombstone with no persistence path.
Headless v1 retains the non-retired `urls.product`, canonical
`urls.form_render`, and `forms.full_url` aliases for existing consumers while
removing only the independently executable middle/hybrid identities.

REQ-216 through REQ-226 and ADR-021 define the accepted DOKU Malaysia roadmap.
A-210 through A-219 are now implemented and verified locally: migration `0059`
adds encrypted configuration, order-linked attempts, and append-only events;
the Global transport verifies signed raw bytes; the disabled configuration API
stores provider-bound ciphertext; authoritative checkout creation is
idempotent; and the public notification route applies one monotonic payment,
order, and stock transition before `204`. Capability-protected result, return,
cancel, status, and same-order retry paths now remove the recovery capability
before rendering and reuse that lifecycle without trusting redirect data. A
bounded capability remains valid for the order's newest attempt, while an
expired active checkout is reconciled with strictly validated provider truth before reuse
or replacement. The one-minute Worker schedule now leases a bounded due set,
verifies provider status through the same lifecycle, backs off without overlap,
and restores stock once for abandoned uninitiated attempts. Order Detail exposes
redacted attempt/event diagnostics; Owner/Admin receives a confirmed manual
check while Customer Service remains read-only, and generic DOKU status edits
are refused. The canonical full buyer form now adds one hosted DOKU choice only
for a healthy enabled configuration, lists only its enabled Malaysia channels,
collects the required email with redirect disclosure, and reuses one stable
submit identity across safe retry. The top-level navigation boundary accepts
only credential-free HTTPS `doku.com` hosts, including the embed widget; no
provider URL enters DOM/storage/analytics. Signed DOKU success now queues one canonical Meta server Purchase
inside the payment transition, and the real DOKU result callback emits the
same browser event ID plus one direct Google Purchase only after `paid`.
Persisted `_fbp`, `_fbc`, and random first-party Meta identity are validated
before reuse; result-page tracking is browser-only, so its recovery cookie is
never forwarded to the same-origin CAPI endpoint. This buyer path is exposed
only when an operator enables a healthy configuration; that locally verified
behavior is not evidence of sandbox or production readiness. Owner/Admin can
now save a complete encrypted DOKU draft, select only
the five supported Malaysia channels, activate/deactivate an eligible revision,
replace or delete it without reveal, and copy the canonical HTTPS notification
URL. Replacement/deletion is revision-bound and atomically refused while a
current-revision payment remains nonterminal; invalid ciphertext still exposes
safe replacement/deletion recovery while activation fails closed. DOKU buyer
integration and A-220 legal/release controls are complete locally, but A-221
sandbox evidence remains open, so no live availability is claimed. Official senangPay guidance routes
migrated merchants to this one DOKU adapter, not a second legacy integration.
Before A-221 approval, no credential or vendor endpoint had been used. The
approved A-221 attempt injected managed credentials without revealing their
values and sent fictional data only; it created no checkout, order, payment,
webhook, D1 mutation, remote migration, deployment, or production change.
A-222/A-223 continue to make production activation and observation explicit
post-sandbox approval gates rather than an implied continuation.

Repository documentation is now self-checking where it can be. `docs/CODE-MAP.md`
is the navigation index, and `src/lib/code-map.test.ts` fails when it drifts from
`src/`: routes, file paths, endpoint methods, and the live-table set are all
derived from disk rather than trusted. All thirteen dated documents were
re-verified on 2026-09-04 and five contradictions corrected; three of them were
variations of the same stale claim that checkout is COD and manual transfer only.

That pass left three open code findings, none of them fixed under a
documentation task. `GET /api/v1/storefront` returns a hard-coded payment set,
so a headless storefront is never told an enabled DOKU exists and the shipped
SDK type cannot express it (A-231). `stores.is_cod_enabled` is read only by
`GET /api/payment-methods` and enforced on no submission path, which is latent
only because no admin surface can currently write it (A-232). ADR-013 through
ADR-020 are cited by `PRD.md`, `wrangler.jsonc`, migration `0044`, and a
navigation test, but were never recorded in this repository. A-233 has since
closed that: three of those decisions are still in force and are now written as
this product's own ADR-023, ADR-024 and ADR-025, under new numbers so
`BUILD-LOG.md`'s historical citations keep resolving to the upstream decisions
they were written about. A fourth citation was dropped because the requirement
row already stated its reason. `src/lib/decision-records.test.ts` fails on any
ADR id cited as authority that `DECISIONS.md` does not define.

Owner and admin now have one read-only `Log sistem` panel at
`/admin/settings/log`, reachable from the shell header, the settings hub, and
the settings submenu. It merges schema state, Meta CAPI outbox outcomes, DOKU
payment transitions, operator notifications, and headless API audit rows that
D1 already holds, bounded to 200 events within 30 days. It adds no table and
writes nothing. Advertiser and customer service receive `403` and see no entry
point. Redaction is structural: labels are composed from typed columns and
stored prose is never selected, which is what keeps `notifications.body` — the
one column that carries a customer's name — out of the response.

The hosted and headless payment reads now share one resolver, so an install
cannot advertise different payment methods on its two surfaces. Enabling DOKU
moves both together; disabling COD moves both together; neither response
carries a credential, environment, or configuration revision. That closes
A-231. It also confirmed A-232 rather than resolving it: with
`stores.is_cod_enabled = 0` both reads correctly reported COD unavailable while
`POST /api/submit-order` still accepted and persisted a COD order. The toggle is
presentation-only end to end, latent in shipped installs only because no admin
surface writes the column. Whether to enforce it or remove it is the user's
call and remains open.

The Malaysia shipping workspace is now three URL-addressable jobs rather than
one long document, and the defect that restructure exposed is fixed: an unsaved
tariff used to be discarded whenever any other row was saved, because every
mutation reloads the dataset and the reload rebuilt every draft. Drafts now
survive a mutation and a panel change, postcode and fallback editing happen in
sheets that refuse to close over unsaved input and keep values through a server
refusal, and focus returns to the control that opened each sheet. That last one
had to be implemented rather than inherited; the Radix restore was measured
landing on `<body>`. A separate finding, filed as A-234, is that the shared
admin switch has a 33 px effective touch target against a 44 px design-system
floor, which predates this work and affects every admin workspace.

**Current verified revision: `33a29c7`.** At that commit the migration chain
applies to an empty database and yields 25 live tables and 60 applied
migrations; `npm run check` reports zero errors, warnings and hints across 361
files; `npm test` passes 447 of 447; `npm run build` completes. Browser evidence
at 390 px and 1280 px covers every surface edited since the previous recorded
run, with zero page overflow and a clean console. Two independent reviews were
taken: the first returned FAIL on three medium findings, all real; after
remediation the second returned PASS. Only the record of that verification sits
after `33a29c7`, and it changes no code.

This remains local evidence. No remote migration, deployment, or provider
traffic is claimed by it.

## Verified local evidence

- The clean isolated D1 chain is at schema version 60 with 2,931 official Malaysia postcode rows,
  four active zones/ranges, complete directory coverage including Kalabakan
  `91400`, 16 active state/WP first-kilogram reference rates, five contiguous
  fallback bands in each zone, and the restored `orders.ad_click_ids` column.
  Obsolete Indonesia provider tables are absent; the new DOKU configuration,
  payment-attempt, and payment-event tables contain no plaintext-secret or raw-
  payload column.
- Preview data contains three fictional products with one published hybrid
  Malaysia presentation, one fictional Maybank account, editable reference
  rates, two COD orders, and one manual-transfer order.
- Runtime search resolves city, state, or exact postcode from local D1. Quotes
  prefer a matching state/WP rule and otherwise use the matching zone weight
  band. Reference rates for 1–5 kg are RM8/9/10/11/12 in Peninsular Malaysia
  and RM15/26/39/48/60 in Sabah, Sarawak, and Labuan.
- Dashboard data contains three active orders worth RM94.70; unfiltered order
  listing returns `200` and uses MYR metadata.
- `npm test`: 410 tests, 410 passed, 0 failed, 0 skipped after the A-220
  cross-document local/sandbox/production guard.
- `npm run check`: 350 files, 0 errors, 0 warnings, 0 hints after A-220.
- `npm run build`: Cloudflare server build completed.
- Real local Chromium at 390 and 1280 px rendered the accepted bilingual DOKU
  privacy link after its email helper and before redirect disclosure. Keyboard
  Tab focus produced a visible 3 px outline, the target measured 44 px, and the
  Malay anchor opened in a new tab immediately before the English section while
  preserving all entered checkout values. COD hid the block; the real embed
  route repeated the contract; root overflow, console errors, and failed
  requests were zero. Payment methods were intercepted locally; no DOKU vendor
  request or credential was used.
- Real Chromium at 390 and 1280 px completed the canonical full checkout through
  location selection, shipping quotation, payment selection, and `/thanks` with
  zero overflow or runtime errors. Keyboard focus remained visible on the
  visually hidden variant control. Built-Worker requests proved all six legacy
  routes preserve attribution and duplicate query keys through one `308`, the
  embed ignores legacy mode, and the retired submit API returns `410 no-store`.
- Real Chromium at 390 and 1280 px exercised the configured DOKU checkout with
  mocked provider responses: one hosted choice, enabled-channel labels,
  conditional email/disclosure, keyboard-focusable radios, disabled/busy
  controls during submission, one stable-token request, one InitiateCheckout,
  safe top-level navigation, no DOKU thanks state, and zero PAN/CVV, overflow,
  or runtime errors. A 390 px refusal/timeout retry retained the same token and
  email payload, kept the advertising initiation single, focused the Malay
  alert, and announced retry loading. The real disabled configuration omitted
  DOKU without suppressing COD/manual transfer; no vendor endpoint was called.
- Real HTTPS Chromium exercised the actual DOKU result capability exchange at
  390 px and its clean-URL reload at 1280 px. Authoritative paid state emitted
  exactly one `purchase:{order_number}` Meta browser event and one Google
  conversion using the D1 merchandise subtotal; reload emitted none. Root
  overflow was zero, no runtime error occurred, the HttpOnly recovery
  capability was absent from the clean URL, DOM, script-visible cookies, and
  browser storage. Injected browser test sinks captured the intended Meta and
  Google calls; no same-origin CAPI request or live Ads vendor request occurred.
- Authenticated built-Worker Chromium at 390 and 1280 px rendered the DOKU
  operations card with ready config, redacted history, explicit automatic/manual
  freshness, an overdue marker, and a confirmed Owner action. Controls were 44
  px, root overflow was zero, the console was empty, and DOM/network inspection
  found no secret, capability, checkout URL, advertising identity, or vendor call.
- Authenticated HTTPS Chromium exercised the Payments workspace from an empty
  DOKU state through sandbox draft/activation and production replacement/
  confirmation using local fixture credentials. The canonical webhook URL was
  exact; only masked values survived; inputs cleared after save; validation
  moved focus to its error summary; COD/manual management remained present;
  browser storage, vendor requests, console errors, and overflow stayed empty at
  390 and 1280 px.
- Public locale code, cookies, query overrides, Headless locale parameters, and
  admin language selectors are absent. The storefront document language is
  fixed to `ms-MY`; dormant bilingual columns from migration `0051` are not read
  or written by active content paths.
- Order Management uses the AdsBookCMS table pattern rather than a card grid,
  while retaining MYR, queue membership, status markers, and WhatsApp CRM.
- Meta CAPI configuration distinguishes encrypted D1, environment-managed,
  empty, and invalid token states without revealing secrets. CAPI delivery uses
  a bearer header, bounded timeout, sanitized terminal/retry classification,
  D1-authoritative product/order data, persisted `_fbp`/`_fbc`, an atomic
  delivery lease, and bounded delivered/failed outbox retention.
- Authenticated read-only Chromium QA exercised all four Meta token sources.
  Desktop retained equal 440.5 px Pixel/token columns; 390 px mobile retained
  one 335 px column; primary controls were at least 44 px; overview invalid and
  environment states were accurate; and both widths had zero root overflow.
  Interception recorded zero mutation requests and zero Meta/Google vendor
  requests.
- The inherited operator workflow is restored: desktop order table, mobile
  cards, bulk actions, direct WhatsApp contact, ten staged CRM actions, editable
  order detail, and manual shipping remain available without provider controls.
- Invoice detail preserves the AdsBookCMS workflow with customer/street editing,
  trusted Malaysia location search, server-side order-weight re-quote, editable
  MYR shipping cost, independent payment/status saves, one consistent total,
  direct WhatsApp contact, and ten staged CRM links.
- Order Management has a separate local `shipping_queued_at` decision. Row/card
  Aksi and the bulk action set or clear only that timestamp for any order. No
  payment, address, status, or legacy-evidence rule blocks entry or exit; a
  progressed row disappears immediately when released. There is no inline queue
  switch, and `shipping_status` remains unchanged.
- The Indonesian Order Management status column and quick filters use one
  operational taxonomy: Baru, Menunggu, Masuk Pengiriman, Dalam Pengiriman,
  Selesai, Dikembalikan, and Dibatalkan. Precedence is derived consistently from
  payment, queue, and stored shipping state; persisted lifecycle changes remain
  explicit actions rather than pretending the derived labels are database enums.
- Pengiriman lists current queue members only. Its desktop table/mobile cards
  edit the independent status marker, trusted Malaysia address, and MYR shipping
  cost; release removes the row without changing its marker. The server exports
  the complete current filter as an 18-column UTF-8 formula-safe CSV containing
  address/cost/status but no courier, service, or tracking evidence.
- Public PDP/checkout again uses the AdsBookCMS form hierarchy and component
  states. `middle` is the short CS-confirmation form; `full` and `hybrid` keep
  the complete Malaysia location, quote, payment, summary, and submission flow.
- Checkout readiness now fails closed across receiver name, normalized Malaysia
  WhatsApp, meaningful street address, selected D1 location, fresh
  location/variant quote, and active COD/manual-transfer selection. AdsBookCMS
  inline feedback appears after field interaction, while the action stays grey
  with a progressive missing-step label until the active mode is complete.
- Executable Chromium at 390 px and 1280 px proved empty/short field feedback,
  character and phone normalization, progressive disabled labels, fresh quote
  gating, a ready action, 16 px inputs, a 44 px action, zero horizontal
  overflow, and zero browser errors.
- Executable Chromium evidence covers the destination field's loading, empty,
  failed/retry, result, keyboard-active, selected, and change/refocus states.
  The field keeps the inherited AdsBookCMS 16 px input and compact result/card
  typography; Johor resolved RM8.00 with zero overflow at 390 px and 1280 px.
- Authenticated Chromium confirmed Johor RM8.00, Sabah RM15.00, Peninsular 2 kg
  RM9.00, and East Malaysia 2 kg RM26.00 in `/admin/expeditions`, with zero
  desktop/mobile overflow and no unexpected browser errors. Superseded inactive
  RM6.50/RM13.00 reference artifacts remain in D1 for history but are omitted
  from the current rate editor.
- The first 55 migrations remain proven against a clean isolated D1, and the
  working isolated D1 advanced successfully through migration `0055` to schema
  56. Migration
  `0053` deactivates only untouched legacy reference rows; existing order
  snapshots remain attached to their original rule and amount until an explicit
  authenticated order edit. Migration `0054` permits only that deliberate
  destination/amount re-quote path; no remote database was touched.
- Migration `0055` restores only Meta/Google configuration columns and creates
  the deduplicated CAPI outbox. The local row remains unconfigured, so browser
  pages render no vendor script and browser verification sends no vendor event.
- Ads navigation follows the AdsBookCMS overview/Meta/Google hierarchy and is
  authorized for owner, admin, and advertiser roles. CAPI tokens are encrypted
  before D1 persistence and returned only as masked/configured state. The
  capability-verified thanks page triggers Purchase for COD and manual transfer
  without waiting for an admin status; Google offline upload remains explicitly
  unimplemented.
- The Ads overview and Google engine retain the AdsBookCMS channel cards, four
  KPI cards, horizontal accessible tabs, configuration card, five-step tutorial,
  compact catalog table, and payload inspector. Malaysia/MYR facts replace
  Indonesia facts; unsupported Enhanced Conversion and inferred GPC claims are
  absent.
- PDP, CMS landing pages, and the native landing template emit ViewContent
  through the shared tracking loader with the same canonical variant identity
  as the feed and checkout. The shared order response supplies the accepted
  `content_id` and `product_value_sen` to thanks instead of deriving value from
  payable total minus shipping.
- The no-store/noindex thanks page restores the complete 480 px confirmation
  hierarchy: store identity, success state, product/variant, separate product
  and shipping rows, payable total, Malaysia destination, status steps,
  COD/manual-transfer instructions, WhatsApp, and order-status actions. A
  recoverable empty state replaces the former immediate redirect. Once the
  persisted order and checkout-issued status token are verified, the page emits
  one deduplicated Purchase using the order number and merchandise subtotal.
- Headless Chromium on the current build exercised pending COD at 390 px and
  pending manual transfer at 1280 px. Each first load emitted one MYR 32.90
  Purchase with the confirmed order number, each reload emitted none, both pages
  had zero root overflow, and neither produced a runtime exception.
- `/feed/google-catalog.xml` is the single public RSS 2.0 variant feed for both
  Google Merchant Center and Meta Commerce Manager, generated only from active,
  in-stock, published catalog content. It uses canonical
  `p{productId}-v{variantId}` IDs, `?variant_id=` product links, `NN.NN MYR`
  prices, and real variant grouping. Both channel pages expose the exact same
  URL; the Google admin page reads local feed diagnostics only. The CMS stores
  no platform catalog credentials and claims no external fetch, shipping,
  approval, or product status.
- Meta configuration now uses the installed shadcn Card, Input, Button, and
  Skeleton components without a hydrated island. Pixel/token fields align in
  two desktop columns and one mobile column; Test Event owns its subsection;
  masked, draft, and deletion token states remain explicit without returning a
  stored token to the browser. Desktop/mobile browser evidence found 44 px
  controls, logical keyboard order, zero overflow, and no failed request.
- Authenticated Chromium evidence shows the restored desktop order table with
  three rows and ten staged WhatsApp links, order detail with direct chat plus
  ten staged links, one non-sticky save action, zero provider copy, and zero
  root overflow. Public hybrid/full and middle modes have zero console errors,
  runtime exceptions, failed requests, provider copy, or root overflow.
- Focused invoice Chromium evidence confirms a focus-managed customer/address
  dialog, live Kuching location results from local D1, and no courier/tracking
  evidence controls. A controlled dummy mutation changed address, destination,
  ongkir RM6.50→RM9.50, and total RM31.40→RM34.40 together, then restored every
  original value.
- Authenticated Chromium proved progressed dummy `INV-10003` leaving Pengiriman,
  changing status while outside the queue, and re-entering without a marker
  mutation. The queued-only API changed one→zero→one, final status and membership
  were restored, and the 18-column CSV excluded courier/service/tracking fields.
  Desktop 1280 px and mobile 390 px had zero root overflow; mobile Perbarui,
  Keluarkan, and Aksi targets measured 44 px.
- Authenticated Chromium at 1280 px and 390 px proved the eight-column desktop
  contract, matching mobile status card, absence of the queue switch and `Masuk
  antrean` copy, independent queue exit/re-entry under Aksi, preserved WhatsApp CRM,
  a 44 px mobile action target, zero root overflow, and zero browser errors.
- Authenticated Chromium opened Ads overview, Meta, and Google pages at 1280 px
  and 390 px. It proved keyboard tab movement, password visibility state,
  strict API rejection for an invalid Google ID, 44 px mobile save control,
  empty safe configuration, and zero horizontal overflow or visible errors.

## Repository-wide analysis — 2026-08-25

### Scope and verified health

- The executable tree includes 58 forward-only migrations and 66 Node test
  files. The runtime surface remains Astro 7 SSR on Cloudflare Workers.
- The runtime boundary is coherent: Astro 7 SSR on Cloudflare Workers, D1 as
  commerce authority, KV for sessions and bounded counters, R2 for merchant
  media, one Malaysia store per install, MYR integer sen, and no external
  payment or logistics dependency.
- `npm test` passed 308 of 309 tests with one intentional skip. Isolated
  workerd-backed D1 tests apply all 58 migrations and prove both the Malaysia
  shipping policy and order duplicate/oversell/terminal/delete invariants.
- `npm run check` reported 307 files with zero errors, warnings, or hints and
  verifies `worker-configuration.d.ts` has no Wrangler configuration drift.
  `npm run build` completed the Cloudflare server bundle.
- The existing local D1 advanced to schema 58. Migration `0057` restores
  `orders.ad_click_ids` without rewriting existing orders.
- `npm audit` reported zero known advisories across the complete lockfile and
  the production-only graph.
- `wrangler deploy --dry-run` accepted the redirected Astro deployment config.
  A prior real local scheduled invocation returned
  `{ outcome: "ok", noRetry: false }`.
- Real Chromium at 390 px proved no cookie notification or privacy-preference
  control renders, configured tags initialize immediately, `fbclid` persists
  into bounded `_fbc` and HttpOnly attribution cookies, and the page has zero
  horizontal overflow.
- The same product-page run emitted PageView plus canonical
  `p10001-v10001` / MYR 24.90 ViewContent immediately. Vendor traffic was
  intercepted deliberately; no production Meta/Google endpoint was exercised.
- An unauthenticated `/admin/dashboard` request still redirects to `/hello`.

### Open prioritized findings

| Priority | Finding | Evidence and impact | Closure evidence |
| --- | --- | --- | --- |
| P1 — release evidence | The hardened revision is local and uncommitted. | Hosted CI has not observed this working tree, and no production migration/deployment occurred. | Commit/push only on operator request, observe CI on the exact revision, then apply migrations `0056` and `0057` and smoke one approved install under the production gate. |
| P1 — live advertising evidence | Local signal contracts are complete but the local store remains unconfigured for live Pixel/token delivery. | Browser QA intercepted vendor traffic deliberately, so Meta Test Events, live browser/CAPI deduplication, Event Match Quality, token validity, and Events Manager diagnostics remain external evidence. | Configure one approved install and verify PageView/ViewContent/Purchase plus dedup and match keys in Meta Test Events. |

### Locally closed findings

- Real workerd-backed D1 coverage now proves duplicate submission, oversell
  rollback, terminal stock restoration, and delete restoration exactly once.
  It exposed and closed two checkout-blocking defects: migration `0049` had
  omitted `orders.ad_click_ids`, and `persistOrder` supplied one excess SQL
  placeholder.
- `/api/admin/media` is the sole authenticated upload boundary. Both callers
  share a streamed request cap, 2 MB file cap, magic-byte verification,
  generated R2 keys, derivative scoping, and one KV hourly policy; the weaker
  endpoint and obsolete helper were removed.
- CI grants only `contents: read`; checkout/setup-node are pinned to reviewed
  full commit SHAs. Wrangler-generated binding types are committed and
  `npm run check` fails on drift. The Worker entrypoint no longer uses the
  adapter double cast.
- Expected catalog/install/content/template/tenant/audit failure logs are
  captured and asserted by their owning tests. Unexpected `console.error`
  remains visible; the green full-suite output contains no production-style
  stack traces.

No confirmed unauthenticated admin bypass, attacker-controlled SQL
interpolation sink, or known dependency advisory was found. That statement is
bounded to inspected trust boundaries, the local Worker/D1 runtime, and the
commands above; it is not a production penetration-test claim.

## Open delivery evidence

- Remote migration, hosted CI, deployment, and production smoke checks require
  separate approval and have not been performed.

`TASKS.md` is the canonical execution queue. `BUILD-LOG.md` is historical
evidence, not a statement of current behaviour.
