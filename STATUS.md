# MyBookCMS Status

> Status reviewed against disk: 2026-09-08 @ MyBookCMS working tree. Executable
> evidence remains dated and revision-bound where recorded below.

## Current state

A-263 applies the owner-approved fixed advertising rate, 1 MYR = 4,100 IDR,
to Meta Pixel/CAPI, direct Google Ads and GTM ecommerce values. Conversion occurs
once at outbound boundaries; internal event inputs, persisted commerce money,
checkout/payment amounts and XML remain MYR. Existing catalog/event IDs and
Purchase timing are unchanged. Previously prepared outbox payloads retain their
original currency on retry. This local implementation does not establish
provider receipt or resolve the reported ROAS symptom by itself.


A-253 refines the complete landing builder with mobile Konten/Pengaturan
navigation, a compact action header, collapsible add palette and outline,
type-specific icons, and clear active-section/save states. Existing inputs remain
mounted across view changes. Deletion restores focus to a neighboring editor or
the reopened add palette. No dependency or API change was introduced.


A-252 presents one shared checkout with product, contact, delivery, payment, and
summary sections. Payment methods load/reveal only after a directory-selected
location has a successful current shipping quote. Changing location or variant
hides/disables payment and conditional email while preserving prior values.
Shipping errors expose retry without calling a subtotal the final amount; payment
load failure can be retried independently. Existing DOKU channels, disclosures,
uncertain-submit recovery, and server price/stock/order authority remain intact.
The browser fixture covers full-form/PDP/embed and five mocked public DOKU
channel options without contacting a payment provider. Designer accepted mobile
and desktop screenshots; verification is recorded by the active delivery run.


A-251D makes image-only landing sections fill the content column with no
padding, margin, or rounded corners. Consecutive images meet seamlessly while
retaining their natural aspect ratios and responsive widths.

A-251C removes the four inline checkout privacy paragraphs at the owner's explicit request. The shared form now starts recipient inputs directly below
its heading. The separate privacy page and checkout behavior are unchanged.

A-251 / REQ-234 completes `/admin/landing-pages/new` and CMS editing with seven
section types: headline, paragraph, numbered list, bullet list, image, HTML,
and full Malaysia checkout. Existing shadcn controls provide section navigation,
reorder/duplicate/delete, draft/publication, SEO, upload, local/saved preview,
and recoverable loading/saving errors. Successful saves hydrate authoritative
server content; concurrent deletion returns 404 and preserves the editor draft.
Draft previews require current Owner/Admin/Advertiser sessions.

Migration `0063_landing_content.sql` (schema version 64) preserves legacy rows.
Typed content and checkout variant ownership are validated before writes.
No new dependency or provider/payment/stock policy is introduced. The isolated
browser regression covers 390/1280 px, all seven section round trips, upload and
save/load failures, normalized save state, deleted-page retention, product/variant
reset, saved reordering, preview access, and public custom checkout copy. Its
loaded JavaScript is 155,001 bytes gzip including shared shell and public fixture;
this is a local transfer budget, not a Core Web Vitals measurement. Designer
accepted the settings/canvas/public layout; the fixture's blocked external logo
is outside the canvas result. See `docs/LANDING-PAGES.md` for authoring rules.


A-250U polishes the recovery workspace with existing shadcn primitives: labeled
filters/reset, initial skeletons, retained rows on refresh failure, customer-first
rows, 44 px actions, wrapping product summaries, and distinct quote-error states.
Only text search waits 250 ms; initial load, status/page changes, and refresh
start immediately. No dependency, API, schema, or permission was added.
The local UI regression is `node --experimental-strip-types scripts/verify-checkout-recovery-ui.mts`
after build, using an existing local Chrome CDP endpoint and fictional D1/KV.
It checks mobile/desktop error/recovery/conversion and a 180,000-byte gzip budget
for all loaded JavaScript (shared shell included), not a field performance score.

A-250N exposes **Pesanan tertinggal** beneath Orders in the shared desktop,
mobile, and search navigation for Owner/Admin/CS. Advertiser remains excluded.

A-250 adds a separate CRM `{{variant_name}}` token and a locally verified
checkout recovery workspace at `/admin/orders/abandoned`. Valid partial full
checkouts become leads without stock reservation, payment attempts, order
revenue, or Purchase events. Owner/Admin/CS can explicitly record follow-up
and convert a lead into one COD order using the existing trusted location,
quote, price, and stock rules. Buyer completion removes its lead from the
pending queue atomically. CS conversion currently supports one item and COD.
The local migration is `0062_checkout_leads.sql` (schema version 63).

Verification on 2026-09-08: 512/512 repository tests, check, build, and isolated
built-Worker Chromium flows at 390/1280 px passed. Browser evidence covers
partial capture, follow-up, conversion, buyer completion, CRM substitution,
COD-disabled state, failed submission capture, and keyboard location selection.
No remote migration, deployment, provider proof, commit, or push is claimed
for this change.

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
Therefore no deployed storefront or production behaviour is claimed.

Hosted CI is separately verified: A-204 passed GitHub check/test/build on
`b093cb82ba14124288e445e7fab112b4fdf5ec49` on 2026-09-08; see the exact run below.

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

Revalidated on 2026-09-07 at `5bc1d4a`: 59/59 focused DOKU tests pass and a
fresh, fictional FPX-only MYR 2.00 sandbox create/retrieve pair again returned
`200` through the accepted REQ-227 envelope, with an allowlisted hosted URL and
no response `Signature`. A bounded hosted-browser run yielded no attributable
payment-control evidence. The then-active local D1 had no DOKU configuration
row, the dev origin was Tailscale HTTP rather than public HTTPS, and no DOKU
Dashboard session was available to activate a Checkout channel or register the
Notification URL.

The operator then approved a local sandbox installation. Managed credentials
are encrypted in local D1, and a guarded no-active-attempt update advanced the
configuration from FPX-only revision 1 to revision 2 with FPX, Touch 'n Go
eWallet, GrabPay, ShopeePay, and credit/debit cards selectable. The separate
managed-secret Worker on port 8787 reports a ready sandbox configuration; its
public payment-method contract and real product form expose all five DOKU
labels beside COD/manual transfer. At 390 px the form also resolved `50450` to
Kuala Lumpur without overflow, runtime exception, or failed request.

The official current Malaysia Postman artifact separates Hosted Checkout
`/v3/checkouts`, which MyBookCMS uses, from channel-specific Direct Payment
`/v3/payments`: the hosted sample does not require `device_info`, while the
direct samples include it. MyBookCMS therefore keeps payment credentials on the
DOKU-hosted redirect and does not collect PAN, OTP, or wallet credentials. No
secret value entered source, output, or documentation. This remains local
configuration/selectability evidence rather than a sandbox lifecycle PASS:
merchant-service activation in DOKU Dashboard is unverified, HTTP callback
origins fail closed, DOKU cannot notify localhost or the VPN-gated Tailscale
URL, and Dashboard channel/Notification URL setup is unavailable. No order,
attempt, payment, callback, webhook, stock transition, Ads event, remote
mutation, deployment, or production action was created. A-221 therefore
remains open on the public-HTTPS, Dashboard, hosted-browser, and end-to-end
lifecycle gates.

A-242 now implements the accepted channel-first Hosted Checkout refinement.
The canonical full form flattens the server-advertised DOKU children into direct
FPX, Touch 'n Go eWallet, GrabPay, ShopeePay, and credit/debit-card radios; it no
longer renders a generic DOKU parent choice and still collects no PAN, CVV, OTP,
or wallet credential. `doku_channel` is conditionally required by the shared
order schema and Headless/OpenAPI contract. Checkout rejects an unknown or
disabled channel before order/stock persistence, binds the accepted channel to
the idempotent intent, stores it in `payment_attempts.channel`, and sends only
that channel to Hosted Checkout. Same-token channel changes, retry after channel
disablement, and provider facts that contradict the stored channel all fail
closed. Retry keeps the original channel rather than creating a new buyer
choice.

Executable evidence, now committed rather than on the working tree: 474/474
repository tests,
`npm run check`, and `npm run build` pass. Built-Worker Chromium exercised the
product, `/full-form`, and `/embed/form` at 390 px and 1280 px. All six runs
rendered the same seven direct rows (COD, manual transfer, five DOKU channels),
defaulted to COD, moved FPX to Touch 'n Go with native radio keyboard behavior,
revealed the required DOKU e-mail/disclosure state, exposed payment validation,
and recorded zero horizontal overflow, runtime exception, failed request, or
local card field. No DOKU provider request, remote mutation, deployment, secret,
or PII entered this proof. The required independent Opus review was carried out
on 2026-09-07 and reported no blocking finding, and the work is committed as
`62f634d`. At that earlier audit, A-242 stayed open: its delivery-ledger boundary approval
could not be bound, because `review-boundary` only attaches to an active run
whose implementer route differs from the reviewer's, and no non-Opus reviewer
route was available. Ledger evidence is `RUN-20260907T100902Z-d900360b`, closed
BLOCKED with every check recorded as executed rather than asserted. A-221 still
owns real sandbox lifecycle evidence. The review's five non-blocking findings
are tracked: two are fixed under A-243, A-232 now has its verified control,
and the remaining decisions sit with A-221 and A-245. A-242 is now closed by
the fresh ADR-028 review recorded below.

`docs/DEVELOPMENT-MAP.md` was added 2026-09-07 and screens every route on disk
against three checkable signals: a test that names it, recorded browser
evidence, and an open task claiming the file. `docs/CODE-MAP.md` answers where
code lives and nothing answered how finished it is, so a route could be fully
documented and still have no coverage naming it, no browser evidence, and no
owner. Five findings came out of it and are queued as A-249: `/produk/[slug]` is
the largest page in the repository and no test names it; `/[slug]` has three
redirect branches and an admin-preview auth path with none named; the
`/admin/ads/meta` and `/admin/settings/developer` credential surfaces have no
test naming them; recorded browser evidence is concentrated on `/full-form`,
`/embed/form`, and `/thanks`, leaving the DOKU recovery pages with none by
route; and three already-open gaps now have a page address. Library-layer
coverage remains strong — the point is that "tested one layer down" is now
checkable rather than assumed.

A placement defect in `TASKS.md` was found and fixed on 2026-09-07 by checking
rather than assuming. Nine open tasks — A-241 through A-249 — sat under
`## Release gate` instead of `## Open queue`, because each was appended by
anchoring on `MYS-5`, which is the last entry of the release section rather than
of the queue. `task-queue.test.ts` validates only the queue, so all nine escaped
the contract that was supposed to guard them and Goal Mode would never have read
them. All nine are now in the queue and all pass; the number of open tasks under
contract went from 8 to 17. `MYS-5` deliberately stays outside it, because its
own `Dependencies` line is that the queue is empty.

A gap screening on 2026-09-07 queued what nothing owned. Five entries were
added: A-244 now provides `npm run cf:dev:managed`, matching the managed
`AUTH_SECRET` used by A-221 setup; ordinary `cf:dev` retains its documented
`.dev.vars`/dotenv authority; A-245 gives a buyer a way forward when the channel they committed
to is disabled mid-payment, blocked until proposed REQ-232 is accepted; A-246
records the owner-approved ADR-028 reviewer policy; A-241/A-242/A-243 now
have fresh audit closures with independent boundary approval; A-247 now
explicitly ignores `.delivery/` under ADR-029, retaining its evidence locally; and A-248 schedules the bilingual privacy-notice decision A-203
researched on 2026-09-01 and left as two `Proposal` rows nothing has owned since.
Two PRD status rows were corrected rather than left standing: REQ-216 recorded
COD enforcement as pending A-232 after it had landed, and REQ-224 claimed
verification the configuration half never had. `TASKS.md` now opens with an
execution order that names which document to read before each entry.

A-243 makes a configured-but-unreadable DOKU install visible. `inspectRow` in
`src/lib/doku-config.ts` swallowed every credential failure in a bare catch, so
`getEnabledDokuConfig` returned null, `resolvePaymentAvailability` produced no
DOKU method, and the storefront omitted online payment with nothing logged
anywhere — indistinguishable from an install that never configured DOKU. It now
records one redacted `doku-config-unusable` diagnostic naming environment,
revision, enabled state, and error class, and never the root secret, either
credential, or either ciphertext; an unconfigured row stays silent. This was
reproduced on 2026-09-07: the A-221 sandbox script encrypts with the managed
`AUTH_SECRET` while `npm run cf:dev` decrypts with the one in `.dev.vars`, so
every worker started through the project's own script served a storefront with
DOKU absent while D1 held an enabled row with five channels. That mismatch is
A-221's; being unable to see it was this. Two smaller review findings landed
with it: both checkout endpoints now refuse a DOKU order with no channel instead
of asserting `data.doku_channel!`, and the PDP trust line names every method the
install offers rather than returning on its first matching arm.

A-241's implementation fixes the local HTTP form failure reproduced from the operator's exact
Tailscale origin. The location directory and API were healthy; the inline
checkout script stopped before attaching listeners because non-secure IP
origins do not expose `crypto.randomUUID`. The form now generates its stable
submit/idempotency token from 32 browser-CSPRNG bytes through
`crypto.getRandomValues`, which remains available on that origin, and no longer
serializes the token into response HTML. The follow-up audit also invalidates
and clears old location results immediately on input and prevents a superseded
request or late error from replacing the latest query.

Built-Worker Chrome exercised the product, `/full-form`, and `/embed/form`
surfaces at 390 and 1280 px. Keyboard and pointer flows selected Kuala Lumpur
`50450`, Johor Bahru `80000`, and Kuching `93000`, returned the expected
D1-owned MYR quotes, and recorded zero exception, failed request, or horizontal
overflow. A deliberately late stale failure did not replace the current result,
and synchronous Enter during the debounce could not choose an old option. The
29 focused tests, `npm run check`, and `npm run build` pass; the repository suite
was 464 tests when that evidence was taken and is 474 at `62f634d`. A final
same-route security review found no issue in token strength, schema/DOKU
compatibility, idempotency, race fencing, or payment-policy scope, and the
independent Opus review on 2026-09-07 reported no blocking finding either.
The earlier A-241 run lacked a bound independent approval. Its fresh ADR-028
audit closure is recorded below; the historical BLOCKED run is unchanged.

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
return capability expires server-side exactly 24 hours after its own attempt
was created; cookie renewal and a newer retry attempt cannot extend that
lifetime, and expiry fails before provider traffic. A capability still inside
that bound may resolve the order's newest attempt, while an expired active
checkout is reconciled with strictly validated provider truth before reuse
or replacement. The one-minute Worker schedule now leases a bounded due set,
verifies provider status through the same lifecycle, backs off without overlap,
and restores stock once for abandoned uninitiated attempts. Order Detail exposes
redacted attempt/event diagnostics; Owner/Admin receives a confirmed manual
check while Customer Service remains read-only, and generic DOKU status edits
  are refused. The canonical full buyer form now adds each enabled Malaysia
  channel as a direct hosted DOKU choice only for a healthy configuration,
  collects the required email with redirect disclosure, and binds one selected
  channel to the stable submit identity and safe same-channel retry. The
  top-level navigation boundary accepts
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

That pass found three code/documentation gaps. A-231 now closes the hard-coded
headless payment set with the same resolver as the hosted read; A-233 now
records the three still-effective missing decisions as ADR-023 through ADR-025
without reusing upstream numbers; and `src/lib/decision-records.test.ts` fails
on an undefined ADR citation. A-232 remains open: `stores.is_cod_enabled` is
read by payment availability but not enforced by order persistence, and no
admin surface currently writes it. ADR-026 now accepts end-to-end Owner/Admin
control; implementation remains deliberately queued rather than implied.

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

## A-272 — checkout-lead buckets against its injected clock 2026-09-08

`POST /api/checkout-lead` takes an optional clock and its limit test freezes
one, asserting the limiter's KV bucket rather than the timing — mutation-proved
to fail when the route ignores the clock. An audit of every call site corrected
the entry's own premise twice. The flake is latent at about one run in forty,
not the deterministic break "already failing" implied; and five routes were
deliberately left unthreaded. The first account of why was wrong and the review
caught it: `meta-event` is imported and called by two tests. The conclusion
holds for a different reason — those fixtures bind no `SESSION`, so the limiter
fails open before it computes a window — while the other four are genuinely
never invoked, so threading any of them would add a parameter with no consumer.
The route also keeps its `APIRoute` annotation through a delegating export,
because moving the extra parameter onto the annotated value would have removed
the only compile-time contract this buyer-facing handler has. The admin-login trio in
`rate-limit.ts` is real but deferred at roughly one run in seven hundred, and is
recorded with the detail that `clearAdminLoginFailures` computes its own
`windowStart` — so any future threading must cover all three or `clear` deletes
the wrong bucket.

One `npm test` during validation exited 1 and could not be reproduced across
six clean runs, so it is recorded as unattributed rather than assumed to be the
clock class this task fixed. It is excluded from that class for a stated
reason: the diff touches one test whose KV key is unique in the repository,
alters no shared or module-level state, and leaves the production path
unchanged. The surviving wall-clock candidates are the deferred admin-login
trio and `route-surface.test.ts`'s build-and-harness `before` hook. The real
gap is that the failing test name was never captured before rerunning; next
occurrence, capture first.

## Review gate audited 2026-09-08

All 62 bound reviews in `.delivery/runs/` were examined after the owner
suspected the reviewer setup was wrong. The shared contract in dotfiles was
checked first and is sound: it requires a separate actual agent, allows any
model or provider, and states that renaming self-review is invalid because the
ledger cannot prove the difference from identity strings. The gap is in what
the ledger stores. `boundary_review` has no field for findings — reviewer,
route, digests, `APPROVED`, nothing more — so it proves a review was claimed,
never that one happened.

The usage pattern cannot be distinguished from a rubber stamp: five reviewer
identities across 62 reviews, three reused 24, 17 and 15 times, one named
`a210_review_retry` signing off A-211 through A-221; a median of 9.2 minutes
from run start to approval with implementation included, and twelve bound
within three minutes. That is not an accusation of self-review, because the
ledger cannot tell the two apart. The contrast is the argument: the four
reviews bound by a genuinely separate agent on 2026-09-08 changed the code four
times, including catching a closure entry that inflated its own review
coverage. `AGENTS.md` rule 10 now requires an R3 run to record its review
findings as a verification check; A-273 carries the reasoning and needs the
owner's approval because it raises what this repository accepts as a completed
R3.

## A-269 — the rate limiter takes the clock it is given 2026-09-08

`checkRateLimit` derived its fixed window from real `Date.now()` while every
other layer of the DOKU capability path accepted an injected clock, so a test
freezing time everywhere else still had this one function reading wall time. It
now takes an optional `clock` defaulting to `Date.now` — no caller changes
behaviour — and `enforceCapabilityRateLimit` threads the `now` its handlers
already receive.

The proof is structural rather than statistical, which is the stronger form
here: the limiter's KV key carries its window bucket, so the capability test
asserts every key it wrote derives from the injected clock, and un-threading the
clock fails that assertion with the wall-clock bucket in the message. Two probes I
built to reproduce the flake myself failed even with the fix reverted, and I
first recorded that as the probes not working on this defect. The reviewer
checked instead of accepting it, reconstructed the pre-fix tree, and reproduced
the flake with the same clock-shift method at three of four offsets. The method
is sound and my parameterisation was wrong; why it was wrong is the reviewer's
hedged inference rather than a measurement, since it never saw my probe code —
most probably that the offset is counted from process start, so running one
test by name puts the loop elsewhere in wall time. It then swept seven offsets against the fixed tree and all seven pass,
which is better end-to-end evidence than either probe I attempted. Two separate
measurements sit behind H1 and are not one thing: a deterministic reproduction
by clock-shifting, and a statistical rate of one failure in fifteen runs. The
H1 cause is removed on the DOKU capability path and structurally proved there,
so the caveat it justified is retired for that path — explicitly not a claim
that the suite has no other flake. That scoping earned itself immediately: on
the fifth validation run afterwards, `checkout-lead.test.ts` failed on
`public capture enforces the 30 per minute IP limit with retry headers`, which
fires thirty requests against a thirty-per-minute bound through a route that
does not inject a clock. Same mechanism, different caller. Queued as A-272.

## A-271 — the schema log entry has nowhere to go 2026-09-08

Queued after a request to add an action button to the system log. The button
already exists: `SystemLogPanel.tsx:302` renders a per-entry "Buka" link,
conditional on `entry.href`, beside the refresh control and source filters. Five
of six sources supply a destination. The sixth, `schema`, sets `href: null`
unconditionally — and it is the only source that can carry `severity: "error"`,
which it does when the running code and the database disagree about the
migration chain. The entry an operator most needs to act on is the one that
offers nowhere to act.

It is not merely a missing link: no surface under `src/pages/admin`,
`src/components/admin` or `src/pages/api/admin` exposes the schema version at
all, so there is nothing for a link to point at. The entry therefore does not
set an `href` — pointing an operator at a page that does not explain the
mismatch would turn "no destination" into one that misleads. The work splits
with different gates: supplying the destination is non-visual wiring, while the
surface that states expected version, applied version, mismatch state and what
to do about it is browser-visible and routes to designer/vision before its first
edit.

## A-268 — pre-provider refusals now name their reason 2026-09-08

A retry refused before DOKU is contacted records an `error_class` the operator
system log can render, and `failureClass` returns a type matching the six values
migration `0059` permits rather than a bare `string`. Independently reviewed in
three passes — the first two returned findings, the third CLEAN — and bound to
the boundary.

Half the entry's premise turned out stale and is recorded as such: A-245 had
already moved the disabled-channel refusal ahead of the retry's own attempt row,
so the guard this task set out to instrument is unreachable; in the
`DOKU_CHANNEL_DISABLED` branch there is no attempt row to record against at all,
while the sibling `DOKU_UNAVAILABLE` fires precisely when an active one exists. On the reviewer's advice the
answer is to point at `retry_blocked_reason`, which already carries that case,
rather than add a write that is sometimes impossible. Findings taken beyond the original scope: an unguarded diagnostic write could turn a 409 into a
502 that blamed the provider for a database hiccup; the untyped return would
have let a future mapping violate the CHECK constraint silently; and three local
error codes were being filed as provider failures. A flake the work introduced
was traced to `attemptFacts` tiebreaking on a hashed id against a random one and
fixed at the helper, which also closed a 6% flake at line 512 that had never
failed in front of anyone — cleared by SQLite rowid semantics, not by the twelve
green runs, which could not have cleared a rate that low.

Two caveats belong with this evidence. The suite it rests on carries a
pre-existing clock-boundary flake in `checkRateLimit`, queued as A-269, failing
roughly one run in fifteen for reasons outside A-268, so a single green run is
not reproducible proof. And the CLEAN verdict named three cosmetic wording items
that were deliberately left open rather than folded into an approved digest.

## A-270 — local dev served no client assets 2026-09-08

Reported as `/admin/expeditions` rendering blank. The page was never the
problem. `npm run cf:dev` hands Wrangler the generated
`dist/server/wrangler.json`, whose `assets.directory` is the relative
`../client`; Wrangler resolved it against the root `wrangler.jsonc` it
discovered instead, looked beside the repository, found nothing, and answered
every `/_astro/*` request with a bare 404. No console error, no exception, no
failed API call — the island chunk simply never arrived, so React never
hydrated and each admin page rendered its server shell above an empty body.
Every admin page was affected, not just expeditions; the storefront looked
healthy only because Astro inlines its checkout script rather than emitting a
separate chunk. Both dev scripts now pass `--assets dist/client`, verified 404
without and 200 with, and `INSTALLATION.md` records what the absence looks like.

`scripts/verify-expeditions-page.mts` is the regression check, and it asserts
the chunk is served before it asserts anything about the page, because a blank
page is a confusing way to learn that assets are unmounted. Its first draft was
itself a false positive: it waited for page text containing `Zon`, which the
header `Zona & tarif pengiriman` satisfies before the island mounts, so a
healthy page measured as blank. It now keys on a marker only the island renders.

## A-260 review bound, and a flaky-evidence finding queued 2026-09-08

The independent reviewer approved the A-260 surface for an R3 payment-path
boundary after three passes, and `review-boundary` is bound to it —
`RUN-20260908T110827Z-fe372668` closed PASS, the first R3 run today to do so
rather than leaving the gate open. The reviewer re-derived both frozen body
constants itself against the builders at `36e3345^` instead of trusting the
generated values, and mutation-proved that both now bite, including the
`metadata`-to-front reorder it had earlier demonstrated passing all 22 tests.
It judged the single-input-shape fixture coverage acceptable and advised
against a task, because key order in that builder is fixed by the source
literal for every key except the one conditional key, and both of its states
are now frozen.

Its one new finding is queued as A-269 and is not an A-260 defect.
`src/lib/rate-limit.ts:38` derives its window from the real wall clock,
ignoring the injected clock the rest of that path accepts, so a capability test
firing 21 requests against a 12-per-60s bound flips whenever a real minute
boundary falls mid-loop. Proved by shifting only `Date.now` and sweeping the
offset — clean at +3700 ms, failing from +4000 to +4500 — and measured at one
failure in fifteen full-suite runs. It predates A-260 by two commits. What
makes it worth an entry is the evidence consequence: a suite that fails one run
in fifteen for unrelated reasons means a single green run is not reproducible
proof for that file, and every `full-tests PASS` recorded against it carries
that caveat until the clock is threaded.

## A-260 independently reviewed 2026-09-08

A separate agent reviewed the DOKU request-body deduplication and returned
NON_BLOCKING_FINDINGS: no defect producing a wrong provider outcome. Byte
equivalence was proved empirically, not by reading — both pre-change builders
were extracted from `36e3345^` and diffed against the new one over 3000
randomized inputs, byte-identical for create and retry. All 21 field mappings
match their old sources, and the highest-risk item, that retry can now throw
where it previously could not, leaves no new state class because the
pre-existing `DOKU_UNAVAILABLE` throw sits in the same position and
`expireUninitiatedAttempt` restores stock on the scheduled pass.

Three of the four findings are fixed. The sharpest was mine: the byte-equality
assertion compared the builder against a round-trip of its own output, so it
would have passed with every key reordered — precisely the regression the commit
claimed it guarded. It is now a frozen fixture, and reordering two keys fails
it. The new retry refusal is now asserted through `handleDokuRetryRequest`;
building that test surfaced that `accessFromRow` already refuses a non-integer
`orders.total_amount` at the capability layer, so the corrupt value has to enter
through `order_items.unit_price` instead. A module comment that claimed more
than the code did is corrected. The fourth finding, that both pre-provider
refusals never record an `error_class` and so appear in the operator log without
a reason, is queued as A-268 because it changes what a payment path writes.

The ledger could not bind a `boundary_review` event: that run had finished, and
review-boundary attaches only to an active run. The review is real and recorded
in the task entry rather than stamped in the ledger.

## Working tree reconciled again 2026-09-08

`36e3345` commits the seventeen files from A-257, A-259, A-260, A-262, A-265,
A-266 and A-267 — three new guards, one deduplicated payment-body builder, a
clean dependency audit, a coverage baseline, and the documentation each of them
changed. Verified on the exact tree committed: 528 tests pass, `astro check`
reports 0 errors across 381 files, the production build completes, and
`npm audit --omit=dev` finds nothing. The tree is clean, so the next R1
documentation run starts without inheriting a pre-existing dirty path — which
was the single reason nine of ten runs closed BLOCKED before the first
reconciliation.

## A-267 — device address guard 2026-09-08

`src/lib/repository-hygiene.test.ts` enforces REQ-210: every tracked file under
`src/`, `scripts/`, `docs/` and the root Markdown may carry only loopback, the
unspecified and broadcast addresses, and the three RFC 5737 documentation
ranges. It allowlists ranges by name rather than banning IP literals, and a
second test pins the allowlist so it cannot widen unnoticed.

Its first run found four real violations that the manual scan behind the task
had only partly seen. `TASKS.md` still carried the operator's Tailscale origin
a Tailscale CGNAT address twice, inside A-241's own reproduction note — the exact leak the
task was queued to prevent, in the entry that described it. Those are redacted
to a placeholder rather than to a documentation address, because substituting
one would falsify the record of what was tested. `rate-limit.test.ts` carried
a redacted address and a redacted address as forwarded-header fixtures and now uses RFC 5737
addresses; the assertions are unchanged. REQ-210 cites the guard instead of
stating that nothing does.

## Development map refreshed 2026-09-08

The map's provenance line still read "audited at base `62f634d`" two commits
after that stopped being true, and `development-map.test.ts` passed throughout —
it guards structure (every route once, every citation resolving, the four
runtime claims naming executable tests) and cannot guard a prose header. The
header now names base `4a41894` plus the uncommitted closures, and says in the
document itself that a green suite is not proof the line is current. The
coverage figure was re-measured after A-260 added two tests and corrected from
524 tests / 88.67-75.24-88.30 to 526 tests / 88.66-75.30-88.34. A-267 is queued
for the REQ-210 guard that A-266 identified and declined to fake.

## A-260 — one DOKU request body 2026-09-08

`src/lib/doku-request-body.ts` is now the only place the signed Hosted Checkout
body is built. The duplication hid a real asymmetry: the create path ran every
money field through a guard that refuses a value which is not a safe
non-negative integer, and the retry path divided by 100 raw, so a corrupt or
negative sen value was refused on the way in and sent to the provider on the
way back. Both paths share the guard now. `metadata.device_id` stays create-only
because a retry has no browser fingerprint, appended last so both bodies remain
byte-identical to the ones they replaced — proved by every existing signed-body
assertion passing unchanged, plus a new test that compares serialized bytes
rather than deep equality because key order carries the signature. Independent
payment-surface review remains owed under the entry's own Risk line.

## A-262 — coverage baseline 2026-09-08

`npm run test:coverage` reports 88.67% lines, 75.24% branches and 88.30%
functions across `src/` on 524 passing tests. No dependency was added: Node
24.18 ships `--experimental-test-coverage`, so the entry's budgeted `c8`
dependency was not spent. The baseline sits in `docs/DEVELOPMENT-MAP.md` beside
the citation method it supplements, and the command in `AGENTS.md`. Branch
coverage at 75.24% is the weakest axis and is the honest place to look next; no
threshold is enforced, because one chosen before the first measurement is a
guess.

## A-266 — requirements joined to evidence 2026-09-08

Fourteen `Implemented locally` rows in `PRD.md` now read `Verified locally` and
name the test file and test that satisfies them. Each citation was resolved by
finding the named test in its file rather than by keyword similarity; four
keyword candidates were discarded on reading, including a match that pointed
REQ-203 at CRM copy instead of slug redirects. Two rows were not raised. REQ-210
is true on disk — only loopback and RFC 5737 documentation addresses appear —
but no test asserts it, so its status cell now says so instead of claiming
verification; it is the natural next guard after A-257 and A-265. REQ-180
already carried its own qualifier and was left alone.

## A-259 — dependency audit cleared 2026-09-08

`npm audit --omit=dev` reports zero vulnerabilities. The high `fast-uri` and
moderate `qs` advisories shared one cause: `shadcn`, a build-time CLI, was
declared in `dependencies`. Nothing under `src/` imports it and no npm script
invokes it, so it was never runtime code; moving it to `devDependencies`
removed `qs` from the production tree, and `npm audit fix --package-lock-only`
resolved the transitive `fast-uri` under `astro-seo`. No direct dependency
version changed and the sixteen outdated packages were left alone. Validated
with `npm ci` from clean, then check, the full suite, and the production build.

## A-265 — task id uniqueness guard 2026-09-08

`task-queue.test.ts` now fails when an id heads two entries in one section, and
when an open-queue id is reused from a closed one. Both were mutation-proved.
The ten archive duplicates `A-176`-`A-185` are left as they are by decision
rather than exempted by name: they are genuinely different closed tasks from
before the fork restarted numbering at the `## A23` era, they carry 55
cross-references in `BUILD-LOG.md`, the docs and the ledger, and renumbering
settled history would invalidate all of them to prevent nothing. Every
collision that caused harm on 2026-09-08 was inside `## Open queue`, which both
assertions cover.

## A-257 — observability guard 2026-09-08

`src/lib/observability-registry.test.ts` now fails when a production
`console.error` label is not in the `OBSERVABILITY.md` registry, and when the
registry names a label nothing emits. Building it found three labels the
registry had missed because they reach production through a constant
(`schema-upgrade-failed`) and a ternary (`capi-outbox-scheduled`,
`doku-reconciliation-scheduled`) rather than a string literal — the exact gap
the entry predicted, and one the earlier literal-only check could not see. All
three are registered and a third test fails if that exemption list outlives its
source. The guard was mutation-tested in three directions before being trusted.

## Working tree reconciled 2026-09-08

`4a41894` commits the 61 files that had accumulated across sessions — the
abandoned-checkout leads feature and migration `0062`, the landing content
sections and migration `0063`, IDR advertising values, checkout receipt and
footer polish, DOKU configuration diagnosability, the observability registry,
the working-agreement rules, and the queue. Every untracked file was read
before staging; no secret, device address, or scratch file was among them.
`astro check` reported 0 errors and the production build completed on the
exact tree committed. The tree is clean, and the first documentation run on it
reached PASS without a review reason, which is the condition A-258 named.

## Working-agreement rules and two joining tasks 2026-09-08

Three rules were added to `AGENTS.md` because each had already been broken
more than once in a single day and none was written anywhere a session reads.
Task ids are now allocated from the highest number in both `TASKS.md` and the
ledger runs, after `A-255` and `A-258` were each claimed by two sessions for
different work and one of each pair was overwritten or falsely closed. New
entries are inserted after the last entry of `## Open queue` rather than
anchored on `MYS-5`, after nine tasks landed under `## Release gate` where the
queue contract could not see them. And a new `console.error` label is
registered in `OBSERVABILITY.md` in the same change, after
`doku-config-unusable` shipped unregistered. A-265 queues the id-uniqueness
check that makes the first rule hold mechanically. A-266 queues the joining of
sixteen `Implemented locally` requirements to evidence that already exists —
118 test names match their domains and several cover a row outright — but
which no current-state document cites; it is explicitly not an upgrade pass.

## Whole-project health report 2026-09-08

Measured against disk at `0cff0f0` including the working tree; the full report
with method is at `~/Documents/work/research/mybookcms-health-2026-09-08.md`, a
research snapshot rather than a source of truth. Verdict: a two-week-old
codebase unusually disciplined about evidence and unusually undisciplined about
committing it. Strong: documentation is self-enforcing through
`code-map.test.ts`, `development-map.test.ts`, and `task-queue.test.ts`; 476
tests pass with direct-runtime coverage of the four blind spots the map found;
the payment path is independently reviewed with channel choice bound end to end.
Weak: 48 modified and 13 untracked files sit on one disk, the untracked set
being the whole of A-250 and A-251C including migrations `0062` and `0063`
(A-258); no linter, formatter, or coverage measurement exists on 62,645 lines
(A-261, A-262); `checkoutBody` is built twice on the R3 payment path with 25
lines drifted between copies (A-260); `npm audit` reports one high and one
moderate vulnerability, both with fixes available (A-259). The branch is 38
commits ahead of `main` with nothing merged, which G-1 already owns. Seven tests
each spend 12–18 s spawning their own Worker; A-235 recorded the sharing pattern
and it applies file by file, so it is noted rather than queued. Of 63
requirements, 33 are verified locally, 18 implemented without recorded
verification, 4 accepted without implementation, and 1 partial — each already
owned by a task.

## Documentation audit 2026-09-08

Audited mechanically against disk rather than by reading. What held up: every
file path cited by a current-state document resolves; every `REQ-` citation
outside `PRD.md` is defined in it; the ADR ids 013–020 that appear undefined are
the upstream records this fork never carried, already settled by A-233 and
documented in `DECISIONS.md`; and `docs/CODE-MAP.md` and
`docs/DEVELOPMENT-MAP.md` are both enforced by guard tests that check route
coverage, path existence, HTTP methods against real exports, and the live table
list against the migration chain. The documentation set is in better shape than
a reading would suggest.

Two defects were found and fixed. `TASKS.md` carried two different tasks under
the id `A-255` — a footer-navigation task and the admin design-conformance task
queued the same morning — and the second had been marked complete without any
work being done. That was verified rather than assumed: the counts the entry
cites were re-measured and are unchanged at 150 `border-slate-200` to 16
`border-border` and 187 `text-slate-500` to 37 `text-muted-foreground`, and no
run exists for it. It is renumbered `A-256` and reopened.

`OBSERVABILITY.md` named five stable surface labels while production code emits
eighty. Its "Required signals" list named the categories that must be observable
without naming a single label that satisfies them, so the requirement and the
code were never joined, and every checkout, authentication, and advertising
signal was absent. A registry of all eighty now sits in the document with the
registration rule stated. Unlike the two maps, nothing enforces it — which is
how `doku-config-unusable` stayed unregistered for a day after it shipped —
so **A-257** queues the guard.

## A-255 — admin design-system conformance queued 2026-09-08

The owner reported the admin canvas reading as untidy. Screened against disk at
`0cff0f0`, the cause is not a missing component library. `shadcn/ui` is installed
with 22 primitives, `src/styles/admin.css` carries the full semantic variable
set, and `DESIGN-SYSTEM.md` already mandates both and forbids a second library or
a separate colour vocabulary. The admin components bypass that system: 150
`border-slate-200` against 16 `border-border`, 187 `text-slate-500` against 37
`text-muted-foreground`, 90 `bg-white` against 6 `bg-card`, and 980 raw palette
uses across 22 files against 74 semantic-token uses concentrated in 2.
Seventeen of twenty-three admin components import no shadcn primitive, and the
installed `table`, `badge`, `dialog`, and `select` are used by none of them while
`OrdersTable`, `ProductCatalog`, and `LandingPageCatalog` hand-roll all four. One
card concept is drawn at three radii across two shadow scales, and
`LandingPageEditor.tsx` adds a third `zinc` vocabulary in a file that elsewhere
uses `border-border`.
The consequence is not only visual. `DESIGN-SYSTEM.md` already measured
`slate-500` as passing AA on a white card at 4.76 and failing on the admin page
background at 4.41, requiring `slate-600` there; 187 raw uses of that exact class
mean the system predicted these failures before they were written. A-255 is
queued to convert the token layer first, then the shared card/table/badge shells,
ordered by daily operator use. No code was changed: the finding is recorded as an
entry, and the designer/vision handoff is a stated dependency before the first
visual edit.

## Current execution gates

The remaining queue is intentionally gate-led. A-240 now implements ADR-027's
accepted 24-hour DOKU return-capability lifetime. ADR-026 accepts Owner/Admin
COD control and A-232 now has verified local implementation. A-234 now has its
designer-approved switch and desktop contrast fixes with passing browser and
Lighthouse checks at both required widths. REQ-230 and the six-path A-226 expansion are accepted; A-226 is verified locally with all named mutations and the operator panel integrated. A-204 is closed by the successful hosted run on `b093cb8`. A-221, A-222,
A-223, G-1, and MYS-5 remain explicit external or production approvals.
No deployment or hosted behaviour is claimed by A-240's local evidence.

An independent audit of the pre-existing payment, order and authorization core
returned PASS with four medium findings, now A-237 through A-240. A-237 is the
one to read first and was reproduced rather than reasoned about: a
`customer_service` operator rewrote an order's shipping cost to zero and then
bulk-deleted the order, because the destructive and money-writing handlers under
`/api/admin/orders` carry no role check while the DOKU reconcile beside them
does. The others are unbounded buyer-facing DOKU status and retry endpoints,
stock restored on the deletion of an already-delivered order, and a return
capability token with no expiry. A-237 through A-240 are now remediated locally.
None was a buyer-exploitable path to money, stock, or a forged payment; the
audit confirmed those boundaries hold.

## Verified local evidence

- The clean isolated D1 chain is at schema version 62 with 2,931 official Malaysia postcode rows,
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
- Historical pre-A-263 Chromium evidence exercised pending COD at 390 px and
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
- That historical pre-A-263 product-page run emitted PageView plus canonical
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

- Hosted CI passed on `b093cb8`; A-204 records the exact GitHub run and steps.
- Remote migration, deployment, and production smoke checks remain unperformed
  and require their separately approved target/action.

`TASKS.md` is the canonical execution queue. `BUILD-LOG.md` is historical
evidence, not a statement of current behaviour.

## A-246 — Owner-approved reviewer policy, 2026-09-07

ADR-028 accepts the owner's instruction to resume with an available qualified
independent reviewer, including GPT-5.6 Sol, instead of blocking solely on an
Opus model-name requirement. At that initial decision, a separate reviewer and
different model or provider were required. The later owner amendment below
removes the route restriction. Historical BLOCKED runs are unchanged.

This completed the policy decision only. A-241/A-242/A-243 were left open for
fresh implementation verification, required browser evidence, and final
boundary approval. A-241/A-242/A-243's subsequent closures are recorded below.
Delivery run `RUN-20260907T145200Z-55836332` owns this documentation change;
no runtime, provider, deployment, commit, or push is part of A-246.

## A-243 — Configuration diagnosis closure, 2026-09-07

Run `RUN-20260907T145451Z-798a794d` audits the existing A-243 implementation
and removes its remaining empty-root-secret shortcut in payment availability.
An enabled configuration is now inspected even when no root is available, so
DOKU remains unavailable and one safe `doku-config-unusable` event is emitted.
An unconfigured or disabled install is still omitted without a decryption
attempt. The fixture regression failed before the repair and passed after it.

Tests cover missing, short, wrong, and correct fictional roots, malformed and
partial credentials, and exact diagnostics in payment operations. Both submit
endpoints retain their channel checks; all availability combinations retain
their Malay trust copy. The operator guidance no longer diagnoses every
unusable configuration as a key mismatch.

The full repository tests, type-check, build, focused regressions, and final
independent correctness/security and boundary review are recorded in the run.
Chromium at 390 and 1280 px against an isolated built Worker and fictional D1
rendered the complete COD/bank/online trust line on both PDP variants with zero
overflow, console error, failed request, or external request. This verifies
local display and fail-closed configuration behavior, not provider lifecycle
or deployment. A-221 remains open.

## A-241 — Fresh HTTP checkout audit, 2026-09-07

`RUN-20260907T150257Z-b5838fbe` closes A-241 under ADR-028 without changing
the committed form. Its 12 real Chromium cases cover product/full-form/embed
at 390/1280 px on literal localhost and a private HTTP IP; secure-context state
was explicitly checked for both. The form requested 32 random bytes, retained
one 64-hex token across two intercepted submit refusals, and emitted no token
in response HTML. City and postcode lookup, stale Enter refusal, delayed stale
error fencing, pointer/keyboard selection, D1-exact hidden destination fields,
and shipping quotes passed without page overflow or unexpected browser errors.

The prior A-243 full suite, type-check, and build cover unchanged runtime code;
fresh focused tests, browser proof, and independent correctness/security
boundary review belong to this run. No actual submit reached the Worker and
no order, payment, provider call, secret, or remote mutation was involved.

## A-242 — Channel contract and settlement closure, 2026-09-07

Run `RUN-20260907T150624Z-2fbee8c5` completes the fresh ADR-028 audit and
repairs defects found by the independent review. Headless bootstrap codes now
share the checkout channel type/allowlist; the client drops unsupported codes
and both OpenAPI directions expose the same enum. A typed bootstrap-to-checkout
regression proves the public contract round-trip.

Status retrieval rejects a present malformed provider channel instead of
substituting the stored choice. Shared settlement requires a persisted
allowlisted channel equal to the provider fact; null/unknown stored channels
cannot transition through notification, status, or reconciliation. Workerd D1
regressions first reproduced the acceptance bugs and then proved refusal with
pending order/attempt state, unchanged events, and no Purchase outbox entry.
Absent retrieve-channel compatibility uses only an already committed known
channel and does not excuse a present invalid or contradictory value.

Six Chromium cases cover product/full-form/embed at 390/1280 px: all five
channels by pointer, keyboard channel selection, COD/email visibility, invalid
email gating, focused retryable refusal, stable tokens, zero card fields or
iframe, zero overflow and no unexpected console/network error. Submissions
were intercepted before the Worker; no order or provider call occurred.
The final full-suite/check/build and independent correctness/security boundary
review are recorded in this run. Sandbox/provider proof remains A-221; the
proposed disabled-channel recovery UX remains A-245. No deployment is claimed.

## A-247 — Local ledger retention, 2026-09-07

ADR-029 explicitly ignores `.delivery/`. Existing local history remains intact;
no ledger content was staged, published, or removed. Repository documents retain
dated outcome summaries, but another checkout must regenerate executable proof
and its required independent approvals. Ignore-rule and task-queue checks verify
this decision; it does not change runtime or certify another checkout.

## A-244 — Managed local development command, 2026-09-07

`npm run cf:dev:managed` builds first, then injects managed secrets into Wrangler
with `--env-file /dev/null` and the existing `.wrangler/state` persistence.
INSTALLATION distinguishes this managed authority from ordinary `cf:dev`'s
dotenv authority. No database, credential, or production resolution changed.

Executed the documented command with loopback port/inspector overrides; the
build completed and a read-only `/api/payment-methods` check returned HTTP 200
with all five installed DOKU channels active. Only the assertion result was
recorded, not account or credential values. Task-queue and diff checks passed.
No provider payment request, remote mutation, deployment, commit, or push was
performed. This proves local configuration loading, not A-221 interoperability.

## A-234 — Shared switch implementation, 2026-09-07

The required designer handoff selected a real 44 × 44 px Radix Root, reserving
space rather than extending a pseudo-element into adjacent controls. The inner
track retains its compact default/small geometry. State styling now follows
Radix's actual `data-state` attributes; controlled state, props, keyboard
semantics, and immediate-write callers remain intact.

The isolated fictional admin fixture verified 390/1280 px targets by
`elementFromPoint`, both sizes, expanded tariff panels, keyboard state changes,
track colour/thumb travel, and no page overflow or unexpected console/network
errors on Orders, Pengiriman, Payments, Tarif Malaysia, and Products. Payments
screenshots passed the independent designer's visual critique. Full suite, type check, and
build passed. Existing page-background contrast values remain documented.

The initial implementation run remained BLOCKED because no installed Lighthouse
runner was available. A later audit used pinned `lighthouse@13.4.1` through
`npm exec` with a disposable `/tmp` cache, avoiding repository dependency or
system installation changes; the earlier proposed package Surface expansion is
unnecessary. The historical BLOCKED record remains intact.

Fresh `/admin/settings/log` reports show accessibility 100 and color-contrast
PASS at 390 px, but accessibility 96 and color-contrast FAIL at 1280 px. The
visible desktop sidebar reveals slate-400 group labels at 2.51:1, active Settings
text at 4.48:1, and the topbar keyboard hint at 2.63:1. At that audit A-234 remained open:
`AppSidebar.tsx` and `AdminShell.tsx` were outside its approved Surface. A read-only
designer proposes slate-600 labels/hint (including the sibling mobile-menu
heading) and blue-700 active text with backgrounds unchanged. That run stopped
for owner approval without editing shell source or claiming a desktop pass.

Run `RUN-20260907T160501Z-9636d3b7` also repeated all 16 real-browser switch
route/viewport checks successfully on the isolated fictional fixture. Runtime
source is unchanged from A-249's passing full suite, typecheck and fresh build.
The existing LandingPageEditor switch lacks an explicit name; its label remains
outside this task's permitted scope and was not changed.

## A-232 — Owner/Admin COD control closure, 2026-09-07

Payments now renders a labelled COD switch in its manual-payment card. Its
independent island reads the existing settings API, validates boolean responses,
and writes only `save-cod-availability`. Loading/saving disables the switch;
save failures retain the last confirmed display, initial-load failures offer
retry, and completed keyboard saves restore focus when it fell back to body.
DOKU credential/configuration controls remain independent.

At 390 and 1280 px, both Owner and Admin passed failed-load/retry, failed-save,
pending state, keyboard/pointer toggles, refresh persistence, and hosted-form
and PDP availability agreement. Headless reads matched both enabled/disabled
states. Customer Service and Advertiser received API 403 `PERMISSION_DENIED`
and redirects from the Payments page. Designer critique passed both viewports;
changed flows had zero overflow and unexpected browser errors.

Both real HTTP checkout endpoints returned 422 for disabled COD against an
isolated D1 fixture, while order/item/attempt/outbox counts and variant stocks
remained identical. The existing regression proves refusal before order-number
allocation or any batch. Full suite, type check, build, and focused contracts
passed. No schema, provider, production, commit, or push change occurred.

The final browser/HTTP evidence uses the installed Miniflare/workerd directly
with the same built bundle and fictional D1/KV fixture. Earlier Wrangler
forwarding-proxy attempts terminated with `Network connection lost` during
role-denial requests; their failed records remain. Direct workerd passed the
complete checks. No Wrangler fix or production-impact diagnosis is claimed.

## A-249 — Route evidence map and direct coverage, 2026-09-07

The development map now accounts for every file-based page and endpoint exactly
once, including aliases and tombstones, and distinguishes static test references
from direct runtime checks. Rows cite the relevant test, recorded browser task
or open decision; they make no unrecorded browser or provider claim. A-232's
closed COD gap and A-234's outstanding Lighthouse check are stated explicitly.
The maintenance rule is visible at the TASKS entrypoint and in CODE-MAP.

`src/lib/route-surface.test.ts` builds the current Worker before starting a
Wrangler test harness with isolated, non-persistent D1/KV and fictional secrets.
It asserts PDP variant/fallback selection, executes the rendered ViewContent
script, checks resolved COD copy, exercises product/takeover redirects and
non-stale admin draft preview, verifies Meta role gates and token masking, and
issues/lists/revokes a developer API key under the actual route middleware.
`src/lib/development-map.test.ts` checks complete unique route inventory and
local citation paths; it does not certify prose quality or browser artifacts.
No route, real credentials, provider state or production resource changed.

Validation: the focused route/map/task checks, full `npm test`, `npm run check`
(type generation, Astro and TypeScript), and `git diff --check` passed. The route
suite itself runs a fresh `npm run build` before exercising the Worker. Evidence
is recorded in `RUN-20260907T155220Z-bf0aac03`; no new browser behavior was
introduced by this test/documentation-only change.

## A-234 — Approved desktop contrast closure, 2026-09-07

The owner authorized the previously blocked work and its two additional shell
paths. Both sidebar-label and active-link branches, the keyboard hint and the
sibling mobile-menu heading now use the designer-selected text colours while
preserving backgrounds, layout and behavior. Rendered ratios are 7.26:1 for
sidebar labels, 5.95:1 for active links, and 7.58:1 for the keyboard hint and
mobile headings. DESIGN-SYSTEM records the measured pairs.

Lighthouse 13.4.1 against the authenticated fictional `/admin/settings/log`
reports accessibility 100 and color-contrast PASS at both 390 and 1280 px.
The real-browser switch audit covers all 16 route/viewport combinations again;
normal/restricted desktop and the open mobile menu also pass contrast, overflow,
console/network and focus-return checks. Designer screenshot critique passed.
`npm run check`, `npm test`, and `npm run build` passed after source changes.
Run `RUN-20260907T163554Z-7edbd892` supersedes the incomplete evidence without
rewriting historical BLOCKED runs. No deployment or real data was involved.

## A-246 — Model eligibility restrictions removed, 2026-09-07

The owner explicitly requested removal of model locks. ADR-028 now permits any
capable model/provider, including the implementer's route for a separate actual
reviewer agent. No specific vendor, model or reasoning level is an eligibility
gate. The independent review, truthful provenance, current boundary digest and
product/scope/live-operation approvals remain.

The restriction came from shared AGENTS and OMP instructions, delivery-ledger's
R3/R4 route comparison, and ai-policy-lint's hardcoded lane anchors. Dotfiles
TASK-062 corrected all four sources and passed ledger/policy regressions, the
canonical policy lint and independent review. This repository's remaining
normative wording is aligned here; historical model provenance is retained.


## A-248 — bilingual privacy notice closure (2026-09-07)

The owner accepted REQ-211/REQ-212 and the reviewed draft under ADR-030.
The privacy page now contains seven Malay sections followed by eight English
sections, with explicit article language attributes and one page heading.
Both accepted DOKU disclosures are unchanged, verified by a content digest.

The shared checkout displays Malay and English privacy links before the buyer
name field. Both open the notice in a new tab, with accessible new-tab text,
so entered data remains in place. Local browser checks covered the PDP,
full form, embed, and privacy page at 390/1280 px: notice placement, visibility
across available payment choices, keyboard link activation, preserved input,
article language order, existing DOKU anchor, and no horizontal overflow.
No order was submitted and no provider request was required.

`RUN-20260907T165031Z-9f29635d` records focused privacy regressions,
`npm run check`, `npm test`, `npm run build`, and browser validation as PASS.
This is local implementation evidence, not a publication or legal certification.


## A-245 — disabled-channel recovery closure (2026-09-08)

The owner accepted REQ-232 under ADR-031. A healthy enabled configuration that
omits the committed channel now yields a specific disabled-channel reason for a
retry-eligible failed/expired attempt. Paid, cancelled and returned order state
takes precedence over this reason; active checkout reuse still requires the
enabled channel and retains its previous unavailable refusal. No channel is
substituted and the refusal creates no attempt or provider request.

Return, result and cancel pages project the restriction during SSR and status
refresh. They hide retry, explain the situation in Malay, and offer order
tracking plus merchant contact. A dynamic refusal focuses the explanation before
hiding retry. Stale responses cannot restore the action or replace the message;
a paid response clears the obsolete restriction. Transient failures remain
retryable. Result-only paid Purchase signaling and capability handling remain
unchanged.

`RUN-20260907T170400Z-46155a16` covers real-D1 classification and no-write/no-provider
regressions, executable client tests for all three pages, full check/tests/build,
and twelve local browser cases (initial/reload plus dynamic behavior on three
routes at 390/1280 px). Browser API responses for dynamic race/error cases are
mocked; initial rendering uses the actual built Worker and fictional D1 data.
Tracking/contact keyboard navigation, focus transfer, hidden actions and no
horizontal overflow were checked. Four screenshots passed independent visual
critique. No sandbox lifecycle or production deployment is claimed.


## A-204 — hosted CI closure (2026-09-08)

[GitHub Actions run 34147093570](https://github.com/ongkipro/mybookcms/actions/runs/34147093570)
completed successfully for `b093cb82ba14124288e445e7fab112b4fdf5ec49` on
`malaysia-market-audit`. The real runner completed checkout, Node setup,
dependency installation, typecheck/static analysis, tests and build successfully.
This is a fresh workflow dispatch, not an inference from local checks or the
old billing-failed runs. Repository visibility remains private; no billing,
workflow, default branch, history or deployment settings were changed.

Delivery run `RUN-20260907T171900Z-d90cd59d` verifies the exact revision,
completed/successful run and job, and each required step's successful completion
against GitHub's API. CI completion does not close provider sandbox proof,
production activation, publication, or the pending A-226 implementation scope.


## A-226 — historical partial checkpoint (2026-09-08)

Owner-accepted REQ-230 is in progress under
`RUN-20260907T172505Z-90da78b5`. Migration 0061 adds the append-only
`system_events` table and schemaVersion 62. The real scheduled handler records
payload-free CAPI/DOKU job failures independently and prunes at most 1,000 rows
strictly older than 90 days per tick. Login recording exists as an unwired helper.

Direct store-profile, COD, embed-origin, headless-origin and CRM settings saves now
commit an actor/action/target event in the same D1 transaction as their update.
A failed audit insert rolls back the update; rejected inputs create no event.
Changed values are excluded from the audit schema and writer. Workerd-backed D1
checks cover clean migrations, both transaction failure directions, insert
correlation, each action's redaction, immutability, exact retention boundaries,
the actual scheduled handler's independent failure handling, and the real
settings handler's five direct save paths.

A-226 remains open. Ads, API-key, operator, credential/payment/template and login
integration, plus reading the new source in the existing log panel, are not all
connected. Five exact helper/panel paths are listed as a requested, unapproved
Surface expansion in TASKS.md; none has been edited. The current branch has not
been remotely migrated or deployed. Hosted CI evidence for b093cb8 predates this
local implementation and is not proof of these uncommitted changes.

Verification checkpoint: typecheck passes; the full suite reports 495/496 passing.
The sole failure is the pre-existing COD route fixture, which supplies neither
authenticated admin identity nor D1 batch support. Updating
`src/lib/payment-availability.test.ts` requires its separately requested Surface
expansion. The seven real-D1 audit tests pass, as do the 20 focused audit/schema/map
checks and a separate fresh production build. The earlier core-only full suite
pass does not replace the latest full-suite failure. This checkpoint is not a
completed release.


### A-226 historical checkpoint — direct mutations and login (2026-09-08)

The same active run now connects Meta/Google configuration saves, API-key
issue/policy/revoke, and operator create/update/delete to the atomic audit
writer. Operator sessions are revoked only after D1 succeeds. Generated API-key
secrets, password hashes, submitted Ads tokens, encrypted token blobs and contact
fields never enter the audit row. Existing role and validation rules remain.

The login boundary records only the transition after an admitted failure reaches
its existing KV limit. Already-denied requests produce no audit writes. Audit
sink and diagnostic recheck failures preserve the failed-login response. KV's
existing non-atomic windows remain; this is not a global exactly-once guarantee.
The new executable frontmatter test uses real D1/KV and existing login helpers.

The previous partial checkpoint is historical evidence. Payment configuration,
self-service credential updates, template insertion and the log panel remain
unwired, and their requested Surface paths remain untouched. The separately
requested COD fixture update is still pending, so A-226 is not complete.


Latest continuation evidence: `npm run check` and a separate fresh build pass;
`npm test` reports 499/500, with only the unchanged COD fixture failing. All 11
system-events tests pass, including the actual login frontmatter and real D1/KV
mutation/session behavior. Separate-agent review found no blocking issue in the
implemented slice. The reviewer caught and removed a flaky test canary: the
street-number fragment could match a timestamp; checks now use complete tokens,
email, phone and street-address markers instead.

A fresh isolated built Worker and real Chrome pass login checks at 390/1280 px:
ten wrong-password attempts produce the existing 401, four repeated denied
submissions produce 429, and D1 contains exactly two anonymous lockout events.
No runtime exception or failed network request was observed. Screenshots remain
in `/tmp/mybookcms-a226-browser-LK9dTm`; executable audit is
`/tmp/mybookcms-a226-browser.mts`. Fictional fixture only; no provider calls,
remote migration or deployment. This evidence does not close pending integration.

The prepared COD fixture patch was applied only to an isolated temporary copy;
all 11 tests in that copy pass against the current implementation. This proves
the proposed fixture correction, not a green repository suite. The canonical
`src/lib/payment-availability.test.ts` remains untouched pending its requested
Surface expansion. Patch: `/tmp/mybookcms-a226-payment-fixture.patch`.


## A-226 — verified local completion (2026-09-08)

This closure supersedes the historical partial checkpoints above. The owner
instructed continuation after the six exact scope paths were presented; all six
were recorded in the task boundary and integrated. The former COD fixture
failure is resolved in the repository, not only in a temporary copy.

Migration 0061/schemaVersion 62 and the fixed audit writer cover the privileged
HTTP store-settings, payment configuration, Ads, API-key, operator, credential
and template paths. Mutation/audit failures roll back together. Credential
changes retain the pre-rename actor; target sessions are revoked only after
successful persistence. Login lockout transitions and scheduler failures are
redacted best-effort records; 90-day pruning remains bounded to 1,000 rows/tick.
The read-only panel projects all 22 known actions, validated principals, fixed
labels and safe links through the existing Owner/Admin boundary. Direct
bootstrap/test configuration and template helper calls without an actor are
outside the privileged HTTP audit scope. Existing non-atomic KV login windows
do not guarantee globally exactly-once transition records.

Run `RUN-20260907T172505Z-90da78b5`: `npm run check`, all 504 tests, and a fresh
build pass. Workerd D1/KV tests exercise actual routes, rollback, redaction,
correlation, retention and session revocation. Real Chrome on the fresh isolated
Worker passes Owner/Admin panel checks at 390/1280 px for all 22 action labels,
actor variants, keyboard filtering and a 64-character username. Both restricted
roles receive 403; the API is no-store. Login tests produce ten 401 failures,
four repeated 429 denials and exactly two anonymous transition events. No browser
runtime exception or failed network request was observed. Designer inspection
passes the panel and long-actor screenshots in
`/tmp/mybookcms-a226-browser-LYYhMt`; the executable audit is
`/tmp/mybookcms-a226-browser.mts`.

The first keyboard harness omitted native Enter text/focus and failed its
activation assertion; foregrounding the page and sending the complete native
Enter event resolved the harness, with no product workaround. Earlier failed
checks remain historical evidence. No sandbox provider call, remote migration,
deployment, publication, commit or push was performed for this closure.
A-221 still needs the approved public HTTPS sandbox origin and DOKU Dashboard
setup; production activation/observation and publication remain separate gates.

A-264 cleans the DOKU receipt field above the CTA: full-width email, plain
disclosure, then privacy link. The 390/1280 isolated browser fixture passes
including payment gating, email validation, keyboard focus and 16px input text.
