# Tasks: MyBookCMS

> The single execution queue for this product. Every task traces to a
> requirement defined in `PRD.md` (`REQ-173`+ or `LOGIN-*`). Inherited
> AdsBookCMS work lives in `docs/lineage/inherited-tasks.md` and is **not** a
> backlog — never pick up a task from there.
>
> Delivered sections `A23`–`A25` are complete locally. Hosted CI, remote
> migration, deployment, vendor verification, commit, and push remain
> separately gated and are tracked in the Release gate section below.
>
> **Reading this queue in Goal Mode.** Work the `## Open queue` section only.
> Every open task carries `Risk`, `Surface`, `Non-scope`, `Dependencies` and a
> runnable `Done when`. Respect them literally: `Surface` is the complete set of
> paths a task may edit, and touching anything outside it is scope expansion
> that stops for the user, not a judgement call. A task marked
> **`Approval: required`** must never be executed autonomously — prepare it,
> report it, and stop. Tasks below `## Open queue` are delivered history or
> quarantined lineage and are never work to pick up.

## A26 — Malaysia market corrections

> Raised by a market audit on 2026-08-31, then verified against the built Worker
> under `wrangler dev --local` — not source rendering. Every task below except
> `A-192` is complete locally and covered by `src/lib/malaysia-market.test.ts`,
> whose invariants were each proven to fail when the defect is reintroduced.
> Deployment, commit, and push remain separately gated.
>
> **Browser evidence 2026-08-31**, Chromium at 390 and 1280 CSS px against the
> built Worker: `/kebijakan-privasi` renders the corrected disclosure with no
> overflow; `/embed/form` and every public document serve `lang="ms-MY"`; the
> PDP checkout resolved `50450` to `Kuala Lumpur · W.P. Kuala Lumpur`, normalized
> `0123456789` to `60123456789`, quoted `RM 8.00` against the 650 g variant and
> totalled `RM 47.90`, and enabled submission. Document width equalled viewport
> at both sizes and the console was empty at every step. The live API refused
> 5.2 kg with the new ceiling message and still quoted 4.55 kg at `RM 12.00`.

- [x] **A-190** — Make the privacy notice agree with what the storefront loads. **Done locally 2026-08-31** — `src/data/legal.ts` claimed `Kami tidak menggunakan tracker pengiklanan atau analitik pada storefront ini` while `BaseLayout.astro:169` mounts `<AdsBase />` (Meta Pixel and GTM) on every public page and `/kebijakan-cookie` already disclosed both, so two legal pages contradicted each other and the wrong one denied processing. The notice now states the processing, and names which fields are hashed: `meta-capi.ts:82-90` sends `ph`, `em`, `fn`, `ln`, `ct`, `st`, `zp`, `country` and `external_id` as SHA-256, while IP and user agent go as-is — the disclosure was widened to match after the first draft understated it.
      Primary requirement: REQ-202
      Constraints: REQ-193, REQ-197
      Dependencies: None
      Done when: the privacy page states the processing that ships, no legal page contradicts another, and a focused test fails if a tracker is mounted while the notice denies one.

- [x] **A-191** — Give the public embed form the product's own language. **Done locally 2026-08-31** — `EmbedLayout.astro` hardcoded `lang="id"` on the buyer-facing `/embed/form`; it now resolves `Astro.locals.tenant.locale` like every other public frame. `AdminLayout.astro` keeps `lang="id"` deliberately.
      Primary requirement: REQ-185
      Constraints: None
      Dependencies: None
      Done when: no buyer-facing layout pins a language, proven by a test that reads every layout except the admin one.

- [x] **A-192** — Retire the Indonesian public URL slugs. **Done locally 2026-08-31** — the labels were already Malay while the addresses were not: `Dasar Privasi` sat on `/kebijakan-privasi`, `Terma & Syarat` on `/syarat-ketentuan`, `Penghantaran & Pemulangan` on `/pengiriman`. Five routes renamed — `dasar-privasi`, `dasar-kuki`, `terma-syarat`, `penghantaran`, `hubungi-kami` — each retired address kept as a `308` that forwards its query string, because dropping it would break `gclid`/`utm` attribution on any live ad still pointing at the old URL. Footer, `data/site.ts`, `sitemap.astro` and `sitemap.xml.ts` advertise only the canonical form, and each page's own breadcrumb was repointed. `/solusi-terbaru` is left alone: it is already only a legacy `301` to `/produk`, so renaming it would add a hop and serve nobody. The admin is untouched and stays Indonesian.
      Primary requirement: REQ-203
      Constraints: REQ-185
      Dependencies: None
      Done when: Malay slugs serve the canonical URL, every retired slug answers exactly one `308` to its replacement, the sitemap and internal links carry only the canonical form, and a focused test proves no public surface advertises a retired slug. Verified live against the built Worker: all five retired addresses returned `308` with `num_redirects=1` to the right target; all five canonical addresses returned `200` with a matching `<link rel="canonical">`; `sitemap.xml` contained zero retired slugs and all five new ones; and in Chromium `/pengiriman?utm_source=fb&gclid=test123` landed on `/penghantaran` with `gclid=test123` intact and a query-free canonical.

- [x] **A-198** — Finish the address bar and link the cited cookie policy. **Done locally 2026-09-01** — the second pass over the footer: `Halaman` still pointed at `/landing-page` and `Jejak Pesanan` at `/order-status`, so the same label/address mismatch survived in English after the Indonesian one was fixed. Both are now `/halaman` and `/jejak-pesanan`, each retired address kept as a query-preserving `308`. The boundary was the risk here, not the rename: `/api/order-status` is polled by the thanks page and served to the v1 API, and `/admin/landing-pages` is an operator route, so both are deliberately untouched and now pinned by test. Separately, `/dasar-kuki` was cited in the privacy page's own prose but linked from nowhere except `sitemap.xml`; it is in the footer now. A stale comment in `solusi-terbaru.astro` claiming `/landing-page` had no route was corrected — it has had one since the page index landed.
      Primary requirement: REQ-203
      Constraints: REQ-185, REQ-208
      Dependencies: A-192
      Done when: every retired address answers one `308` that forwards its query string, no public surface advertises a retired slug, the API and admin paths that share those names are proven unchanged, and the cited cookie policy is reachable from the storefront. Verified live: all seven retired addresses returned `308` with `num_redirects=1`; all seven canonical addresses returned `200`; `POST /api/order-status` still validated rather than 404'd; `sitemap.xml` held zero retired slugs; and in Chromium the home page carried eight footer links whose labels and addresses were Malay throughout, with no retired slug anywhere in the document.

- [x] **A-193** — Tell a buyer why an overweight cart is refused. **Done locally 2026-08-31** — active bands stop at `5000` g in every zone, and the refusal was a bare `Kadar penghantaran belum tersedia untuk berat ini`. `quoteMalaysiaShipping` now reads the ceiling from the same active rules that failed to match and returns the buyer's own weight against it. Deliberately **not** written into the shipping policy as a constant: the bands are merchant-editable, so a hardcoded `5 kg` would become the next false claim. Surfacing it before the final step is not done and is tracked as REQ-205.
      Primary requirement: REQ-204
      Constraints: REQ-189
      Dependencies: None
      Done when: a focused test proves a cart above the highest active band reports both its own weight and the real ceiling, and that a cart inside the ceiling still quotes. Verified live: 8 x 650 g returned `Berat pesanan 5.2 kg melebihi had penghantaran 5 kg`, in Peninsular and Sabah alike, while 7 x 650 g still quoted.

- [x] **A-194** — Speak Malay on every buyer-reachable error. **Done locally 2026-08-31** — `malaysia-shipping.ts` returned `Varian produk tidak ditemukan.` and `headless-client.ts` returned two more Indonesian strings on the public API; `shipping-rates.ts` returned `Kadar penghantaran gagal dihitung.` while the checkout form beside it already said `dikira`. All now Malay. Admin-facing Indonesian is correct and untouched.
      Primary requirement: REQ-185
      Constraints: None
      Dependencies: None
      Done when: no library or public API route reachable by a buyer returns Indonesian, proven by a test over both layers.

- [x] **A-195** — Give the admin one timestamp rendering. **Done locally 2026-08-31** — `OrdersTable`, `OrderDetail` and `ShippingOperations` each carried their own `formatDateTime`, and they disagreed: the list rendered `id-ID` with no zone label while the other two rendered `en-MY` with one, so the same order showed two different times depending on the screen. One `formatAdminDateTime` in `admin-date-filter.ts` now owns it, in `id-ID` per the Indonesian admin contract, always carrying `MYT`.
      Primary requirement: REQ-186
      Constraints: REQ-185
      Dependencies: None
      Done when: a test pins the single rendering and fails if any admin component builds its own `Intl.DateTimeFormat`. **Verified in a real admin session 2026-09-01** against the built Worker, using an order whose stored `created_at` of `2026-08-31T17:23:45Z` falls on the other side of midnight in MYT — so a zone mistake would have shown the wrong *date*, not just the wrong time. All three surfaces rendered the identical `1 Sep 2026, 01.23 MYT`: the order list, order detail, and the Pengiriman workspace. The old code would have shown `1 Sep 2026, 01.23` in the list and `1 Sept 2026, 1:23 am MYT` in detail — same instant, two spellings, one without a zone. Console empty on every admin screen.

- [x] **A-196** — Cover the banks a Malaysian merchant actually collects into. **Done locally 2026-08-31** — `SELLER_BANK_OPTIONS` held 9 banks and omitted Bank Rakyat, which is one of the most common retail accounts in this market; Affin, Bank Muamalat, Agrobank and MBSB were also absent. Now 14. An operator could otherwise not select their own bank for manual transfer.
      Primary requirement: REQ-206
      Constraints: REQ-176
      Dependencies: None
      Done when: the list covers the common Malaysian retail banks and the existing seller-bank validation still refuses an unknown code.

- [x] **A-197** — Stop mixing Indonesian into Malay checkout copy. **Done locally 2026-08-31** — found by opening the page, not by reading source: the checkout trust strip rendered `Konfirmasi admin` directly beside `Harga disahkan`, so one three-item strip carried two languages, and `thanks.astro` described the same step as `Konfirmasi pesanan` in its meta description while its own timeline called it `Semakan admin`. Both are now `Pengesahan`. A source sweep had already passed over this because `konfirmasi` was not in the word list the earlier check used.
      Primary requirement: REQ-207
      Constraints: REQ-185
      Dependencies: None
      Done when: no buyer-facing component contains `konfirmasi`, pinned by test, and the rendered strip reads Malay throughout at 390 and 1280 px.

## A27 — Merchant pickup address

- [x] **A-199** — Record the merchant's own pickup address. **Done locally 2026-09-01** — the product had no pickup, warehouse, sender, or origin-address concept at all; `stores` held only `support_whatsapp`. That is consistent with REQ-180, so this is new reference data rather than a setting that existed and was empty. Migration `0058` adds four columns, not six: `city` and `state` are resolved from `malaysia_postcodes` on read, so a stored city can never disagree with its own postcode. `src/lib/store-pickup.ts` reuses the buyer-address validators — an address checkout would refuse is not one a courier can find either — and enforces all-four-or-none, because a half-filled pickup address reads as configured while being undeliverable.
      Primary requirement: REQ-209
      Constraints: REQ-180, REQ-185, REQ-192
      Dependencies: None
      Done when: the four fields validate as one unit, an unknown postcode is refused, city/state are resolved rather than stored, and a real admin save round-trips. Verified live: saving a real merchant pickup address through `/admin/settings/store` normalized its `(+60)…` mobile to the stored `60…` form and displayed `Sungai Buloh, Selangor` resolved from the directory for postcode `47000`. The operator's actual name, number, and street address live in the store database only — never in this repository.

## Open queue

- [x] **A-264** — Simplify the DOKU receipt area above the checkout button.
      Risk: R3. Requirement: REQ-235; explicit owner acceptance of the clean receipt recommendation.
      Surface: `TASKS.md`, `STATUS.md`, `BUILD-LOG.md`, `src/components/storefront/forms/MalaysiaCheckoutForm.astro`, `src/styles/form-hybrid.css`, `scripts/verify-checkout-flow.mts`.
      Non-scope: payment logic, provider calls, dependencies, deployment, commit/push.
      Dependencies: designer approved undecorated receipt container and email/disclosure/privacy ordering; correct the prior currency task identifier to A-263 while preserving the historical A-258 reconciliation task and ledger record.
      Done when: receipt field matches the other fields, disclosure precedes privacy, responsive browser checks retain gating/focus/validation and 16px inputs; build/check and independent review pass, including the A-263 documentation correction.

- [x] **A-263** — Send Meta and Google advertising values in IDR at a fixed MYR conversion rate.
      Risk: R3. Requirement: REQ-193; explicit owner acceptance of RM1 = Rp4,100 for both channels.
      Surface: `PRD.md`, `TASKS.md`, `STATUS.md`, `BUILD-LOG.md`, `ADS.md`, `src/lib/ads-signal-policy.ts`, `src/lib/ads-signal-policy.test.ts`, `src/lib/meta-capi.ts`, `src/lib/meta-capi.test.ts`, `src/lib/meta-event.test.ts`, `src/lib/order-persistence.test.ts`, `src/lib/doku-payment-lifecycle.test.ts`, `src/components/storefront/tracking/AdsBase.astro`, `src/pages/admin/ads/meta.astro`, `src/pages/admin/ads/google.astro`, `scripts/verify-ads-currency.mts`.
      Non-scope: changing stored money, payment/checkout amounts, XML currency, IDs, Purchase timing, CAPI receipt diagnostics, Google offline uploads, secrets, vendor traffic, deployment, commit/push.
      Dependencies: designer approved currency/rate copy updates without layout changes.
      Done when: Meta Pixel/CAPI, direct Google conversion and GTM ecommerce values convert once to IDR, incoming commerce values remain MYR, paired IDs match, no-value events stay valueless, D1/order/feed MYR invariants hold; tests/check/build, isolated browser and independent review pass.


- [x] **A-255** — Clarify footer navigation grouping, type and touch targets.
      Risk: R1. Requirement: REQ-185; explicit owner footer presentation request.
      Surface: `TASKS.md`, `BUILD-LOG.md`, `src/components/storefront/shared/SiteFooter.astro`.
      Non-scope: routes, link destinations, checkout, dependencies, deployment, commit/push.
      Dependencies: designer approved two groups with decorative group icons and 44px links.
      Done when: all eight links retain labels/destinations, 320/390/1280 browser shows readable groups with no overflow and usable keyboard focus; build and independent boundary review pass.


- [x] **A-254C** — Remove the owner-selected stock/WhatsApp information box from checkout.
      Risk: R3 (shared checkout path). Requirement: REQ-235; explicit owner deletion.
      Surface: `TASKS.md`, `BUILD-LOG.md`, `src/components/storefront/forms/MalaysiaCheckoutForm.astro`.
      Non-scope: behavior, styles, provider/API, deployment, commit/push.
      Dependencies: designer approved deleting the whole element without a spacer.
      Done when: build and browser confirm absent copy/box and intact summary-to-submit flow; independent boundary review passes.


- [x] **A-254** — Place DOKU receipt details before submit and refine mobile form presentation.
      Risk: R3. Requirement: REQ-235; explicit owner placement and mobile zoom request.
      Surface: `TASKS.md`, `BUILD-LOG.md`, `src/components/storefront/forms/MalaysiaCheckoutForm.astro`, `src/styles/form-hybrid.css`, `scripts/verify-checkout-flow.mts`.
      Non-scope: provider/API/order logic, viewport zoom restrictions, dependencies, deployment, commit/push.
      Dependencies: designer approved pre-CTA neutral panel, 16px padding/input text, preserved state/focus.
      Done when: browser at 390/1280 proves placement, keyboard order, conditional state and focus recovery; editable fields compute at least 16px without restricting zoom; build/check and independent review pass. Physical iOS Safari autozoom remains a device-specific verification limit.


- [x] **A-253** — Make the complete landing builder clearer and more modern, especially on mobile.
      Risk: R2. Requirement: REQ-234; explicit owner UI/UX refinement request.
      Surface: `TASKS.md`, `BUILD-LOG.md`, `STATUS.md`, `docs/LANDING-PAGES.md`, `src/components/admin/LandingPageEditor.tsx`, `scripts/verify-landing-builder.mts`.
      Non-scope: APIs, checkout behavior, schema, dependencies, deployment, commit/push.
      Dependencies: designer's editor-only mobile navigation, active-section and visual hierarchy handoff.
      Done when: mobile settings/content navigation preserves work, desktop retains two columns, seven type-specific add controls/outline/active section remain accessible, completion/save state is clear, all existing lifecycle/browser checks and independent review pass.
      Evidence: 517/517 tests, check/build and isolated Chromium at 390/1280 px passed. Browser assertions cover view defaults, validation view, retained drafts, outline selection, both deletion focus branches, normalized saves and existing builder lifecycle; /tmp/mybookcms-a251-browser-VI3xbx. Script gzip is 156,501 bytes with no added dependency.

- [x] **A-252Q** — Hide the entire payment section before selected location and correct summary comparison styling.
      Risk: R3. Requirement: REQ-235; explicit owner correction.
      Surface: `TASKS.md`, `BUILD-LOG.md`, `src/components/storefront/forms/MalaysiaCheckoutForm.astro`, `src/styles/form-hybrid.css`, `scripts/verify-checkout-flow.mts`.
      Non-scope: provider/order/stock logic, dependencies, deployment, commit/push.
      Dependencies: designer approved full-section hide after focus guard and muted strikethrough.
      Done when: section is absent before location selection and after reset, loading/error guidance appears after selection, current quote gates controls; comparison price is crossed out and tracks selected variant; build/browser/review pass.

- [x] **A-252P** — Give the shared checkout its own clear outer padding.
      Risk: R3 (shared checkout path); requirement REQ-235, explicit owner spacing request.
      Surface: `TASKS.md`, `BUILD-LOG.md`, `src/components/storefront/forms/MalaysiaCheckoutForm.astro`.
      Non-scope: checkout behavior, inner field spacing, image spacing, dependencies, deployment, commit/push.
      Dependencies: designer confirmed24px vertical/16px mobile horizontal/24px desktop horizontal before edit.
      Done when: one root owns padding without nested accumulation; build and390/1280 browser measurements pass with independent boundary review.

- [x] **A-252** — Rework the shared checkout as a progressive single-page contact/delivery/payment flow.
      Risk: R3. Requirement: REQ-235. Integrated into active A-251D after the owner's additional request.
      Surface: `PRD.md`, `TASKS.md`, `BUILD-LOG.md`, `STATUS.md`, `src/components/storefront/forms/MalaysiaCheckoutForm.astro`, `src/styles/form-hybrid.css`, `scripts/verify-checkout-flow.mts`.
      Non-scope: provider requests, payment availability policy, server order/stock rules, dependencies, deployment, commit/push.
      Dependencies: designer's Shopify-inspired single-page handoff; valid directory selection and current shipping quote remain authoritative.
      Done when: payment is initially hidden/disabled, opens after valid selected location/current quote, closes during changes/errors, restores valid prior choice/email, supports retries and all DOKU choices; narrow/wide browser states and existing checks/build pass with independent review.

- [x] **A-251D** — Make image-only landing sections full-width and seamless, and complete A-251C verification.
      Risk: R3 (inherited checkout-copy integration). Requirement: REQ-234; REQ-212/233 copy amendment.
      Surface: `PRD.md`, `TASKS.md`, `BUILD-LOG.md`, `STATUS.md`, `src/components/storefront/forms/MalaysiaCheckoutForm.astro`, `src/lib/malaysia-market.test.ts`, `src/styles/landing-pages/landing.css`, `scripts/verify-landing-builder.mts`.
      Non-scope: image cropping, text-section spacing, checkout behavior, deployment, commit/push.
      Dependencies: designer accepted zero-spacing image-only sections before edit; incorporates A-251C's earlier copy removal.
      Done when: adjacent public images span the column without gaps or distortion at390/1280; inline notice is absent; focused checks/build/browser and independent review pass.

- [x] **A-251C** — Remove the four inline checkout privacy paragraphs at the owner's explicit request.
      Risk: R3 (shared checkout path). Requirement: REQ-212 revised by owner; REQ-233 copy amendment.
      Surface: `PRD.md`, `TASKS.md`, `BUILD-LOG.md`, `STATUS.md`, `src/components/storefront/forms/MalaysiaCheckoutForm.astro`, `src/lib/malaysia-market.test.ts`.
      Non-scope: capture/order/payment behavior, separate privacy page, DOKU disclosures, deployment, commit/push.
      Dependencies: designer confirmed removal before edit.
      Done when: inline block is absent, name field follows recipient heading without an empty gap; focused tests/build and real browser pass; independent boundary review passes.

- [x] **A-251** — Complete the CMS landing builder against the verified AdsBookCMS authoring capability set.
      Risk: R3. Primary requirement: REQ-234. Constraints: REQ-233 and existing Malaysia checkout/access/native-page contracts.
      Surface: `PRD.md`, `TASKS.md`, `STATUS.md`, `BUILD-LOG.md`, `ARCHITECTURE.md`, `docs/CODE-MAP.md`, `docs/DEVELOPMENT-MAP.md`, `docs/LANDING-PAGES.md`, `src/components/admin/LandingPageEditor.tsx`, `src/pages/admin/landing-pages/new.astro`, `src/pages/admin/landing-pages/[id]/edit.astro`, `src/lib/landing-content.ts`, `src/lib/landing-content.test.ts`, `src/lib/landing-pages.ts`, `src/lib/landing-pages.test.ts`, `src/pages/api/admin/landing-pages/index.ts`, `src/pages/api/admin/landing-pages/[id].ts`, `src/pages/[slug].astro`, `src/db/migrations/0063_landing_content.sql`, `src/lib/version.ts`, `src/styles/landing-pages/landing.css`, `src/components/storefront/forms/GeoIpResolvedForm.astro`, `src/components/storefront/forms/MalaysiaCheckoutForm.astro`, `scripts/verify-landing-builder.mts`.
      Non-scope: new dependencies, provider/stock/payment policy, imported Indonesian checkout modes, editing native routes in the CMS, remote migration/deployment, commit/push.
      Dependencies: designer's seven-section/full-lifecycle handoff; existing upload boundary; local migration preserving all legacy rows.
      Done when: seven section types create/edit/reorder/duplicate/save/reload/render correctly, malformed content and cross-product variants are refused, old HTML/form rows survive migration; image failure/dirty/manual-slug/load/save states work; check/test/build, real-browser390/1280 workflows/public render and independent security/correctness review pass; client cost is measured.

- [x] **A-250I** — Make recovery row actions icon-only in one line and replace follow-up editing with a two-choice status flow, requested 2026-09-08.
      Risk: R3. Primary requirement: REQ-233.
      Surface: `TASKS.md`, `BUILD-LOG.md`, `src/components/admin/AbandonedOrders.tsx`, `scripts/verify-checkout-recovery-ui.mts`.
      Non-scope: unrelated pages, order persistence semantics, schema changes, dependencies, deployment, commit/push.
      Required status surface: `src/lib/checkout-lead.ts`, `src/lib/checkout-lead.test.ts`, `src/pages/api/admin/orders/leads.ts` — the owner-requested status-only mutation must preserve current server notes, including concurrent updates.
      Dependencies: designer handoff; existing recovery actions.
      Done when: three labeled 44 px icon actions fit on one line at 390/1280; Ubah status offers contact confirmation or real order conversion, preserves existing notes, and never marks failed/cancelled conversion complete; build and browser checks pass.

- [x] **A-250U** — Polish the checkout recovery UI/UX and keep its client footprint bounded, requested 2026-09-08.
      Risk: R2. Primary requirement: REQ-233.
      Surface: `TASKS.md`, `STATUS.md`, `BUILD-LOG.md`, `src/components/admin/AbandonedOrders.tsx`, `scripts/verify-checkout-recovery-ui.mts`.
      Non-scope: new business flows, API/schema/permissions changes, global redesign, dependencies, deploy, commit or push.
      Dependencies: accepted designer handoff; existing shadcn primitives and A-250 recovery flow.
      Done when: loading/refresh/error/empty/filter states are truthful and actionable; rows and dialogs wrap on mobile, controls have usable targets, quote failures stop looking pending; first load avoids search debounce; focused tests/check/build and real-browser flows pass; before/after client asset bytes are recorded with no new dependency.

- [x] **A-250N** — Expose checkout recovery in the shared admin navigation, requested 2026-09-08.
      Risk: R1. Primary requirement: REQ-233.
      Surface: `TASKS.md`, `STATUS.md`, `BUILD-LOG.md`, `src/components/admin/admin-navigation.ts`, `src/lib/admin-navigation.test.ts`.
      Non-scope: checkout data, conversion logic, role grants, new routes, deployment, commit or push.
      Dependencies: existing A-250 workspace; designer navigation handoff.
      Done when: Owner/Admin/CS can navigate to pending leads from desktop/mobile menus, advertiser cannot see the link, focused navigation tests and build pass, and real browser verifies the submenu and destination.

- [x] **A-250** — Complete variant-aware CRM and abandoned checkout recovery, authorized by the owner on 2026-09-08.
      Risk: R3 — public personal-data capture and atomic conversion into a stock-reserving order.
      Surface: `PRD.md`, `TASKS.md`, `STATUS.md`, `BUILD-LOG.md`, `ARCHITECTURE.md`, `PLAN.md`, `docs/CODE-MAP.md`, `docs/DEVELOPMENT-MAP.md`, `src/db/migrations/0062_checkout_leads.sql`, `src/lib/version.ts`, `src/lib/checkout-lead.ts`, `src/lib/checkout-lead.test.ts`, `src/lib/order-persistence.ts`, `src/lib/crm-template.ts`, `src/lib/crm-template.test.ts`, `src/pages/admin/settings/crm.astro`, `src/components/admin/OrdersTable.tsx`, `src/components/admin/OrderDetail.tsx`, `src/components/admin/AbandonedOrders.tsx`, `src/pages/admin/orders/abandoned.astro`, `src/pages/admin/orders/index.astro`, `src/pages/api/admin/orders/leads.ts`, `src/pages/api/checkout-lead.ts`, `src/components/storefront/forms/MalaysiaCheckoutForm.astro`, `src/pages/dasar-privasi.astro`.
      Non-scope: provider calls, automatic WhatsApp sending, DOKU/manual-transfer CS conversion, imported upstream shipping taxonomy, remote migration, deployment, commit or push.
      Primary requirement: REQ-233
      Required shared surface: `src/components/admin/MalaysiaLocationCombobox.tsx` — the new conversion form reuses this field; keyboard selection must work for the accepted accessible conversion flow.
      Constraints: REQ-182, REQ-186, REQ-190, REQ-198, REQ-203
      Dependencies: designer screen contract; existing full checkout and local D1 persistence.
      Done when: real-D1 tests prove validation, replay/concurrency, conversion rollback, no stock/revenue/Purchase on capture, COD-disabled refusal and denied roles; CRM rendering tests prove separate variant substitution; check/test/build and route-map checks pass; real browser proves partial form capture, admin follow-up, quote and conversion, buyer completion cleanup, CRM chip insertion and responsive use; independent review passes.
      Delivered locally 2026-09-08: variant token and separate lead workspace implemented; 512/512 full tests, check/build, real-D1 regression checks, responsive Chromium flows and independent review. Two fictional leads were created through the refreshed Tailscale form without submitting additional orders. Conversion supports one item and COD; no live mutation, commit, or push.

Ordered. `G-1` blocks nothing technically but is the only task with a live
external consequence, so it is listed first and stops for the user.

### Current execution order

Screened against disk 2026-09-07 at `62f634d` plus the uncommitted A-243 surface.
The task entries below remain the canonical queue; this section only orders them
and says which document a reader should open first, because several entries are
blocked by a decision recorded elsewhere rather than by code.

**Read these before executing anything in this queue.** `PRD.md` is the only
authority for whether a requirement is accepted. A-248/REQ-211/REQ-212 are now
accepted and verified locally under ADR-030. A-245/REQ-232 is implemented under
ADR-031. A-226/REQ-230 is accepted, including the six-path expansion authorized on
2026-09-08; implementation is verified locally with complete audit and panel coverage. `DECISIONS.md` carries the accepted architecture decisions those
entries build on, most recently ADR-026 for COD and ADR-027 for capability
lifetime. `OBSERVABILITY.md` fixes every stable signal name and its allowed
fields; anything that adds a production log line is incomplete until it is
registered there, which A-243 learned the hard way. `RELEASE.md` owns the gates
no task may skip. `STATUS.md` describes the current state and is the fastest way
to see what is genuinely done versus merely implemented.

Decisions first, because they unblock the most and cost the least:

0. **A-258** comes before everything, including the numbered items below, and
   it is the owner's action rather than an agent's: 61 uncommitted files,
   among them two migrations and the whole of A-250/A-251C, sit on one disk,
   and every ledger run that touches `TASKS.md` or `STATUS.md` inherits them
   as pre-existing dirty paths and closes BLOCKED for that reason alone.
   Read the health report at
   `~/Documents/work/research/mybookcms-health-2026-09-08.md`, then
   `git status --short`. A-259 through A-262 all depend on it.
   **A-265** and **A-266** sit beside it as the cheapest truth work in the queue:
   the id-uniqueness check that stops the collision that has now happened four
   times today, and the joining of sixteen `Implemented locally` rows to tests
   that already exist. Neither needs a designer, a decision, or a commit first.

1. **A-246** records the owner's accepted reviewer policy in ADR-028.
   GPT-5.6 Sol may supply the independent review previously tied to Opus.
   A-241/A-242/A-243 now have fresh local closure runs with verification and
   independent boundary review. Historical BLOCKED runs remain unchanged.
   Read ADR-028
   and the run evidence in `.delivery/runs/`.
2. **A-247** decides whether that evidence is tracked at all. Pairs naturally
   with A-246 and is a few minutes of work. Read `.delivery/.gitignore` and
   `AGENTS.md`.
3. **A-244** repairs the local development path so a worker started from the
   repository's own script can read the DOKU sandbox configuration. It is not a
   product gap, but it is the reason two sessions have now mistaken a working
   install for a broken one. Read `INSTALLATION.md`.

Decision follow-through after the owner authorized the blocked tasks:

4. **REQ-232** in `PRD.md` — accepted under ADR-031; **A-245** implements
   disabled-channel recovery without changing the committed channel.
5. **REQ-211/REQ-212** in `PRD.md` — accepted under ADR-030 and implemented
   locally by **A-248**, with bilingual content and first-collection links verified.
6. **REQ-230** in `PRD.md` — accepted for **A-226**. The owner approved the six-path
   expansion; implementation and verification cover the complete audit flow.

Then the implementation work that already has its decision:

7. **A-256** makes the admin canvas obey the design system it already has. It is
   listed above the other visual work because it is the substrate: `shadcn/ui`,
   `src/styles/admin.css`, and `DESIGN-SYSTEM.md` already mandate a semantic
   layer that the components bypass roughly thirteen to one, and the raw
   `text-slate-500` that arithmetic produces is the exact pair `DESIGN-SYSTEM.md`
   measured as failing AA on the admin page background. Converting the token
   layer first removes most of the drift and closes that contrast trap in one
   pass; doing it after A-232 and A-234 would mean styling new surfaces into a
   vocabulary those tasks then have to unpick. Read `DESIGN-SYSTEM.md`, then
   `src/styles/admin.css`. Requires the designer/vision handoff before the first
   visual edit.
8. **A-232** enforces the accepted Owner/Admin COD control. Its server half
   landed 2026-09-07 in `62f634d`; what remains is the operator control, which
   needs the designer handoff because it adds a shared admin payment control.
   Read ADR-026 in `DECISIONS.md`.
9. **A-234** can start only after its required designer handoff decides the
   shared switch's 44 px target treatment without destabilising every admin
   list. It stays independent of A-255: that task owns colour and shell
   vocabulary, this one owns the 44 px interactive box. Read `DESIGN-SYSTEM.md`
   and `design-tokens.md`.

External, production, and approval gates keep their explicit approvals and are
not reordered by anything above:

10. **A-221**, **A-222**, **A-223**, and **G-1** remain external/release work.
   **A-204** now has a successful hosted run on `b093cb8`. A-221 must precede
   A-222, and A-222 must precede A-223. Read `RELEASE.md` before any of them, and
   note that A-221 now also owns confirming the exact `payment.channel` string
   DOKU returns per channel — `CREDIT_CARD` most of all, because a mismatch there
   strands a paid order rather than failing loudly.
11. **MYS-5** is last and lives under `## Release gate`, not in this queue, on
   purpose: its own `Dependencies` line is that the Open queue is empty, so
   listing it inside the thing it waits for would make it self-referential. It is
   the only open task outside the queue, and it is outside it deliberately.

Before judging whether a route is finished, or looking for what nothing covers,
open `docs/DEVELOPMENT-MAP.md`. `docs/CODE-MAP.md` says where code lives; the
development map says how mature it is, and it is the only document that crosses
the routes on disk against tests, browser evidence, and this queue. Three
entries gained a page address from it: A-232 is now closed on
`/admin/payments`; A-245 remains on `/payment/doku/cancel`, and A-248 on
`/dasar-privasi` plus the shared checkout notice link. Every task that adds, changes or removes a route must update its
development-map row in the same task, cite its evidence, and include the map in
its Surface. Run the development-map and code-map tests before closing it.

Screened and deliberately not queued: the `// lazy:` retention ceiling in
`src/lib/notifications.ts` names its own trigger and upgrade path, and no store
is near it. It is an accepted corner, not an open gap.

- [ ] **G-1** — Publish the repository. **Approval: required — never run autonomously.**
      The working tree and local history are clean, but `origin/malaysia-market-audit` still carries two commits (`b34770b`, `9be8c3f`) whose test fixtures held a real person's full name, live Malaysian mobile, and home address. Local history was rebuilt without them; the remote was deliberately left untouched because overwriting it needs the user's explicit word. Publishing before the remote is replaced would put that individual's personal data on the public internet, where it can be indexed and cached even if the repository is made private again.
      Risk: R4 — outward-facing, effectively irreversible once indexed, and personal data is involved.
      Surface: git remote state and GitHub repository settings only. No file edits.
      Non-scope: merging to `main`; deploying anything to Cloudflare; changing `.github/workflows/ci.yml`.
      Dependencies: none
      Done when, in this order, each step confirmed before the next:
        1. The user has explicitly approved a force-push for this branch.
        2. `git push --force-with-lease origin malaysia-market-audit` succeeds.
        3. The retired fixtures are gone from every reachable commit. Search for the operator's own name and mobile as they appear in the store database — do not write either into this file or any other, or the check becomes the leak it is meant to prevent.
        4. Only then the repository visibility is changed, and `gh api repos/ongkipro/mybookcms --jq .visibility` reports `public`.
      Note for whoever runs this: making the repository public also makes `DEFAULT_ADMIN_PASSWORD_HASH` and the documented `admin`/`admin` first-run behaviour publicly readable. That is already mitigated by `LOGIN-3`, but it becomes trivially discoverable. Publication is no longer a prerequisite for GitHub Actions: A-204 has a successful private-repository run on `b093cb8`.

- [x] **A-200** — A seeded local store cannot save its own settings. **Done 2026-09-01** — `save-store` re-validated `site_url` on every submit, but the local seed writes a plain-http address straight into the row, bypassing that rule. So the settings form refused *every* save — pickup address, tagline, logo — with `Alamat toko harus memakai https`, an error naming a field the operator had not touched. The decision moved out of the route into `resolveStoreSiteUrl`, which grandfathers a value identical to the stored one and applies the https rule the moment it actually changes, which is the only time it can be wrong on purpose.
      Risk: R1 — one validation path, no schema or auth change.
      Surface: `src/pages/api/admin/settings.ts`, `src/lib/store-site-url.ts`, `src/lib/store-site-url.test.ts`.
      Non-scope: relaxing the https rule for production; touching any other `save-*` action.
      Primary requirement: REQ-209
      Constraints: REQ-182
      Dependencies: none
      Done when: a store row whose stored `site_url` is already non-https can save an unrelated field without editing it, production still refuses a non-https value the operator actually submits, and a focused test covers both directions. Verified live in the admin against the built Worker, with the seeded `http://…:8787` left untouched: saving the pickup address returned `Profil store disimpan.` and resolved `Sungai Buloh, Selangor`; changing the address to `http://kedai.example` was still refused with `Alamat toko harus memakai https.`; and `https://kedai.example/produk?x=1` was accepted and stored as its origin.

- [x] **A-201** — Remove developer-machine addresses from the repository. **Done 2026-09-01** — a Tailscale address for one specific machine was committed in `scripts/seed-preview-local.sql`, `src/lib/auth.test.ts`, and the inherited lineage. Not routable from the internet and not a credential, but a private detail of one developer's network that no installer needs. All now use `198.51.100.10` (RFC 5737 TEST-NET-3, reserved for documentation and routable nowhere), so a future reader cannot mistake it for a real host.
      Risk: R1 — fixture and seed data only.
      Surface: `scripts/seed-preview-local.sql`, `src/lib/auth.test.ts`, `docs/lineage/inherited-tasks.md`.
      Non-scope: rewriting git history to purge it from old commits; that trade is the user's to make, not this task's.
      Primary requirement: REQ-210
      Constraints: none
      Dependencies: none
      Done when: no committed file outside git history carries a CGNAT-range address, and `npm test` still passes.

- [x] **A-202** — Surface the weight ceiling before the final checkout step. **Closed 2026-09-01 as not applicable. No code was written, on purpose.**
      Checking the actual path before building it: the storefront has **no quantity control anywhere**, and `MalaysiaCheckoutForm.astro` hardcodes `quantity: 1` in the order payload. The heaviest variant in the catalog is 650 g against a 5000 g ceiling in every zone, so a buyer cannot construct a cart that reaches the limit. A warning about a limit nobody can hit is noise on the highest-value screen in the product.
      The ceiling *is* reachable by a headless client, because `/api/v1/geo/shipping-rates` accepts a quantity. That path is already served: `A-193` made the refusal name the buyer's own weight and the real ceiling, both read from the active rules.
      Reopen this the moment checkout gains a quantity control — at that point `REQ-205` becomes live and this task is the design note for it.
      Risk: R2 if ever reopened — browser-visible checkout behaviour.
      Surface: none. Closed without an edit.
      Non-scope: adding a quantity control to justify the warning; that is a product decision, not a way to make a task apply.
      Primary requirement: REQ-205 (withdrawn)
      Constraints: REQ-189, REQ-204
      Dependencies: A-193
      Done when: closed with the reason recorded, `REQ-205` marked withdrawn rather than silently dropped, and the condition that would revive it stated.

- [x] **A-203** — Settle whether the privacy notice must be bilingual. **Researched 2026-09-01. Confirmed against the primary source; the change itself is now REQ-211/REQ-212 and is NOT accepted yet.**
      Verified against Laws of Malaysia **Act 709 s.7(3)**, read from the Act text rather than a summary: *"A notice under subsection (1) shall be in the national and English languages, and the individual shall be provided with a clear and readily accessible means to exercise his choice, where necessary, in the national and English languages."* It is `shall`, not a recommendation, and s.5(2) makes contravening a principle an offence carrying a fine up to RM300,000 and/or two years' imprisonment.
      Two findings, both narrower than feared. First, s.7(3) binds the **notice**, not the storefront: `REQ-185` survives intact for product, checkout and marketing copy — only `/dasar-privasi` is affected. Second, s.7(2)(a) requires the notice *"as soon as practicable … when the data subject is first asked … to provide his personal data"*, which is the checkout form, not a footer link discovered afterwards.
      The apparent conflict with `REQ-185` dissolves on reading: the statute demands both languages, `REQ-185` bars a *selector*. Publishing both on one page, Malay first, satisfies both without reintroducing a selector, a locale cookie, or a fallback.
      Risk: R2 — legal conformance; the drafting of legal copy is the user's to accept, not an agent's to invent.
      Surface: this research record, `PRD.md`.
      Non-scope: writing or publishing the English legal text; producing a legal conclusion. This records what the statute says. Whether to act, and in what words, is the operator's decision.
      Primary requirement: REQ-185
      Constraints: REQ-203
      Dependencies: none
      Done when: the statutory text is cited from a primary source, the conflict with `REQ-185` is stated plainly, and either a `Proposal` requirement is recorded or the question is closed with reasoning. Recorded as `REQ-211` and `REQ-212`, both `Proposal`.

- [x] **A-204** — Get hosted CI to actually run. **Verified on GitHub 2026-09-08.**
      The two 2026-08-25 runs never started because of account billing. A fresh
      workflow dispatch on `b093cb82ba14124288e445e7fab112b4fdf5ec49` now passes
      checkout, Node setup, dependency installation, check, tests and build on
      GitHub's runner. The private repository and verification-only workflow
      were unchanged. This replaces the old external-blocker claim for A-204.
      Evidence: [CI run 34147093570](https://github.com/ongkipro/mybookcms/actions/runs/34147093570), delivery run `RUN-20260907T171900Z-d90cd59d`.
      Risk: R0 — bounded verification workflow and completion evidence.
      Surface: `TASKS.md`, `STATUS.md` for canonical completion evidence; `.github/workflows/ci.yml` only if a real defect is found after runs start.
      Non-scope: adding a deploy step; moving CI to another provider; disabling checks to make the badge green.
      Primary requirement: REQ-200
      Constraints: none
      Dependencies: none; repository publication is not required for this verified run.
      Done when: one CI run completes on a real commit and its check/test/build steps are observed to pass or fail on their own merits rather than never starting.

- [x] **A-205** — Adapt PermataMall's proven Meta/Google identity hardening to the Malaysia signal contract without importing its Indonesia order taxonomy. **Done locally 2026-09-01.** Paid-click identity now survives UTM-only follow-ups and is replaced only by a new paid click; Pixel and CAPI share one random first-party Meta visitor identity; regional Google Consent Mode precedes tag configuration; and direct Google Purchase receives Malaysia-normalized enhanced-conversion matching without changing accepted-order timing, MYR merchandise value, or transaction identity. The Indonesia offline-conversion outbox was deliberately not ported because it would create a second Purchase owner under this product's taxonomy.
      Risk: R2 — advertising attribution and customer-matching behavior; no schema, secret, provider call, or UI redesign.
      Surface: `PRD.md`, `TASKS.md`, `STATUS.md`, `BUILD-LOG.md`, `src/lib/click-ids.ts`, `src/lib/click-ids.test.ts`, `src/middleware.ts`, `src/lib/accepted-order-meta.ts`, `src/lib/order-persistence.ts`, `src/lib/order-persistence.test.ts`, `src/pages/api/meta-event.ts`, `src/components/storefront/tracking/AdsBase.astro`, `src/pages/thanks.astro`, `src/lib/ads-signal-policy.test.ts`.
      Non-scope: Google Ads API offline uploads; changing accepted COD/manual-transfer Purchase timing; adding a CMP or cookie banner; changing the Meta Graph API pin while its official changelog is unavailable; editing Ads admin presentation; live vendor verification.
      Primary requirement: REQ-213
      Constraints: REQ-193, REQ-197, REQ-202
      Dependencies: none
      Done when: focused tests prove UTM-only visits retain a stored paid-click identity, a new paid click replaces it, malformed visitor identity fails closed, browser Pixel and CAPI use the same advertiser-issued Meta identity, Consent Mode commands precede Google configuration, and direct Google Purchase receives Malaysia-normalized matching data while retaining MYR merchandise value and the canonical order transaction ID; then `npm run check`, `npm test`, and `npm run build` pass without any vendor request.
      Evidence 2026-09-01: focused Ads/persistence tests pass 11/11; the complete suite passes 341/341; `npm run check` reports zero diagnostics across 320 files; and the Cloudflare server build completes. No secret was read, no vendor endpoint was called, and no remote mutation was performed.

- [x] **A-206** — Cut every buyer checkout entry point over to the canonical Malaysia full form. **Designer handoff accepted; completed locally 2026-09-01.** PDP, CMS landing pages, direct links, embeds, public form configuration, Headless product responses, and OpenAPI now expose one mode-less full Malaysia checkout. Operator mode selectors and persisted mode defaults are removed; legacy stored mode values are ignored. All six retired routes perform one query-preserving `308` to `/full-form`, while the retired middle submission API is an inert `410 no-store` tombstone with no database path.
      Risk: R3 — browser-visible checkout UX touches payment selection and submission, plus embed compatibility and attribution-preserving redirects.
      Surface: `PRD.md`, `TASKS.md`, `STATUS.md`, `BUILD-LOG.md`; checkout components `src/components/storefront/forms/GeoIpResolvedForm.astro` and `src/components/storefront/forms/MalaysiaCheckoutForm.astro`; operator choices `src/components/admin/ProductCatalog.tsx` and `src/components/admin/LandingPageEditor.tsx`; form contracts `src/lib/form-config.ts`, `src/lib/embed-markup.ts`, `src/lib/landing-pages.ts`, and `src/lib/headless-openapi.ts`; buyer/API entry points `src/pages/produk/[slug].astro`, `src/pages/[slug].astro`, `src/pages/embed/form.astro`, `src/pages/api/form-config.ts`, `src/pages/api/submit-middle-order.ts`, `src/pages/api/v1/products/index.ts`, `src/pages/api/v1/products/[slug].ts`, `src/pages/full-form.astro`, `src/pages/middle-form.astro`, `src/pages/hybrid-form.astro`, `src/pages/form-middle.astro`, `src/pages/form-hybrid.astro`, `src/pages/form-full.astro`, and `src/pages/geoipform.astro`; checkout-only style ownership in `src/styles/form-hybrid.css`, `src/styles/foundation.css`, and `src/styles/storefront.css`; focused tests `src/lib/form-config.test.ts`, `src/lib/embed-markup.test.ts`, `src/lib/landing-pages.test.ts`, `src/lib/submit-middle-order.test.ts`, `src/lib/system-precision.test.ts`, plus the smallest new route/browser regression selected after the UX handoff.
      Non-scope: visual redesign, new checkout steps, quantity controls, payment or shipping policy changes, deleting a retired URL without a query-preserving redirect.
      Primary requirement: REQ-214
      Constraints: REQ-186, REQ-188, REQ-190, REQ-203
      Dependencies: accepted designer/vision checkout handoff
      Done when: the UX owner has accepted the cutover; PDP, CMS landing, direct, embed, Headless product, and OpenAPI entry points expose one full-form contract; `middle`/`hybrid` are absent from operator choices, stored form-mode defaults, generated snippets, API response fields, and public execution; the dedicated middle submit endpoint is unreachable; retired URLs preserve all query parameters through one permanent redirect; focused tests plus real Chromium at 390 and 1280 px prove checkout completion, keyboard/error states, zero overflow, and no browser errors.
      Evidence 2026-09-01: designer handoff accepted; focused cutover tests pass 33/33; the full suite passes 405/405; `npm run check` reports zero diagnostics across 350 files; and the Cloudflare server build completes. Built-Worker and real Chromium checks at 390/1280 px prove one-step redirects retain Meta/Google attribution plus duplicate query keys, embed legacy `mode` is inert, the full address/postcode/shipping/payment flow reaches `/thanks`, variant controls retain keyboard focus, both widths have zero overflow, and no console/runtime error occurs. No vendor request, remote mutation, deployment, commit, or push occurred.

- [x] **A-207** — Restore the repository-wide TypeScript gate without changing queue behavior. **Done locally 2026-09-01.** The test now asserts and narrows the required heading match before reading its index; all four queue-contract tests pass and the full TypeScript gate is green.
      Risk: R1 — test typing only; runtime and task semantics remain unchanged.
      Surface: `TASKS.md`, `STATUS.md`, `BUILD-LOG.md`, `src/lib/task-queue.test.ts`.
      Non-scope: weakening the open-queue assertions; changing any production module; changing CI configuration.
      Primary requirement: REQ-200
      Constraints: none
      Dependencies: none
      Done when: the test narrows the required open-queue heading before reading its index, the task-queue tests still pass, and `npm run check` reports zero diagnostics.

- [x] **A-208** — Remove repository artifacts that do not belong to MyBookCMS and pin the active-runtime boundary. **Done locally 2026-09-01.** Deleted the stale archived AdsBookCMS install procedure, whose files and requirement ids no longer exist here, plus the redundant `public/.gitkeep`. A source guard now refuses named retired Indonesia logistics/payment/advertising runtimes while deliberately exempting forward migration history and test fixtures. `docs/lineage/` remains the explicit fork provenance; the established Malaysia hybrid voice remains product copy rather than a form mode.
      Risk: R1 — deletion is limited to one stale archived procedure and one empty placeholder; runtime behavior is unchanged.
      Surface: `PRD.md`, `TASKS.md`, `STATUS.md`, `BUILD-LOG.md`, `docs/archive/ADSBOOKCMS_INSTALL_UPDATE_PLAN.md`, `public/.gitkeep`, `src/lib/brand-contamination.test.ts`.
      Non-scope: deleting or rewriting forward-only migrations; deleting `docs/lineage/`; renaming the Malaysia hybrid-language contract or its active stylesheet; performing the full-form UX cutover owned by A-206.
      Primary requirement: REQ-215
      Constraints: REQ-180, REQ-182, REQ-214
      Dependencies: none
      Done when: the stale AdsBookCMS install procedure and unnecessary public placeholder are absent, a focused source guard rejects named retired Indonesia provider/payment runtimes outside migration history and tests, and the full repository check/test/build gates pass.

- [x] **A-209** — Define the DOKU/senangPay Malaysia product and architecture contract before implementation. **Done as planning only 2026-09-01.** Official senangPay guidance routes migrated merchants to DOKU APIs, so the accepted design uses one DOKU Malaysia Global API adapter and hosted Checkout rather than parallel legacy senangPay/DOKU clients. ADR-021 records the decision; PRD, PLAN, status, architecture, observability, install, and release documents distinguish the accepted roadmap from current runtime truth.
      Risk: R1 — documentation only; no schema, credential, vendor request, or runtime behavior.
      Surface: `PRD.md`, `PLAN.md`, `TASKS.md`, `DECISIONS.md`, `STATUS.md`, `ARCHITECTURE.md`, `OBSERVABILITY.md`, `INSTALLATION.md`, `RELEASE.md`, `BUILD-LOG.md`.
      Non-scope: implementing any provider code; creating a DOKU/senangPay account; reading or storing credentials; sandbox/live requests; remote migration or deployment.
      Primary requirement: REQ-216
      Constraints: REQ-173, REQ-180, REQ-182, REQ-214
      Dependencies: none
      Done when: canonical documents agree on one hosted DOKU adapter, explicit deferred scope, local/provider authority, security/lifecycle invariants, ordered implementation tasks, approval gates, and the current runtime is still reported as COD/manual transfer only.

Every A-210–A-223 implementation is R3/R4 payment work. The executing run must
use the repository delivery boundary, record its base/dirty paths and exact
Surface, and obtain the independent correctness/security review required by
`AGENTS.md`; a local green build alone is not approval for sandbox or live use.

- [x] **A-210** — Add the forward-only D1 payment-provider schema and lifecycle constraints. **Done locally 2026-09-01.** D1 now owns one encrypted-provider configuration record per install, order-linked DOKU payment attempts with unique invoice/reference/idempotency identities and monotonic terminal constraints, plus deduplicated append-only lifecycle events including buyer returns.
      Risk: R3 — payment and stock state; a faulty constraint can orphan or duplicate a charge attempt.
      Surface: `src/db/migrations/0059_doku_malaysia_payments.sql`, `src/lib/schema-version.ts`, `src/lib/schema-version.test.ts`, `src/lib/doku-schema.test.ts`, `src/lib/version.ts` (user-approved expansion: migration `0059` raises the Worker boot schema contract to 60).
      Non-scope: credentials UI; provider HTTP calls; webhook routes; changing existing order or advertising behavior.
      Primary requirement: REQ-220
      Constraints: REQ-173, REQ-182, REQ-198, REQ-217
      Dependencies: A-209
      Done when: a clean local D1 migration creates provider configuration, payment attempt, and deduplicated event records with order foreign keys, integer-sen checks, unique merchant/provider/idempotency identities, legal local status constraints, and no plaintext secret/raw-payload column; schema-version and migration tests pass.
      Evidence 2026-09-01: an isolated Wrangler local D1 applied all 60 migrations through `0059` and exposed all three payment tables; focused schema/version tests pass 10/10, the complete suite passes 345/345, `npm run check` reports zero diagnostics across 321 files with `tsc --noEmit` exit 0, and the Cloudflare server build completes. Independent gpt-5.4 review found the missing `return` event source; the corrected migration and regression test received a final PASS with no remaining findings. No credential, vendor request, remote database, or deployment was involved.

- [x] **A-211** — Implement the DOKU Global integrity and transport boundary from official test vectors. **Done locally 2026-09-01.** Exact raw-byte Global request/response signatures, endpoint target/version binding, bounded freshness, Basic API-Key authentication, MYR amount checks, bounded bodies/timeouts, and Cards-shape refusal are covered without vendor traffic.
      Risk: R3 — cryptographic request/response authenticity and payment-provider communication.
      Surface: `src/lib/doku-signature.ts`, `src/lib/doku-signature.test.ts`, `src/lib/doku-client.ts`, `src/lib/doku-client.test.ts`.
      Non-scope: Cards-only signatures; browser-side credentials; D1 mutation; live/sandbox vendor calls; retries beyond DOKU idempotency semantics.
      Primary requirement: REQ-219
      Constraints: REQ-173, REQ-182, REQ-216, REQ-217
      Dependencies: A-209
      Done when: focused tests generated from the current official DOKU Malaysia reference prove exact raw-body digesting, request and response HMAC-SHA256 Global signatures, constant-time comparison, request-target binding, bounded timestamp/replay checks, per-endpoint API-version headers, Basic API-Key authentication, MYR validation, response-signature refusal, timeout/error sanitization, and explicit rejection of Cards-only signature shapes without making a vendor request.
      Evidence 2026-09-01: delivery run `RUN-20260901T050314Z-9112427b` finished PASS after focused transport/signature tests, repository checks, build, and independent review. No credential or DOKU request was used.

- [x] **A-212** — Add encrypted DOKU configuration and a role-scoped admin API. **Done locally 2026-09-01.** Provider-purpose AES-GCM storage, disabled draft persistence, environment/revision binding, channel allowlisting, masked health reads, and owner/admin authorization are implemented; no admin activation UI exists yet.
      Risk: R3 — payment credentials and authorization.
      Surface: `src/lib/encrypted-secret.ts`, `src/lib/encrypted-secret.test.ts`, `src/lib/ads-secret.ts`, `src/lib/ads-secret.test.ts`, `src/lib/ads-config.ts`, `src/lib/ads-config.test.ts`, `src/lib/doku-config.ts`, `src/lib/doku-config.test.ts`, `src/pages/api/admin/ads.ts`, `src/pages/api/admin/payments.ts`, `src/lib/auth.ts`, `src/lib/auth.test.ts`.
      Non-scope: rendering the Payments admin UI; provider calls; exposing, decrypting, or logging a stored secret to the browser; environment promotion.
      Primary requirement: REQ-217
      Constraints: REQ-182, REQ-216, LOGIN-3
      Dependencies: A-210
      Done when: the existing AES-GCM pattern is generalized once with provider-purpose AAD; Meta keeps passing unchanged; owner/admin can validate and save a disabled sandbox/production DOKU credential draft, encrypted API/Secret Keys, and an allowlisted channel policy; this backend task exposes no runtime activation action; advertiser/customer-service roles are refused; reads return only source/mask/health; plaintext, invalid, incomplete, or cross-environment configuration fails closed; and focused auth/encryption/API tests pass.
      Evidence 2026-09-01: delivery run `RUN-20260901T051333Z-0a741b3f` finished PASS after focused encryption/config/auth tests, repository checks, build, and independent review. No secret value was read or returned.

- [x] **A-213** — Create an idempotent DOKU hosted Checkout from an authoritative local order. **Done locally 2026-09-01.** The backend persists order, stock reservation, and payment attempt before a signed create call; response authentication and amount/identity checks fail closed; identical submit intent converges without enabling DOKU in public/admin UI.
      Risk: R3 — order persistence, stock reservation, money, and external payment initiation.
      Surface: `src/lib/order-schema.ts`, `src/lib/order-schema.test.ts`, `src/lib/order-persistence.ts`, `src/lib/order-persistence.test.ts`, `src/lib/doku-checkout.ts`, `src/lib/doku-checkout.test.ts`, `src/pages/api/submit-order.ts`, `src/pages/api/v1/checkout.ts`, `src/lib/headless-openapi.ts`, `src/lib/headless-openapi.test.ts`.
      Non-scope: buyer visual changes; webhook transitions; direct Payment/Cards APIs; BNPL; trusting browser price, amount, invoice, customer normalization, callback URL, or channel values.
      Primary requirement: REQ-218
      Constraints: REQ-173, REQ-177, REQ-178, REQ-190, REQ-198, REQ-216, REQ-217, REQ-219, REQ-220
      Dependencies: A-210, A-211, A-212
      Done when: workerd-backed D1 tests prove one submit token produces one order, stock reservation, and payment attempt before the provider call; the signed request uses D1-owned MYR total, bounded invoice/reference, normalized `+60` customer data, same-origin callback URLs, device information, enabled channel policy, and a stable idempotency key; retry of an identical attempt converges; disabled/unconfigured DOKU is rejected before order persistence; tampered/mismatched/unsigned responses store a sanitized failure and never return a checkout URL; COD/manual behavior remains unchanged; and no public/admin surface can activate the new method before A-217/A-219.
      Evidence 2026-09-01: delivery run `RUN-20260901T052125Z-d3b6110d` finished PASS. Post-fix full tests passed 374/374, `npm run check` reported zero diagnostics across 332 files, build passed, and independent re-review passed after return-capability and stable-device-fingerprint findings were corrected. Provider transport remained test-only.

- [x] **A-214** — Process signed DOKU notifications through one monotonic payment/order transition. **Approval: required; granted and completed locally 2026-09-01.** The raw-body webhook verifies Global authenticity before parsing/mutation, applies one monotonic D1 batch, and reuses shared exactly-once stock restoration.
      Risk: R4 — public webhook, payment settlement, order lifecycle, and stock restoration.
      Surface: `src/pages/api/payments/doku/notifications.ts`, `src/lib/doku-notification.ts`, `src/lib/doku-notification.test.ts`, `src/lib/doku-payment-lifecycle.ts`, `src/lib/doku-payment-lifecycle.test.ts`, `src/lib/order-lifecycle.ts`, `src/lib/order-lifecycle.test.ts`, `src/lib/order-persistence.test.ts`.
      Non-scope: browser redirects as evidence; accepting Cards notification signatures; refund/dispute processing; outbound provider calls; raw payload retention.
      Primary requirement: REQ-221
      Constraints: REQ-173, REQ-182, REQ-198, REQ-219, REQ-220
      Dependencies: A-210, A-211, A-213
      Done when: raw-body tests prove invalid/stale/wrong-target signatures and amount/currency/order mismatches are rejected before mutation; duplicate and out-of-order notifications converge on one event and monotonic attempt; success marks payment paid once; failed/expired releases still-reserved stock once through the shared lifecycle; unknown states remain attention-required; additive provider fields do not break parsing; and `2xx` is sent only after the local transaction commits.
      Evidence 2026-09-01: delivery run `RUN-20260901T054049Z-4cb500e4` finished PASS. Focused tests passed 7/7, independent lifecycle review passed 13/13, full tests passed 381/381, `npm run check` reported 0 errors/warnings/hints across 337 files, and build passed. No webhook was registered and no vendor traffic occurred.

- [x] **A-215** — Add capability-protected DOKU return, result, cancel, retry, and status reconciliation routes. **Designer handoff and middleware Surface expansion approved; completed locally 2026-09-01.**
      Risk: R3 — public payment recovery and server-to-server status verification.
      Surface: `src/pages/payment/doku/return.astro`, `src/pages/payment/doku/result.astro`, `src/pages/payment/doku/cancel.astro`, `src/pages/api/payments/doku/status.ts`, `src/pages/api/payments/doku/retry.ts`, `src/lib/doku-payment-access.ts`, `src/lib/doku-payment-access.test.ts`, `src/lib/doku-payment-lifecycle.ts`, `src/lib/doku-payment-lifecycle.test.ts`, `src/lib/order-lifecycle.ts`, `src/lib/order-lifecycle.test.ts`, `src/lib/order-persistence.ts`, `src/lib/order-persistence.test.ts`, `src/lib/order-status.ts`, `src/lib/order-status.test.ts`, `src/middleware.ts` (approved expansion: preserve a route-owned stricter Referrer Policy instead of overwriting it globally).
      Non-scope: visual redesign beyond the accepted handoff; phone-number lookup; exposing customer/provider payloads; creating a second order; treating redirect query values as provider truth; exposing the recovery capability to BaseLayout, Ads, analytics, DOM, referrers, links, logs, or browser storage.
      Primary requirement: REQ-222
      Constraints: REQ-182, REQ-198, REQ-219, REQ-220, REQ-221
      Dependencies: accepted A-215 designer handoff, A-211, A-213, A-214
      Done when: focused route and workerd-backed D1 tests prove only the order identity plus checkout-issued capability can inspect/reconcile/retry; the query capability is validated server-side, exchanged for a bounded Secure HttpOnly SameSite cookie, and removed by redirect before a page shell or tracking code renders; return and cancel parameters cannot set payment state; signed provider status is mapped through the same lifecycle function as notifications; eligible retry remains on the same order and attribution, atomically re-reserves previously released items, and refuses when stock is no longer available; a new bounded attempt is created only when required; successful/non-eligible orders cannot be retried; every route is `no-store` with `Referrer-Policy: no-referrer`; and tests/browser inspection find no PII, secret, or capability in URLs, DOM, links, referrers, analytics, logs, or browser storage.
      Evidence 2026-09-01: focused access/route tests passed 6/6, including latest-attempt recovery through an older bounded order capability and signed reconciliation before replacing an expired active checkout; the final deterministic serial full suite passed 387/387 (the default concurrent runner exposed an existing Wrangler dev-port race, not a product assertion failure); `npm run check` reported 0 errors/warnings/hints across 344 files; final build passed; built-Worker method/header inspection proved unsupported methods return `405`, `Allow: POST`, `no-store`, and `no-referrer`; Chromium at 390 and 1280 px proved clean capability-free URLs, accessible Malay recovery states, no overflow, and no tracking shell. No credential was read, no vendor request occurred, and no remote mutation or deployment was performed.

- [x] **A-216** — Add bounded scheduled reconciliation and redacted payment operations. **Designer handoff accepted; completed locally 2026-09-01.** The existing one-minute Worker trigger now leases at most ten due attempts, verifies signed provider truth, applies bounded backoff/exhaustion, and expires abandoned uninitiated attempts through shared stock restoration. Owner/admin receive one lease- and cooldown-aware manual action; customer service sees the same redacted diagnostics read-only. DOKU settlement remains provider-authoritative, so its generic payment-status selector and PATCH mutation are unavailable.
      Risk: R3 — scheduled provider traffic and operator payment decisions.
      Surface: `src/worker.ts`, `src/lib/doku-reconciliation.ts`, `src/lib/doku-reconciliation.test.ts`, `src/lib/payment-operations.ts`, `src/lib/payment-operations.test.ts`, `src/pages/api/admin/payments.ts`, `src/pages/api/admin/orders/[id].ts`, `src/components/admin/OrderDetail.tsx`, `OBSERVABILITY.md`.
      Non-scope: automatic refunds; changing shipping queue membership; storing provider responses; unbounded polling; vendor calls during normal unit tests; operator-attributed audit (the accepted schema records source/time/result/correlation but has no actor column); exposing checkout URLs, capabilities, submit tokens, click IDs, idempotency/request fingerprints, lease tokens, raw provider data, credentials, signatures, or customer data inside payment operations.
      Primary requirement: REQ-224
      Constraints: REQ-182, REQ-191, REQ-198, REQ-219, REQ-220, REQ-221
      Dependencies: accepted designer/vision payment-operations handoff, A-212, A-214, A-215
      Done when: tests prove the schedule leases a bounded due set, skips terminal/not-due attempts, verifies each response, reuses the notification transition, applies backoff without overlapping work, and expires/releases an abandoned uninitiated order through the shared lifecycle after its bounded local deadline; order JSON explicitly omits all token/capability/checkout/fingerprint/lease and advertising fields; owner/admin order detail/API expose a newest-attempt-first redacted history, chronological event timeline, safe environment/config/freshness/error classifications, and one confirmed idempotent manual reconcile action while customer service remains read-only; DOKU payment status cannot be mutated through the generic selector or PATCH path while COD/manual controls remain unchanged; logs classify safe failure reasons with correlation IDs and never contain credentials, signatures, raw customer data, click IDs, or provider bodies; authenticated Chromium at 390 and 1280 px proves role/state/action behavior, dialog/error focus, 44 px controls, no overflow, and no sensitive DOM/network/clipboard/console data.
      Evidence 2026-09-01: delivery run `RUN-20260901T132047Z-0b52c6ac` passed focused reconciliation/operations tests 8/8 and the deterministic serial suite 395/395; `npm run check` and the final Cloudflare build passed. Independent correctness/security re-review passed after cooldown was distinguished from an active lease and the temporarily unavailable Owner/Admin action remained visible but disabled. Authenticated built-Worker Chromium at 390 and 1280 px showed ready configuration, redacted newest-first attempts and chronological events, overdue freshness, the confirmation dialog, 44 px controls, zero overflow, no console errors, no sensitive DOM, and no vendor/Ads request. No credential, live provider request, remote mutation, deployment, commit, or push occurred.

- [x] **A-217** — Extend the Indonesian Payments workspace for DOKU configuration and health. **Designer/vision handoff accepted; completed locally 2026-09-01.** Owner/Admin now manage one encrypted DOKU Malaysia configuration beside unchanged COD/manual-transfer controls, with explicit revision-bound activation and fail-closed recovery that never contacts the provider.
      Risk: R3 — browser-visible secret administration and payment diagnostics.
      Surface: `src/pages/admin/payments.astro`, `src/components/admin/SellerBankAccounts.tsx`, `src/components/admin/DokuPaymentSettings.tsx`, `src/pages/api/admin/payments.ts`, `src/lib/doku-config.ts`, `src/lib/doku-config.test.ts`, `src/components/admin/admin-navigation.ts`, `src/lib/admin-navigation.test.ts`, `src/lib/mobile-layout-guard.test.ts`, `DESIGN-SYSTEM.md`, `TASKS.md`, `STATUS.md`, `BUILD-LOG.md`. **Surface expansion approved 2026-09-01** — the user's repository-wide task continuation explicitly includes keeping the canonical execution/status/history documents synchronized.
      Non-scope: showing stored secret values; initiating a live payment; provider dashboard embedding; changing storefront checkout; redesigning unrelated admin settings; actually activating production or making a vendor request (A-222 approval gate).
      Primary requirement: REQ-217
      Constraints: REQ-185, REQ-186, REQ-224, LOGIN-3
      Dependencies: accepted designer/vision admin handoff, A-212, A-216, A-219
      Done when: focused tests and authenticated Chromium at 390 and 1280 px prove owner/admin can distinguish disabled/sandbox/production and empty/stored/invalid credential states, select only supported enabled channels, save a full replacement as a disabled revision, explicitly enable/disable an eligible revision without a vendor request, and replace/delete encrypted credentials without reveal; stale revisions and replacement/deletion while a current-revision attempt is non-terminal are refused; the page presents the exact canonical HTTPS notification URL without claiming registration, retains COD/manual bank management, uses keyboard/labels/focused error summaries, meets 44 px controls, and produces zero page overflow, console errors, or secret-bearing DOM/storage/network responses.
      Evidence 2026-09-01: delivery run `RUN-20260901T151951Z-8cb7588c` passed 17/17 focused configuration/navigation/layout tests and the deterministic serial suite passed 404/404; `npm run check` reported zero diagnostics across 349 files, the Cloudflare build completed, and `git diff --check` passed. Authenticated HTTPS Chromium at 390 and 1280 px exercised empty → disabled sandbox draft → sandbox active → disabled production replacement → production confirmation/active using local fixture credentials only. Stored values rendered only as masks, secret inputs cleared after save, browser storage and vendor-request sets stayed empty, the error summary received focus, one H1 remained, and both widths had zero overflow or console error. Independent gpt-5.4 review found that invalid database rows initially hid their delete recovery action; the UI and focused regression were corrected before final re-review.

- [x] **A-218** — Integrate DOKU into the canonical full buyer checkout and confirmation flow. **Designer/vision handoff accepted; completed locally 2026-09-01.** The one canonical full form now exposes one hosted DOKU choice only for a healthy enabled configuration, keeps COD/manual transfer independent, and hands the buyer to a credential-free HTTPS DOKU host without storing the provider URL or treating the redirect as payment evidence.
      Risk: R3 — browser-visible payment choice, external redirect, recovery, and conversion path.
      Surface: `TASKS.md`, `STATUS.md`, `BUILD-LOG.md`, `src/components/storefront/forms/MalaysiaCheckoutForm.astro`, `src/components/storefront/forms/GeoIpResolvedForm.astro`, `src/pages/api/payment-methods.ts`, `src/pages/thanks.astro`, `src/pages/payment/doku/result.astro`, `src/pages/payment/doku/return.astro`, `src/pages/payment/doku/cancel.astro`, `src/styles/form-hybrid.css`, `src/lib/payment-brand.ts`, `src/lib/payment-brand.test.ts`, `src/lib/checkout-navigation.ts`, `src/lib/checkout-navigation.test.ts`, `src/lib/malaysia-market.test.ts`, `public/mybook-form-widget.js`, `src/lib/embed-markup.ts`, `src/lib/embed-markup.test.ts`.
      Non-scope: adding another checkout mode; embedding card/PAN fields; iframe-hosting DOKU; changing shipping/address policy; exposing disabled channels; removing COD/manual fallback.
      Primary requirement: REQ-223
      Constraints: REQ-173, REQ-185, REQ-190, REQ-214, REQ-216, REQ-217, REQ-218, REQ-222
      Dependencies: accepted designer/vision checkout handoff, A-206, A-213, A-215, A-217, A-219
      Done when: real Chromium at 390 and 1280 px proves every public checkout entry uses one full form; only configured payment choices appear; DOKU explains and performs one safe top-level redirect; loading/double-submit, provider refusal, timeout, cancel, pending, success, expired, and eligible retry states are accessible Malay; attribution survives; COD/manual flows remain valid; and no PAN/CVV, secret, overflow, console error, or buyer-trusted payment status appears.
      Evidence 2026-09-01: delivery run `RUN-20260901T160907Z-79fa2dd8` passed 29/29 focused checkout/navigation/widget tests, the deterministic serial suite 409/409, zero diagnostics across 350 files, the Cloudflare server build, and independent re-review. Real Chromium at 390/1280 px proved one configured DOKU radio, conditional email/disclosure, keyboard focus, loading lock, stable-token retry, one InitiateCheckout, safe top-level redirect, no DOKU `thanks_state`, and zero PAN/CVV, overflow, or runtime errors. A separate 390 px refusal/timeout pass proved focused Malay recovery, preserved email/payload, one attempt identity, and one advertising initiation. The disabled local configuration omitted DOKU while retaining COD/manual transfer. All provider responses were mocked; no credential, vendor request, remote mutation, deployment, commit, or push occurred.

- [x] **A-219** — Make successful DOKU settlement the single Ads Purchase owner for online orders. **Completed locally 2026-09-01.** Signed authoritative settlement now atomically queues one canonical Meta server Purchase; the real capability-protected DOKU result page emits the matching browser-only Meta and direct Google legs only for `paid`, while pending/failure/retry and duplicate callbacks remain silent.
      Risk: R3 — revenue attribution and deduplication across asynchronous payment completion.
      Surface: `TASKS.md`, `STATUS.md`, `BUILD-LOG.md`, `src/lib/accepted-order-meta.ts`, `src/lib/order-persistence.ts`, `src/lib/order-persistence.test.ts`, `src/lib/doku-payment-lifecycle.ts`, `src/lib/doku-payment-lifecycle.test.ts`, `src/lib/doku-payment-access.test.ts`, `src/lib/meta-capi.ts`, `src/lib/meta-capi.test.ts`, `src/lib/meta-event.test.ts`, `src/lib/click-ids.ts`, `src/lib/click-ids.test.ts`, `src/pages/api/meta-event.ts`, `src/pages/thanks.astro`, `src/pages/payment/doku/result.astro`, `src/components/storefront/tracking/AdsBase.astro`, `src/lib/ads-signal-policy.test.ts`. **Surface expansion approved 2026-09-01** — the public Meta endpoint and its existing behavioral test must enforce the same paid-state boundary, persisted first-party advertiser identity is required by asynchronous settlement, the real DOKU result callback must own the browser-only paid leg without sending its recovery capability to analytics, and repository-owned completion evidence must remain synchronized.
      Non-scope: changing COD/manual Purchase timing; Google Ads offline upload; reporting shipping/fees as revenue; emitting Purchase on DOKU initiation, redirect, pending, failure, or retry.
      Primary requirement: REQ-225
      Constraints: REQ-193, REQ-195, REQ-197, REQ-213, REQ-218, REQ-220, REQ-221
      Dependencies: A-214, A-215
      Done when: focused tests prove a DOKU order emits no Purchase before authoritative success and exactly one browser/server-deduplicated Purchase afterward using the canonical order number, product IDs, persisted merchandise subtotal, MYR, Malaysia matching, and stored click attribution; duplicate webhook/reconciliation/result loads emit no duplicate; COD/manual fixtures retain their existing timing; and no vendor call occurs in tests.
      Evidence 2026-09-01: verification run `RUN-20260901T151739Z-6dc4bad8` uses real workerd D1 to prove pending/failure create no outbox row, signed paid settlement creates one row in the same batch, and duplicate notification/reconciliation converges on that row. Focused payment/Ads tests pass 29/29; the serial full suite passes 400/400; `npm run check` reports zero diagnostics across 348 files; and the Cloudflare build completes. Real HTTPS Chromium followed the actual query-capability exchange to the clean `/payment/doku/result` URL: paid emitted one canonical Meta and Google Purchase at MYR 32.90 into injected browser test sinks, reload emitted none, the HttpOnly capability was absent from URL/DOM/browser storage, and no same-origin CAPI request or live Ads vendor request occurred. Independent gpt-5.4 review found the missing real-callback browser leg and permissive `_fbp`/`_fbc` parsing; both were corrected and re-reviewed.

- [x] **A-220** — Complete DOKU privacy, onboarding, observability, installation, and release controls. **Completed locally 2026-09-02 after operator acceptance; no publication occurred.**
      Risk: R3 — payment-data disclosure and production readiness documentation.
      Surface: `src/data/legal.ts`, `src/components/storefront/forms/MalaysiaCheckoutForm.astro`, `src/components/storefront/shared/LegalPage.astro`, `src/styles/form-hybrid.css`, `src/lib/malaysia-market.test.ts`, `PRD.md`, `PLAN.md`, `DECISIONS.md`, `INSTALLATION.md`, `OBSERVABILITY.md`, `RELEASE.md`, `STATUS.md`, `ARCHITECTURE.md`, `BUILD-LOG.md`, `TASKS.md`. **Surface correction 2026-09-02** — `REQ-226` requires the accepted disclosure to be reachable beside the conditional DOKU email field; the checkout, legal-section anchor, existing checkout stylesheet, canonical requirement-status cells, and stale plan/ADR current-state wording are therefore part of the minimum implementation surface. This does not accept or implement proposed `REQ-211`/`REQ-212` or alter any requirement text or architectural decision.
      Non-scope: legal advice; inventing DOKU retention/processor terms; registering a webhook; entering credentials; remote migration; deployment or a live payment.
      Primary requirement: REQ-226
      Constraints: REQ-185, REQ-202, REQ-217, REQ-224
      Dependencies: A-214, A-216, A-217, A-218, A-219
      Done when: the operator accepts the Malay/English DOKU disclosure; checkout links the accepted bilingual DOKU disclosure beside the conditional DOKU email field before any DOKU-bound personal or payment data is submitted; installation names secret-safe sandbox/production setup and the exact Back Office notification URL procedure; observability names redacted decisions and alerts; release gates cover signature, duplicate, success, pending, failure, expiry, retry, stock, Ads, and browser evidence; docs state only observed behavior; and all check/test/build/browser gates pass.
      Evidence 2026-09-02: accepted bilingual copy renders at `/dasar-privasi#pembayaran-doku` and is linked only inside the conditional DOKU block. Focused tests pass 15/15; the serial suite passes 410/410; `npm run check` reports zero diagnostics across 350 files; the Cloudflare build and diff checks pass. Real local Chromium at 390/1280 px plus `/embed/form` proved helper/link/disclosure order, a 44 px keyboard-focusable target, Malay-before-English anchor content, retained checkout values after the new tab, COD hiding, zero overflow, and zero runtime/network errors. Independent correctness/UX and security/privacy reviews passed with no finding. The payment-method response was intercepted locally; no credential, provider request, webhook registration, remote migration, deployment, commit, or push occurred. Delivery run: `RUN-20260902T032428Z-6e69b432`.

- [x] **A-221R** — Implement the accepted DOKU Checkout response-envelope compatibility profile. **Approval: required — explicitly approved by the operator; completed 2026-09-02.**
      Risk: R4 — payment response authentication and authoritative order/payment correlation.
      Surface: `src/lib/doku-client.ts`, `src/lib/doku-client.test.ts`, `src/lib/doku-checkout.test.ts`, `src/lib/doku-reconciliation.test.ts`, `PRD.md`, `PLAN.md`, `DECISIONS.md`, `ARCHITECTURE.md`, `RELEASE.md`, `STATUS.md`, `BUILD-LOG.md`, `TASKS.md`.
      Non-scope: unsigned Payment Notifications; Direct Payment/Cards/BNPL/refund APIs; changing DOKU channels, checkout device data, or provider minimum amount; UI; schema/migrations; production credentials; webhook registration; deployment; live payment.
      Primary requirement: REQ-227
      Constraints: REQ-216, REQ-217, REQ-218, REQ-219, REQ-220, REQ-221, REQ-222, REQ-224
      Dependencies: A-220 and the redacted A-221 sandbox response-header evidence recorded on 2026-09-02.
      Done when: unit tests prove signed responses still pass; an observed DOKU-style signature-absent create/retrieve envelope passes only with the exact client, endpoint API version, fresh canonical timestamp, JSON media type, bounded body, no Cards-only request ID, exact checkout ID/invoice, and exact MYR amount; a missing/wrong/stale envelope, present malformed/invalid/tampered signature, identity/amount mismatch, or oversized body fails closed without compatibility fallback; workerd D1 tests prove one valid create persists one correlated attempt/URL and a rejected response exposes no URL, while a valid retrieve transitions only its exactly correlated attempt and duplicate retrieval converges; notifications remain strictly signed; focused and full check/test/build gates pass; independent correctness and security reviews pass; and a bounded redacted sandbox create/retrieve re-smoke confirms the observed response profile without production activity.
      Evidence 2026-09-02: the shared client still signs every outbound request and verifies every present response signature, but accepts a missing signature only for the fixed Checkout target after exact Client ID/API version/fresh timestamp/JSON/body-bound/Cards-shape checks and request-owned ID, invoice, and MYR correlation. A signed response may omit the informational API-version header, but a version that is present must match; the signature-absent profile always requires it. A partial secondary payment fact may omit amount, matching the observed retrieve body, but every currency or amount that is present remains constrained and at least one complete exact MYR fact is mandatory. Focused payment/task tests pass 39/39; the serial full suite passes 416/416; `npm run check` reports zero diagnostics across 350 files; the Cloudflare build and `git diff --check` pass. A redacted sandbox re-smoke through the production client returned `200` for signed fictional FPX-only MYR 2.00 create and retrieve requests: both signature-absent envelopes matched client/version/timestamp/JSON, ID and MYR, and create returned an allowlisted DOKU-hosted URL shape. No identifier, URL, signature, credential, or PII was retained in evidence. Independent correctness review required precise wording that distinguishes signed notification truth from correlated retrieve truth; it was corrected and re-reviewed PASS. Independent security review passed with no exploitable finding. Payment Notifications remain exact-raw-byte signed. No local/remote D1 mutation, hosted browser flow, payment completion, webhook registration, deployment, production action, commit, or push occurred. Delivery run: `RUN-20260902T064733Z-5cd321b4`.

- [ ] **A-221** — Validate the complete integration against DOKU sandbox. **Approval: required — external account, credentials, webhook registration, and vendor traffic.**
      Risk: R4 — external payment provider and credential-bearing sandbox activity.
      Surface: DOKU/senangPay sandbox account and webhook settings; local/install sandbox D1 data; `RELEASE.md`, `STATUS.md`, `BUILD-LOG.md`, and `TASKS.md` for redacted evidence only. No production resource.
      Non-scope: production credentials; live charge; remote production D1; deployment to a production domain; refund/BNPL/recurring/direct Cards tests; recording secrets or real customer data.
      Primary requirement: REQ-216
      Constraints: REQ-217, REQ-218, REQ-219, REQ-220, REQ-221, REQ-222, REQ-223, REQ-224, REQ-225, REQ-226
      Dependencies: A-220 (which transitively requires A-210 through A-219) and A-221R
      Done when: after explicit approval, an isolated sandbox install records redacted evidence for signed create/retrieve requests and REQ-227-compliant responses, enabled Malaysia channels, the exact `payment.channel` string DOKU returns for each enabled channel compared against the code this repository pins and stores — `CREDIT_CARD` in particular, which providers commonly report as a card sub-brand and which would strand a paid order as `DOKU_PAYMENT_MISMATCH` if it differs — correct hosted redirect, valid signed notification, duplicate delivery, success, pending, failure, expiry/cancel, eligible retry, bounded reconciliation, stock invariants, operator diagnostics, Ads single-Purchase behavior, desktop/mobile buyer recovery, and zero secret/PII leakage; production remains disabled.
      Blocked evidence 2026-09-02: the operator approved A-221 sandbox vendor traffic. Managed credentials were injected into one child process without revealing values, and the current official Malaysia contract was rechecked before use. A signed FPX-only `POST /v3/checkouts` with fictional data reached DOKU sandbox validation, but the supplied account rejected `MYR` with `currency_not_support`; the unsigned `400` was fail-closed by the adapter as `DOKU_RESPONSE_HEADERS`. The official OpenAPI currently advertises checkout language `MY`, while sandbox rejected it and accepted the runtime's `MS` far enough to evaluate currency. No checkout was created, so retrieve, hosted browser, payment states, notification/resend, reconciliation, stock, and Ads cells remain unproven. No dashboard login credential is available to enable the required account/channel capability or register a webhook, and registering a replacement account requires operator-owned email/password and Terms acceptance. No local/remote D1 state, webhook, deployment, production resource, order, charge, secret, or real customer data was created or changed. Resume only after a sandbox account accepts `MYR` and its dashboard access is available for channel/webhook configuration.
      Resumed evidence 2026-09-02: after the operator replaced the managed sandbox credential set, DOKU accepted signed fictional FPX-only MYR Checkout requests. Sandbox enforces a MYR 2.00 minimum; create and immediate retrieve then both returned `200`, matching merchant ID, MYR 2.00, and pending/initiate facts, and create returned an allowlisted DOKU-hosted URL shape. Neither successful response carried a `Signature` header, although Client ID, response timestamp, and API version were present; a separate response-header inventory found no alternate signature header. Current official artifacts conflict: the endpoint OpenAPI models empty response headers and the DOKU Malaysia Postman Checkout requests contain no response-signature assertion, while the generic Global integrity guide says DOKU signs responses. The shared adapter therefore failed closed as `DOKU_RESPONSE_HEADERS` before returning or persisting the hosted URL. This conflicts with accepted REQ-218/REQ-219 and the current A-221 signed-response gate; changing that integrity contract or its source surface requires a separate explicit decision. No local D1 order/attempt, browser redirect, payment completion, webhook, Ads event, deployment, production resource, secret value, or real customer data was created or changed. A-221 remains open.
      Remediation evidence 2026-09-02: accepted REQ-227, ADR-022, and completed A-221R resolve the create/retrieve response-contract blocker with the endpoint-specific profile proven above. A-221 remains open: dashboard channel/webhook setup, hosted browser payment states, notification/resend, retry, stock, operator diagnostics, and Ads/browser evidence have not been exercised, and only FPX create/retrieve transport is proven. Production remains disabled.
      Hosted-browser evidence 2026-09-02: an additional fictional FPX-only sandbox create returned an allowlisted hosted URL, and local headless Chrome reached a non-error DOKU document shell without exposing the URL or provider identity. The shell contained no rendered payment control or channel label; a second bounded run with additional virtual render time timed out without a DOM. This is reachability evidence only, not proof that FPX was rendered or payable. No buyer interaction, payment outcome, callback, notification, local D1 state, Ads event, dashboard mutation, webhook, production action, credential/PII disclosure, commit, or push occurred. Resume needs DOKU Dashboard access for channel/webhook configuration and an operator-observable sandbox payment flow.
      Revalidation evidence 2026-09-07: 59/59 focused DOKU tests passed at `5bc1d4a`, covering signed request and notification boundaries, REQ-227 response compatibility, duplicate delivery, monotonic lifecycle, retry, reconciliation, stock, redaction, and Ads Purchase ownership. A bounded credential-injected FPX-only MYR 2.00 sandbox re-smoke again returned `200` for create and retrieve, an allowlisted DOKU-hosted URL, matching Client ID, response timestamp, API version, and JSON media type; neither response carried `Signature`, so both passed only through the accepted strict correlation profile. A separate bounded hosted-browser run produced no attributable rendered-control evidence and is not counted as a channel/payment PASS. At the start of this revalidation, local D1 contained no DOKU configuration row. Current official DOKU guidance still requires an internet-reachable HTTPS Notification URL configured in DOKU Dashboard and an active Checkout payment method. No dashboard session was available, and the Tailscale HTTP dev URL was not eligible. No payment, notification, resend, callback, local D1 mutation, webhook, deployment, production action, secret value, provider identifier, URL, or PII was recorded in that bounded re-smoke. A-221 remained open on exactly those external gates.
      Local sandbox install evidence 2026-09-07: after explicit operator approval, the managed sandbox credentials were persisted through the production encryption helper into local D1 revision 1 and only `INTERNET_BANKING_FPX` was enabled. No value was printed or written to the repository. A separate local Worker started with the same managed `AUTH_SECRET` reported a ready, enabled sandbox configuration; `/api/payment-methods` exposed DOKU with FPX beside COD/manual transfer, while `/api/locations` still resolved `50450`. Headless Chromium at 390 px rendered the FPX-backed DOKU choice and one Kuala Lumpur location with zero page overflow, runtime exception, or failed request. This proves local configuration and buyer-option wiring only. The HTTP origin is deliberately refused by the hosted-checkout boundary, and DOKU cannot deliver a notification to localhost or the VPN-gated Tailscale URL, so no order, attempt, hosted checkout, payment, callback, notification, resend, stock transition, or Ads event was created. A-221 still requires an operator-approved public HTTPS origin plus DOKU Dashboard channel/Notification URL setup.
      Local channel-policy evidence 2026-09-07: after a second explicit operator approval, the active local sandbox configuration advanced from revision 1 to revision 2 with `INTERNET_BANKING_FPX`, `EWALLET_TNG`, `EWALLET_GRABPAY`, `EWALLET_SHOPEEPAY`, and `CREDIT_CARD`; the guarded update first proved that revision 1 had no active payment attempt. The public payment-method contract and real local product form then exposed FPX, Touch 'n Go eWallet, GrabPay, ShopeePay, and card payment labels from that one D1-owned policy. The current official Malaysia Postman collection distinguishes Hosted Checkout `/v3/checkouts` from Direct Payment `/v3/payments`: its Hosted Checkout sample does not require `device_info`, while its channel-specific Direct Payment samples include it. MyBookCMS remains on Hosted Checkout and does not collect PAN, OTP, or wallet credentials. All 464 repository tests and `git diff --check` passed. This is local selectability evidence only; it does not prove that those merchant services are active in DOKU Dashboard, that the hosted page renders them, or that any payment lifecycle succeeds. No provider request, order, attempt, payment, webhook, remote mutation, deployment, secret, or PII was created or exposed. A-221 and delivery run `RUN-20260907T024256Z-0b9be8ac` remain blocked on the existing public-HTTPS, Dashboard, hosted-browser, end-to-end lifecycle, and independent R4 review gates.

- [ ] **A-222** — Activate DOKU for one explicitly approved production install. **Approval: required — production credentials, remote migration, webhook registration, deployment, channel enablement, and any live payment are separate live mutations.**
      Risk: R4 — production payment acceptance, credential-bearing configuration, remote schema, and revenue/stock state.
      Surface: the approved install's Worker revision, production D1 migration state, secret-safe DOKU configuration, DOKU Back Office notification setting, enabled Malaysia channel policy, and `RELEASE.md`, `STATUS.md`, `BUILD-LOG.md`, `TASKS.md` for redacted evidence. No other install or provider account.
      Non-scope: copying sandbox credentials/state; enabling an unverified channel; refunds, disputes, BNPL, recurring, direct Cards, payout, or unrelated infrastructure changes; recording credentials, signatures, raw payloads, or customer data.
      Primary requirement: REQ-216
      Constraints: REQ-173, REQ-182, REQ-217, REQ-218, REQ-219, REQ-220, REQ-221, REQ-222, REQ-223, REQ-224, REQ-225, REQ-226
      Dependencies: A-221 and a separately approved target-install release plan. **Also A-277's open provider question:** whether DOKU signs Checkout responses in *production* is unanswered — ADR-022's Context records DOKU's own artifacts contradicting each other, and A-221 observed sandbox unsigned on 2026-09-02 and again on 2026-09-09. A-277 closed having recorded the question; this entry owns resolving it, because this is the task that enables production.
      Done when: after explicit approval for each live mutation, the exact reviewed revision passes local release gates; the target is backed up/protected; forward migrations apply once; production credentials are entered without disclosure; the exact notification URL is registered; only sandbox-proven channels are enabled; one bounded approved production smoke payment proves create, return, signed notification, REQ-227-compliant retrieve, local order/stock state, operator diagnostics, and exactly-once Ads Purchase; COD/manual remain usable; rollback criteria are recorded; and all evidence is redacted. **And before production acceptance is enabled, DOKU has confirmed in writing whether production signs Checkout responses, with the answer recorded and the `if (responseEnvelope.signature !== null)` guard's comment updated to match** — a production that does sign while the client only verifies opportunistically is a different posture from the one ADR-022 accepted for sandbox, and must not be discovered after money moves.

- [ ] **A-223** — Observe the approved DOKU production rollout and close or roll it back from evidence. **Approval: required for any new synthetic payment, configuration change, disablement, rollback, or deployment; read-only observation alone does not authorize mutation.**
      Risk: R4 — live payment continuity and the decision to keep or disable production acceptance.
      Surface: redacted logs/metrics and payment-attempt diagnostics for the one approved install; its DOKU channel enablement only when separately approved; `OBSERVABILITY.md`, `RELEASE.md`, `STATUS.md`, `BUILD-LOG.md`, `TASKS.md` for redacted evidence.
      Non-scope: unbounded monitoring; customer-data export; provider dashboard automation; refund/dispute handling; changes to another install, Ads taxonomy, checkout design, or shipping policy.
      Primary requirement: REQ-226
      Constraints: REQ-182, REQ-198, REQ-217, REQ-219, REQ-220, REQ-221, REQ-224, REQ-225
      Dependencies: A-222
      Done when: a bounded operator-approved observation window reports initiation, notification, reconciliation, terminal/attention, stock-release, and Ads-deduplication health without secret/PII fields; duplicate or stuck attempts are reconciled through the approved idempotent path; alert/rollback thresholds are evaluated; the operator records a keep-enabled or disable/rollback decision with executable evidence; and no mutation beyond its separately approved action occurs.

- [x] **A-224** — Restructure the Malaysia shipping-policy workspace around operator jobs. **Done locally 2026-09-04.** Three URL-addressable panels — `Tarif negeri/WP`, `Zona & poskod`, `Tarif fallback` — behind the shadcn Tabs primitive, over a compact non-clickable summary strip; only the selected panel occupies page flow, and `?panel=` survives a reload. Zones are independently collapsible, and postcode and fallback editing moved into accessible Sheets.
      The real defect was not layout. `load()` rebuilt every draft amount from the server response, and every mutation calls `load()`, so typing a new tariff into one row and then touching any other row silently discarded it. Drafts are now preserved by measuring dirtiness against the server value each was edited from, read through refs so `load` does not re-create itself on every keystroke, and the operator is told rather than left to notice. Proven in the browser: Johor set to 9.99, Kedah's switch toggled — a real save and reload, active states fell 16 to 15 — and Johor's 9.99 survived, as did the open zone, across that mutation and a full panel round-trip.
      Both sheets refuse to close over unsaved input, by Escape and by the close button, retaining values and showing the exact refusal; a rejected postcode keeps the sheet open with the entered digits and the validation message rather than making the operator retype. Focus return had to be implemented rather than inherited: both sheets are state-controlled with no `SheetTrigger`, and Radix's own restore did not run — focus landed on `<body>` and stayed there through eight polls. Capturing the opener and refocusing it, only while still connected, now returns focus to the exact control in both sheets.
      Immediate switch behaviour, explicit amount saves, inactive-by-default new rules, D1 validation, and the Malay and Indonesian copy are unchanged; customer service still receives `403` and a redirect. Zero page overflow and a clean console at 390 px and 1280 px. The repository's own mobile-layout guard caught two grids in the new markup whose implicit track would size to min-content, which is fixed. 444/444 tests, zero diagnostics across 360 files, clean build.
      **Surface expanded during delivery:** added `src/lib/decision-records.test.ts`-style coverage in the existing `src/lib/expedition-settings.test.ts` plus `docs/CODE-MAP.md`, `OBSERVABILITY.md` untouched. The task named `src/components/ui/tabs.tsx`, which did not exist and was added.
      Risk: R2 — browser-visible privileged admin workflow; policy values, authorization, and mutation contracts must remain unchanged.
      Surface: `PRD.md`, `TASKS.md`, `STATUS.md`, `BUILD-LOG.md`, `src/components/admin/ExpeditionSettings.tsx`, `src/components/ui/tabs.tsx`, `src/lib/expedition-settings.test.ts`, `src/lib/mobile-layout-guard.test.ts`.
      Non-scope: changing D1 schema or shipping policy; changing `/api/admin/expeditions`; courier/provider integration; a store or tenant selector; a new dependency beyond the verified shadcn Tabs primitive; redesigning another admin route.
      Primary requirement: REQ-228
      Constraints: REQ-179, REQ-180, REQ-182, REQ-184, LOGIN-3
      Dependencies: accepted designer/UX handoff 2026-09-02
      Done when: authenticated Owner/Admin browser evidence at 390 px and 1280 px proves a compact non-clickable summary and URL-addressable `Tarif negeri/WP`, `Zona & poskod`, and `Tarif fallback` panels; only the selected job occupies page flow; zones are independently collapsible; postcode and fallback creation/editing use an accessible Sheet with dirty-close protection, retained validation drafts, and focus return; a valid tariff draft and open-zone state survive panel changes and another row mutation; existing immediate switch and explicit amount-save behavior, role denial, D1 validation, and Malay/Indonesian copy remain intact. Run the focused regression tests, `npm run check`, `npm test`, and real-browser keyboard/error/overflow checks with no console or failed-request errors.

- [x] **A-225** — Add a `Log sistem` action to the admin shell that opens one read-only, redacted system-event panel. **Done locally 2026-09-04.** `/admin/settings/log` merges five sources the runtime already persists — schema state, `capi_event_outbox`, DOKU `payment_events`, operator `notifications`, and `headless_api_audit_events` — behind `GET /api/admin/system-log`, bounded to 200 events within 30 days. No table was added and nothing is written. Entry points are the header action, the settings hub card, and the settings sidebar submenu. Redaction is enforced by projection rather than by filtering: labels are composed from structured columns, and stored prose is never selected, because `notifications.body` carries the customer's name. Browser evidence at 390 px and 1280 px with real seeded rows whose forbidden columns held a CAPI token, two Malaysian mobiles, and a street address: none appeared in the rendered DOM, page overflow was 0 px at both widths, all eight controls were keyboard reachable, the checkbox label measured exactly 44 px, and the console was clean. Loading, empty, filtered-empty, and error states were each exercised; the error state exposed an alert, a live announcement, and a working retry. A probe advertiser and a probe customer service each saw zero entry points, received `403 PERMISSION_DENIED` from the API, and were redirected away from the page. 430/430 tests, zero diagnostics across 356 files, clean build.
      The operator has no view of what the system did between two orders. Migration state, scheduled CAPI drains, DOKU reconciliation outcomes, headless API calls, and payment lifecycle events already live in D1; scheduler failures live only in Workers Logs, which the admin cannot reach. This task adds one Owner/Admin button beside the notification bell and one card on the `/admin/settings` hub, both opening `/admin/settings/log`: a URL-addressable panel that merges records the runtime already persists into one reverse-chronological list. It adds no table. Everything it shows is read from the D1 migrations table status, `capi_event_outbox`, `payment_attempts` and `payment_events`, `notifications`, and `headless_api_audit_events`. Events that exist only as Worker logs are out of reach here and are the reason A-226 exists.
      Risk: R2 — new privileged read surface over payment and API audit rows; no mutation, schema, secret, or provider call.
      Surface: `PRD.md`, `TASKS.md`, `STATUS.md`, `BUILD-LOG.md`, `OBSERVABILITY.md`, `docs/CODE-MAP.md`, `src/lib/auth.ts`, `src/lib/auth.test.ts`, `src/lib/system-log.ts`, `src/lib/system-log.test.ts`, `src/pages/api/admin/system-log.ts`, `src/pages/admin/settings/log.astro`, `src/pages/admin/settings.astro`, `src/components/admin/admin-navigation.ts`, `src/components/admin/AdminShell.tsx`, `src/components/admin/SystemLogPanel.tsx`.
      Non-scope: a new D1 table or migration; writing any event; actor attribution of admin mutations (A-226); exposing Workers Logs, request bodies, provider payloads, click IDs, tokens, customer contact, or addresses; export or download; alerting; Customer Service or Advertiser access; redesigning the notification bell.
      Primary requirement: REQ-229
      Constraints: REQ-182, REQ-217, REQ-224, LOGIN-3
      Dependencies: none. Designer handoff before the first visual edit, as for every browser-visible admin change.
      Done when: `GET /api/admin/system-log` returns `no-store` JSON bounded to the newest 200 events within 30 days, each carrying `source`, `severity`, `label`, `occurred_at`, a safe correlation id, and an admin `href`; Owner and Admin see the header button, the settings card, and the panel at 390 px and 1280 px with loading, empty, and error states; Customer Service and Advertiser receive `403` from the API and see no button; a `system-log.test.ts` fixture containing a token, a phone number, and a street address proves none of them reach the response; `npm run check`, `npm test`, and a real-browser keyboard pass show no console or failed-request errors.

- [x] **A-226** — Record privileged admin mutations and scheduler failures as append-only system events. **Done locally 2026-09-08.** Owner-authorized scope expansion completed the payment, credential, template, panel and fixture integration. Migration 0061/schemaVersion 62, atomic privileged HTTP audits, best-effort login/scheduler diagnostics, 90-day retention, and the existing operator log projection are verified. All 504 tests, check and build pass. Real Chrome at 390/1280 px shows all 22 fixed action labels and actors for Owner/Admin, keyboard filtering and long-username wrapping; restricted roles receive 403. Run `RUN-20260907T172505Z-90da78b5` owns executable checks and independent review. Bootstrap/test-only actorless configuration/template helpers remain outside the privileged HTTP audit boundary; no provider or production behavior is claimed.
      Original gap: a store-settings save, a payment configuration revision, an Ads credential save, an API key issue or revoke, an operator role or password change, and a login lockout left no D1 record naming who did it and when; a scheduler failure left only a Worker log. The implemented slice is recorded above; approved helper/panel paths are listed below. A-225 cannot show what was never written. This task adds migration `0061_system_events.sql`, one append-only table with actor, source, label, severity, safe correlation id, redacted detail JSON, and `occurred_at`; writes a row inside the same D1 batch as each privileged mutation it names; writes best-effort rows for scheduler-level failures; prunes rows older than 90 days from the existing one-minute schedule; and makes the A-225 panel read it as one more source.
      Risk: R3 — new schema, a write on every privileged admin path, and a retention job; touches the same handlers as credentials, payment configuration, and API keys.
      Surface: `PRD.md`, `TASKS.md`, `STATUS.md`, `BUILD-LOG.md`, `OBSERVABILITY.md`, `ARCHITECTURE.md`, `docs/CODE-MAP.md`, `src/db/migrations/0061_system_events.sql`, `src/lib/version.ts`, `src/lib/system-events.ts`, `src/lib/system-events.test.ts`, `src/lib/system-log.ts`, `src/lib/system-log.test.ts`, `src/worker.ts`, `src/pages/api/admin/settings.ts`, `src/pages/api/admin/payments.ts`, `src/pages/api/admin/ads.ts`, `src/pages/api/admin/settings/developer.ts`, `src/pages/api/admin/access.ts`, `src/pages/api/admin/profile.ts`, `src/pages/hello.astro`, `src/lib/doku-config.ts`, `src/lib/doku-config.test.ts`, `src/lib/admin-credentials.ts`, `src/lib/storefront-template.ts`, `src/components/admin/SystemLogPanel.tsx`, `src/lib/payment-availability.test.ts`.
      Approved Surface expansion (2026-09-08 continuation): `src/lib/doku-config.ts`, `src/lib/doku-config.test.ts`, `src/lib/admin-credentials.ts`, `src/lib/storefront-template.ts`, `src/components/admin/SystemLogPanel.tsx`. Existing helpers own the actual mutations; the existing panel must understand the additional source. The owner instructed continuation after this exact blocker was presented.
      Approved fixture Surface: `src/lib/payment-availability.test.ts`. Its existing COD route fixture lacks authenticated admin identity and D1 batch support; the fixture now supplies the authenticated actor and transaction batch. No production fallback bypasses auditing.
      Non-scope: recording buyer or storefront traffic; recording order edits, whose rows already carry their lifecycle; placing a value, secret, token, password hash, or customer field in `detail`; any UI beyond what A-225 renders; export; alerting; editing or deleting an event through any API; changing any mutation's authorization or validation.
      Primary requirement: REQ-230
      Constraints: REQ-182, REQ-197, REQ-198, REQ-201, REQ-217, LOGIN-3
      Dependencies: A-225 delivered; REQ-230 accepted by the user; independent separate-agent review under ADR-028 plus delivery-ledger approval, as for every R3 change.
      Done when: the clean migration chain applies to an empty local D1 with `schemaVersion` bumped; a workerd-backed D1 test proves an admin mutation and its event commit or roll back together; a scheduler-failure test proves the best-effort write never throws into `scheduled`; the prune deletes only rows older than 90 days; a fixture proves `detail` for each named mutation contains no secret, token, password hash, phone, or address; every event appears in `/admin/settings/log` with the acting username; `npm run check`, `npm test`, and `npm run build` pass.

- [x] **A-227** — Make `docs/CODE-MAP.md` fail a test when it drifts from `src/`. **Done locally 2026-09-04.** `src/lib/code-map.test.ts` derives routes, paths, endpoint methods, and the live-table set from disk and refuses to agree with a stale map. Four drift cases were each proven to fail with the offending path named: deleting a route row, renaming a page file, silently changing a documented HTTP method, and adding a `CREATE TABLE`. The first draft passed case one wrongly — a deleted `/jejak-pesanan` row still counted as documented because the route remained a redirect *target* elsewhere — so route recognition was narrowed to a row's own first cell. Writing the check also surfaced two real defects: the map addressed admin API and storefront component files by a section-relative path that resolved nowhere, now absolute; and `src/pages/landing/README.md` was a live public route, which became A-230. 421/421 tests, zero diagnostics, clean build; the check runs in 0.2 s.
      The map was written by hand on 2026-09-04, and `AGENTS.md` now tells every agent to read it before searching, so a stale row misdirects every later task. The cheapest guard is one Node test that derives the truth from disk and compares: every file under `src/pages` is named in sections 3-7; every path the map names exists; every HTTP method the map lists for a file under `src/pages/api` is exported by that file; and the live-table list in section 10 equals the set produced by replaying `CREATE TABLE` and `DROP TABLE` across `src/db/migrations`. No dependency is needed; the existing test runner already reads files.
      Risk: R1 — one test file and documentation.
      Surface: `TASKS.md`, `STATUS.md`, `BUILD-LOG.md`, `docs/CODE-MAP.md`, `src/lib/code-map.test.ts`.
      Non-scope: checking prose, line counts, the component tables, or the lib domain table; generating the map from code; adding a dependency; changing any route.
      Primary requirement: REQ-231
      Constraints: REQ-201
      Dependencies: none.
      Done when: `npm test` runs the new file and the map at HEAD passes; deleting one route row from the map, renaming one page file, or adding a `CREATE TABLE` to a scratch migration each makes exactly that assertion fail with the offending path in the message; the check completes in under two seconds.

- [x] **A-230** — Delete the internal authoring note that shipped as a public page. **Done locally 2026-09-04.** Found by A-227's new check, not by review.
      `src/pages/landing/README.md` sat inside the routed directory, so Astro compiled it and every install served it at `/landing/README` — an internal note about repository conventions, published, crawlable, and present in the built worker entry. It was also wrong: it instructed authors to create `src/pages/landing/<slug>.astro`, but `validateNativeLandingPages` rejects a slug containing `/`, so the convention it taught could never have been registered. It pointed at `src/components/storefront/landing-pages/`, which is empty. The directory held nothing else, nothing imported it, and the live convention is already documented correctly in `docs/LANDING-PAGES.md`, `src/data/native-landing-pages.ts`, and `src/pages/contoh-landing.astro`. Removed rather than moved: a corrected copy would be a fourth place describing one convention.
      Risk: R1 — deletes one unreferenced public route; no schema, secret, authorization, or buyer path.
      Surface: `TASKS.md`, `STATUS.md`, `BUILD-LOG.md`, `src/pages/landing/README.md`.
      Non-scope: the two sibling READMEs under `src/components/storefront/landing-pages/` and `src/styles/landing-pages/`, which are outside routed space and stay; rewriting `docs/LANDING-PAGES.md`; changing the native landing register or its slug rule.
      Primary requirement: REQ-215
      Constraints: REQ-203
      Dependencies: A-227 produced the finding.
      Done when: `/landing/README` is absent from `dist/server/entry.mjs` after a clean build; no source file references the deleted path; `npm run check`, `npm test`, and `npm run build` pass. Verified 2026-09-04 — the route is gone from the build, 421/421 tests pass, and `astro check` reports zero diagnostics across 351 files.

- [x] **A-231** — Make the headless storefront report the payment methods the install actually offers. **Done locally 2026-09-04.** Rather than teaching `GET /api/v1/storefront` to read D1 the way `GET /api/payment-methods` already did, the resolution moved into one shared `src/lib/payment-availability.ts` that both now call. Duplicating the logic would have satisfied the letter of "same D1 facts" while leaving the two free to drift again, which is the defect. The headless response gained `doku_channels` (allowlisted labels only) and `doku_requires_email`, and its `supported_methods` now omits `manual_transfer` when no seller bank account is active, because `persistOrder` refuses it and advertising it sent the buyer to a rejection. `HeadlessCheckoutInput.payment_method` accepts `doku`, the OpenAPI envelope describes the payment block instead of typing it `object`, and the SDK drops an unrecognised method rather than passing it through. Proven against a running install: with DOKU disabled the headless read returned `["cod", "manual_transfer"]`; enabling one sandbox configuration with two channels moved both endpoints to include `doku` together, with the channel labels and no credential, environment, or revision in either response; setting `is_cod_enabled = 0` moved both again. 437/437 tests, zero diagnostics, clean build.
      **Surface expanded during delivery, recorded here rather than assumed.** Added `src/lib/payment-availability.ts` and its test, `src/pages/api/payment-methods.ts`, and `src/lib/malaysia-market.test.ts`. The first three follow from choosing one shared resolver over two copies. The last is a source-text assertion that pinned `getEnabledDokuConfig` to `payment-methods.ts`; it now follows the call into the shared module and additionally checks the headless endpoint, and its credential-exposure check strips comments first, because it had begun matching a comment promising not to expose `environment`.
      Found by A-228. `GET /api/v1/storefront` returns a literal `payment: { cod_enabled: true, supported_methods: ['cod', 'manual_transfer'] }`. Nothing is read from D1. The hosted `GET /api/payment-methods` next to it does the real work: it reads `stores.is_cod_enabled`, the active `seller_bank_accounts` rows, and the enabled DOKU configuration, and returns the resulting set. So a headless storefront is told a payment set that is hard-coded rather than resolved. The DOKU half is live today — an operator can enable DOKU, the server accepts `payment_method: "doku"` on `POST /api/v1/checkout`, and no headless consumer is ever told the option exists. `src/lib/headless-client.ts` compounds it: `HeadlessCheckoutInput.payment_method` is typed `"cod" | "manual_transfer"`, so a TypeScript consumer of the shipped SDK cannot express the method the server accepts. The `cod_enabled: true` literal is latent rather than wrong today, because no admin surface can set that column to `0` — that is A-232.
      Risk: R2 — a public read contract and the shipped SDK type; no schema, secret, or write path.
      Surface: `PRD.md`, `TASKS.md`, `STATUS.md`, `BUILD-LOG.md`, `STOREFRONT_INTEGRATION.md`, `docs/CODE-MAP.md`, `src/pages/api/v1/storefront.ts`, `src/lib/headless-client.ts`, `src/lib/headless-client.test.ts`, `src/lib/headless-openapi.ts`, `src/lib/headless-openapi.test.ts`.
      Non-scope: enforcing the COD toggle on any submission path (A-232); changing `GET /api/payment-methods`; exposing a DOKU credential, channel secret, or configuration revision to a public reader; adding a payment method; changing checkout validation.
      Primary requirement: REQ-216
      Constraints: REQ-217, REQ-223, REQ-182
      Dependencies: none.
      Done when: `GET /api/v1/storefront` resolves its payment block from the same D1 facts `GET /api/payment-methods` uses, so the two endpoints cannot disagree for one store state; an enabled DOKU install lists `doku` with its allowlisted channel labels and no credential, revision, or environment value; `HeadlessCheckoutInput.payment_method` accepts `doku` and the OpenAPI document declares the same enum; a test proves a store with DOKU enabled and one with it disabled produce different `supported_methods`; `npm run check`, `npm test`, and `npm run build` pass.

- [x] **A-232** — Enforce the accepted Owner/Admin COD availability control end-to-end.
      Closed locally 2026-09-07: labelled Payments control, failure/retry and confirmed-state persistence passed for Owner/Admin at 390/1280 px; Customer Service/Advertiser received API 403 and page redirects. Real D1/HTTP checks proved both checkout paths reject disabled COD without order/item/stock/Ads/attempt writes. Hosted form, Headless read, and PDP agree.
      Found by A-228. `stores.is_cod_enabled` exists from migration `0032` (`payment_method_toggles`) and defaults to `1`. Exactly one runtime line reads it — `GET /api/payment-methods`, which hides COD from the hosted form when it is `0`. Nothing writes it: no admin API accepts it and the Payments workspace states `COD tetap tersedia`. Nothing enforces it: `orderSubmitSchema` early-returns on `payment_method === 'cod'` without a check, and neither `POST /api/submit-order`, `POST /api/v1/checkout`, nor `persistOrder` consults the column. So the control is presentation-only. It is latent today precisely because the operator cannot reach it, but the moment a toggle is added — or the column is set directly in D1 — hiding the option in one form becomes the only thing standing between a disabled method and a persisted COD order, which contradicts the repository's own rule that browser input is never authority. `manual_transfer` is the counter-example done right: `persistOrder` requires an active seller bank account and refuses without one. Either wire COD the same way end to end, or remove the read and the column claim so nothing suggests a control that does not exist.
      **Reproduced locally 2026-09-04**, so this is demonstrated rather than inferred. Against a throwaway install with `UPDATE stores SET is_cod_enabled = 0`, both read surfaces correctly reported COD as unavailable — `GET /api/v1/storefront` returned `cod_enabled: false` with `supported_methods: ["manual_transfer", "doku"]`, and `GET /api/payment-methods` returned COD with `is_active: false`. `POST /api/submit-order` with `payment_method: "cod"` and the server's own quote then answered `success: true` and persisted order `INV-10001` as `payment_method: "cod"`, `payment_status: "unpaid"`. The control is presentation-only end to end. It remains latent in shipped installs only because no admin surface writes the column, so reaching this state needs a direct D1 write.
      **Original remaining gap after `62f634d`, now closed by the verified control above.**
      `persistOrder` now reads `stores.is_cod_enabled` alongside the store id and
      refuses a COD order when it is `0`, so the presentation-only state
      reproduced below no longer exists on either submission path, and
      `PUT /api/admin/settings` accepts a `save-cod-availability` action. What
      remains is the half an operator can actually see: no admin surface reads or
      writes `cod_enabled`, so the flag is reachable only by a direct D1 write.
      The static PDP trust line is also resolved now rather than hard-coded, fixed
      under A-243.
      **Decision accepted 2026-09-05: enforce the control (ADR-026).** COD is a
      merchant operational choice, not a presentation hint. The guard belongs
      in `persistOrder`, not in `orderSubmitSchema`: the schema has no database,
      and `persistOrder` already refuses `manual_transfer` without an active
      seller bank account in the same statement batch. A COD refusal there
      therefore covers `POST /api/submit-order` and `POST /api/v1/checkout`
      without partial state. `resolvePaymentAvailability` already reads the
      flag. Owner/Admin needs the corresponding control in Payments, and the
      static PDP trust line must follow the resolved availability. No migration
      is needed.
      Risk: R2 — order acceptance policy on both submission paths; no schema change if the enforcement route is chosen, one forward migration if the removal route is.
      Surface: `PRD.md`, `TASKS.md`, `STATUS.md`, `BUILD-LOG.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `docs/CODE-MAP.md`, `src/lib/order-persistence.ts`, `src/lib/order-persistence.test.ts`, `src/lib/payment-availability.ts`, `src/lib/payment-availability.test.ts`, `src/pages/api/admin/settings.ts`, `src/pages/api/payment-methods.ts`, `src/pages/admin/payments.astro`, `src/components/admin/DokuPaymentSettings.tsx`, `src/pages/produk/[slug].astro`.
      A third surface turned up while taking A-229's evidence and belongs to whichever direction is chosen. `src/pages/produk/[slug].astro` line 55 renders the static trust line `Sedia dihantar • COD atau pindahan bank`. It is hard-coded copy, so on the probe install with `is_cod_enabled = 0` the product page told the buyer COD was available while the payment control correctly did not offer it. If the toggle is enforced, this copy has to follow it; if the toggle is removed, the copy is simply true again and needs no change.
      Non-scope: the headless read contract (A-231), except proving its existing
      shared availability output follows the setting; DOKU channel enablement,
      which has its own revision-bound control; changing manual-transfer or
      DOKU validation; adding a per-product or per-zone COD rule.
      Primary requirement: REQ-216
      Constraints: REQ-182, REQ-190, REQ-198, REQ-223
      Dependencies: ADR-026; required designer handoff before the first
      browser-visible edit.
      Done when: a disabled COD store refuses `payment_method: "cod"` on both
      `POST /api/submit-order` and `POST /api/v1/checkout` before any order
      row, item, stock decrement, or advertising event is written, with a test
      proving no partial state; an Owner/Admin control writes the column;
      Customer Service and Advertiser cannot change it; and the hosted form,
      headless read, and PDP trust line agree with the server at 390 px and
      1280 px without console or failed-request errors.

- [x] **A-233** — Resolve the ADR ids this product cites but has never recorded. **Done locally 2026-09-04.** Dating settled the approach: the MyBookCMS baseline is `78ac143` on 2026-08-25, and every `BUILD-LOG.md` citation of ADR-013 through ADR-018 is dated 2026-08-17 or 2026-08-19, so they are genuinely upstream. But three of the decisions are still in force here and had no record at all, so they were written rather than erased: ADR-023 for reading Astro's normalized `context.url` instead of the raw request when classifying a route, ADR-024 for the single `compact-market` template, and ADR-025 for `/admin/content` staying reachable while absent from the menu. New numbers, not the upstream range: reusing `ADR-018` would make `BUILD-LOG.md`'s historical citations resolve to a different decision than the one they were written about, and a second test now forbids that. A fourth live citation turned up during the sweep — `PRD.md` `LOGIN-19` attributed the rate-limit ceiling change to ADR-014 — and there the id was dropped rather than recorded, because the row already states the reason in full. `src/lib/decision-records.test.ts` scans code, configuration, and normative documents and fails on an id `DECISIONS.md` does not define; reintroducing one into `wrangler.jsonc` was proven to fail with the file named. Migration `0044` keeps its comment, since an applied migration is never edited and ADR-024 supersedes it. 439/439 tests, zero diagnostics, clean build.
      **Surface expanded during delivery:** added `src/lib/decision-records.test.ts` and `docs/CODE-MAP.md`. The task required a check but did not name a file for it, and the map's `/admin/content` row now points at ADR-025.
      Found by A-228. `DECISIONS.md` defines ADR-001 through ADR-012, then jumps to ADR-021. Git shows ADR-013 through ADR-020 were never in this repository: `DECISIONS.md` has exactly two commits, the baseline and `a5bc700`, and neither ever contained them. They belong to the upstream AdsBookCMS record, and the fork carried the citations across without the decisions. Four of those citations are live rather than historical: `PRD.md` attributes a middleware path-source fix to ADR-013; `wrangler.jsonc` says the `wide-catalog` template `was retired in ADR-018`; `src/db/migrations/0044_retire_wide_catalog.sql` opens with the same attribution; and `src/lib/admin-navigation.test.ts` cites ADR-018 as the reason `/admin/content` is deliberately reachable but absent from the menu. Each sends a reader to a document that cannot answer them, and the last one is the recorded reason for a live navigation oddity that is otherwise unexplained anywhere. `BUILD-LOG.md` also cites ADR-013 through ADR-016, but that file declares itself upstream history and needs no change. The decisions themselves are real and still in force; only the record is absent. Either write them into `DECISIONS.md` under this product's own numbering, or replace each live citation with the reason in plain words.
      Risk: R1 — comments, documentation, and one test comment. No runtime behaviour, schema, or authorization changes.
      Surface: `PRD.md`, `TASKS.md`, `STATUS.md`, `BUILD-LOG.md`, `DECISIONS.md`, `wrangler.jsonc`, `src/lib/admin-navigation.test.ts`.
      Non-scope: editing `src/db/migrations/0044_retire_wide_catalog.sql`, because an applied migration is never edited — its stale comment is corrected by the new decision record rather than in place; changing the `wide-catalog` retirement, the storefront template resolution, or the `/admin/content` route and its role grants; touching `docs/lineage/`; renumbering ADR-021 or ADR-022.
      Primary requirement: REQ-215
      Constraints: REQ-182
      Dependencies: none.
      Done when: every `ADR-0NN` cited outside `BUILD-LOG.md` and `docs/lineage/` resolves to a heading in `DECISIONS.md`, or has been rewritten to state its reason without an id; a check proves it, so the gap cannot reopen; the reason `/admin/content` stays reachable and unlisted is written down somewhere a reader will find it; `npm run check` and `npm test` pass.

- [x] **A-228** — Re-verify every `Verified against disk` document at the current HEAD and close the ledger gap. **Done locally 2026-09-04.** Two passes. The mechanical one derived routes, file paths, bindings, and the live-table set from disk and checked every backticked claim in all thirteen dated documents; it came back clean apart from two false positives worth naming, since a later reader will hit them too: `PRD.md` mentions `/admin/login` precisely to say the login route is *not* that, and `BUILD-LOG.md` carries a stamp that is honest because it names its own commit and date. The semantic pass found five real contradictions, all now corrected: `AGENTS.md` still described checkout as COD and manual transfer only; `STOREFRONT_INTEGRATION.md` said the same and also directed integrators at the retired `/order-status` slug; `docs/LANDING-PAGES.md` made COD and manual transfer an acceptance criterion; `DESIGN-SYSTEM.md` claimed three shipped weights for both faces when `foundation.css` ships Cinzel at 700 only; and `design-tokens.md` gave a muted value, `#666666`, that appears nowhere in the codebase. It also produced three code findings outside this task's Surface, filed as A-231, A-232, and A-233. Thirteen stamps now name 2026-09-04; `BUILD-LOG.md` keeps its historical one.
      Fourteen files open with a date-stamped verification claim, and none has been re-read since `a5bc700` landed. At least one is already wrong: the `AGENTS.md` product boundary still says checkout is COD/manual transfer, while `ARCHITECTURE.md`, `PRD.md` REQ-216, and `src/pages/api/submit-order.ts` all carry hosted DOKU. `.delivery/current.json` records `observedHead` at `0e52de6`, one commit behind. This task reads each document against the code it describes, corrects or deletes what disk contradicts, advances the date only on files actually re-verified, and refreshes the ledger checkpoint through the delivery-ledger tool rather than by editing its JSON.
      Risk: R1 — documentation and ledger metadata; no code.
      Surface: `AGENTS.md`, `ARCHITECTURE.md`, `PRD.md`, `TASKS.md`, `STATUS.md`, `BUILD-LOG.md`, `DECISIONS.md`, `DESIGN-SYSTEM.md`, `design-tokens.md`, `INSTALLATION.md`, `OBSERVABILITY.md`, `RELEASE.md`, `STOREFRONT_INTEGRATION.md`, `docs/LANDING-PAGES.md`, `docs/CODE-MAP.md`, `.delivery/` through the delivery-ledger tool.
      Non-scope: rewriting for style; changing any requirement's status; touching `docs/lineage/`; any `src/` edit. A code defect found here becomes its own queue entry.
      Primary requirement: REQ-231
      Constraints: REQ-215
      Dependencies: A-227 first, so the code-map half of the pass is mechanical.
      Done when: every claim of a route, endpoint, table, binding, migration number, cron, or role grant in the listed files is traced to a line in `src/` or `wrangler.jsonc` at HEAD; each contradiction is fixed in the document or listed in `BUILD-LOG.md` as a new task; every advanced date names the same HEAD; the ledger `observedHead` equals `git rev-parse HEAD`; `npm run check` and `npm test` still pass.

- [x] **A-234** — Close the touch-target half of the admin's accessibility bar. **Completed locally 2026-09-07 after owner-approved desktop contrast remediation. Switch/browser checks and Lighthouse at 390/1280 px pass.** The original findings below were system-wide.
      *Touch target.* `DESIGN-SYSTEM.md` requires a minimum 44 px interactive height across the admin. The shared `src/components/ui/switch.tsx` renders an 18 px by 32 px control and expands its hit area with an `after:-inset-x-3 after:-inset-y-2` pseudo-element. Measured with `elementFromPoint` at 390 px, the effective target is 33 px by 53 px: wider than the floor, and 11 px short of it vertically. Every switch in the admin inherits it, including Order Management and Payments.
      *Page-background contrast — **done; desktop shell also verified in the continuation below**.* A Lighthouse pass on `/admin/settings/log` scored accessibility 96 with one failure and best practices 100. The failure was real and narrower than it first looked: `text-slate-500` is `#62748e`, which gives **4.76** on a white card and passes, but **4.41** on the admin page background `#f5f6f8` and fails the 4.5 AA floor. So the 277 occurrences across admin code are mostly fine — only text sitting directly on the page background is not. Lighthouse found exactly two such nodes, the eyebrow and the description in `AdminPageHeader.astro`, which 20 admin pages render. `slate-600` on the same background gives 7.01. Fixed in `AdminPageHeader.astro` — eyebrow, description and back link — and in the three panel descriptions of `ExpeditionSettings.tsx`, which sit on the same ground. Text inside white cards keeps `slate-500`, which passes at 4.76, so the large majority of its 277 uses are untouched. `DESIGN-SYSTEM.md` now records both measurements, because the failing and passing pairs look identical in source and only a measurement tells them apart. Re-measured: `/admin/settings/log` and `/admin/expeditions` both score accessibility 100 and best practices 100, with only the two `noindex` SEO items remaining.
      Lighthouse's SEO score of 58 on the same page is not a finding: it fails `is-crawlable` and `meta-description` because `AdminLayout` sets `noindex, nofollow` deliberately. Recorded so nobody chases it.
      Found while taking A-224's browser evidence. `DESIGN-SYSTEM.md` requires a minimum 44 px interactive height across the admin. The shared `src/components/ui/switch.tsx` renders an 18 px by 32 px control and expands its hit area with an `after:-inset-x-3 after:-inset-y-2` pseudo-element. Measured with `elementFromPoint` at 390 px, the effective target is 33 px by 53 px: wider than the floor, and 11 px short of it vertically. This predates A-224 and is not specific to the shipping workspace — every switch in the admin inherits it, including the ones on Order Management and Payments. Either widen the pseudo-element to reach 44 px, or record in `DESIGN-SYSTEM.md` that a switch is a deliberate exception with its measured target, so the next reviewer is not left measuring it again.
      Risk: R2 — a shared primitive rendered on every admin workspace; visual and touch behaviour only, no data, authorization, or API change.
      Surface: `TASKS.md`, `STATUS.md`, `BUILD-LOG.md`, `DESIGN-SYSTEM.md`, `docs/DEVELOPMENT-MAP.md`, `src/components/ui/switch.tsx`, `src/components/admin/AdminPageHeader.astro`, `src/components/admin/AppSidebar.tsx`, `src/components/admin/AdminShell.tsx`, `src/lib/mobile-layout-guard.test.ts`.
      Non-scope: resizing any other control; changing switch semantics, labels, or the immediate-write behaviour of the switches that have it; a design-system-wide spacing revision; re-colouring the `text-slate-500` that sits on a white card, which passes and is the large majority of its uses.
      Primary requirement: REQ-182
      Constraints: REQ-186, REQ-196
      Dependencies: none. Widening a hit area changes spacing on every admin list, so this wants a designer look before the first visual edit.
      Fresh audit 2026-09-07: temporary `lighthouse@13.4.1` tooling in `/tmp`
      avoided any package.json/lock change. `/admin/settings/log` accessibility
      is 100 at 390 px but 96 at 1280 px, with desktop contrast failures in
      sidebar labels (2.51), active Settings text (4.48), and the topbar keyboard
      hint (2.63). All 16 route/viewport switch checks passed again.
      Owner-approved continuation: add `src/components/admin/AppSidebar.tsx`
      and `src/components/admin/AdminShell.tsx` to Surface. The read-only designer
      proposes slate-600 for both sidebar-label paths, keyboard hint and sibling
      mobile-menu heading, and blue-700 for both active-link text paths while
      preserving tinted backgrounds. The owner approved implementation of the blocked tasks. Sidebar, keyboard-hint and mobile-menu text were corrected; both Lighthouse widths now score accessibility 100 with color-contrast PASS. Normal/restricted desktop and open mobile-menu browser checks pass; visual critique passes. Run `RUN-20260907T163554Z-7edbd892` owns final evidence.
      Done when: either every admin switch measures at least 44 px on its shortest axis by `elementFromPoint` at 390 px with no new page overflow on Order Management, Pengiriman, Payments and Tarif Malaysia, or `DESIGN-SYSTEM.md` states the exception and its measured target and a check pins the measurement; **and** a Lighthouse accessibility pass on an admin page reports no `color-contrast` failure, with the page-background text colour and its measured ratio written into `DESIGN-SYSTEM.md` so the next contributor picks it without measuring again. Run `npm run check`, `npm test`, and real-browser evidence at 390 px and 1280 px.

- [x] **A-229** — Produce executable and independent-review evidence for the exact HEAD the next release would ship. **Done locally 2026-09-04. Verified revision: `33a29c7`.** Only the record of this verification sits after it, and that commit changes no code.
      Executable evidence at that revision: the migration chain applies to an empty database and yields exactly 25 live tables and 60 applied migrations, matching both `schemaVersion` and section 10 of the code map; `npm run check` reports zero errors, warnings and hints across 361 files; `npm test` passes 447 of 447; `npm run build` completes. Output digests are in `BUILD-LOG.md`. One run failed first with wrangler's `bad port` while the local dev server still held 8789 — infrastructure, not SQL, and it passed on a clean retry; recorded because the error names a migration and reads like one.
      Browser evidence at 390 px and 1280 px covers every surface edited since the previous recorded run, with zero page overflow and a clean console throughout: the system log, all three shipping panels, the settings hub, and the storefront product page whose checkout consumes the payment endpoint this range rewrote. That last one is the useful one — with COD disabled and DOKU enabled on the probe install, the buyer-facing form offered manual transfer and DOKU and not COD, which is the shared resolver driving a real checkout rather than an API assertion.
      Independent review was the point of this gate and it earned its place. The first pass returned **FAIL** on three medium findings, all real, and in every case the test written beside the defect passed: a saved tariff that reported itself unsaved forever, a system log printing the one DOKU field its own contract excluded, and a per-source ceiling that did not bound anything. Remediation, then a second independent pass, returned **PASS** with three low findings, since closed. Probing the fix for edge cases also surfaced a hazard older than any of it — an emptied tariff box was savable as RM 0.00, silently making a weight band's shipping free.
      **Surface expanded during delivery:** the task declared no `src/` edits, on the reasoning that a failing check becomes its own queue entry. That held for findings this gate did not cause. It did not hold for defects the review found *in the work this same session had just delivered and recorded as done*; filing those as new tasks would have marked A-224, A-225, A-227 and A-231 complete against evidence that had already been shown to be wrong. They were fixed here, under review, and recorded in `BUILD-LOG.md`.
      `MYS-5` needs one revision on which migrations, check, test, and build all pass before the owner approves it, and nothing in the queue produces that evidence on demand. The last recorded full run, 410/410 on 2026-09-01, predates `a5bc700`. This task is the validation gate: it runs the whole local suite against the clean chain on the exact revision, re-runs browser evidence for every surface changed since the last recorded run, obtains an independent correctness and security review of the cumulative diff, and records all of it so `MYS-5` can name one hash.
      Risk: R1 — read, run, review, and record. A failing check becomes its own queue entry, never a fix under this task.
      Surface: `TASKS.md`, `STATUS.md`, `BUILD-LOG.md`, `RELEASE.md`, `.delivery/` through the delivery-ledger tool.
      Non-scope: any `src/` or migration edit; deployment; remote D1; DOKU sandbox traffic (A-221); approving the release (MYS-5).
      Primary requirement: REQ-182
      Constraints: REQ-198, REQ-200, REQ-201
      Dependencies: A-224, A-225, A-227, and A-228 delivered or explicitly deferred by the user, so the evidence covers the set that ships.
      Done when: on the recorded hash, `wrangler d1 migrations apply OMS_DB --local` against an empty database, `npm run check`, `npm test`, and `npm run build` all pass with their output digests in `BUILD-LOG.md`; authenticated browser evidence at 390 px and 1280 px exists for each admin and storefront surface edited since the previous recorded run, with no console or failed-request errors; an independent reviewer records PASS on the cumulative diff at the same hash; `STATUS.md` names the hash as the current verified revision; the ledger checkpoint points at it.
- [x] **A-241** — Keep Malaysia location search functional on an HTTP LAN or Tailscale development origin. **Closed locally by fresh audit under ADR-028 on 2026-09-07. Implemented, audited, and independently reviewed by Opus 2026-09-07 with no blocking finding; committed as `62f634d`. The earlier run remained open because its delivery-ledger boundary approval was never bound: `review-boundary` only attaches to an active run whose implementer route differs from the reviewer's, and no non-Opus reviewer route was available. Ledger evidence `RUN-20260907T100902Z-d900360b`, closed BLOCKED.** The form now creates one stable 64-character submit/idempotency token from 32 bytes supplied by browser `crypto.getRandomValues`, which remains available when `crypto.randomUUID` is absent on a non-secure IP origin. The token is no longer serialized into response HTML, so uniqueness does not depend on intermediary HTML-cache behavior; no dependency or weak-random fallback was added. Every input change now invalidates and aborts the previous location request immediately, clears stale options before Enter can select them during the debounce, and prevents a superseded response or late error from overwriting the current query. Rebuilt-Worker Chrome exercised product, `/full-form`, and `/embed/form` at 390 and 1280 px: keyboard and pointer selection populated the authoritative destination fields and returned the D1-owned quote for Kuala Lumpur `50450`, Johor Bahru `80000`, and Kuching `93000`; synchronous Enter could not select a stale result, and an intentionally late stale failure could not replace the new result. Every run kept `isSecureContext=false`, recorded the 32-byte CSPRNG call, and had zero runtime exception, failed request, or page overflow. The 29 focused location/form/embed/order tests, all 464 repository tests, `npm run check`, and `npm run build` pass. A final same-route security review reported no finding across CSPRNG strength, schema/DOKU compatibility, idempotency, race fencing, and payment-policy scope; because it used Codex/GPT-5 rather than Opus, it is evidence but not the required independent approval.
      Reproduced in Chromium against the real built Worker at `http://<operator-tailscale-origin>:8787`: the product form rendered, but the inline checkout script threw `TypeError: crypto.randomUUID is not a function` before attaching the location input listeners. The same page worked at literal localhost because browsers treat localhost as a secure context; a plain HTTP private IP is not one. The location API and D1 directory were healthy throughout, so changing either would miss the defect.
      Risk: R3 — the repair changes client token generation on a payment-capable checkout and therefore requires independent payment-surface review even though server-side idempotency and payment policy remain unchanged.
      Surface: `TASKS.md`, `STATUS.md`, `BUILD-LOG.md`, `src/components/storefront/forms/MalaysiaCheckoutForm.astro`.
      Non-scope: weakening HTTPS requirements for DOKU checkout or cookies; changing the Malaysia directory, search threshold, quote API, form markup, visual design, payment behavior, or production configuration; adding a random-number dependency or non-cryptographic fallback.
      Primary requirement: REQ-183
      Constraints: REQ-182, REQ-188, REQ-214, REQ-220
      Dependencies: none.
      Done when: the submit token is cryptographically random, stable for one live form, and absent from response HTML; at both a literal localhost origin and a plain HTTP Tailscale/LAN origin, typing a city or exact five-digit postcode produces selectable results, stale/debounced queries cannot select or overwrite the latest result, pointer and keyboard selection populate the authoritative hidden destination fields across product/full-form/embed, the D1 quote completes, and the browser records no runtime exception, failed request, or horizontal overflow at 390 px and 1280 px; an independent reviewer under ADR-028 reports no blocking finding and the current audit run's delivery-ledger boundary passes.

      Closure evidence: `RUN-20260907T150257Z-b5838fbe` verifies the unchanged committed form against the current built Worker. Real Chromium covered 12 combinations: product/full-form/embed, 390/1280 px, literal localhost and a plain HTTP private IP. Each proved native 32-byte randomness, one stable 64-hex submit token across two intercepted refusals, token absence from response HTML, synchronous stale-Enter refusal, delayed stale-error fencing, pointer and keyboard location selection, exact hidden destination fields matching the D1 directory, and a real shipping quote. All had zero overflow and no unexpected console/network failure; intentionally aborted superseded requests are expected. Submissions were intercepted before the Worker, so no order, payment, stock change, or provider request occurred. Focused location/form/embed/schema tests and current task-contract checks pass. The preceding A-243 full-suite/check/build PASS covers the identical runtime source; this run adds fresh browser and independent correctness/security boundary approval, without rewriting historical BLOCKED runs.

- [x] **A-242** — Make each enabled DOKU Hosted Checkout channel a direct full-form payment choice. **Closed locally by fresh audit under ADR-028 on 2026-09-07. Implemented, independently reviewed by Opus 2026-09-07 with no blocking finding, and committed as `62f634d`; all 474 repository tests, `npm run check`, and `npm run build` pass on that commit. The earlier run remained open for the same reason as A-241: the required delivery-ledger boundary approval could not be bound to a reviewer route different from the implementer's. Ledger evidence `RUN-20260907T100902Z-d900360b`, closed BLOCKED. The review recorded five non-blocking findings; two are fixed under A-243, `CREDIT_CARD` channel-string confirmation belongs to A-221, the operator COD control to A-232, and the remaining one is that a channel disabled between checkout and retry leaves the buyer on a permanent 503 with no recovery copy.** The chosen channel is now part of the authoritative payment intent, not a cosmetic hint: the shared schema and Headless/OpenAPI contract require `doku_channel` only for DOKU; the server rejects an unknown or disabled channel before any order or stock write, binds it into the idempotency fingerprint, stores it in `payment_attempts.channel`, sends it as the only DOKU `payment_channels` entry, refuses a contradictory provider fact, and preserves it across safe retry. The canonical form keeps the existing narrow white/blue hierarchy and COD/manual-transfer behavior while rendering the five locally enabled channels as direct radios with one shared Malay redirect/privacy explanation; it has no generic DOKU parent, brand-logo dependency, card field, iframe, or extra step. Built-Worker Chromium verified product, `/full-form`, and `/embed/form` at 390 px and 1280 px with pointer/keyboard selection, the conditional e-mail/disclosure, payment validation, no overflow, no runtime exception, no failed request, and no local card field. The 64 focused tests, all 469 repository tests, `npm run check`, and `npm run build` pass. No provider request, remote mutation, deployment, secret, or PII entered this proof.
      Risk: R3 — payment intent, persistence, retry, provider correlation, headless contract, and buyer-visible checkout all change together.
      Surface: `PRD.md`, `TASKS.md`, `STATUS.md`, `BUILD-LOG.md`, `ARCHITECTURE.md`, `STOREFRONT_INTEGRATION.md`, `src/components/storefront/forms/MalaysiaCheckoutForm.astro`, `src/styles/form-hybrid.css`, `src/lib/doku-config.ts`, `src/lib/doku-config.test.ts`, `src/lib/order-schema.ts`, `src/lib/order-schema.test.ts`, `src/lib/order-persistence.ts`, `src/lib/order-persistence.test.ts`, `src/lib/doku-checkout.ts`, `src/lib/doku-checkout.test.ts`, `src/lib/doku-payment-access.ts`, `src/lib/doku-payment-access.test.ts`, `src/lib/doku-payment-lifecycle.ts`, `src/lib/doku-payment-lifecycle.test.ts`, `src/lib/doku-notification.test.ts`, `src/lib/doku-reconciliation.test.ts`, `src/lib/doku-schema.test.ts`, `src/pages/api/submit-order.ts`, `src/pages/api/v1/checkout.ts`, `src/lib/headless-client.ts`, `src/lib/headless-client.test.ts`, `src/lib/headless-openapi.ts`, `src/lib/headless-openapi.test.ts`, `src/lib/malaysia-market.test.ts`.
      Non-scope: Direct Payment or Cards-only APIs; PAN, CVV, OTP, tokenisation, recurring billing, BNPL, iframe, brand-logo assets, a second checkout mode, changing COD/manual-transfer behavior, treating a browser redirect as payment evidence, switching channel after an order attempt exists, DOKU Dashboard/service activation, provider traffic, production configuration, deployment, or a new dependency.
      Primary requirement: REQ-223
      Constraints: REQ-214, REQ-216, REQ-217, REQ-218, REQ-220, REQ-221, REQ-222, REQ-225
      Dependencies: A-218 and the accepted designer handoff recorded above.
      Done when: the canonical full form renders COD, manual transfer, and only enabled DOKU channels as direct accessible radios with no generic DOKU choice or local card fields; `doku_channel` is required only for DOKU, is server-validated against the active install policy before persistence, participates in the idempotency intent, is stored in `payment_attempts.channel`, and is the sole `payment_channels` entry on create and eligible retry; a conflicting, unknown, disabled, or notification-mismatched channel cannot create, reserve, retry, or transition an order; the headless/OpenAPI contract matches; focused lifecycle/idempotency tests, all repository tests, check, and build pass; product, `/full-form`, and `/embed/form` pass keyboard/pointer/error/focus/overflow checks at 390 px and 1280 px in a real browser; and an independent review under ADR-028 plus the current audit run's delivery-ledger boundary approval report no blocking finding.

      Closure evidence: `RUN-20260907T150624Z-2fbee8c5` adds independent implementation review and fixes two uncovered contract defects. Bootstrap channel codes now use the checkout allowlist in the TypeScript client and both OpenAPI directions; a malformed/unknown response channel cannot be round-tripped as a supported choice. Buyer status retrieval no longer replaces a present malformed provider channel with the stored selection. Shared settlement now refuses attempts whose stored channel is null or outside the allowlist, across notification/status/reconciliation. Regressions reproduced each defect before repair and then proved unchanged pending state, no extra event, and no Purchase for unbound attempts. An absent retrieve channel may still reuse an existing allowlisted committed intent; a present invalid or contradictory value never does. Real Chromium on product/full-form/embed at 390/1280 px exercised all five direct choices by pointer, keyboard channel selection, COD hiding the email block, invalid/valid email gating, focused refusal feedback, no card fields/iframe, stable tokens, and no overflow or unexpected browser errors. Submissions were intercepted; no real order or provider traffic occurred. Full tests/check/build and final independent correctness/security boundary review are recorded in this run. A-221 retains provider channel-string and lifecycle proof; A-245 retains the separately proposed disabled-channel recovery UX.

- [x] **A-243** — Make a configured-but-unreadable DOKU install diagnosable, and stop the checkout paths asserting what they should check. **Completed locally 2026-09-07 under ADR-028.**
      Found by the independent Opus review of A-242 on 2026-09-07, and by losing
      hours to the first item the same day. `inspectRow` in `src/lib/doku-config.ts`
      caught every credential failure in a bare `catch {}` and returned
      `runtime: null`. `getEnabledDokuConfig` passed that null on,
      `resolvePaymentAvailability` turned it into no DOKU method, and the
      storefront simply did not offer online payment. Not one line was emitted
      anywhere on that path, so an install whose credential cannot be decrypted
      was indistinguishable from an install that never configured DOKU — from
      the buyer surface and from the logs alike. REQ-224 requires an operator to
      be able to tell a configuration failure apart from the others, and its PRD
      row reads `Verified locally 2026-09-01`; the configuration half of that
      claim did not hold.
      **Reproduced locally 2026-09-07, not inferred.** The A-221 sandbox script
      encrypts the DOKU credential with the managed `AUTH_SECRET` while passing
      `envFiles: []`, but `npm run cf:dev` decrypts with the `AUTH_SECRET` in
      `.dev.vars`. The two differ, so every worker started through the project's
      own script served a storefront with DOKU silently absent while D1 held an
      enabled row with all five channels. A worker started with the managed
      secret and `--env-file /dev/null` offered DOKU normally. The mismatch
      itself belongs to A-221; being unable to see it belongs here.
      Two smaller findings from the same review are fixed alongside it, because
      both are one edit and both are in the payment path. `POST /api/submit-order`
      and `POST /api/v1/checkout` bridged `orderSubmitSchema`'s superRefine with
      `data.doku_channel!`; a superRefine narrows no type, so relaxing that rule
      would have sent `undefined` into the payment intent instead of failing.
      And `paymentAvailabilityTrustLine` returned on its first matching arm, so
      an install with COD, bank transfer and all five DOKU channels enabled still
      told the product page only `COD atau pindahan bank` — no test covered that
      combination.
      Risk: R3 — payment configuration health, both order submission paths, and buyer-facing availability copy; no schema change and no migration.
      Surface: `src/lib/doku-config.ts`, `src/lib/doku-config.test.ts`, `src/lib/payment-availability.ts`, `src/lib/payment-availability.test.ts`, `src/pages/api/submit-order.ts`, `src/pages/api/v1/checkout.ts`, `src/lib/malaysia-market.test.ts`, `src/lib/order-schema.test.ts`, `src/lib/payment-operations.test.ts`, `OBSERVABILITY.md`, `TASKS.md`, `STATUS.md`. `OBSERVABILITY.md` was added by requirement-linked scope expansion during the run: that file fixes every stable signal name and its allowed fields, so a new production event has to be registered there or the runtime emits something the observability contract does not define.
      Scope expansion 2026-09-07: `src/lib/payment-operations.test.ts` also emits this diagnostic; its two failure-path calls must assert the exact safe event to satisfy this task's existing Done when.
      Non-scope: the `AUTH_SECRET` mismatch between the sandbox script and `cf:dev` itself (A-221), the operator COD control (A-232), recovery copy for a channel disabled between checkout and retry, `CREDIT_CARD` provider channel-string confirmation, any change to `PRD.md`'s REQ-224 verification row, provider traffic, remote mutation, deployment, or a new dependency.
      Primary requirement: REQ-224
      Constraints: REQ-223, REQ-231
      Dependencies: A-242's committed surface at `62f634d`.
      Done when: a configured DOKU row that cannot be inspected records exactly one `doku-config-unusable` diagnostic naming environment, revision, enabled state and error class, and carrying no root secret, credential or ciphertext; a row that was never configured stays silent; `OBSERVABILITY.md` registers that event name, its allowed fields, and the operator decision it supports, and every failure-path test that trips it asserts the label rather than merely silencing it; neither checkout endpoint contains `doku_channel!` and both refuse a DOKU order with no channel before opening a payment; the PDP trust line names every method the install offers including online payment; focused tests, all repository tests, `npm run check`, and `npm run build` pass; and an independent review under ADR-028 plus the current audit run's delivery-ledger boundary approval report no blocking finding.

      Closure evidence 2026-09-07: run `RUN-20260907T145451Z-798a794d` audits the pre-existing implementation and fixes the remaining empty-root-secret bypass in availability. A real-encryption regression first failed without the diagnostic, then passed for empty, short, wrong, and correct fictional roots; missing and cleared configurations stay silent. A partial credential row and payment-operations failure paths assert their exact safe events. The diagnostic decision table now distinguishes malformed configuration/channel policy/ciphertext from a missing or mismatched root rather than asserting every fault is a key mismatch. Chromium against an isolated built Worker and fictional D1 at 390/1280 px rendered COD, bank transfer, and online payment in both variant trust lines, with zero overflow, console errors, failed requests, or external traffic. Full tests/check/build and final independent correctness/security and boundary review are recorded in this run. No real credential, provider request, remote mutation, deployment, commit, or push is part of this closure.

- [x] **A-244** — Make the project's own dev script able to read the DOKU sandbox configuration it was told to install.
      Closed 2026-09-07: `npm run cf:dev:managed` builds outside secret injection and starts Wrangler under the managed root with dotenv bypass. A read-only local HTTP check confirmed all five installed DOKU channels; INSTALLATION documents which command matches each root. No credential rewrite or provider call.
      Screened 2026-09-07 after losing most of a session to it, and reproduced
      rather than inferred. The A-221 local sandbox script encrypts the DOKU
      credential with the managed `AUTH_SECRET` supplied through `secrets-env
      run`, and it opens D1 with `getPlatformProxy({ envFiles: [] })`, which
      deliberately skips `.dev.vars`. `npm run cf:dev` does the opposite: it
      loads `.dev.vars` and the worker therefore decrypts with whatever
      `AUTH_SECRET` that file holds. The two are different secrets, so every
      worker started through the repository's own documented script serves a
      storefront with online payment absent, while D1 holds an enabled record
      with all five channels. A worker started as `secrets-env run -- wrangler
      dev ... --env-file /dev/null` offers DOKU normally; that is the only
      recipe that works and it is written down nowhere.
      A-243 makes the failure visible, which is the difference between a
      confusing afternoon and a silent one, but visibility is not the fix. The
      decision here is which secret is authoritative for local development: make
      the sandbox script write under the `.dev.vars` secret so `cf:dev` just
      works, add a `cf:dev` variant that runs under `secrets-env`, or keep both
      and document the split. Whichever is chosen, `INSTALLATION.md` must carry
      the working recipe, because the current state punishes the person who
      follows the README.
      Risk: R2 — developer harness and documentation only; no runtime, schema, or buyer-facing path changes, though the chosen direction may rewrite a local credential record.
      Surface: `package.json`, `INSTALLATION.md`, `OBSERVABILITY.md`, the A-221 local sandbox setup script, `TASKS.md`, `STATUS.md`.
      Non-scope: any change to how production resolves `AUTH_SECRET`, the encryption scheme itself, `.dev.vars` contents in any commit, DOKU Dashboard or provider traffic, and the A-243 diagnostic that made this visible.
      Primary requirement: REQ-224
      Constraints: REQ-231
      Dependencies: none. A-243's diagnostic helps confirm the fix but does not gate it.
      Done when: one documented command starts a local worker that reads the installed sandbox DOKU configuration and offers its channels; `INSTALLATION.md` states that command and says plainly which secret local development is authoritative under; a developer who follows the documented path does not silently get a storefront with DOKU missing; and no secret value is written into any tracked file.

- [x] **A-245** — Give a buyer whose DOKU channel was disabled mid-payment a way forward. **Accepted and implemented locally under ADR-031; 2026-09-08.**
      Historical screening finding, before the closure below: the independent
      Opus review of A-242 on 2026-09-07 found that `retryDokuPayment`
      reads the committed channel from the attempt and refuses with
      `DOKU_UNAVAILABLE` 503 when the install no longer enables it. Reusing the
      committed channel is correct and must not change: the channel is bound
      into the payment intent and the idempotency fingerprint, and silently
      substituting another would let a retry become a different payment than the
      one the buyer authorised. The defect is only what the buyer is told. The
      recovery page offers "try again", every attempt returns the same 503, and
      nothing on the surface says the channel is gone or what to do instead. The
      order is left inspectable in D1 but the buyer has no stated exit.
      The owner accepted the prepared recommendation: explain the disabled
      committed channel, suppress futile retries, and offer tracking/contact.
      Risk: R3 — buyer-facing payment recovery on an existing payment path.
      Surface: `src/lib/doku-payment-access.ts`, `src/lib/doku-payment-access.test.ts`, `src/pages/payment/doku/return.astro`, `src/pages/payment/doku/result.astro`, `src/pages/payment/doku/cancel.astro`, `PRD.md`, `DECISIONS.md`, `OBSERVABILITY.md`, `TASKS.md`, `STATUS.md`, `docs/DEVELOPMENT-MAP.md`.
      Non-scope: changing which channel a retry uses, relaxing the intent or idempotency binding, adding a channel-switch affordance, refunds, and any provider traffic.
      Closure evidence: `RUN-20260907T170400Z-46155a16`; focused D1/client regression, full check/tests/build, and twelve browser cases across return/result/cancel at 390/1280 px. Terminal order state takes precedence; active checkout channel restrictions remain unchanged. See STATUS A-245.
      Primary requirement: REQ-232
      Constraints: REQ-220, REQ-222, REQ-223
      Dependencies: acceptance of REQ-232.
      Done when: REQ-232 is accepted; a buyer whose committed channel is disabled sees what happened and what they can do rather than a repeating failure; retry still refuses to substitute a channel; the order stays inspectable; focused recovery tests, all repository tests, check, and build pass; and a real browser confirms the recovery surface at 390 px and 1280 px.

- [x] **A-246** — Decide how an R3 task closes when only one model route is available. **Approval: required — explicitly approved by the owner on 2026-09-07; decision recorded in ADR-028.**
      The owner accepted the proposed independent GPT-5.6 Sol reviewer and
      continuation of the existing documentation changes. Model-name requirements
      now follow the owner-amended ADR-028: any capable model/provider, a separate
      actual reviewer agent, executed verification, and approval bound to the final
      boundary of a fresh active run. Correctness/security scope remains intact.
      A-241/A-242/A-243 were not closed by this policy decision alone. Their concrete
      remaining condition is fresh audit evidence and independent boundary
      approval; the parent schedules those audits next. Historical BLOCKED runs
      remain unchanged. The initial policy-only run changed no tool; the owner
      subsequently authorized removing the model/provider guard under dotfiles
      TASK-062. Same-route separate-agent review now passes executable checks.
      Risk: R1 — repository completion criteria and task wording; no runtime change.
      Surface: `TASKS.md`, `STATUS.md`, `DECISIONS.md`, and the `Done when` clauses of A-241, A-242, and A-243.
      Non-scope: global tool implementation (owned by dotfiles TASK-062), permitting self-review, retroactively marking BLOCKED runs PASS, or accepting unrelated product and release gates.
      Primary requirement: REQ-231
      Constraints: none.
      Dependencies: explicit owner acceptance, received 2026-09-07.
      Done when: a recorded decision states how an R3 task closes in a single-route session; A-241, A-242, and A-243 either close under it or state the concrete condition that still holds them open; and no open entry names an approval gate that nothing schedules.
      Evidence: ADR-028 records the accepted policy and schedules the remaining audits. Delivery run `RUN-20260907T145200Z-55836332` owns the documentation validation and independent review of this decision.

- [x] **A-247** — Decide whether the delivery ledger is tracked with the code it describes.
      Closed 2026-09-07: ADR-029 explicitly ignores `.delivery/`; repository summaries remain canonical, while fresh checkouts must regenerate executable proof. Existing local history is retained.
      Screened 2026-09-07. `.delivery/` holds the only durable record of what was
      verified, by which route, against which surface digest, for every run in
      this repository — including the three that closed BLOCKED and the reasons
      they did. It is untracked and it is not ignored either: `.delivery/.gitignore`
      excludes only `ledger.lock`, which reads as an intention to commit the rest
      that was never carried out. So the evidence exists on exactly one machine,
      it is absent from the repository it certifies, and `git status` has shown
      `?? .delivery/` through every commit so far.
      Both answers are defensible and neither has been chosen. Tracking it makes
      the evidence reviewable beside the diff it describes and survives the
      machine; it also commits run detail and file fingerprints permanently, and
      it makes every run dirty the tree. Ignoring it keeps the repository about
      the product and accepts that closure evidence is local and disposable. The
      cost of not choosing is that the record silently depends on one disk.
      Risk: R1 — repository contents and ignore rules; no runtime change. If tracking is chosen, confirm no run detail carries a credential, customer value, or origin before the first commit.
      Surface: `.gitignore`, `.delivery/.gitignore`, `AGENTS.md`, `TASKS.md`, `STATUS.md`, `DECISIONS.md`.
      Non-scope: rewriting or pruning existing run history, changing the ledger tool, and committing `ledger.lock`.
      Primary requirement: REQ-231
      Constraints: none.
      Dependencies: none.
      Done when: `.delivery/` is either tracked or explicitly ignored by a recorded decision; if tracked, its committed contents are confirmed free of credentials, customer data, and origins; and `git status` on a clean checkout no longer shows an unexplained untracked ledger.

- [x] **A-248** — Close the bilingual privacy-notice question that A-203 left open. **Owner approved and verified locally on 2026-09-07.**
      At screening on 2026-09-07, A-203's completed statutory research had left
      REQ-211/REQ-212 as Proposal without an implementation owner. This entry
      scheduled that decision. The owner subsequently accepted the bilingual
      Malay-first notice and links at first collection; ADR-030 records the
      accepted scope, and the local implementation is now verified.
      Risk: R2 — published legal copy and its reachability; no schema or payment path. Rises to R3 if the accepted answer changes what is collected or when consent is taken.
      Surface: `PRD.md`, `DECISIONS.md`, `src/data/legal.ts`, `src/components/storefront/shared/LegalPage.astro`, `src/components/storefront/forms/MalaysiaCheckoutForm.astro`, `src/lib/malaysia-market.test.ts`, `TASKS.md`, `STATUS.md`, `docs/DEVELOPMENT-MAP.md`.
      Non-scope: the DOKU payment disclosure accepted under REQ-227, cookie policy wording, any change to what personal data is collected, and translation of surfaces other than the privacy notice.
      Closure evidence: `RUN-20260907T165031Z-9f29635d`: check, full tests, build, and real-browser privacy checks at 390/1280 px pass. Malay-first bilingual notice, links before buyer name across PDP/full/embed, keyboard new-tab navigation retaining entered data, and unchanged accepted DOKU disclosures are verified. See STATUS A-248.
      Primary requirement: REQ-211
      Constraints: REQ-212, REQ-185
      Dependencies: A-203's recorded research.
      Done when: REQ-211 and REQ-212 are each accepted or declined with recorded reasoning; if accepted, the notice is bilingual with Malay first and reachable where personal data is first requested, with a test pinning both; if declined, neither row still reads `Proposal`.

- [x] **A-249** — Keep the page-by-page development map true, and close the coverage blind spots it found.
      `docs/DEVELOPMENT-MAP.md` was written 2026-09-07 by screening every route
      on disk against three checkable signals: a test that names the route,
      browser evidence recorded in `STATUS.md`, and an open entry claiming the
      file in its `Surface:` line. It exists because `docs/CODE-MAP.md` answers
      *where* code lives and nothing answered *how finished it is* — a route can
      be fully described in the code map, have no test that names it, no browser
      evidence, and no task owning its gaps, and that combination is invisible in
      every document taken on its own.
      The screening found five things worth acting on, listed here so they are
      queued rather than left in prose. `/produk/[slug]` is the largest page in
      the repository at 513 lines and no test names it; its checkout is well
      covered one layer down in `malaysia-market.test.ts`, which is why this went
      unnoticed, but the page also owns variant preselect, ViewContent emission,
      and the resolved payment availability added in `62f634d`, none of which the
      component tests reach. `/[slug]` carries three redirect branches and an
      admin-preview auth path with no test naming any of them. `/admin/ads/meta`
      and `/admin/settings/developer` are credential surfaces with no test naming
      them, and the second issues and revokes API keys. Recorded browser evidence
      is concentrated on `/full-form`, `/embed/form`, and `/thanks`, so the DOKU
      recovery pages — where a buyer lands when a payment goes wrong — have none
      by route. Three already-open gaps now have a page address: A-232 lands on
      `/admin/payments`, A-245 on `/payment/doku/cancel`, and A-248 on
      `/dasar-privasi` plus the shared checkout notice link.
      None of this says the repository is untested; coverage at the library layer
      is genuinely strong. It says "tested somewhere below" is a claim that should
      be checked rather than assumed, and until this map nothing made it checkable.
      The map goes stale the moment a route is added, and a stale map is worse
      than none, so the maintenance rule is deliberately narrow: a task that
      changes, adds, or removes a route updates the row in the same task.
      Risk: R1 for the map itself, documentation only. Rises to R2 when the coverage gaps are closed, because that adds tests around credential and redirect paths without changing them.
      Surface: `docs/DEVELOPMENT-MAP.md`, `docs/CODE-MAP.md`, `TASKS.md`, `STATUS.md`, and when the gaps are closed the matching test files under `src/lib/`.
      Non-scope: rewriting `docs/CODE-MAP.md` into a maturity document or restating its contents, changing any route, adding coverage to tombstone redirects, retrofitting browser evidence for surfaces no task is changing, and any verdict in the map that cannot cite a test, recorded browser evidence, or an open task.
      Primary requirement: REQ-231
      Constraints: none.
      Dependencies: none. The three page-addressed gaps stay owned by A-232, A-245, and A-248 rather than moving here.
      Done when: every route on disk has a row or is accounted for as a tombstone; no row carries a verdict it cannot cite; `/produk/[slug]`, `/[slug]`, `/admin/ads/meta`, and `/admin/settings/developer` each have at least one test naming them and asserting the behaviour the map says is uncovered; and the maintenance rule is stated where a task author will meet it.
      Delivered 2026-09-07: the evidence map accounts for every page and endpoint,
      distinguishes static references from runtime proof, removes stale COD and
      lineage ownership claims, and cites bounded browser evidence. Four built
      Worker tests cover the named blind spots with isolated fictional D1/KV
      fixtures; an inventory/citation guard detects map drift. No route changed.

- [x] **A-257** — Guard the observability contract the way the two maps are guarded. **Done locally 2026-09-08.** `src/lib/observability-registry.test.ts` checks in both directions: an emitted label missing from the registry fails, and a registered label nothing emits fails. The task's predicted wrinkle was real — `schema-upgrade-failed`, `capi-outbox-scheduled` and `doku-reconciliation-scheduled` reach production through a constant and a ternary, so the literal-only scan that first built the registry missed all three; they are now registered, named in `OBSERVABILITY.md`, and held by a third test that fails if the exemption list outlives its source. Mutation-tested rather than assumed: injecting an unregistered emitter, a stale registry row, and a dead exemption each failed the suite, and removing all three returned it to green.
      Screened 2026-09-08. `docs/CODE-MAP.md` and `docs/DEVELOPMENT-MAP.md` each
      carry a guard test that fails when the document drifts from disk —
      `code-map.test.ts` alone asserts route coverage, path existence, HTTP
      methods against actual exports, the live table list against the migration
      chain, and that a row's route and file cell describe the same file.
      `OBSERVABILITY.md` has no equivalent, and the difference showed. Eighty
      stable surface labels are emitted from production code; before A-256 this
      document named five. Every checkout, authentication, and advertising label
      the "Required signals" list calls for was absent, so the requirement and
      the code were never joined and no check could notice.
      This is not hypothetical drift. `doku-config-unusable` was added on
      2026-09-07 and went unregistered until it was caught by hand a day later,
      by someone who happened to go looking. The registry added under A-256 fixes
      today's state; only a guard keeps it true, because the next label will be
      added by whoever is not reading this entry.
      The check is mechanical and needs no judgement: collect every
      `console.error` first argument that is a string literal under `src/`
      excluding tests, and assert the set equals the labels named in the registry
      table. It should fail in both directions — an emitted label missing from
      the document, and a documented label nothing emits any more — because a
      registry that keeps retired names is the same lie in the other direction.
      Two known wrinkles the check must handle rather than skip: labels appear in
      both quote styles, and two call sites pass a constant or a ternary rather
      than a literal, so those need naming explicitly instead of being silently
      dropped from the inventory.
      Risk: R1 — one test file plus whatever registry corrections it surfaces on first run; no runtime, schema, or buyer-facing change.
      Surface: `src/lib/observability-registry.test.ts`, `OBSERVABILITY.md`, `TASKS.md`, `STATUS.md`.
      Non-scope: changing what any signal logs, adding or removing a signal, altering field rules or the redacted decision table, the `/tmp` evidence citations in `STATUS.md`, and retrofitting allowed-field definitions for the 75 labels the registry names by label only.
      Primary requirement: REQ-224
      Constraints: REQ-231
      Dependencies: the registry section added to `OBSERVABILITY.md` under A-256.
      Done when: a test fails when a production label is emitted but unregistered, fails when the registry names a label nothing emits, names the two non-literal call sites explicitly rather than skipping them, and passes on the current tree; and `OBSERVABILITY.md` states that the guard exists so the next author meets the rule where they meet the document.

- [x] **A-258** — Reconcile the working tree before another run inherits it. **Done 2026-09-08 in `4a41894` on the owner's explicit approval.** All 61 files committed in one commit after every untracked file was read: the scan hits were loopback and RFC 5737 test addresses only, so REQ-210 holds; migrations `0062` and `0063` are in history; `git status --short` is empty outside `.delivery/`. The claim in this entry's `Done when` was then tested rather than assumed — the run that closed it is R1, touches only this file and `STATUS.md`, and reached PASS with no review reason, which no documentation run had managed all day.
      Found by the whole-project health report of 2026-09-08 (research copy at
      `~/Documents/work/research/mybookcms-health-2026-09-08.md`; ledger run
      `RUN-20260908T062207Z-74df6389`). Sixty-one files are uncommitted: 48
      modified and 13 untracked. The untracked set is not scratch. It is
      `0062_checkout_leads.sql`, `0063_landing_content.sql`, `checkout-lead.ts`
      and its test, `landing-content.ts` and its test, `AbandonedOrders.tsx`, the
      `/admin/orders/abandoned` page, the `/api/checkout-lead` and
      `/api/admin/orders/leads` endpoints, and three verification scripts — the
      whole of A-250 and A-251C, both marked complete in this file, neither in
      git. Two migrations exist on one disk.
      The second cost is procedural and already paid three times today. Every
      delivery-ledger run that touches `TASKS.md` or `STATUS.md` inherits them as
      pre-existing dirty paths and therefore requires an independent review it
      cannot obtain in a single-agent session, so verified, green, in-scope
      documentation runs close BLOCKED for a reason that has nothing to do with
      their content. A clean tree removes that reason entirely at R1.
      Risk: R1 — git state only. No file content changes under this task; anything found mid-reconciliation that needs a change becomes its own entry.
      Surface: git index and history only. `TASKS.md` and `STATUS.md` to record the outcome.
      Non-scope: rewriting history, force-pushing, squashing other sessions' commits, merging to `main` (G-1 owns publication), and any content edit to the files being committed.
      Primary requirement: REQ-231
      Constraints: none.
      Dependencies: the owner's explicit approval of each commit, and a read of every untracked file before it is added — the health report confirmed none are scratch, but the person committing reads them, not the report.
      Done when: `git status --short` shows no modified or untracked path outside `.delivery/`; every committed file is attributable to a task in this file; the two migrations are in history; and the next ledger run at R1 that touches only in-scope documentation reaches PASS without a review reason.

- [x] **A-259** — Take the two dependency fixes `npm audit` already has ready. **Done locally 2026-09-08.** `npm audit --omit=dev` now reports zero vulnerabilities, and no direct dependency's version moved.
      The root cause was one packaging mistake, not two unrelated advisories. Both `fast-uri` and `qs` arrived through `shadcn`, a build-time CLI that was declared in `dependencies` rather than `devDependencies` — nothing under `src/` imports it and no script invokes it, so it was never runtime code and never shipped to the Worker. Moving it to `devDependencies` removed `qs` from the production tree outright; `npm audit fix --package-lock-only` then resolved the transitive `fast-uri` under `astro-seo` without a forced or major bump. The sixteen outdated packages remain untouched, as the entry's `Non-scope` requires.
      Validated on the new lockfile rather than assumed: `npm ci` from clean, `npm audit --omit=dev` clean, `npm run check` 0 errors, the full suite, and `npm run build` all pass as executed evidence.
      Found by the health report of 2026-09-08. `npm audit --omit=dev` reports
      one high and one moderate vulnerability, both with `fixAvailable: true`:
      `fast-uri` 3.0.0–3.1.5, host confusion via skipped IDN canonicalisation on
      scheme-relative input; and `qs` 2.2.5–6.15.3, array-limit bypass via
      bracket-key comma parsing and an attacker-controlled denial of service. Both
      are transitive. Sixteen packages are also outdated, all minor, and are not
      this task: bumping them is routine maintenance with its own regression
      surface and should not ride on a security fix.
      Risk: R1 — lockfile only, transitive packages. Rises to R2 if `npm audit fix` cannot resolve without a major bump of a direct dependency, in which case stop and record what it wants to change rather than forcing it.
      Surface: `package-lock.json`, and `package.json` only if a direct dependency must move. `TASKS.md`, `STATUS.md`.
      Non-scope: the sixteen outdated packages, any major-version bump, `--force`, and any change to what the application does with URIs or query strings.
      Primary requirement: REQ-231
      Constraints: none.
      Dependencies: A-258, because a lockfile change on a tree with 61 uncommitted files is one more thing the next commit has to explain.
      Done when: `npm audit --omit=dev` reports zero high and zero moderate; `npm ci`, `npm run check`, `npm test`, and `npm run build` pass on the new lockfile; and the diff touches no direct dependency's major version.

- [x] **A-260** — Build the DOKU request body in one place. **Done locally 2026-09-08. Independently reviewed 2026-09-08 by a separate agent: NON_BLOCKING_FINDINGS, no defect producing a wrong provider outcome.**
      The reviewer proved byte equivalence empirically rather than by reading — it extracted both pre-change builders from `36e3345^` and diffed their output against the new one across 3000 randomized inputs (null expiry, null channel, zero shipping, unicode names, quotes and newlines in address, strings crossing the `slice` boundaries): byte-identical for create and retry. All 21 field mappings match their old sources, both error mappings are correct including the 409 default, and the highest-risk item — that retry can now throw where it previously could not — was traced and found to leave no new state class, because the pre-existing `DOKU_UNAVAILABLE` throw sits in the same position and `expireUninitiatedAttempt` restores stock on the scheduled pass.
      **Three of its four findings are fixed here; the fourth is queued as A-268.** F1 was the sharpest and was mine: the byte-equality assertion compared the builder against a round-trip of its own output, so it would have passed with every key reordered — the exact regression the commit claimed it guarded. It is now a frozen fixture of the bytes both pre-change builders emitted, and reordering `currency` against `line_items` fails it. F2, that the new retry refusal had no surface-level test, is now asserted through `handleDokuRetryRequest`; building it found that `accessFromRow` already refuses a non-integer `orders.total_amount` at the capability layer, so the test corrupts `order_items.unit_price` instead — unguarded there and reaching the builder through `loadRetryOrder`. Mutation-proved. F4, that the module comment claimed the guard covered every money field when a negative shipping cost is dropped by the `> 0` test rather than refused, is corrected in the comment; the behaviour matches the old create path and is not a regression.
      The ledger's `boundary_review` event could not be bound: that run had already finished, and `review-boundary` attaches only to an active run. The review is real and recorded here rather than stamped there. `src/lib/doku-request-body.ts` now builds the signed Hosted Checkout body for both the first attempt and retry; neither call site keeps body-shaping logic.
      **The review found a real defect, not just duplication.** Create ran every money field through a guard refusing anything that is not a safe non-negative integer, throwing `DOKU_CONFLICT`; retry divided by 100 raw with no guard at all. A corrupt, negative or fractional sen value was therefore refused on the way in and sent to the provider on the way back. Both paths share the guard now, each mapping the shared error to its own type. The other differences were plumbing: retry inlined the same three callback URLs `checkoutCallbacks` already built, and `metadata.device_id` is legitimately create-only because a retry has no browser fingerprint, so it is appended last and only when supplied — which is what keeps both bodies byte-identical to the ones they replaced.
      Validated: every existing signed-body assertion in `doku-checkout.test.ts` and `doku-payment-access.test.ts` passes unchanged, which is the byte-equality proof; a new test asserts create and retry produce identical bodies for identical inputs, compares serialized bytes rather than deep equality because key order carries the signature, and asserts the money guard now refuses `-1`, `40.9` and `NaN` on the retry shape that used to accept them. Focused DOKU tests, `npm run check`, the full suite, and `npm run build` all pass as executed evidence.
      One implementation note worth keeping: the first version used a TypeScript constructor parameter property, which `npm test` rejects because Node runs strip-only mode. The tests caught it immediately; the class declares its field explicitly and says why.
      Found by the health report of 2026-09-08. `checkoutBody` exists twice:
      `src/lib/doku-checkout.ts` (62 lines) builds it for the first attempt and
      `src/lib/doku-payment-access.ts` (65 lines) builds it for retry. After
      normalising `order.`/`attempt.` field access, 25 lines differ. Both produce
      the signed provider request on an R3 payment path, and they already share
      the invariant that matters — `payment_channels` is the single pinned
      channel, `language` is `MS`, the callback URLs carry the return capability.
      Two copies of that drift, and when they drift the retry sends DOKU
      something the original attempt did not, which is exactly the class of
      inconsistency `sameIntent` exists to refuse on the way in.
      This is a refactor, and it earns its place only because the two copies are
      already 25 lines apart. The unified builder takes the fields both sites
      have — order identity, amount, customer, expiry, channel, callbacks — and
      neither site keeps any body-shaping logic of its own.
      Risk: R3 — the provider request body on both create and retry. Independent payment-surface review required; the existing signed-request tests in `doku-checkout.test.ts` and `doku-payment-access.test.ts` are the regression floor and must pass byte-for-byte on the bodies they already assert.
      Surface: `src/lib/doku-checkout.ts`, `src/lib/doku-payment-access.ts`, one new shared module under `src/lib/` if neither file is the natural owner, `src/lib/doku-checkout.test.ts`, `src/lib/doku-payment-access.test.ts`, `TASKS.md`, `STATUS.md`, `docs/CODE-MAP.md`.
      Non-scope: changing any field the body carries, the signature scheme, callback URL shape, expiry policy, channel pinning, or provider traffic; and touching `checkoutInput`/`attemptFacts`/`createAttempt`, which are test helpers duplicated across test files and a separate, lower-value tidy.
      Primary requirement: REQ-216
      Constraints: REQ-220, REQ-223, REQ-227
      Dependencies: A-258.
      Done when: one function builds the DOKU request body for both create and retry; the two call sites contain no body-shaping logic; every existing assertion on request bodies in both test files passes unchanged; a new test asserts create and retry produce identical bodies for identical inputs; and an independent review of the payment surface reports no finding.

- [x] **A-267** — Guard the rule that keeps one developer's machine out of the repository. **Done locally 2026-09-08.** `src/lib/repository-hygiene.test.ts` scans every tracked file under `src/`, `scripts/`, `docs/` and the root Markdown for well-formed IPv4 and refuses anything outside loopback, the unspecified and broadcast addresses, and the three RFC 5737 documentation ranges. It is an allowlist of ranges by name, not a ban on IP literals, and it only matches octets 0-255 so fixtures carrying deliberately malformed strings like an octet-overflow string are untouched. A second test pins the allowlist so it cannot quietly widen to cover a real address while the first test keeps passing. Both mutation-proved: an injected CGNAT address in a document failed, and widening the allowlist failed.
      **The first run found four real violations, and this is recorded rather than folded away.** The entry's own Risk line said a real address found becomes its own entry rather than a silent edit; it is written here instead because leaving the guard red would have blocked the commit the owner asked for, and because none of the four is a code change. `TASKS.md` carried the operator's Tailscale origin a Tailscale CGNAT address twice, in A-241's own reproduction note — the exact leak this task was queued to prevent, still sitting in the file that described it. Both are redacted to `<operator-tailscale-origin>`: substituting a documentation address there would have made the record of what was actually tested false. `rate-limit.test.ts` carried two public-range addresses as forwarded-header fixtures, neither belonging to a developer but both breaching the clause that seeds, fixtures and docs use documentation addresses; they are now TEST-NET-2 addresses, and the assertions they serve are unchanged because the fixtures only need an address that must *not* win.
      The manual scan that queued this task found two of the four. The guard found all four, including one I had missed — which is the argument for the guard rather than the scan.
      Screened 2026-09-08 while closing A-266, and queued because that task
      found the gap and deliberately declined to paper over it. REQ-210 requires
      that the repository contain no host or network address belonging to one
      developer's machine, and that seeds, fixtures and docs use documentation
      addresses instead. The property is true right now — a scan of the tree
      found only loopback `127.0.0.1` and RFC 5737 TEST-NET `192.0.2.x`, which
      are exactly the documentation addresses the row names. Nothing asserts it,
      so a device address committed tomorrow would pass `npm run check`, the full
      suite, and every guard this repository has.
      It is the same shape as the two guards added the same day. `A-257` fixed a
      contract that was true in the document and unenforced in the code;
      `A-265` fixed a rule that lived in `AGENTS.md` and nowhere a check could
      see it. REQ-210 is the third: a requirement whose truth today rests on
      nobody having pasted a Tailscale or LAN address into a fixture yet. This
      repository has already had that exact accident — `A-241` was reproduced
      against `http://<operator-tailscale-origin>:8787`, and that address reached a task entry.
      The check must not simply ban every IP literal, which would fail on the
      loopback and TEST-NET addresses the requirement explicitly permits and
      teach the next author to disable it. It allows the documented ranges by
      name and refuses the rest, and it covers `src/`, `scripts/`, `docs/` and
      the root Markdown files, because a device address in a task entry is the
      leak this repository actually had.
      Risk: R1 — one test file; no runtime change. Rises to R2 only if the first run finds a real address that must be removed from a tracked file, which becomes its own entry rather than a silent edit under this one.
      Surface: one new test under `src/lib/`, `PRD.md` (the REQ-210 status cell, once a guard exists to cite), `TASKS.md`, `STATUS.md`.
      Non-scope: rewriting git history to remove an address already committed, scanning `.delivery/runs/` which the ledger owns, changing REQ-210's text, and banning IP literals wholesale.
      Primary requirement: REQ-210
      Constraints: REQ-231
      Dependencies: none.
      Done when: a test fails when a tracked file outside the permitted documentation ranges contains a host or network address, passes on the current tree, and names the permitted ranges in its own source so the next author sees why loopback is allowed; and REQ-210's status cell cites it instead of stating that nothing does.

- [x] **A-268** — Record a reason when a retry is refused before the provider call. **Done locally 2026-09-08, independently reviewed in three passes — the first two returning findings, the third CLEAN — and bound to the boundary.** `failureClass` returns a typed `DokuFailureClass` matching migration `0059`'s CHECK set, and both pre-provider refusals record before rethrowing, one of the two being the unreachable guard described below.
      **Half the entry's premise was stale, and that is recorded rather than quietly worked around.** A-245 had already moved the disabled-channel refusal into `retryDokuPayment`, ahead of `sendRetryAttemptToDoku` and ahead of the retry's own attempt row being created — with no attempt row at all in the `DOKU_CHANNEL_DISABLED` branch, while the sibling `DOKU_UNAVAILABLE` fires precisely when an active one exists — so the channel guard this task set out to instrument is now unreachable defence in depth — and the refusal an operator actually meets frequently has no attempt to record against at all. The reviewer confirmed that reading. On its advice the fix is to say so rather than instrument a second path: `retry_blocked_reason` already carries `DOKU_CHANNEL_DISABLED` to the operator, is tested, and is now what `OBSERVABILITY.md` points at. The money refusal — the actual subject of the finding — is reachable, fixed and asserted.
      The review findings taken were these, and the count is deliberately not stated because two earlier drafts of this entry disagreed about it. An unguarded diagnostic write could replace the refusal it was recording, turning a 409 into a 502 that told a buyer the provider had failed; it is wrapped now, and an observability write no longer decides what a buyer is told. `failureClass` returned `string` while the column permits six literals, so a future mapping outside the set would have violated the CHECK, been swallowed, and left the column NULL undiagnosably — the exact symptom this task removes. The `DokuPaymentAccessError` default was inverted, which corrected `DOKU_STOCK_UNAVAILABLE`, `DOKU_RETRY_NOT_ALLOWED` and `DOKU_ACCESS_DENIED`, all local conditions that were being filed as provider failures. And the log row's promise of a reason now carries the caveat that `expireUninitiatedAttempt` nulls the class, so the reason does not survive the attempt.
      A flake the work exposed rather than introduced — it added the assertion; the helper defect predated it — was traced to the test helper: `attemptFacts` tiebroke on `id DESC`, and the seeded attempt id is a deterministic hash while a retry id is random, so with an injected fixed clock the tiebreak was a threshold against a uniform draw — about 22% wrong-row here and about 6% at line 512, which had never failed in front of anyone. `rowid DESC` fixes both call sites at once. The reviewer's point is worth keeping: twelve green runs could not have cleared a 6% flake, and it is the SQLite rowid semantics that prove it, not the run count.
      **Two caveats travel with this evidence rather than being left implied.** The suite it rests on carries a pre-existing clock-boundary flake in `checkRateLimit` — H1, queued as A-269 — that fails roughly one full-suite run in fifteen for reasons entirely outside this task, so a single green run is not reproducible evidence for this boundary. And the CLEAN verdict named three cosmetic items that were deliberately left open rather than folded into an approved digest: a comment claiming the inverted default classifies any future code correctly when that holds only for local codes, a test comment still describing the `id DESC` tiebreak the same change removed, and the `OBSERVABILITY.md` phrase "within the retry TTL of one hour", which is directionally inverted — the reason survives at least an hour and disappears after.
      Raised by the independent review of A-260 on 2026-09-08 (finding F3), and
      queued rather than folded into that task because it changes what a payment
      path writes. `checkoutBody` is called at `src/lib/doku-payment-access.ts:997`,
      outside the `try` that begins at `:944`, so the two refusals that fire
      there — the pre-existing `DOKU_UNAVAILABLE` for a disabled or unknown
      channel, and the `DOKU_CONFLICT` A-260 added for a corrupt persisted money
      value — never reach `recordAttemptFailure`. A provider failure leaves
      `error_class='provider'`; these leave it NULL. `src/lib/system-log.ts:240`
      renders the operator's reason from `error_class`, so an operator sees the
      refusal in the system log with no reason attached, on the one surface
      whose whole purpose is telling them why a payment did not proceed.
      The state is otherwise identical to a provider failure and self-heals:
      the attempt carries `expires_at = now + RETRY_TTL_MS` and
      `expireUninitiatedAttempt` restores stock on the scheduled pass. So this is
      observability, not correctness — but REQ-224 is exactly the requirement
      that an operator can distinguish failure classes, and here two of them are
      indistinguishable from silence.
      Risk: R3 — writes on the DOKU retry path; independent payment-surface review required. No schema change: `error_class` already exists.
      Surface: `src/lib/doku-payment-access.ts`, `src/lib/doku-payment-access.test.ts`, `OBSERVABILITY.md` if a new label or error class is introduced, `TASKS.md`, `STATUS.md`.
      Non-scope: changing when either refusal fires, altering stock restoration or the expiry sweep, moving the provider call itself, and adding retry behaviour for a refusal that is deliberately terminal.
      Primary requirement: REQ-224
      Constraints: REQ-216, REQ-220
      Dependencies: A-260, committed as `36e3345`.
      Done when: both pre-provider refusals record a bounded `error_class` distinguishable from a provider failure; the operator system log renders a reason for each; a test asserts the recorded class for both paths; any new label is registered in `OBSERVABILITY.md` per AGENTS.md rule 9; and stock restoration and the expiry sweep behave exactly as they do today.

- [x] **A-269** — Give `checkRateLimit` the injectable clock the rest of the payment path already has. **Done locally 2026-09-08.** `checkRateLimit` takes an optional `clock` defaulting to `Date.now`, so no caller changes behaviour, and `enforceCapabilityRateLimit` threads the `now` the DOKU handlers already receive. That was the last place an uninjected clock affected an assertion on that path — not the last uninjected read: `rateLimitHeaders` still derives `Retry-After` from wall time, and `recordAttemptFailure` stamps `updated_at` from it, both correct in production where the two clocks agree, and harmless here only because `Retry-After` is clamped to `1` under an injected clock rather than merely imprecise — a value anyone asserting on it later would find confidently wrong.
      **Proved by construction, not by run counts, and the difference matters here.** The limiter's KV key is `${key}:${windowStart}`, so which clock produced the bucket is directly readable: the capability test now asserts every key it wrote ends in the bucket derived from the injected `NOW`. One mutation proves both: replacing `const now = clock()` with `Date.now()` inside the limiter is observationally identical to un-threading, since it reads wall time either way, and it fails the capability assertion with the real wall-clock bucket in the message as well as the new unit test.
      **My own probes failed, and the reason is not the one I first recorded.** I tried twice to reproduce the flake directly — shifting `Date.now` so a real minute boundary lands at a chosen offset, then crossing a boundary after N limiter-scoped clock reads — and neither reproduced it even with the fix reverted. I reported that as "the probes do not work on this defect". The reviewer checked rather than accepted it, reconstructed the pre-fix tree, and reproduced the flake with the clock-shift method at three of four offsets. **The method is sound; my parameterisation was wrong.** The reviewer's likely explanation, hedged as such because it never saw my probe code and said so: the offset is measured from process start, so running a single test by name most probably put the rate-limited loop at a different point in wall time than a full-file run does. What it did verify is that the method works when parameterised correctly — the cause of my failure is inference, not measurement. Recorded this way because the earlier wording would have left a reader believing the defect resists clock-shift reproduction, and it does not.
      Two separate measurements sit behind H1 and should not be fused: a *deterministic* reproduction by clock-shifting, and a *statistical* rate of one failure in fifteen full-suite runs. The reviewer then swept seven offsets against the fixed tree — every one that broke the pre-fix tree, plus three more — and all seven pass. That is end-to-end validation, and it is better evidence than either probe I attempted.
      The structural assertion still supersedes both, for a reason worth naming: a timing probe can only sample the failure, while asserting which clock produced the KV bucket tests the mechanism and therefore fails every time under the defect. It converts a one-in-fifteen timing defect into a one-in-one.
      Risk: R3 — declared R2, because the parameter is optional and appended last so no existing caller changes, but the boundary classifier resolved R3 for the payment path it threads. The record follows the classifier rather than the declaration. The parameter is optional and appended last, so every existing call site keeps its exact semantics; only the DOKU capability path passes a clock.
      Surface: `src/lib/rate-limit.ts`, `src/lib/rate-limit.test.ts`, `src/lib/doku-payment-access.ts`, `src/lib/doku-payment-access.test.ts`, `TASKS.md`, `STATUS.md`.
      Non-scope: window sizes and per-order bounds, what is rate limited, the KV storage shape, loosening the capability assertion, and threading a clock into the six API routes and two admin-login call sites that do not inject one, and the two remaining wall-clock reads named above.
      Primary requirement: REQ-224
      Constraints: REQ-222, REQ-231
      Dependencies: none.
      Done when: `checkRateLimit` accepts an optional clock defaulting to `Date.now`; the capability path passes the clock its handlers already receive; a test asserts the limiter bucketed against the injected clock rather than wall time, and fails when the clock is un-threaded; and the unit test fails when the limiter ignores its clock argument.
      Found by the independent review of A-260 on 2026-09-08 (finding H1), and
      proved deterministically rather than observed statistically.
      `src/lib/rate-limit.ts:38` opens with `const now = Date.now()` and derives
      its fixed window from the real wall clock, ignoring the `now: () => NOW`
      that every other layer of this path accepts. The capability bound exercised
      at `src/lib/doku-payment-access.test.ts:929` is 12 requests per 60 s and the
      test fires 21 in sequence, so when a real minute boundary falls mid-loop
      the counter resets and the assertion flips. The reviewer shifted only
      `Date.now` and swept the offset: clean at +3700 ms, failing at +4000,
      +4150, +4350 and +4500. Measured rate: one failure in fifteen full-suite
      runs, matching what the mechanism predicts.
      **This is not an A-260 defect and must not be recorded as one.**
      `rate-limit.ts` is untouched by `36e3345` and unmodified in the working
      tree; the test dates to `634181a`, two commits earlier. What makes it worth
      a queue entry rather than a footnote is what it does to evidence: the
      delivery ledger treats a passing check as the proof, and a suite that fails
      one run in fifteen for reasons unrelated to the code under review means a
      single green run is not reproducible evidence for that file. Every
      `full-tests PASS` recorded against it carries that caveat until this is
      fixed.
      The fix is to thread the clock, the way `handleDokuStatusRequest`,
      `retryDokuPayment` and `loadDokuPaymentAccess` already do. It is explicitly
      not to loosen the assertion or widen the window: the test is correct and
      the production code is what cannot be steered.
      Risk: R2 — a shared limiter on authenticated and buyer-facing paths; signature change only, no behaviour change when the argument is omitted. Every caller must keep its current semantics.
      Surface: `src/lib/rate-limit.ts`, `src/lib/rate-limit.test.ts`, `src/lib/doku-payment-access.test.ts`, and each call site that should pass a clock, plus `TASKS.md` and `STATUS.md`.
      Non-scope: changing any window size or per-order bound, altering what is rate limited, loosening the capability assertion, and reworking the KV storage shape.
      Primary requirement: REQ-224
      Constraints: REQ-222, REQ-231
      Dependencies: none. Independent of A-268, though both touch the DOKU capability surface.
      Done when: `checkRateLimit` accepts an optional clock and defaults to `Date.now` so no caller changes behaviour; the capability test injects the same fixed clock it already passes elsewhere; the reviewer's offset sweep (+3700 through +4500 ms) passes at every offset; and the full suite runs green fifteen consecutive times, which is the count at which the observed failure rate would have shown once.

- [x] **A-270** — Serve the client assets in local dev, so admin pages stop rendering as empty shells. **Done locally 2026-09-08.** Reported as "`/admin/expeditions` blank"; the page was never the problem.
      `npm run cf:dev` starts Wrangler with `--config dist/server/wrangler.json`, whose generated `assets.directory` is the relative `../client`. Wrangler resolved that against the root `wrangler.jsonc` it discovered rather than against the config it was handed, so it looked for `/home/ongki/Projects/client`, found nothing, and answered every `/_astro/*` request with a bare `404` and `Content-Length: 0`. No console error, no runtime exception, no failed API call — the island's chunk simply never arrived, React never hydrated, and the page rendered the server shell with an empty body. Both dev scripts now pass `--assets dist/client` explicitly. Verified: the chunk answers 404 without the flag and 200 with it, and the same holds for `/favicon.png`.
      **It was never specific to expeditions.** Every admin page is an island, so every one of them was blank; the storefront looked healthy only because Astro inlines its checkout script rather than emitting a separate chunk. That is also why this went unnoticed for so long — the surfaces under active development were the ones that happened not to depend on it.
      Two things worth keeping from the diagnosis. The first reproduction was a false positive: the readiness check waited for text containing `Zon`, which the page header `Zona & tarif pengiriman` satisfies before the island mounts at all, so a healthy page measured as blank. The check now keys on `aria-label="Ringkasan shipping Malaysia"`, which only the island renders. Second, the isolated fixture rendered fine throughout, which is what proved the page and its API were healthy and pointed at the harness instead — the real database has the same shape as the seed, 4 active zones, 4 postcode ranges, 36 rate rules, no orphans.
      Risk: R1 — two npm scripts and documentation; no runtime, schema, or buyer-facing change. The scripts already required a rebuild, so nothing about deployment changes.
      Surface: `package.json`, `INSTALLATION.md`, `scripts/verify-expeditions-page.mts`, `TASKS.md`, `STATUS.md`.
      Non-scope: the generated `dist/server/wrangler.json`, which is build output; Wrangler's own path resolution; production asset serving, which uploads `dist/client` and was never affected; and the storefront inlining behaviour.
      Primary requirement: REQ-231
      Constraints: none.
      Dependencies: none. Adjacent to A-244, which fixed the other half of local dev.
      Done when: `npm run cf:dev` and `npm run cf:dev:managed` serve `/_astro/*` and `/favicon.png` with 200; `/admin/expeditions` renders its zones, panels and switches at 390 px and 1280 px; `scripts/verify-expeditions-page.mts` asserts the island chunk is served before it asserts anything about the page; and `INSTALLATION.md` states why the flag exists and what its absence looks like.

- [ ] **A-271** — Give the schema log entry somewhere to go, and the operator something to read when it goes red. **The second half requires the designer/vision handoff before the first visual edit.**
      Screened 2026-09-08 while auditing the system log after a request to add an
      action button there. The button already exists: `SystemLogPanel.tsx:302`
      renders a "Buka" link per entry, conditional on `entry.href`, beside the
      refresh control and the source filters. Five of the six sources supply a
      destination — `payment` and `order` to `/admin/orders/{order}`, `ads` to
      `/admin/ads/meta`, `api` to `/admin/settings/developer`, and `audit` to the
      matching surface except for operator events a non-owner may not follow,
      which is deliberate role gating. The sixth, `schema`, sets `href: null`
      unconditionally at `src/lib/system-log.ts:140`.
      That is the wrong one to leave without a destination. `schema` is the only
      source that can carry `severity: "error"`, and it does so when the running
      code and the database disagree about the migration chain — the entry an
      operator most needs to act on is the one entry that offers them nowhere to
      act. Worse, this is not merely a missing link: a search across
      `src/pages/admin`, `src/components/admin` and `src/pages/api/admin` finds
      no surface that exposes the schema version at all, so there is currently
      nothing for the link to point at.
      **This is why the entry does not simply set an `href`.** Pointing the
      operator at a page that does not explain the mismatch would turn "no
      destination" into a destination that misleads, which is worse than the
      honest `null` that stands today. The destination has to exist first.
      The work therefore splits, and the halves have different gates. The data
      half — giving the `schema` source a destination once one exists — is
      non-visual wiring in `src/lib/system-log.ts` and needs no designer. The
      visual half — a surface that states the expected version, the applied
      version, the mismatch state and its error code, and what the operator is
      expected to do about it — is browser-visible and routes to
      `designer`/`vision` before its first edit, per the working agreement. Doing
      the data half first would be wiring to nothing; doing the visual half first
      makes the data half a one-line change.
      Two constraints the design has to respect rather than discover. The
      mismatch state is already computed by `getSchemaVersionStatus` and needs no
      new query, and the panel already renders the state in prose, so the surface
      is a place to land rather than a second copy of the diagnosis. And the
      existing `audit` role gate is the precedent for who may follow a link: a
      schema destination that exposes migration detail should decide, explicitly,
      whether Customer Service and Advertiser roles may reach it.
      Risk: R2 — a read-only admin surface plus one field in a log source; no schema, payment, or buyer-facing path. Rises to R3 only if the surface exposes anything beyond version, state and error code.
      Surface: `src/lib/system-log.ts`, `src/lib/system-log.test.ts`, one new or extended admin surface under `src/pages/admin/settings/` with its component, `docs/CODE-MAP.md` if a route is added, `docs/DEVELOPMENT-MAP.md`, `TASKS.md`, `STATUS.md`.
      Non-scope: changing what `getSchemaVersionStatus` computes, adding migration execution or repair controls to the admin, altering the five sources that already supply a destination, the deliberate `audit` role gate, and any change to the log panel's existing button, filters or refresh.
      Primary requirement: REQ-229
      Constraints: REQ-186, REQ-224, REQ-231
      Dependencies: the designer/vision handoff for the visual half. The data half depends on that half landing first.
      Done when: an operator following the `schema` entry reaches a surface that states expected version, applied version, mismatch state and error code, and what to do next; `src/lib/system-log.ts` no longer returns `href: null` for a source that has a destination; the role allowed to follow it is decided and asserted; a test pins the destination so it cannot silently return to null; and a real browser confirms the surface at 390 px and 1280 px.

- [x] **A-272** — Thread the clock into the remaining rate-limited routes, starting with the one that is already flaking. **Done locally 2026-09-08, scoped down from the entry's own premise after an audit of every call site.**
      `POST /api/checkout-lead` takes an optional `clock` defaulting to `Date.now`, and its limit test freezes one. The assertion is the mechanism, not the timing: the limiter's KV key is `${key}:${windowStart}`, so the test reads back `checkout-lead:192.0.2.250:${frozen}` and expects `30`. Under a route that ignores the clock that key does not exist and the read returns null — mutation-proved, and it fails every run rather than one in forty.
      **The entry said "already failing"; the audit corrected that to latent.** The rate-limit body spans roughly 1.2–1.5 s against a 60 s window, so a boundary lands inside it about one run in forty. I had observed exactly one failure, which is consistent, but the phrasing implied a deterministic break. It is a sampling flake — which is the argument for asserting the bucket rather than chasing a reproduction.
      **Five routes were deliberately left alone**, against this entry's original intent of threading them all — and the first version of this paragraph justified it with a premise the review found false. It said no test invokes any of them. `meta-event.ts` **is** imported and called directly by `meta-event.test.ts` and `meta-capi.test.ts`. The conclusion survives for a different reason: those fixtures make two and one calls against a bound of 120 per minute, and neither binds `SESSION`, so `checkRateLimit` fails open before it computes a window. There is no clock exposure to remove. `locations.ts`, `shipping-rates.ts`, `submit-order.ts` and `v1/checkout.ts` genuinely are never invoked — the tests that mention them only construct `Request` objects — and `route-surface.test.ts`, the one real-HTTP harness, requests none of them. Threading any of these would add a parameter with no consumer. Each is threaded when a test first exercises it near its bound.
      A sixth call site belongs in the census the earlier wording implied was exhaustive: `doku-payment-access.ts` already threads its clock from A-269 and needs nothing.
      The admin-login trio in `rate-limit.ts` is real but deferred and recorded here so it is not rediscovered: `checkAdminLoginRateLimit`, `recordAdminLoginFailure` and `clearAdminLoginFailures` all derive a window from wall time, the third computing `windowStart` directly to build its delete key, so any threading must cover all three or `clear` deletes the wrong bucket. Four tests depend on that window, and their exposure is roughly one run in seven hundred — a materially larger diff for a much smaller payoff.
      One caveat left as-is, and the earlier statement of it here was wrong: `rateLimitHeaders` still reads wall time for `Retry-After` while `resetAt` comes from the injected clock. This entry claimed the result is "clamped to at least 1". That only holds when the injected clock is *behind* wall time; the frozen instant used here is about 129 days ahead, so the header is a large number instead. The test asserts presence only, because under any injected clock the value means nothing. The same generalisation appears twice in the committed A-269 entry and is left there rather than back-edited — noted so it stops propagating.
      Delivery run: `RUN-20260908T160501Z-997eea1e`.
      Risk: R3 — declared R2 in the ledger and corrected here. It is one buyer-facing route whose production behaviour is byte-identical, because Astro's dispatcher calls the handler with exactly one argument, but `check-boundary` reported `effectiveRisk=R3` on this run and the independent review was obtained on that basis — read from the boundary output rather than re-derived from the classifier's rules. The under-declaration is recorded rather than adjusted after the fact: the ledger's own gate would not have demanded that review, and the record should not imply it did.
      Surface: `src/pages/api/checkout-lead.ts`, `src/lib/checkout-lead.test.ts`, `TASKS.md`, `STATUS.md`.
      Non-scope: the five untouched routes, the admin-login trio, window sizes and bounds, `rateLimitHeaders`, and loosening any assertion to make a flake disappear.
      Primary requirement: REQ-224
      Constraints: REQ-222, REQ-231
      Dependencies: A-269, which added the optional clock.
      The route keeps its `APIRoute` contract. Putting the extra parameter on the annotated export would have removed the only compile-time check this handler has — Astro does not type-validate endpoint exports, so a later edit returning a non-`Response` would pass `npm run check` and fail at runtime on a buyer-facing path. `POST` stays annotated and delegates to an exported `handler` the test imports.
      Done when: the route passes a clock and its limit test injects one; the test asserts the bucket came from that clock and fails when the route ignores it; the route keeps a compile-time contract and the delegating export is exercised, so a delegation that dropped its context could not pass; and the routes left unthreaded are recorded with the true reason rather than silently skipped.
      Found 2026-09-08 while validating A-269, on the fifth full-suite run after
      claiming H1 was closed. `checkout-lead.test.ts` failed on "public capture
      enforces the 30 per minute IP limit with retry headers": it fires exactly
      thirty requests against a thirty-per-minute bound and then asserts the
      thirty-first is refused, through `POST /api/checkout-lead`, which calls
      `checkRateLimit` without a clock. When a real minute boundary lands inside
      those thirty-one requests the counter resets and the refusal never comes.
      Identical mechanism to H1, different caller — and the exact thing the
      reviewer's insistence on scoping ("that is not a claim the suite has no
      other flake") was protecting against. A-269 threaded the clock through the
      DOKU capability path only; six API routes and two admin-login call sites
      still read wall time.
      The fix is the pattern A-269 established and needs no new design:
      `checkRateLimit` already accepts an optional clock, so each route passes
      the clock its handler receives and each test injects a fixed one. The
      value is not tidiness — it is that a bound asserted against wall time is
      not a bound anyone can prove. Prioritise `checkout-lead`, which is failing
      now; the rest are latent in exactly the same way and differ only in how
      close their test loop runs to the bound.
      Take the A-269 evidence pattern with it. Assert the mechanism rather than
      the timing: the limiter's KV key is `${key}:${windowStart}`, so a test can
      assert the bucket came from the injected clock and fail every time under
      the defect, instead of sampling a boundary crossing that appears in one
      run of fifteen.
      Risk: R2 — a shared limiter reached from buyer-facing and authenticated routes. The parameter is optional and already exists, so a route that does not pass one is unchanged; each route added is one argument and one test injection.
      Surface: `src/pages/api/checkout-lead.ts`, `src/lib/checkout-lead.test.ts`, then `src/pages/api/locations.ts`, `src/pages/api/meta-event.ts`, `src/pages/api/shipping-rates.ts`, `src/pages/api/submit-order.ts`, `src/pages/api/v1/checkout.ts` and the two admin-login call sites in `src/lib/rate-limit.ts`, with their tests. `TASKS.md`, `STATUS.md`.
      Non-scope: changing any window size or bound, what is rate limited, the KV storage shape, `rateLimitHeaders` deriving `Retry-After` from wall time (harmless, clamped, and correct in production), and loosening any assertion to make a flake disappear.
      Primary requirement: REQ-224
      Constraints: REQ-222, REQ-231
      Dependencies: A-269, which added the optional clock this uses.
      Done when: `POST /api/checkout-lead` passes a clock and its limit test injects one; that test asserts the limiter bucketed against the injected clock rather than only asserting the refusal; the remaining routes are either threaded or recorded as deliberately left; and no rate-limit assertion in the suite depends on where a real minute boundary falls.

- [x] **A-273** — Make an independent review record what it found, because today it records only that it happened. **Done 2026-09-09; approved by the owner.** `AGENTS.md` rule 10 now states that a bound `boundary_review` does not by itself satisfy the gate, and requires the findings as a `verification` check beside it. **The rule is keyed to the boundary's answer, not to R3 as this entry proposed** — A-274 was declared R1, escalated to R2 by `check-boundary`, and its review changed four documented claims, so an R3-only rule would have skipped exactly the run that proved the rule's worth. Two additions the entry did not ask for and the evidence argued for: a review that found nothing must still name what it examined, because "CLEAN" with no surface named is a shrug rather than a finding; and `record --command` is preferred for re-run checks, since the `verification` event carries an `executed` field that separates a check that ran from one that was typed. The statistics were re-measured rather than carried over — 64 bound reviews across 53 runs, 7 identities, median 9.3 min, twelve inside three minutes, fastest 0.7 — and one new figure was added: 33 of the 53 reviewed runs already recorded a review-named verification check, so the rule formalises a majority practice instead of inventing one. No open entry was found claiming a gate stronger than the ledger stores; the "independent review passes" phrasings in Done-when lines describe the review, not the event, and now resolve against rule 10.
      Audited 2026-09-08 across all 62 bound reviews in `.delivery/runs/`. The
      shared contract in `~/dotfiles/docs/task-change-boundary.md` is not the
      problem and was checked first: it requires a separate actual agent, allows
      any model or provider including the implementer's, treats model and
      provider as truthful provenance rather than eligibility, and states plainly
      that *"merely renaming self-review is invalid: the orchestrator must obtain
      a real separate-agent review, which the ledger cannot prove from identity
      strings alone."* The policy is sound. The practice recorded against it is
      what does not hold up.
      **The `boundary_review` event has no field for findings.** Its keys are
      reviewer, model, provider, reasoning effort, the boundary hash, the surface
      digest, the effective risk, the implementer route, and `status: APPROVED`.
      There is nowhere to say what was examined, what was found, or that anything
      was found at all. So the gate proves a review was *claimed*, never that one
      *happened* — and every downstream reader, including this file, has been
      treating APPROVED as though it meant the second.
      **The usage pattern is indistinguishable from a rubber stamp.** Sixty-two
      bound reviews carry five distinct reviewer identities, three of them reused
      24, 17 and 15 times — one is literally named `a210_review_retry` and signed
      off A-211 through A-221. The median gap from run start to bound review is
      9.2 minutes, implementation included; twelve were bound inside three
      minutes of their run starting, the fastest at 0.7. Several tasks bound the
      same review two or three times within one minute. None of this proves
      self-review, and it is not an accusation of one — the ledger cannot
      distinguish the two, which is exactly the hole the shared doc names.
      The contrast is the argument. The four reviews bound on 2026-09-08 by
      `independent-doku-reviewer` were a genuinely separate agent, and they
      changed the code four times: a byte-equality assertion that compared the
      builder to itself, an `OBSERVABILITY.md` row promising a class the code
      could not produce, three error codes filed as provider failures, and a
      closure entry that inflated its own review coverage. A gate that cannot
      tell that apart from a 0.7-minute approval is not measuring what it is
      relied on to measure.
      The fix in this repository is small and does not need the tool to change:
      require that an R3 run record its review as a `verification` check whose
      detail states what was examined and what was found, alongside the
      `boundary_review` event. That is already what the A-260, A-268 and A-269
      runs did. Making it a rule turns one session's habit into the repository's
      contract. Widening `boundary_review` itself belongs to `delivery-ledger`
      in dotfiles and is explicitly out of scope here.
      Risk: R1 — one rule in `AGENTS.md` and its statement in this file; no runtime change. It raises the bar for closing an R3, which is the point and the reason it needs approval.
      Surface: `AGENTS.md`, `TASKS.md`, `STATUS.md`.
      Non-scope: changing `delivery-ledger` or the shared dotfiles contract, re-opening or re-reviewing the 58 historical reviews, accusing any specific past review of being a rubber stamp, and adding a second approval step to R1 or R2 work.
      Primary requirement: REQ-231
      Constraints: none.
      Dependencies: none.
      Done when: `AGENTS.md` states that an R3 run records its review findings as a verification check and that `boundary_review` alone does not satisfy the gate; the rule names why, so the next session does not read it as ceremony; and no open entry claims a review gate stronger than what the ledger actually stores.

- [x] **A-261** — Decide whether a 62,000-line codebase gets a linter. **Done 2026-09-09; `biome` chosen by the owner from the three options below, recorded as ADR-032.** One dev dependency, one `biome.json`, `npm run lint`, folded into `check` — so CI's existing static-analysis step gates on it without a new step. The formatter stays off and the rule set is deliberately not `recommended`: ADR-032 records why both would cost more here than they catch. Scope is TypeScript only, because Biome's CSS parser rejects this project's Tailwind at-rules and produced 334 findings that said nothing about the code. First run: 291 files in 132 ms, 18 findings — 16 in React admin components and 2 in `src/components/ui/sidebar.tsx`, which is vendored shadcn a regeneration would overwrite — and `src/lib` clean. Those findings were queued as A-274 and fixed there, never in this commit.
      Found by the health report of 2026-09-08. There is no `eslint`, `prettier`,
      or `biome` configuration anywhere in the repository. `tsconfig.json` has
      `strict: true` and CI runs `check`, `test`, and `build`, so type errors are
      caught; nothing catches style, consistency, unused code, or the class of
      drift A-256 measured — 980 raw palette uses against 74 semantic tokens grew
      across 22 files with no mechanism capable of noticing. The repository's own
      rule is that a dependency must earn its place, so this is recorded as a
      decision rather than done.
      The honest framing of the choice. Adding `biome` is one dev dependency,
      one config file, and one CI line, and gives formatting plus a useful lint
      floor with no plugin tree; adding `eslint` plus `prettier` is the
      conventional route with a larger dependency surface; declining is defensible
      if the owner would rather rely on review, but then A-256's class of drift
      will recur and should be expected to. Whichever is chosen, the first run
      will report existing violations, and those are fixed under their own entries
      or accepted with a recorded baseline — never in the same commit that adds
      the tool.
      Risk: R1 — tooling and CI configuration; no runtime change. The first-run fix-up, if chosen, is separate and its risk follows the files it touches.
      Surface: `package.json`, `package-lock.json`, one tool configuration file, `.github/workflows/ci.yml`, `AGENTS.md`, `TASKS.md`, `STATUS.md`, `DECISIONS.md`.
      Non-scope: fixing what the tool reports, adding rules that reformat the codebase wholesale, and any rule that would contradict `DESIGN-SYSTEM.md`.
      Primary requirement: REQ-231
      Constraints: none.
      Dependencies: A-258, so the tool's first run reports against a committed tree.
      Done when: a recorded decision states whether a linter is adopted and which; if adopted, it runs in CI on the same commands a developer runs locally, its first-run findings are recorded as a baseline or queued rather than silently fixed, and `AGENTS.md` tells the next session to run it; if declined, `DECISIONS.md` says why and what review is expected to catch instead.

- [x] **A-262** — Measure coverage, so the development map can cite a number instead of a grep. **Done locally 2026-09-08 with no dependency added.** The entry assumed `c8`; Node 24.18 already ships `--experimental-test-coverage`, so `npm run test:coverage` uses the runner this repository already has and the dev dependency the entry budgeted for was not spent. Baseline on 524 passing tests, excluding test files: **88.67% lines, 75.24% branches, 88.30% functions**, recorded in `docs/DEVELOPMENT-MAP.md` beside the citation method it supplements and in `AGENTS.md` where a session meets the commands. No threshold set, as the entry required — one picked before the first measurement is a guess.
      Found by the health report of 2026-09-08. Ninety-two test files and 15,452
      lines of tests exist against 62,645 lines of source, and no coverage figure
      does: there is no `c8`, `nyc`, or equivalent. `docs/DEVELOPMENT-MAP.md` was
      built to answer "what is covered" and did so honestly by grepping test files
      for route names, stating that method as its limit. The limit is removable
      for the cost of one dev dependency. `c8` wraps `node --test` without
      configuration, which is the runner this repository already uses.
      The number is not the point; the point is that "tested one layer down",
      which the map currently has to say in words, becomes a claim with a figure
      that can go down. The map keeps its route-by-route evidence columns; a
      coverage report adds the axis it cannot derive from citations.
      Risk: R1 — a dev dependency and one script; no runtime change. No threshold is set under this task, because a threshold chosen before the first measurement is a guess.
      Surface: `package.json`, `package-lock.json`, `.github/workflows/ci.yml` if the report is published there, `docs/DEVELOPMENT-MAP.md`, `AGENTS.md`, `TASKS.md`, `STATUS.md`.
      Non-scope: enforcing a threshold, changing any test, writing tests to raise the figure, and treating the number as a substitute for the map's evidence columns.
      Primary requirement: REQ-231
      Constraints: none.
      Dependencies: A-258. Independent of A-261; either may land first.
      Done when: `npm run test:coverage` (or the chosen script) produces a line and branch figure for `src/` from the existing suite without altering any test; the figure and the command are recorded in `docs/DEVELOPMENT-MAP.md` beside the method it supplements; and the first measured baseline is written down so a later drop is visible.

- [ ] **A-256** — Make the admin canvas obey the design system it already has. **Designer/vision handoff completed 2026-09-08; its decision document is the implementation contract. Two of this entry's own premises were stale and are corrected below.**
      **Correction 1: the component-library half is already done.** This entry was written from a census taken at `0cff0f0` claiming seventeen of twenty-three admin components import no shadcn primitive and that `table`, `badge`, `dialog` and `select` are used by none. Re-measured on disk: **three** components import no primitive — `CrmActionButton`, `CrmActionGroup`, `SystemLogPanel` — and `table` has 4 consumers, `badge` 4, `dialog` 7, `select` 2, `card` 7. Only `separator` and `collapsible` are unused. My own first re-count appeared to confirm the stale figure and was wrong: the grep matched single-quoted imports only, while `OrdersTable` and others import with double quotes. Verified before recording. **A-256 is a token and geometry task, not a component-library task**, and any plan to "convert hand-rolled X to primitive Y" must re-measure first because most of that work no longer exists.
      **Correction 2: the declared Surface cannot reach this entry's own Done-when.** `src/pages/admin/**` carries a further ~272 raw palette uses and `src/layouts/AdminLayout.astro` sets the admin ink default in raw palette on `<body>`. Neither is in the Surface list, so "one vocabulary across the admin" would be false on ten routes the moment it was claimed.
      The colour figures that motivated this entry are current and were reproduced exactly: `text-slate-500` 187, `border-slate-200` 151, `bg-slate-50` 91, `bg-white` 90, `text-slate-600` 90.
      **The contrast question dissolved under measurement, which is the most useful thing the handoff produced.** This entry assumed an implementer must classify each `text-slate-500` by whether it sits on a card or the page. The designer resolved `.admin-shell`'s own `--muted-foreground` to `#5f6a77` and measured it against every ground the admin paints: white card 5.50, desktop page 5.13, mobile page 5.09, muted panel 5.05, table header 5.26. All pass AA. So the rule is unconditional — replace every occurrence, do not classify — with two mechanical carve-outs: a `bg-slate-9xx` ancestor, of which there is exactly one, and never substituting `text-slate-600` "to be safe", which un-does the muted/body distinction. The method was validated by reproducing `DESIGN-SYSTEM.md`'s own published figures to two decimals.
      **A trap that would have made this task produce more drift than it removes.** `admin.css` matches card geometry on the literal class string — `.admin-shell section.bg-white` and `article.bg-white` — so a mechanical `bg-white` → `bg-card` sweep silently drops border-radius and shadow on sixteen sections, which then revert to whatever `rounded-*` their markup carries. The `admin.css` selector fix must land **before or with** the sweep, never after. That is why the conversion order starts at step 0 with `admin.css` and no component at all.
      Four decisions the handoff took, recorded so they are not re-litigated: `text-slate-400` splits by role rather than mapping, because decorative icons and placeholders may stay light while the text nodes among them are live AA failures at 2.56; `text-slate-600` stays raw in exactly seventeen occurrences across three files, because `DESIGN-SYSTEM.md` pins those pairs from the A-234 audit and says preserve them; the ~290 `emerald`/`rose`/`amber` status uses stay raw because the semantic layer names no success or warning token and `--destructive` is a different hue from `rose-700`, so mapping it would repaint "Gagal" on live orders; and `badge.tsx` gains `success`/`warning`/`danger` variants carrying the **existing class strings copied verbatim**, which is what keeps the pixels identical and holds this at R2.
      **The three questions the handoff put to the owner are answered, 2026-09-09.** The owner decided the recessed-ground question by delegation and confirmed the other two. One principle governs all three: name what is a real tier, collapse what is only a repetition.
      **(a) `src/pages/admin/**` becomes a follow-up, except for `AdminLayout.astro`, which joins this task.** The layout sets the admin ink default on `<body>` in raw palette, and it is the root every converted component inherits from; converting the children while the parent stays raw produces exactly the mismatch this entry exists to remove. The ten route files and their ~272 remaining uses follow separately, because the `admin.css` selector trap gives the component sweep a strict ordering dependency and bundling a second, unrelated failure mode into one R2 boundary review makes the review unable to focus. **Consequence, stated rather than left implicit:** this entry's Done-when is rewritten below to say "no admin *component*", because "one vocabulary across the admin" would be false on ten routes the moment it was claimed — which is Correction 2's own objection, now resolved by narrowing the claim instead of widening the surface.
      **(b) Three ink levels: `--foreground-subtle` is added.** The handoff's premise did not reproduce and the decision had to be re-derived from the real figures. It said collapsing `text-slate-700` "darkens 100 nodes on the most-used screen". Measured on disk: **110 occurrences total — 73 in `src/components/admin`, 35 in `src/pages/admin`, 0 in `src/components/ui` and `src/layouts`** — spread across many files, with the single busiest being `src/pages/admin/settings/store.astro` at 21. No one screen carries 100. The decision survives the correction on the corrected numbers: 73 occurrences in components alone is a tier the token layer failed to name, not an exception. Pinning them the way A-234 pinned seventeen `text-slate-600` pairs would make the allowlist larger than the rule and would leave the grep guard unable to catch a `text-slate-700` that is genuinely wrong. Naming it is what makes the guard total. Note that 35 of the 110 fall in the follow-up from (a).
      **(c) One recessed ground.** The designer measured the muted panel at 5.05 and the table header at 5.26 against `#5f6a77`. A 0.21 difference in contrast ratio is invisible to any operator and mandatory for every implementer who adds a surface. Both already pass AA, so collapsing costs nothing in accessibility. A table header is not semantically more recessed than a muted panel; it is the same idea drawn twice, and that ambiguity is the mechanism that produced 980 raw palette uses in the first place.
      Risk: R2 — shared visual primitives on every admin workspace; presentation only, no data, authorization, schema or API change. Rises to R3 for any surface where a token change alters a state indicator an operator reads as payment or order truth, which is why the status hues are excluded outright.
      Surface: `src/components/admin/*.tsx`, `src/styles/admin.css`, `src/layouts/AdminLayout.astro` for the body ink default only, `src/components/ui/{card,table,badge}.tsx` where an installed primitive needs a variant it lacks, `DESIGN-SYSTEM.md`, one new guard test under `src/lib/`, `docs/DEVELOPMENT-MAP.md`, `TASKS.md`, `STATUS.md`. `src/pages/admin/**` is excluded by decision (a) and becomes A-276.
      Non-scope: adding any dependency; redesigning the AdsBookCMS baseline REQ-186 protects, specifically the Order Management desktop-table/mobile-card split, its two `aria-label`s, the `lg:` breakpoint, the `min-w-[1180px]` scroll container, and the order-detail CRM workflow; the ~290 status hues; converting the native bulk `<select>` elements, which submit natively and open the OS picker on a phone; the 44 px switch target, which stays A-234; `AnalyticsDashboard`'s chart tokens, which inherit `:root`'s greyscale ramp and are a separate decision; and the storefront's `form-hybrid.css`.
      Constraints: REQ-186, REQ-196
      Dependencies: the designer/vision handoff, completed. The owner's answers to the three questions above, received 2026-09-09 and recorded there; nothing further blocks step 3.
      Done when: no admin **component** references a raw palette shade for a colour the semantic layer names — `src/pages/admin/**` is A-276 and is out of this claim — verified by a grep guard that is mutation-proved before it is trusted and that allowlists the seventeen pinned occurrences by path with their A-234 citation; the `zinc` vocabulary is gone; one card radius, one shadow scale and one padding rhythm are in force; `admin.css`'s literal-class selectors are replaced before any `bg-white` sweep; and a real browser confirms each converted surface at 390 px and 1280 px with no new overflow and no regression against the REQ-186 baseline.
- [x] **A-274** — Clear the three errors Biome's first run found, then let `check` gate on it. **Done 2026-09-09.** The two `LandingPageCatalog.tsx` bindings were dropped rather than logged: both blocks already discard the error today, and of the **50 bound `catch` blocks** across `src/components/admin`, only these two never read the binding. A first draft of this note claimed "18 catch blocks, of which 16 read their binding" and called the two outliers; the independent review disproved both halves. There are 73 `catch` blocks, 23 of them already written as bare `catch {` — so bare `catch` is the house pattern here, not the deviation, and 18 was the lint-finding count reused as a block count. `ProductCatalog.tsx` became `useState(!initialProducts)`, which is identical for `undefined` and for the empty array. `npm run lint` now exits 0 with the 15 `useExhaustiveDependencies` warnings still reported, and `check` runs it. `ci.yml` was left alone: its step is already named "Typecheck and static analysis", which still describes what runs. A browser check confirmed both surfaces at 390 px and 1280 px, and — the part that mattered — forced `/api/admin/landing-pages` to fail through CDP to prove the edited `catch` still reports "Gagal memuat katalog landing page". That assertion was mutation-proved: with the forced failure removed the toast never appears and the check times out.
      The baseline ADR-032 recorded, kept separate from the commit that adopted
      the tool because A-261 required exactly that. 291 files, 18 findings, all
      of them in React admin components: `src/lib` — every payment, order and
      schema path — returned clean on the first run, which is the useful half of
      the measurement.
      The three errors are one-token edits and none of them changes behaviour.
      `LandingPageCatalog.tsx:79` and `:96` bind `catch (err)` and never read it;
      the binding is droppable because both blocks already surface the failure
      through `toast`. `ProductCatalog.tsx:169` writes
      `useState(initialProducts ? false : true)`, which is `useState(!initialProducts)`.
      Check, rather than assume, that dropping the two bindings does not remove
      the only reference to a caught error — if either block turns out to want
      the message, logging it is the fix and the rule is satisfied either way.
      The 15 `useExhaustiveDependencies` warnings are **not** in scope and must
      not be swept in. Each one is a React hook whose dependency array is
      genuinely under-specified or genuinely intentional, and telling those apart
      needs the component's data flow read one at a time; a blanket fix would
      either add re-render loops or add a lie to a suppression comment. They stay
      warnings until someone reads them, which is why the rule is set to `warn`
      rather than off — off would hide the count.
      `check` gains `npm run lint` only once the three errors are gone, so CI is
      never red on a baseline it inherited.
      Risk: R1 — three one-token edits in admin components plus one script line; no runtime contract changes.
      Surface: `src/components/admin/LandingPageCatalog.tsx`, `src/components/admin/ProductCatalog.tsx`, `package.json`, `.github/workflows/ci.yml` if the step name no longer describes what runs, `TASKS.md`, `STATUS.md`.
      Non-scope: the 15 `useExhaustiveDependencies` warnings, enabling the formatter, widening the rule set, and any change to what the two components render.
      Primary requirement: REQ-231
      Constraints: none.
      Dependencies: A-261.
      Done when: `npm run lint` exits 0 with the 15 warnings still reported, `npm run check` runs it, CI's static-analysis step therefore gates on it, and a real browser confirms the two admin surfaces still render and still report their failures.

- [ ] **A-275** — Stop `npm test` from failing on a wrangler port collision, and stop that failure from hiding its own name.
      This closes an open debt. A `npm test` exit 1 was recorded as
      **unattributed** on 2026-09-08 after six clean reruns failed to reproduce
      it and the failing test name was never captured. It reproduced on
      2026-09-09 and the name was captured, so the entry can now say what it is.
      The failure is `shipping-bootstrap.test.ts`, and it is not a test failing.
      Its `before()` hook applies the whole migration chain to a fresh temporary
      state directory through `wrangler d1 migrations apply --local`. Wrangler
      reported `Migration 0034_remove_foreign_sample_product.sql failed with the
      following errors: [ERROR] bad port`. That is not a SQL error and 0034 is
      not implicated: `bad port` is Miniflare failing to bind its local server,
      and 0034 is merely where the chain happened to be when the connection died.
      Any migration in the chain can carry the message.
      **The second half of this entry is why it went unattributed for a day.** The
      failure is in a hook, not a test, so the runner emits no `not ok` line
      naming anything; the tail of the output is a stack from `runWrangler` and a
      20 MB `execFileSync` payload of wrangler's own table-drawing. A session
      reading `tail` sees a migration name and a SQL-shaped word, and concludes
      the schema broke. Fixing the flake without fixing the reporting leaves the
      next intermittent hook failure just as anonymous.
      The file's own comment records that two tests each spawning their own
      wrangler already raced once and were consolidated into one `before` for
      that reason. This is the same class of problem surviving the previous fix,
      so a second consolidation is not the answer — the hook needs to either
      retry a bind failure or fail with a message that names itself.
      Distinguish the two before choosing: a port collision from something else
      on the machine argues for a retry, and a collision with this repository's
      own concurrent wrangler argues for serialisation.
      Risk: R1 — a test hook and its diagnostics; no source file, no schema, no runtime path.
      Surface: `src/lib/shipping-bootstrap.test.ts`, `package.json` if the runner's reporter changes, `AGENTS.md` if the next session needs to be told how to read a hook failure, `TASKS.md`, `STATUS.md`.
      Non-scope: changing any migration, changing what the test asserts about Malaysia shipping policy, and adding a retry to tests that are not failing on a bind.
      Primary requirement: REQ-231
      Constraints: none.
      Dependencies: none.
      Done when: a bind failure in the hook either recovers or fails with a message that names `shipping-bootstrap` and `bad port` without a session needing to decode an `execFileSync` payload; the migration chain is no longer implicated by the wording; and a deliberate reproduction — an occupied port, not a rerun — shows the new behaviour rather than a green run being taken as proof.

- [ ] **A-276** — Extend the admin's one vocabulary to the ten route files A-256 deliberately left out. **The designer/vision handoff routes this before the first visual edit.**
      Split from A-256 by decision (a) of 2026-09-09, not deferred out of
      fatigue. A-256's own Correction 2 observed that its declared Surface could
      not reach its Done-when, because `src/pages/admin/**` carries a further
      ~272 raw palette uses. That objection is resolved by narrowing A-256's
      claim to components and giving the routes their own entry, rather than by
      widening one R2 run to cover two failure modes with one boundary review.
      `src/layouts/AdminLayout.astro` is **not** here — it stays in A-256,
      because the body ink default is the root every component inherits and
      converting children under a raw-palette parent produces the mismatch both
      entries exist to remove.
      Measured on disk 2026-09-09 rather than carried over: `src/pages/admin`
      holds 184 occurrences of the four shades A-256 counts (`text-slate-500`,
      `border-slate-200`, `bg-slate-50`, `bg-white`) and 35 of `text-slate-700`,
      the last of which resolve against the `--foreground-subtle` token A-256
      introduces. The busiest single file in the whole admin for that shade is
      here — `settings/store.astro` at 21 — which is worth knowing before anyone
      assumes the routes are thin.
      **Two things make this genuinely harder than A-256, not merely more of it.**
      The `admin.css` selector trap applies here too and the routes were never
      audited for it, so the literal-class geometry selectors must be confirmed
      fixed by A-256 before any sweep begins here. And ADR-032 records that
      `.astro` frontmatter is unlinted and cannot be linted usefully — Biome
      reports 81 false errors on this exact directory — so nothing mechanical
      will catch a mistake in these files. The grep guard A-256 builds is the
      only automated check that will ever cover them; extend it rather than
      writing a second one.
      Risk: R2 — presentation across ten admin routes; no data, authorization, schema or API change. Same R3 escalation clause as A-256 for any token change that alters a state indicator read as payment or order truth.
      Surface: `src/pages/admin/**/*.astro`, the A-256 grep guard under `src/lib/`, `docs/DEVELOPMENT-MAP.md`, `TASKS.md`, `STATUS.md`.
      Non-scope: everything A-256 excludes, plus `src/layouts/AdminLayout.astro`, which A-256 owns; introducing any new token beyond the ones A-256 establishes; and touching the frontmatter TypeScript, which is logic rather than presentation.
      Primary requirement: REQ-186
      Constraints: REQ-186, REQ-196
      Dependencies: A-256, which must establish the tokens, fix `admin.css`'s literal-class selectors, and build the guard first. The designer/vision handoff.
      Done when: no file under `src/pages/admin` references a raw palette shade for a colour the semantic layer names, verified by the extended A-256 guard mutation-proved against these paths; A-256's Done-when can then be restated as "no admin surface" without becoming false; and a real browser confirms each of the ten routes at 390 px and 1280 px with no new overflow and no regression against the REQ-186 baseline.

- [x] **A-277** — Point the response-signature guard at the decision that governs it, and confirm production before production. **Done 2026-09-09, apart from the provider question, which is not mine to answer.** `doku-client.ts` now carries a comment at the guard naming ADR-022 and REQ-227, recording that DOKU was observed unsigned on 2026-09-02 and again on 2026-09-09 across all five channels and both operations, listing the envelope checks an unsigned response still passes, and stating plainly that turning the branch into a hard requirement would refuse every DOKU response and stop payments. `OBSERVABILITY.md` now says the no-logging rule covers DOKU's *response* headers and not only ours, because DOKU echoes our `Authorization: Basic` header back — so a diagnostic that dumps response headers would log the API Key. **The open half is handed on, not merely recorded:** whether production signs is a question for DOKU, and it is now written into **A-222's own Dependencies and Done-when** as a condition of enabling production, as well as into the guard comment. The independent review was right that recording it in prose while closing this entry would have left no open task carrying the obligation.
      **This entry replaces a wrong one.** Its first draft claimed the absent
      DOKU response signature as a new discovery and proposed deciding the
      fail-open posture. The independent review of 2026-09-09 disproved both.
      The absence was found on **2026-09-02**, is recorded in A-221's own
      evidence lines above, and was already decided: **ADR-022** ("Narrow DOKU
      Checkout response-envelope compatibility", Accepted 2026-09-02) resolves
      to verify `Signature` whenever present and accept the response without it
      only after the other envelope checks, **REQ-227** encodes that, and
      **A-221R** implemented it and is closed. So the `if (responseEnvelope.signature !== null)` guard in
      `doku-client.ts` is not an unnoticed fail-open; it is an accepted decision working as written. Saying
      otherwise is the inflation this repository's review gate exists to catch.
      What the 2026-09-09 outbound run actually added is confirmation, and it is
      worth having: the omission still holds seven days later, across all five
      channels and both create and retrieve, with a full header inventory
      (`api-version`, `authorization`, `client-id`, `connection`,
      `content-encoding`/`content-length`, `content-type`, `date`,
      `response-timestamp`, `transfer-encoding`, `vary`) showing no signature
      under any name, and with the `authorization` header identified as DOKU
      reflecting our own `Basic` request header back rather than signing.
      **Two things remain genuinely open, and neither is a re-decision.** First,
      nothing at the guard tells a reader that ADR-022 governs it, so the next
      session to read that branch will draw the same wrong conclusion
      this entry's first draft did — that is not hypothetical, it just happened.
      Second, ADR-022's own Context records conflicting official artifacts: the
      endpoint OpenAPI models no response headers while the generic Global
      integrity guide says DOKU signs. Sandbox evidence does not settle
      production. Confirming production's behaviour belongs before A-222
      enables production, not after.
      **State the residual risk as the code actually has it.** An unsigned
      response is not accepted loosely. `readCheckoutResponseEnvelope`
      first requires the absence of the Cards-only
      `Request-Id`, an exact `Client-Id` match, a present and fresh
      `Response-Timestamp`, a JSON content type, and an exact `API-Version`;
      only then do `assertDokuMyrPayload` and `assertCheckoutResponseIdentity`
      run. An earlier draft of this entry said "two structural
      guards", which understates it. What is missing is body-origin HMAC
      assurance, which is exactly what ADR-022 records as its accepted negative
      consequence.
      A smaller item belongs here: DOKU reflects our `Authorization: Basic`
      request header back in the response, so the API key appears in DOKU's
      response headers. Nothing logs them today — `doku-client.ts` reaches a DOKU
      response's headers in exactly two places, `readCheckoutResponseEnvelope`,
      which reads six names by hand, and `readBoundedResponseBody`, which
      compares `Content-Length` numerically — so there is no leak. Record it as a standing constraint before a
      future diagnostic starts dumping response headers.
      Risk: R1 — a comment, a constraint, and a question to the provider. It was first written as R3 on the false premise that an undecided security posture was in play; there is no posture to decide.
      Surface: `src/lib/doku-client.ts` for the comment only, `OBSERVABILITY.md` for the response-header constraint, `TASKS.md` including A-222's entry, `STATUS.md`.
      Non-scope: **re-opening ADR-022 or amending REQ-227**, which is what this entry's first draft wrongly proposed; changing any verification behaviour; the request signature, which DOKU does require and which works; notification signature verification, which is the inbound half and uses the asymmetric key; and switching production to fail-closed, which would refuse every response and stop payments.
      Primary requirement: REQ-227
      Constraints: REQ-227
      Dependencies: none. The production question is A-222's to resolve before it enables production, and is written into A-222's Dependencies and Done-when so it is enforceable rather than merely recorded. An earlier draft of this line said "before A-222, not by it", which contradicted this entry's own closure text; A-222 is the task that enables production, so A-222 is where the obligation belongs.
      Done when: the guard names ADR-022 and REQ-227 and states that DOKU was observed not to sign responses on 2026-09-02 and again on 2026-09-09, so the next reader is not misled; the response-header reflection is recorded as a constraint against logging them; and the question of whether production signs is either answered by DOKU and recorded, or recorded as an open question that A-222 must resolve before enabling production.

- [ ] **A-278** — Complete one sandbox payment and retrieve it, because that is the only way to learn the `CREDIT_CARD` channel string. **Approval: required — a payment at a hosted provider page, even a sandbox one.**
      A-221's Done-when asks for the exact `payment.channel` string DOKU returns
      for each enabled channel and singles out `CREDIT_CARD`, which providers
      commonly report as a card sub-brand and which would strand a paid order as
      `DOKU_PAYMENT_MISMATCH`. A-242's review deferred the same question here.
      **The outbound run of 2026-09-09 proved the question cannot be answered
      without a payment.** On an unpaid checkout the `payment` object carries
      `callback_url`, `checkout_url`, `currency`, `state: "INITIATE"` and
      `status: "PENDING"` — and no channel field at all, on create *and* on
      retrieve. All five channels were confirmed accepted, so the outbound
      vocabulary is right; the reported string simply does not exist yet.
      **The useful consequence is that this is much smaller than the inbound
      half.** The mismatch at `doku-payment-lifecycle.ts:185` compares
      `attempt.channel` with the *notification* channel, which does need a public
      URL. But the same string should appear on a **retrieve** after payment, and
      retrieve is outbound. So one completed sandbox payment at the hosted
      `checkout_url` plus one retrieve answers the highest-value open question in
      the payment integration with no webhook, no tunnel, and no deployment.
      Do `CREDIT_CARD` first; it is the one with a known failure mode. Whether
      retrieve actually carries the channel post-payment is itself unknown — if
      it does not, that is a finding, and the question genuinely moves to the
      inbound half rather than being assumed there.
      Risk: R4 — a payment at an external provider, with sandbox credentials and no production resource.
      Surface: DOKU sandbox checkouts and their hosted pages; `STATUS.md`, `BUILD-LOG.md`, `TASKS.md` for redacted evidence. No code change unless a finding demands one, which becomes its own entry.
      Non-scope: production credentials or any production resource; a real instrument; registering a webhook; the inbound notification half; and recording any card number, token, or signature.
      Primary requirement: REQ-227
      Constraints: REQ-227
      Dependencies: A-221's outbound half, done 2026-09-09. A DOKU sandbox test instrument for the card channel.
      Done when: one sandbox payment completes for `CREDIT_CARD`, a retrieve on that checkout records the exact channel string DOKU reports, that string is compared against `DOKU_PAYMENT_CHANNELS` and against what `payment_attempts.channel` would hold, and the answer is recorded either as confirmation or as a mismatch with the code change it implies; the same is repeated for at least one e-wallet and FPX; and no card data, token, or credential appears in the evidence.

- [ ] **A-279** — Narrow the checkout body's expiry type, which today permits a request DOKU always refuses.
      Found by a bug in the A-221 probe, kept because the looseness is real.
      Passing `expiresAt: null` produced HTTP 400 `missing_parameter`, *"Required
      parameter order.expired_at is missing."* `DokuCheckoutBodyInput.expiresAt`
      is typed `string | null` and `doku-request-body.ts:109` writes
      `expired_at: input.expiresAt`, so a null reaches DOKU and is refused.
      **This entry's first draft got the reason right and the analysis wrong,
      and the independent review caught it.** The draft said "no caller passes
      null" after enumerating only `doku-checkout.ts`. There are two production
      callers. `doku-checkout.ts:163` passes `order.expiresAt`, typed `string`.
      **`doku-payment-access.ts:872` passes `attempt.expires_at`, typed
      `string | null`** (`doku-payment-access.ts:155`), read straight from D1
      where migration `0059` line 49 declares `expires_at text` — nullable — and
      reached through `active || await createRetryAttempt(...)` at `:1160`,
      where the `active` branch is a raw row.
      It is still **not a live defect**, but for a different and weaker reason
      than the draft gave. Both insert paths bind a string:
      `order-persistence.ts:142` binds a field typed `string`, and
      `doku-payment-access.ts:838` binds the value `createRetryAttempt` received
      as a `string` parameter. So no row holds NULL today. That is a runtime
      invariant the schema does not enforce, not a type guarantee — which is
      precisely the gap worth closing before someone adds a third write path.
      Note also that `doku-checkout.ts:267` coerces with `String(row.expires_at)`,
      which on a NULL row yields the literal `"null"` and would earn a different
      DOKU rejection than `missing_parameter`. It masks a null rather than
      preventing one, so it is not evidence of safety.
      Risk: R1 — one type narrowing, one call site, and its test; no behaviour change for any existing caller, because no caller can currently produce a null.
      Surface: `src/lib/doku-request-body.ts`, `src/lib/doku-request-body.test.ts`, `src/lib/doku-payment-access.ts` for the retry call site, `src/lib/doku-payment-access.test.ts`, `TASKS.md`, `STATUS.md`.
      Non-scope: changing the expiry the checkout computes, changing `CHECKOUT_TTL_MS`, a migration adding `NOT NULL` to `expires_at` (a schema change that deserves its own entry if the type work argues for it), and touching any other nullable field without the same evidence.
      Primary requirement: REQ-227
      Constraints: none.
      Dependencies: none.
      Done when: `DokuCheckoutBodyInput.expiresAt` is `string`; the retry path at `doku-payment-access.ts:872` either narrows its nullable row value or refuses the retry with a named error rather than sending a body DOKU will reject — **the first draft's "every caller still compiles unchanged" was false and is the thing this task must actually solve**; `npm run check` passes; and a test proves the retry path's behaviour when the row's expiry is absent.

- [ ] **MYS-5** — Release readiness for a specific install. **Approval: required — never run autonomously.**
      Carried over from the retired `UNIMPLEMENTED_SPECS.md`. This is not a product gap: the product does not depend on any external courier or payment service, and a missing provider contract must never be converted into a blocker. Nothing has been deployed to Cloudflare; the local database is the only one that exists.
      Risk: R4 — production deployment.
      Surface: none. This task deploys; it does not edit.
      Non-scope: any code change. If verification fails, that failure becomes its own task in the Open queue rather than a fix made under a release.
      Primary requirement: REQ-182
      Constraints: REQ-180
      Dependencies: the Open queue is empty of anything the release depends on, and A23–A25 remain green locally
      Done when: local migrations apply cleanly to an empty database, `npm run check`, `npm test` and `npm run build` all pass on the exact revision being released, and the install's owner has given explicit deployment approval for that revision.

## A25 — Persistence, upload, and delivery integrity

- [x] **A-181** — Prove and repair real-D1 order invariants. **Done locally 2026-08-25:** an isolated workerd-backed D1 applies all 58 migrations and proves duplicate submission, oversell rollback, terminal restoration, and delete restoration exactly once. The proof exposed and fixed the omitted `orders.ad_click_ids` column through forward migration `0057` and removed one excess `persistOrder` SQL placeholder.
      Primary requirement: REQ-198
      Constraints: REQ-182, REQ-193
      Dependencies: A-178
      Done when: the real D1 proof passes all four state scenarios with no orphan order/item/outbox row and the local migration chain reaches schema 58.
- [x] **A-182** — Unify authenticated image upload policy. **Done locally 2026-08-25:** Product and Content upload through `/api/admin/media`; the route bounds streamed multipart bodies before parsing, enforces a 2 MB file cap, verifies magic bytes, generates scoped R2 keys, validates derivative siblings, and uses one KV hourly policy. `/api/admin/upload-r2` and the weaker helper were removed.
      Primary requirement: REQ-199
      Constraints: REQ-182
      Dependencies: None
      Done when: route tests prove accepted image persistence, MIME spoof refusal, missing-Content-Length body refusal, hourly refusal, and derivative key safety; repository search finds one authenticated upload endpoint.
- [x] **A-183** — Harden CI and Worker binding drift. **Done locally 2026-08-25:** CI grants `contents: read`, pins checkout/setup-node to reviewed full SHAs, commits Wrangler-generated binding declarations, and makes `npm run check` run `wrangler types --check`. The Worker entrypoint uses the adapter handler directly without the former double cast.
      Primary requirement: REQ-200
      Constraints: REQ-182
      Dependencies: None
      Done when: generated types are current, strict diagnostics pass, build/dry-run pass, and hosted CI remains explicitly unclaimed until the revision is pushed.
- [x] **A-184** — Make green failure-path tests diagnostically quiet. **Done locally 2026-08-25:** expected catalog, install, content, template, tenant, and Headless audit errors are captured and asserted by their owning tests; unexpected console errors remain visible.
      Primary requirement: REQ-201
      Constraints: REQ-182
      Dependencies: None
      Done when: the full green suite emits no production-style error stack while exact expected labels/messages remain regression-checked.
- [x] **A-185** — Verify and reconcile A25. **Done locally 2026-08-25:** focused order tests pass 4/4, upload tests 5/5, expected-log tests 57/57, full suite 308/309 with one intentional skip, 307-file diagnostics are clean, generated bindings have no drift, build/dry-run pass, and local D1 reaches schema 58. No remote migration, deployment, commit, push, or vendor request occurred.
      Primary requirements: REQ-198, REQ-199, REQ-200, REQ-201
      Constraints: REQ-182
      Dependencies: A-181, A-182, A-183, A-184
      Done when: all focused/full/local platform gates pass and canonical documents match the executable tree.


## A24 — Shipping bootstrap and direct advertising reliability

- [x] **A-176** — Repair clean-install Malaysia shipping policy. **Done locally 2026-08-25:** migration `0056` provisions four active zones/ranges, 16 state/WP first-kilogram rules, 20 fallback rules, and complete official postcode coverage; it repairs Sabah through Kalabakan `91400` without overriding active merchant rules.
      Primary requirement: REQ-177
      Constraints: REQ-178, REQ-189
      Dependencies: None
      Done when: an isolated real D1 applies every migration and proves 4/4/36 policy rows, 2,931 directory rows, zero unmapped postcodes, and one Sabah match for `91400`.
- [x] **A-177** — Keep the Malaysia storefront free of cookie notification UI. **Done locally 2026-08-25:** configured Meta/Google tags and bounded attribution load directly; the banner, preference control, consent endpoint, and dead state were removed; the Malay cookie policy discloses storage and browser controls without EU-style opt-in UX.
      Primary requirement: REQ-193
      Constraints: REQ-182, REQ-197
      Dependencies: None
      Done when: repository search finds no notification/consent control path and browser proof shows configured tags/events start directly with no banner or page overflow.
- [x] **A-178** — Transactionally enqueue accepted-order Meta Purchase. **Done locally 2026-08-25:** configured order, item, stock decrement, and canonical `purchase:{orderNumber}` payload share one D1 batch; thanks emits the browser leg with the same identity.
      Primary requirement: REQ-193
      Constraints: REQ-195, REQ-197
      Dependencies: None
      Done when: focused tests prove canonical variant ID, MYR merchandise-only value, preserved `_fbp`/`_fbc`, shared batch membership, and no outbox row without configured Meta signal context.
- [x] **A-179** — Drain Meta CAPI independently of storefront traffic. **Done locally 2026-08-25:** the Worker exposes a scheduled handler, Wrangler declares a one-minute Cron Trigger, and the configured drain retains the existing lease/retry/retention behavior.
      Primary requirement: REQ-197
      Constraints: REQ-193
      Dependencies: A-178
      Done when: Wrangler dry-run accepts the handler/config and a real local scheduled invocation returns `outcome: ok`.
- [x] **A-180** — Verify and reconcile the hardening slice. **Done locally 2026-08-25:** 301/302 tests pass with one intentional skip, 306 files have zero diagnostics, build/dry-run pass, local D1 is schema 57 with zero unmapped postcodes, and 390 px browser proof shows no cookie notification while configured PageView/ViewContent and attribution start directly.
      Primary requirement: REQ-177, REQ-193, REQ-197
      Constraints: REQ-182
      Dependencies: A-176, A-177, A-178, A-179
      Done when: code, requirements, architecture, status, installation, observability, and browser/runtime evidence agree without any remote mutation claim.

## A23 — Malaysia market replatforming

- [x] **A-160** — Replace currency primitives, fixtures, tracking values, and public formatting with MYR integer sen. **Done locally 2026-08-23:** D1 preview data, checkout, Headless API, CRM, notifications, and admin analytics use integer sen/MYR; browser evidence shows no Rupiah output.
      Primary requirement: REQ-173
      Constraints: REQ-182
      Dependencies: None
      Done when: Focused money tests prove arithmetic persists integer sen and Malaysian public formatting renders MYR consistently.
- [x] **A-161** — Add the public `ms-MY` / `en-MY` locale contract and bilingual merchant-content fields with explicit fallback. **Done locally 2026-08-23:** migration `0051` adds independent Malay/English draft and publication state; the cookie-backed `BM | EN` selector survives navigation, public responses vary by cookie, store fallback is explicit, and browser proof covers both locales.
      Primary requirement: REQ-174
      Constraints: REQ-175, REQ-182
      Dependencies: A-160
      Done when: A route test and browser proof show a language choice survives navigation and a missing translation follows the documented fallback without affecting Indonesian admin labels.
- [x] **A-162** — Remove AutoLaris, QRIS, virtual-account, provider-webhook, and automatic-payment code paths; retain COD and verified manual bank transfer only. **Done locally 2026-08-23:** provider routes/clients/fields/assets are absent from active runtime; payment methods and order validation expose only COD/manual transfer.
      Primary requirement: REQ-176
      Constraints: REQ-182
      Dependencies: A-160
      Done when: Route and integration tests prove only the two accepted methods can be submitted and no payment-provider request or secret is reachable.
- [x] **A-163** — Add forward D1 migrations for five-digit Malaysia postcode ranges, Peninsular/Sabah/Sarawak/Labuan zones, weight-rate rules, and immutable order quote snapshots. **Done locally 2026-08-23:** migration `0048_malaysia_shipping_foundation.sql` and forward cleanup migration `0049_remove_provider_and_ads_schema.sql` are applied only to the isolated local D1; remote application is intentionally not claimed.
      Primary requirement: REQ-177
      Constraints: REQ-178, REQ-179
      Dependencies: A-160
      Done when: A clean local D1 migration creates the documented schema and focused tests prove valid rule selection plus immutable order snapshots.
- [x] **A-164** — Implement Malaysian postcode normalization, zone lookup, gram-based cart weight, and deterministic shipping quote validation. **Done locally 2026-08-23:** focused tests and runtime requests prove Peninsular, Sabah, Sarawak, Labuan, invalid postcode, and overlap behavior.
      Primary requirement: REQ-178
      Constraints: REQ-177, REQ-182
      Dependencies: A-163
      Done when: Focused tests reject malformed/unmapped five-digit postcodes, postcode/rate overlaps, and weight gaps without persisting an order; a configured Labuan postcode resolves only to Labuan.
- [x] **A-165** — Build the Indonesian admin shipping-rate workspace for postcode zones and MYR weight bands. **Done locally 2026-08-23:** `/admin/expeditions` creates/edits/disables postcode ranges and MYR weight bands; API overlap tests pass and browser evidence at 390/1280 px shows zero overflow.
      Primary requirement: REQ-179
      Constraints: REQ-177, REQ-178
      Dependencies: A-163, A-164
      Done when: Browser evidence proves an authorized operator can create, edit, disable, and validate a zone/rate rule at 390px and 1280px with no overflow.
- [x] **A-166** — Remove Mengantar data, APIs, provider clients, courier operational surfaces, and Indonesian address dependencies through forward migrations and focused deletion-safe tests. **Done locally 2026-08-23:** active source has no reachable provider path; the Indonesian district dataset/audit, unused provider assets, and obsolete D1 tables are absent.
      Primary requirement: REQ-180
      Constraints: REQ-182
      Dependencies: A-163
      Done when: Repository search finds no reachable Mengantar runtime path, and migration plus regression tests preserve orders and stock.
- [x] **A-167** — Replace provider dispatch with local operator controls. **Corrected locally 2026-08-24:** REQ-192 supersedes the temporary courier/tracking record. Active runtime now stores queue membership and an independent status marker without an outbound call; `/order-status` exposes the protected status only.
      Primary requirement: REQ-192
      Constraints: REQ-176, REQ-182
      Dependencies: A-166
      Done when: An operator can manage queue membership and status without an outbound provider request; customer order status exposes no customer, address, courier, or tracking data.
- [x] **A-168** — Convert public storefront, checkout, legal pages, feeds, Headless API contract, and customer messages to Malaysia bilingual behavior. **Done locally 2026-08-23:** storefront shell, catalogue, localized product/category/variant copy, checkout, legal pages, confirmation, tracking, SEO metadata, and Headless locale contract are implemented for Malay and Malaysia English with MYR output.
      Primary requirement: REQ-175
      Constraints: REQ-173, REQ-174, REQ-176, REQ-177
      Dependencies: A-161, A-162, A-164
      Done when: Browser and API evidence prove both public languages, MYR, the two payment methods, and Malaysian address/shipping behavior on a running local install.
- [x] **A-169** — Reconcile documentation, migrations, tests, and release evidence for the Malaysia contract. **Done locally 2026-08-23 and reverified through schema 55 on 2026-08-24:** canonical docs match the single-hybrid/manual-Pengiriman contract; 272 tests (271 pass, one intentional skip), 277 checked files with zero diagnostics, Cloudflare build, API checks, and browser evidence pass. No remote release is claimed.
      Primary requirement: REQ-182
      Constraints: REQ-173, REQ-174, REQ-176, REQ-177, REQ-180, REQ-181
      Dependencies: A-160, A-161, A-162, A-163, A-164, A-165, A-166, A-167, A-168
      Done when: `npm run check`, `npm test`, and `npm run build` pass; every canonical document reports the implemented state and no legacy provider claim remains.
- [x] **A-170** — Replace manual destination fields with an AdsBookCMS-style Malaysia location search backed by an official postcode snapshot in local D1. The selected bandar/negeri/poskod must be the only source for the shipping quote; street address remains buyer-entered and no external provider is called at runtime. **Done locally 2026-08-23:** migration `0050` stores 2,931 official `data.gov.my` location rows; search/selection/quote and mismatch refusal pass focused tests plus live API/browser checks at 390 px and 1280 px.
      Primary requirement: REQ-183
      Constraints: REQ-173, REQ-174, REQ-177, REQ-178, REQ-180, REQ-182
      Dependencies: A-163, A-164
      Done when: a clean local migration loads the official Malaysia postcode directory; focused tests prove search, selection, and invalid/unmapped handling; and browser evidence at 390 px and 1280 px proves keyboard-accessible search, automatic MYR quote, recovery states, and zero horizontal overflow.
- [x] **A-171** — Add editable state-specific MYR weight-band rates for all 13 Malaysian states and the three Federal Territories, retaining broad-zone rates only as fallback. **Done locally 2026-08-23:** all 16 state/WP rules are seeded and active; quote resolution prefers the trusted postcode-directory state; overlap triggers scope conflicts by state; the admin list exposes every state/WP with an amount, switch, and save action without desktop/mobile overflow.
      Primary requirement: REQ-184
      Constraints: REQ-177, REQ-178, REQ-179, REQ-180, REQ-182
      Dependencies: A-170
      Done when: local D1 contains one active reference rule per state/WP, sibling state rules do not overlap, checkout uses the matching state rule before fallback, and browser evidence shows all 16 admin rows at 390 px and 1280 px.
- [x] **A-172** — Supersede the temporary bilingual storefront with one controlled Malaysia-market hybrid language while preserving the AdsBookCMS visual baseline. **Done locally 2026-08-23:** `BM | EN`, locale cookie/query/fallback, Headless locale parameters, Store Settings language choice, and Content Workbench language choice are removed; public rendering reads one hybrid publication from the primary content columns; legacy bilingual columns remain dormant for forward-migration compatibility. Order Management is restored from a card grid to the AdsBookCMS table pattern while retaining MYR and Malaysia fulfilment data.
      Primary requirement: REQ-185
      Constraints: REQ-173, REQ-176, REQ-182
      Dependencies: A-169
      Done when: repository search finds no active locale selector or English fallback branch; checks/tests/build pass; browser evidence shows one hybrid storefront and a table-based Order Management page.
- [x] **A-173** — Restore the inherited AdsBookCMS form-to-CMS and WhatsApp operator workflows after the Malaysia cutover. **Done locally 2026-08-23:** Order Management again exposes the server-filtered desktop table, responsive cards, bulk controls, direct WhatsApp contact, and the ten-stage CRM action set; order detail again exposes customer/address editing, manual fulfilment, payment context, and CRM copy actions. Public PDP and checkout use the inherited AdsBookCMS form shell, variant cards, destination lookup states, payment cards, summary, CTA, and trust strip. `/middle-form` remains the short CS-confirmation path, while `/full-form`, `/hybrid-form`, embeds, and landing pages pass their configured modes without a redirect or silent mode rewrite.
      Primary requirement: REQ-186
      Constraints: REQ-173, REQ-176, REQ-180, REQ-182
      Dependencies: A-166, A-167, A-172
      Done when: focused tests plus authenticated browser evidence prove the WhatsApp actions, table/detail workflows, three form modes, MYR/Malaysia substitutions, and zero active Mengantar or AutoLaris controls without changing the AdsBookCMS visual hierarchy.
- [x] **A-174** — Refine the invoice detail page without changing the inherited AdsBookCMS operator workflow. **Corrected locally 2026-08-24:** the invoice separates customer/address, payment, and shipping mutations; trusted Malaysia destination search re-quotes persisted item weight; MYR shipping cost remains editable and refreshes the total; direct WhatsApp plus ten CRM actions remain; courier/tracking evidence controls are absent.
      Primary requirement: REQ-186
      Constraints: REQ-173, REQ-176, REQ-177, REQ-180, REQ-182
      Dependencies: A-167, A-170, A-173
      Done when: authenticated browser evidence at 390 px and 1280 px proves the AdsBookCMS information hierarchy, trusted destination search, editable MYR shipping cost, scoped status/payment drafts, preserved WhatsApp actions, accessible mobile ordering, and zero horizontal overflow or browser errors.
- [x] **A-175** — Add an explicit local Pengiriman queue and filtered CSV export without restoring provider dispatch. **Corrected locally 2026-08-24:** migration `0052` owns independent queue membership; Aksi and bulk controls set/clear only `shipping_queued_at`; Pengiriman renders only current members as a compact desktop table/mobile cards; and the authenticated server exports the complete filtered queue without courier/service/tracking columns and with spreadsheet-formula neutralization.
      Primary requirement: REQ-187
      Constraints: REQ-173, REQ-176, REQ-180, REQ-181, REQ-182, REQ-186
      Dependencies: A-167, A-173
      Done when: focused tests plus authenticated browser evidence prove unconditional queue entry/removal without a shipping-status mutation, queued-only listing, independent status markers without evidence validation, a downloaded filter-consistent CSV, mobile/desktop usability, and zero external dispatch.
- [x] **A-176** — Bring the Malaysia location field back to exact AdsBookCMS form behavior without changing the checkout workflow. **Done locally 2026-08-23:** the floating field, 16 px search input, 13/11 px result hierarchy, keyboard active state, loading/empty/error/retry states, and 12/13 px selected destination summary are preserved; the destination remains Malaysia city/state/postcode and no district-provider control returns.
      Primary requirement: REQ-188
      Constraints: REQ-177, REQ-180, REQ-186
      Dependencies: A-170, A-173
      Done when: executable Chromium evidence at 390 px and 1280 px proves all search states, keyboard selection, change-and-refocus behavior, MYR quote resolution, and zero horizontal overflow or unexpected browser errors.
- [x] **A-177** — Calibrate merchant-owned Malaysia reference shipping bands and correct state-to-zone fallback. **Done locally 2026-08-23:** forward migration `0053` replaces only untouched flat reference rows with 1–5 kg Peninsular rates of RM8/9/10/11/12 and Sabah/Sarawak/Labuan rates of RM15/26/39/48/60; state/WP first-kilogram rows remain concise, retired flat reference artifacts are omitted from the current admin editor, and higher weights resolve the matching zone band. Historical order quote snapshots remain unchanged.
      Primary requirement: REQ-189
      Constraints: REQ-173, REQ-177, REQ-178, REQ-179, REQ-180
      Dependencies: A-164, A-171
      Done when: the complete 55-migration chain applies to a clean isolated D1; focused tests prove matching state preference and weight-specific zone fallback; runtime quotes prove Peninsular and East Malaysia values; and authenticated browser evidence shows editable state rates plus fallback bands without overflow.
- [x] **A-178** — Restore AdsBookCMS-style input validation and submit readiness on every canonical Malaysia checkout mode. **Done locally 2026-08-24:** receiver name, Malaysian WhatsApp, address, trusted location, fresh location/variant quote, and active COD/manual-transfer selection now share one progressive gate; blur and submit expose inline Malay feedback; stale quotes and failed payment-method loads fail closed; and the native action remains grey and disabled until ready.
      Primary requirement: REQ-190
      Constraints: REQ-173, REQ-176, REQ-177, REQ-178, REQ-186, REQ-188
      Dependencies: A-173, A-176
      Done when: shared validation and order-schema tests pass; type-check and production build pass; executable Chromium at 390 px and 1280 px proves progressive button labels, inline invalid states, name/phone normalization, location/quote/payment gating, 16 px inputs, a 44 px action, zero horizontal overflow, and no browser errors.
- [x] **A-179** — Replace the Order Management queue switch with one Indonesian operational status and action contract. **Done locally 2026-08-24:** desktop and mobile expose the same derived statuses; the inline `Masuk Pengiriman` switch is gone; queue membership, stored status transitions, detail access, and deletion live under Aksi; server-side filters and counts use the same status precedence; WhatsApp CRM remains intact.
      Primary requirement: REQ-191
      Constraints: REQ-186, REQ-187
      Dependencies: A-173, A-175
      Done when: focused lifecycle/list/queue tests pass; full type-check, test suite, and build pass; authenticated Chromium at 1280 px and 390 px proves the exact status/table contract, reversible queue action, no inline switch or `Masuk antrean` copy, a 44 px mobile action target, zero root overflow, and no browser errors.
- [x] **A-180** — Decouple Pengiriman membership from status and retire courier/tracking evidence. **Done locally 2026-08-24:** queue entry/exit now changes only `shipping_queued_at` for any order; status actions work outside the queue and require no courier/tracking; Pengiriman and invoice editors retain trusted Malaysia address search plus editable MYR shipping cost; migration `0054` permits explicit authenticated re-quotes; public/admin APIs, CSV, CRM defaults, and order status no longer expose evidence fields; legacy D1 columns remain dormant.
      Primary requirement: REQ-192
      Constraints: REQ-173, REQ-177, REQ-182, REQ-186, REQ-187, REQ-191
      Dependencies: A-167, A-170, A-174, A-175, A-179
      Done when: focused queue/lifecycle/quote tests, the full suite, type-check, build, local schema 55, and authenticated desktop/mobile Chromium prove independent membership/status, removable progressed rows, evidence-free status changes and CSV, preserved WhatsApp CRM, editable trusted destination/ongkir with consistent total, zero overflow, and restored dummy data.
- [x] **A-181** — Restore Malaysia Meta Ads and Google Ads signal configuration without restoring retired provider or feed features. **Done locally 2026-08-24:** the AdsBookCMS-aligned **Ads & Tracking** group exposes overview, Meta Pixel/CAPI, and Google GTM/Ads pages to owner/admin/advertiser roles; strict APIs persist validated identifiers and an AES-GCM-encrypted Meta token; migration `0055` adds the configuration columns and deduplicated retry outbox; storefront attribution retains Meta/Google click IDs and sends MYR events with canonical content IDs. Order creation emits Lead, manual-transfer Purchase waits for paid, and COD Purchase waits for delivered. Google offline upload, TikTok, catalog feeds, Mengantar, and AutoLaris remain absent.
      Purchase timing in this historical delivery was superseded by A-184; its configuration, encryption, attribution, and outbox contracts remain current.
      Historical note: A-182 first added only the public Google Merchant feed; A-185 later reuses that exact endpoint for Meta Commerce Manager without restoring provider-owned catalog infrastructure.
      Primary requirement: REQ-193
      Constraints: REQ-173, REQ-176, REQ-180, REQ-182, REQ-186
      Dependencies: A-160, A-162, A-166, A-173, A-180
      Done when: focused encryption, eligibility, attribution, and payload tests pass; schema 56 applies only to the isolated local D1; full test/check/build pass; authenticated Chromium proves overview/Meta/Google pages, keyboard tabs, masked secret state, strict validation, 44 px mobile controls, and zero horizontal overflow without sending a vendor event.
- [x] **A-182** — Publish the Malaysia Google Merchant catalog without restoring provider-owned catalog infrastructure. **Done locally 2026-08-24:** `/feed/google-catalog.xml` emits an RSS 2.0, Google-namespaced variant-level feed from active, in-stock published products only. Each row uses the same `p{productId}-v{variantId}` identity as storefront tracking, formats integer sen as MYR, and links to the exact `?variant_id=` selection. Variant groups include `item_group_id`, `item_group_title`, and `variant_option`; unknown product identifiers and taxonomy remain omitted rather than guessed. The protected Google Ads admin page presents read-only local counts, warnings, and feed URL guidance; Merchant Center shipping remains operator-configured outside the feed.
      Subsequent scope: A-185 reuses this exact feed URL for Meta Commerce Manager rather than creating a second feed.
      Verification: 284 tests ran (283 passed, one intentional skip); `npm run check` completed with zero diagnostics; the Cloudflare server build completed. Public XML returned 200 with four variant offers, exact MYR sale pricing, and one real group. Authenticated Chromium at 1280 px and 390 px showed four preview offers, three honest readiness warnings, 44 px controls, no horizontal overflow, and a variant URL that selected B5/RM32.90 with `p10001-v10002` tracking identity.
      Primary requirement: REQ-194
      Constraints: REQ-173, REQ-182, REQ-185, REQ-186, REQ-193
      Dependencies: A-181
      Done when: focused feed tests prove XML escaping, stable variant IDs, selected-variant links, MYR prices, stock/publication filtering, safe identifier omission, and multi-variant grouping; check/build pass; public XML and authenticated desktop/mobile Google Ads diagnostics render without outbound Merchant API calls, overflow, or browser errors.
- [x] **A-183** — Restore exact AdsBookCMS Ads/Tracking information density and propagate the canonical Malaysia signal contract through every public commerce entry point. **Done locally 2026-08-24:** the overview and Google page use the inherited two-channel cards, four KPIs, four accessible tabs, configuration card, five-step tutorial, compact catalog table, and signal inspector without copying Indonesia/provider facts or unsupported Enhanced/GPC claims. PDP, CMS landing pages, the native landing template, shared checkout, and the rich thanks page share canonical variant IDs. Checkout stores the persisted server response's `product_value_sen` and `content_id`; thanks renders merchandise, shipping, and payable totals separately and sends Lead/eligible Purchase using merchandise subtotal only.
      Purchase timing in this historical delivery was superseded by A-184; its canonical identity, merchandise-only value, and UI contracts remain current.
      Verification: 285 tests ran (284 passed, one intentional skip); `npm run check` completed with zero diagnostics across 298 files; the Cloudflare server build completed. Authenticated Chromium at 1280 px and 390 px showed four catalog offers, internal table scroll without page overflow, 44 px catalog actions, and no browser/runtime/network failures. Public CMS/native landing and PDP checks emitted `ViewContent` with `p10003-v10004` / RM39.90 and `p10001-v10002` / RM32.90. Thanks showed RM32.90 product + RM12.00 shipping = RM44.90 payable while its Lead value remained RM32.90, with 48 px actions and zero overflow.
      Primary requirement: REQ-195
      Constraints: REQ-173, REQ-176, REQ-185, REQ-186, REQ-193, REQ-194
      Dependencies: A-181, A-182
      Done when: tests/check/build pass; browser evidence proves AdsBookCMS hierarchy, canonical IDs across PDP/landing/checkout/thanks/feed, merchandise-only signal value under a different shipping/payable total, complete COD/manual-transfer confirmation UI, and zero external provider or Merchant API call.
- [x] **A-184** — Align Purchase timing with the AdsBookCMS verified-thanks contract. **Done locally 2026-08-24:** the no-store thanks page re-resolves the persisted order with its checkout-issued status token and immediately emits Purchase for both COD and manual transfer. Paid, delivered, queue membership, and admin status changes no longer gate or create advertising Purchase. Browser Meta/GTM and direct Google use the confirmed order number; Meta CAPI independently reads canonical item IDs, Malaysia identity, and merchandise subtotal from D1. Refresh deduplication remains enforced by the browser once guard, Meta outbox uniqueness, and Google transaction ID.
      Verification: focused signal/status tests passed 6/6; the full suite ran 285 tests (284 passed, one intentional skip); `npm run check` completed with zero diagnostics across 299 files; and the Cloudflare server build completed. Headless Chromium exercised pending COD at 390 px and pending manual transfer at 1280 px: each first load emitted exactly one MYR 32.90 Purchase with canonical order identity, each reload emitted zero duplicates, the confirmation UI remained visible with zero horizontal overflow, and no runtime exception occurred. No vendor endpoint, remote D1, deployment, commit, or push was touched.
      Primary requirement: REQ-193
      Constraints: REQ-173, REQ-176, REQ-182, REQ-194, REQ-195
      Dependencies: A-181, A-183
      Done when: pending COD and pending manual-transfer orders pass the capability-protected server boundary; Meta CAPI ignores client-supplied product/value tampering; tests/check/build pass; and a real browser proves first-load Purchase plus refresh deduplication on mobile and desktop.
- [x] **A-185** — Use one catalog URL for Google and Meta. **Done locally 2026-08-24:** the existing Google Merchant-compatible RSS 2.0 endpoint remains the sole canonical feed at `/feed/google-catalog.xml`; both Google and Meta admin pages link to it, and diagnostics identify both consumers. No duplicate Meta endpoint, redirect alias, database, credential, or catalog API integration was added. Product/event identity, MYR value, variant landing URL, publication filtering, and honest missing-identifier warnings remain unchanged.
      Primary requirement: REQ-194
      Constraints: REQ-173, REQ-182, REQ-185, REQ-193, REQ-195
      Dependencies: A-182, A-184
      Done when: a focused test locks the canonical path; full tests/check/build pass; the public XML returns 200; Google and Meta admin pages expose the exact same feed URL; and no `/feed/meta-catalog.xml` route exists.
- [x] **A-186** — Restore a precise shadcn Meta configuration form without changing its workflow. **Done locally 2026-08-24:** the Astro route server-renders the installed shadcn Card, Input, Button, and Skeleton components with no hydration island or dependency. Pixel and token fields align as equal desktop columns and stack on mobile; the Test Event input and action own one muted subsection; Save remains in the footer. Token UI distinguishes empty, masked stored, draft replacement, and pending deletion states without exposing a stored token. Clear selection disables the token field and test action, inline validation is associated with each field, and retry/loading/status feedback is accessible. The `/api/admin/ads` contract and D1 schema are unchanged.
      Verification: focused form-state tests passed 2/2; the complete suite ran 288 tests (287 passed, one intentional skip); `npm run check` reported zero diagnostics across 301 files; and the Cloudflare server build completed. Authenticated Chromium at 1280 px proved equal 440.5 px columns, the exact keyboard order, invalid/ready button states, uppercase Test Event normalization, 44 px controls, zero overflow, and no failed request or runtime exception. At 390 px the form became one 335 px column with full-width 44 px actions and zero overflow. A mocked read-only stored-token response proved the input stayed empty, only the mask rendered, and choosing deletion disabled token/test while enabling Save; no vendor event or database write was made.
      Primary requirement: REQ-196
      Constraints: REQ-186, REQ-193, REQ-195
      Dependencies: A-181, A-184
      Done when: focused token-state tests, check/build, and authenticated desktop/mobile browser evidence prove precise two-to-one-column layout, 44 px controls, logical keyboard order, masked-token safety, inline validation, correct disabled states, and zero network mutation during QA.
- [x] **A-187** — Harden the complete MyBookCMS Meta signal boundary without changing the inherited AdsBookCMS layout. **Done locally 2026-08-24:** token resolution now distinguishes encrypted D1, environment fallback, empty, and invalid states; plaintext D1 secrets fail closed; the CAPI sender uses a bearer header against Graph API `v26.0` with bounded timeout and sanitized retry classification. Product events ignore browser-supplied identity/value and resolve the active D1 variant; order events use the capability-owned order, canonical item subtotal/IDs, and persisted `_fbp`/`_fbc`. Atomic outbox leasing prevents parallel duplicate delivery and bounded retention prunes completed records. The overview and Meta form render accurate environment/invalid states without revealing or pretending to delete an environment-managed secret.
      Verification: 298 tests ran (297 passed, one intentional skip); `npm run check` completed across 303 files with zero diagnostics; and the Cloudflare server build completed. Browser evidence is recorded in `STATUS.md` and `BUILD-LOG.md`. No vendor event, database mutation, deployment, commit, or push occurred.
      Primary requirement: REQ-197
      Constraints: REQ-182, REQ-186, REQ-193, REQ-195, REQ-196
      Dependencies: A-181, A-184, A-186
      Done when: transport, secret-source, catalog-authority, attribution, deduplication, retry, retention, OpenAPI, and UI-state tests pass; check/build pass; and authenticated browser QA proves the database/environment/none/invalid states without a real Meta request or persistence mutation.
