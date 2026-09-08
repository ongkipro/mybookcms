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
      Dependencies: A-221 and a separately approved target-install release plan
      Done when: after explicit approval for each live mutation, the exact reviewed revision passes local release gates; the target is backed up/protected; forward migrations apply once; production credentials are entered without disclosure; the exact notification URL is registered; only sandbox-proven channels are enabled; one bounded approved production smoke payment proves create, return, signed notification, REQ-227-compliant retrieve, local order/stock state, operator diagnostics, and exactly-once Ads Purchase; COD/manual remain usable; rollback criteria are recorded; and all evidence is redacted.

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

- [ ] **A-268** — Record a reason when a retry is refused before the provider call.
      Raised by the independent review of A-260 on 2026-09-08 (finding F3), and
      queued rather than folded into that task because it changes what a payment
      path writes. `checkoutBody` is called at `src/lib/doku-payment-access.ts:935`,
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

- [ ] **A-269** — Give `checkRateLimit` the injectable clock the rest of the payment path already has.
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

- [ ] **A-261** — Decide whether a 62,000-line codebase gets a linter. **Approval: required — adds a toolchain to a repository that has kept dependencies deliberately minimal.**
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

- [ ] **A-256** — Make the admin canvas obey the design system it already has.
      Screened 2026-09-08 after the owner reported the admin reading as untidy.
      The finding is not a missing library. `shadcn/ui` is installed with 22
      primitives in `src/components/ui/`, `src/styles/admin.css` carries the full
      semantic variable set, and `DESIGN-SYSTEM.md` already makes both mandatory:
      "the admin uses the semantic variables and Tailwind bridge in
      `src/styles/admin.css` plus the existing shadcn components", and "do not
      introduce a second component library, a separate color vocabulary, or a
      provider brand as a system accent". The admin components bypass all of it.
      Measured across `src/components/admin/*.tsx` at `0cff0f0`: `border-slate-200`
      150 uses against `border-border` 16; `text-slate-500` 187 against
      `text-muted-foreground` 37; `bg-white` 90 against `bg-card` 6. Whole-palette
      counts are 980 `slate-*` uses across 22 files against 74 semantic-token uses
      concentrated in 2 files. Seventeen of twenty-three admin components import no
      shadcn primitive at all, and the largest are the worst: `ProductCatalog` at
      1232 lines with 51 hand-styled nodes and zero imports, `LandingPageCatalog`
      968/40/0, `OrderDetail` 761/36/0, `ProductForm` 696/21/0. The installed
      `table`, `badge`, `dialog`, and `select` primitives are used by zero admin
      components, while `OrdersTable`, `ProductCatalog`, and `LandingPageCatalog`
      are table-heavy and full of hand-rolled badges and modals.
      What the operator sees is the arithmetic of that. One "card" concept is drawn
      three ways depending on the file — `rounded-xl` 121, `rounded-lg` 79,
      `rounded-2xl` 28 — across two shadow scales and two padding rhythms.
      `LandingPageEditor.tsx` additionally introduces a third colour vocabulary
      (`text-zinc-800`, `bg-zinc-900`, 6 uses) in the same file that elsewhere uses
      `border-border`, which is the "separate color vocabulary" the design system
      names explicitly.
      **This is not only cosmetic, and that is the part worth acting on.**
      `DESIGN-SYSTEM.md` already measured and recorded that `slate-500` passes AA
      on a white card at 4.76 but fails on the admin page background `#f5f6f8` at
      4.41, and must be `slate-600` there. There are 187 raw `text-slate-500` uses.
      Some necessarily sit on the page background, so the design system predicted
      these failures before they were written. A component using
      `text-muted-foreground` cannot express the failing pair at all, which is why
      the token layer is the fix rather than a per-instance contrast audit.
      Sequenced deliberately, because rewriting 23 components is over ten thousand
      lines of risk for no proportionate gain. The token layer goes first: it is
      mechanical, greppable, verifiable without taste, removes most of the visual
      drift, and closes the contrast trap in one pass. Shared shells follow —
      card, table, badge — where the ratio of consistency gained to lines changed
      is highest. Surfaces are ordered by daily operator use, not by file size.
      Risk: R2 — shared visual primitives rendered on every admin workspace; presentation only, with no data, authorization, schema, or API change. Rises to R3 for any surface where a token change alters a state indicator an operator reads as payment or order truth.
      Surface: `src/components/admin/*.tsx`, `src/styles/admin.css`, `src/components/ui/*` only where an installed primitive needs a variant it does not yet have, `DESIGN-SYSTEM.md`, `docs/DEVELOPMENT-MAP.md`, `TASKS.md`, `STATUS.md`.
      Non-scope: adding any component library or dependency; redesigning the AdsBookCMS interaction baseline REQ-186 protects, including the Order Management desktop-table/mobile-card split and the order-detail CRM workflow; changing any admin behaviour, data, permission, or endpoint; the storefront, which has its own token layer in `src/styles/form-hybrid.css`; the 44 px switch target, which stays A-234; and converting a component to a shadcn primitive where the primitive cannot yet express its existing behaviour.
      Constraints: REQ-186, REQ-196
      Dependencies: the designer/vision handoff required before the first visual edit. A-234 stays independent and neither blocks this nor is blocked by it.
      Done when: no admin component references a raw Tailwind palette shade for a colour the semantic layer already names, verified by a grep-based check that fails on reintroduction; the third `zinc` vocabulary in `LandingPageEditor.tsx` is gone; every hand-rolled card, table, and badge that the installed primitives can express uses them; one card radius, one shadow scale, and one padding rhythm are in force across the admin; no `text-slate-500` remains on the page background; a real browser confirms each converted surface at 390 px and 1280 px with no new overflow and no regression against the REQ-186 baseline; and focused tests, all repository tests, `npm run check`, and `npm run build` pass.

- [x] **A-265** — Make a duplicated task id fail the queue contract. **Done locally 2026-09-08.** `task-queue.test.ts` gained two assertions: an id may not repeat inside one section, and an open-queue id may not appear in any closed section. Both mutation-proved before being trusted — an injected duplicate `A-256` and a reused historical `A-176` each failed the suite, and removing them returned it to green.
      **The archive duplicates are resolved by decision, not by an exclusion list.** `A-176`–`A-185` legitimately head two different closed tasks each: the fork restarted numbering after the 2026-08-23 `## A23` era, so `## A23` and `## A24`/`## A25` each own an entry for those ten ids. They carry 55 cross-references across `BUILD-LOG.md`, the docs, and `.delivery/runs/`, and renumbering settled history to satisfy a checker would invalidate every one of them to fix nothing an agent can trip over — the same reasoning ADR-024 applies to applied migrations. So the rule was written to ask what actually matters instead: every collision that caused harm today was inside `## Open queue`, and the two assertions catch a new duplicate wherever it lands while leaving closed history closed. No id is exempted by name.
      Screened 2026-09-08 after two collisions in one day. `A-255` was allocated
      by two sessions for two different tasks, and the design-conformance one was
      then marked complete without any work; `A-258` was allocated twice the same
      way an hour later. `task-queue.test.ts` validates that every open entry
      carries its five fields, cites only defined requirements, and marks R4 for
      approval — and asserts nothing about ids, so both collisions passed green.
      The archive already shows the same defect at rest: `A-176` through `A-185`
      appear under both `## A24` and `## A23`. AGENTS.md rule 7 tells a session
      how to allocate; this is the check that makes the rule hold when a session
      does not read it.
      Risk: R1 — one assertion in an existing test file; no runtime change. The first run will fail on the archive duplicates, and the task decides whether those are one entry recorded under two epics or a real duplicate, per pair, rather than silencing them.
      Surface: `src/lib/task-queue.test.ts`, `TASKS.md`, `STATUS.md`.
      Non-scope: renumbering historical entries, changing what the five-field contract requires, and any check on `.delivery/runs/` labels, which the ledger owns.
      Primary requirement: REQ-231
      Constraints: none.
      Dependencies: none.
      Done when: `task-queue.test.ts` fails when the same `**A-nnn**` id heads more than one entry anywhere in `TASKS.md`; the archive duplicates `A-176`–`A-185` are each resolved by a recorded decision rather than an exclusion list; and the test passes on the resulting file.

- [x] **A-266** — Join the sixteen "Implemented locally" requirements to the evidence that already exists for them. **Done locally 2026-09-08.** Fourteen rows now read `Verified locally` and each names the test file and test that satisfies it — REQ-173 and REQ-185 to `storefront-locale.test.ts`, REQ-178 and REQ-184 to `malaysia-shipping.test.ts`, REQ-179 to `expedition-settings.test.ts`, REQ-183 to `malaysia-locations.test.ts`, REQ-194 to `catalog-data.test.ts`, REQ-202/203/204/207/208 to `malaysia-market.test.ts`, REQ-206 to `seller-bank-account.test.ts`, REQ-209 to `store-pickup.test.ts`. Every citation was resolved by locating the named test in its file, not by keyword similarity; four candidates that matched on keywords alone were discarded on reading.
      **Two rows were deliberately not raised**, which is the part that matters. REQ-210 — the repository shall contain no host or network address belonging to one developer's machine — is true on disk: a scan found only loopback `127.0.0.1` and RFC 5737 TEST-NET `192.0.2.x`, the documentation addresses the row itself requires. But no test asserts it, so a device address added tomorrow would pass every check, and the row says exactly that rather than claiming verification it does not have. It is the natural next guard after A-257 and A-265. REQ-180 already carried its own qualifier (`payment clause superseded`) and was left alone: it is not an unreferenced row.
      Screened 2026-09-08. Sixteen rows in `PRD.md` read `Implemented locally`:
      REQ-173, 178, 179, 180, 183, 184, 185, 194, 202, 203, 204, 206, 207, 208,
      209, 210 — the foundation of the Malaysia replatforming, from MYR integer
      sen through postcode bands, location search, Malay copy, slugs, legal
      reachability, seller banks, pickup address, and host hygiene. Not one of
      them is mentioned in `STATUS.md`, in `BUILD-LOG.md`, or by any closed task
      entry. That is not the same as unverified: 118 test names match these
      domains by keyword, and several cover a row outright — "advertising values
      convert integer sen to MYR major units" is REQ-173, "postcode range
      mutations reject malformed or overlapping active policy" is REQ-178,
      "location search returns only D1-backed shippable city, state, and postcode
      rows" is REQ-183, "a retired slug redirects once to its Malay canonical" is
      REQ-203. The evidence exists; nothing joins it to the row it satisfies.
      This is a joining task, not a verification task, and it must not become an
      upgrade pass. For each row: name the test or recorded browser evidence that
      satisfies it, and change the status to `Verified locally` with that
      citation; or, where nothing does, leave the row as it is and say so in the
      status cell. A row raised without a citation is worse than the row it
      replaces, because it looks finished.
      Risk: R1 — `PRD.md` status cells and their citations only; no code, no test change. If a row genuinely has no evidence, writing the test is a separate entry, not this one.
      Surface: `PRD.md`, `STATUS.md`, `TASKS.md`.
      Non-scope: adding or changing tests; touching requirement text; the four `Accepted` rows and REQ-224's `Partially verified` row, which have their own owners; and any row whose status already cites its evidence.
      Primary requirement: REQ-231
      Constraints: none.
      Dependencies: none. Independent of A-265.
      Done when: each of the sixteen rows either reads `Verified locally` with the test name or recorded evidence that satisfies it, or still reads `Implemented locally` with the status cell stating that no evidence names it; no row was raised without a citation; and `STATUS.md` records how many moved and how many did not.


## Demo run 2026-09-01 — local only

A full buyer-to-operator pass against the built Worker under `wrangler dev --local`.
No remote call, no deployment, no commit.

- **Checkout, Sabah.** `88000` resolved to `Kota Kinabalu · Sabah`, `0198765432`
  normalized to `60198765432`, and the quote returned `RM 15.00` — the East
  Malaysia rate, materially different from the `RM 8.00` Kuala Lumpur returned
  earlier, so zone differentiation is real and not a single hardcoded number.
  Total `RM 54.90`.
- **Persistence.** `INV-10001` stored `shipping_cost=1500`, `total_amount=5490`
  as integer sen, `payment_method=cod`, `payment_status=unpaid`,
  `shipping_status=pending`, `shipping_queued_at=NULL`.
- **REQ-192 proven by action, not by reading.** Entering the Pengiriman queue
  from the order Aksi menu set `shipping_queued_at` and left both
  `shipping_status` and `payment_status` untouched. Queue membership and
  shipping status are genuinely independent.
- **REQ-191 taxonomy** rendered as specified: Baru 1, Menunggu 0, Masuk
  Pengiriman 0, Dalam Pengiriman 0, Selesai 0, Dikembalikan 0, Dibatalkan 0.
- **Two suspected defects were measured and dismissed rather than reported.**
  The thanks page carries two `<h1>`; the fallback sits in a `display:none`
  section, so it is out of the accessibility tree, and the page is `noindex` —
  inert. In the Pengiriman row `COD RM 54.90` appeared to overlap the address in
  a screenshot; measured, the address ends at x=677 and the amount starts at
  x=709, a 32px gap.
- **Local test data left in place**: order `INV-10001` and a rotated local admin
  credential. Neither exists anywhere but this machine's `.wrangler` state.

## Release gate

- [x] **A-235** — Index the columns the system log reads, before a busy store needs it. **Done locally 2026-09-04.** Migration `0060` adds three indexes, each leading with the timestamp its query filters on and carrying `id` as the tiebreaker the `ORDER BY` also names, so the sort is satisfied by the index rather than a temporary B-tree. Existing indexes are untouched; the ones on `payment_events` and `capi_event_outbox` serve other queries that still need them. Re-measured against a clean chain: `capi_event_outbox` and `notifications` moved from `SCAN` + `USE TEMP B-TREE FOR ORDER BY` to `SEARCH ... USING INDEX (col>?)`, and the `payment_events` join lost its scan and its sort entirely. All four reads now search an index with no temporary sort, and the live-table count is still 25. `schemaVersion` is 61.
      The check asserts the query *plans* rather than the presence of a migration file, because an index that exists but leads with the wrong column — which is exactly what `payment_events` already had — is indistinguishable from a correct one in source. It lives in `shipping-bootstrap.test.ts` beside the other clean-chain assertion and that file now applies the chain once in a `before` hook: two tests each spawning their own wrangler cost 37 seconds and raced each other into an intermittent failure, where sharing costs 21 and is stable.
      Found by auditing A-225's own delivery rather than by a failure. `GET /api/admin/system-log` issues four reads per request, filtering and ordering each source on a timestamp. Measured with `EXPLAIN QUERY PLAN` against a clean migration chain, three of the four cannot use an index:
        - `capi_event_outbox` filtered and ordered on `updated_at`: `SCAN capi_event_outbox` plus `USE TEMP B-TREE FOR ORDER BY`. Its indexes are `event_id` and `(status, next_retry_at)`; neither leads with `updated_at`.
        - `notifications` on `created_at`: `SCAN notifications` plus a temp B-tree. Its only index is the unique `(type, order_id)`.
        - `payment_events` on `received_at`: it does use `payment_events_attempt_received_idx`, but as a full `SCAN` because that index leads with `payment_attempt_id`, and it still needs a temp B-tree to order.
        - `headless_api_audit_events` is the counter-example done right: `SEARCH ... USING INDEX headless_api_audit_events_created_idx (created_at>?)`, no sort.
      This is latent, not broken. It costs nothing on a store with a hundred rows. It bites exactly when the panel matters most: `notifications` grows one row per order and is never pruned, `payment_events` grows several rows per DOKU attempt and is never pruned, and an owner opening the panel during an incident on a busy store pays three full scans. `capi_event_outbox` is the mildest, since its own retention prunes at seven and thirty days.
      Risk: R2 — one forward migration adding indexes only. No column, table, constraint, or data change, and no runtime code has to move.
      Surface: `TASKS.md`, `STATUS.md`, `BUILD-LOG.md`, `OBSERVABILITY.md`, `docs/CODE-MAP.md`, `src/db/migrations/0060_system_log_indexes.sql`, `src/lib/version.ts`, `src/lib/system-log.test.ts`.
      Non-scope: changing what the panel reads or shows; adding retention or pruning to `notifications` or `payment_events`, which is a separate decision about how long an operator's history should live; touching any existing index; reordering an existing composite.
      Primary requirement: REQ-182
      Constraints: REQ-198, REQ-201
      Dependencies: A-225 delivered. Note the ordering constraint with A-226, which also claims migration `0060`: whichever lands first takes that number and the other renumbers.
      Done when: `EXPLAIN QUERY PLAN` for all four system-log reads shows an index search and no `USE TEMP B-TREE FOR ORDER BY`, captured against a clean chain in `BUILD-LOG.md`; `schemaVersion` is bumped with the new migration; the clean chain still yields the documented live-table count; `npm run check`, `npm test`, and `npm run build` pass.

- [x] **A-236** — Answer a wrong method on a headless endpoint with JSON, not a storefront page. **Done locally 2026-09-04.** One shared `methodNotAllowed` in `src/lib/api.ts`, wired as an `ALL` export on the five endpoints that fell through: `/api/order-status`, `/api/submit-order`, `/api/meta-event`, `/api/v1/checkout` and `/api/v1/orders/status`. It carries `Allow`, which RFC 9110 requires on a 405 and which is the part that actually tells an integrator what to do differently. Verified on the running Worker: all five now answer `405 application/json` with the right `Allow`, where each previously returned the complete storefront 404 page. The supported methods are untouched — `POST` still validates, `OPTIONS` still preflights at `204`, the headless read still answers `200`, and `/produk` still renders.
      The route handlers could not be imported in a test: they pull their whole dependency graph and the raw Node runner cannot resolve the extensionless imports inside it. So the helper is unit-tested directly, and that each route exports `ALL` is enforced by the code-map check, which compares documented and exported methods in both directions. That is a better division anyway — the first version of that check only looked one way and would not have noticed a dropped handler. 463/463 tests, zero diagnostics, clean build.
      Found while auditing the running Worker. A client holding a valid API key that calls `GET /api/v1/checkout` or `GET /api/v1/orders/status` — both POST-only — receives `404 text/html`: the complete storefront not-found page, layout and all. An integrator parsing that as JSON fails obscurely, and the response is a rendered page rather than an error. The same is true of `GET` on `/api/order-status`, `/api/submit-order` and `/api/meta-event`.
      The repository already decided this is worth handling: `/api/payments/doku/status` and `/api/payments/doku/retry` each export an `ALL` handler and answer `405 application/json` with a bounded message. That pattern simply was not extended.
      **Ruled out during the same audit, recorded so it is not re-investigated:** `DELETE`, `PUT` and `PATCH` to any path answer `403 text/plain` with `Cross-site DELETE form submissions are forbidden`. That is Astro's built-in origin check rejecting a non-GET/POST request that carries no `Origin` header, it applies to every route rather than to these, and it is a security feature behaving correctly. No documented headless operation uses those methods, so nothing is blocked by it.
      Risk: R1 — adds a rejection path to endpoints that currently fall through to the 404 route. No authentication, authorization, data or business logic changes.
      Surface: `TASKS.md`, `STATUS.md`, `BUILD-LOG.md`, `STOREFRONT_INTEGRATION.md`, `docs/CODE-MAP.md`, `src/pages/api/v1/checkout.ts`, `src/pages/api/v1/orders/status.ts`, `src/pages/api/order-status.ts`, `src/pages/api/submit-order.ts`, `src/pages/api/meta-event.ts`, `src/lib/headless-api.test.ts`.
      Non-scope: changing which methods each endpoint supports; adding `OPTIONS` where it is absent; touching the `/api/admin` surface, whose 401 and 403 answers are already JSON; changing Astro's origin check or configuring `security.checkOrigin`.
      Primary requirement: REQ-182
      Constraints: REQ-201
      Dependencies: none.
      Done when: a wrong method on each named endpoint answers `405` with a JSON body and `no-store`, matching the shape `/api/payments/doku/status` already returns; the code map's Methods column lists the `ALL` handlers the way it notes them for the DOKU routes; a test covers one headless and one public endpoint; `npm run check`, `npm test` and `npm run build` pass.

- [x] **A-237** — Close the order-management authorization gap the lowest-trust role can reach today. **Demonstrated before the fix, and re-attacked after it. Done locally 2026-09-04.**
      The split is by field and by verb, not by route, because denying the route would have taken away the correction work customer service exists to do. `src/lib/auth.ts` now owns the policy beside the other role logic: `PRIVILEGED_ORDER_FIELDS` is `shipping_cost` and `payment_status` — one is money, the other is somebody asserting cash was collected — and `canDeleteOrders` keeps a permanent, stock-restoring delete with the roles that answer for the books. Deliberately still open to CS: name, phone, address, `location_id` and `shipping_status`. Changing an address still re-quotes shipping, which is the system recalculating rather than an operator naming a price.
      Re-ran the exact requests that had worked. Every one is now `403 PERMISSION_DENIED` and the order is untouched at 800/3290/unpaid: `PATCH {shipping_cost: 0}`, `PATCH {payment_status: "paid"}`, bulk `DELETE {ids:[...]}` and the single `DELETE`. The same session then corrected the customer's name, phone and address and moved the order to `processing`, all `200` — the job still works. Owner writing `shipping_cost: 900` still lands, moving the total to 3390, so the rule did not over-block.
      **The first attempt was incomplete and said it was complete; an independent review found the bypass.** Guarding `/api/admin/orders` alone left the identical money write reachable through `PATCH /api/admin/shipping`, a route customer service also holds, two clicks away in its own Pengiriman UI — which sent `shippingCost` on every save, changed or not. The rule now lives inside `resolveAdminOrderDeliveryPatch`, the helper both routes share, so a third caller inherits it instead of having to remember. `role` is a required field on that helper's input, so a caller that forgets it fails to compile rather than falling into the permissive branch — the compiler found all three call sites immediately. Re-attacked through the reviewer's exact path: customer service queued the order (200, still their job) and then got `403` on the shipping-route amount write, with the order untouched at 900/3390; the same session still set the status to `shipped` and corrected the address (200); owner writing 1200 on that route still lands and the total follows to 3690.
      **One claim in the first attempt did not survive and is withdrawn.** It said `location_id` was safe because "the system recalculates rather than an operator naming a price". The reviewer showed that an operator picks the zone, and seeded rates run 800–1200 sen peninsular against 1500–6000 sen for Sabah, so moving an order to a cheap postcode cuts the collected COD total by proxy. That is fraud by data entry rather than an authorization bypass — any role that may correct an address can do it, and blocking it would remove the work customer service exists for. The answer is an actor-attributed audit record, which is A-226, and the helper now says so where the next reader will find it.
      The browser stops offering what the server refuses, which matters because a control that fails reads as a broken page rather than a permission. As CS the order detail shows the shipping cost and payment status as read-only facts with a line saying whose decision they are, and the delete button and payment-save button are absent, while `Edit pelanggan`, the shipping-status control and the ten CRM actions remain. On the list, CS sees `Batalkan pilihan` alone where owner sees `Batalkan pilihan` and `Hapus`. In the Pengiriman dialog the amount is a read-only fact and the dialog's own description stops promising an edit it will refuse. 456/456 tests, zero diagnostics across 361 files, clean build.
      Found by an independent audit of code this session did not touch. `src/lib/auth.ts` grants `customer_service` the whole `/api/admin/orders` subtree, and that is deliberate — CS works orders. What is not deliberate is that the destructive and money-writing handlers under it check nothing. `POST /api/admin/orders/[id]` explicitly demands owner or admin for the DOKU reconcile, so the pattern exists in the same file; `PATCH /api/admin/orders/[id]`, `DELETE /api/admin/orders/[id]` and the bulk `DELETE /api/admin/orders` have no role check at all.
      Reproduced end to end against a throwaway install, signed in as a real `customer_service` operator: `PATCH /api/admin/orders/INV-10001` with `{"shipping_cost": 0}` answered `200` and moved the order from `shipping_cost` 800 and `total_amount` 3290 to 0 and 2490 — the lowest-trust role rewriting a money field. Then `DELETE /api/admin/orders` with `{"ids":[1]}` answered `200 · 1 pesanan dihapus` and the order was gone. Bulk delete accepts a list, so the same request removes a hundred orders and restores their stock.
      The fix is not to revoke the subtree — CS needs to read and work orders. It is to guard the three handlers the way the reconcile POST already is, and to decide deliberately which of them CS should keep.
      Risk: R3 — authorization on a destructive and a money-writing path, reachable today by a role an operator hands out freely.
      Surface: `PRD.md`, `TASKS.md`, `STATUS.md`, `BUILD-LOG.md`, `docs/CODE-MAP.md`, `src/lib/auth.ts`, `src/lib/auth.test.ts`, `src/pages/api/admin/orders/index.ts`, `src/pages/api/admin/orders/[id].ts`, `src/components/admin/OrdersTable.tsx`, `src/components/admin/OrderDetail.tsx`.
      Non-scope: the advertiser role, which already cannot reach this subtree; changing what an order edit does when it is authorized; the lifecycle and stock rules themselves; `/api/admin/shipping`, which needs its own read before assuming the same answer.
      Primary requirement: REQ-182
      Constraints: REQ-186, REQ-191, LOGIN-3
      Dependencies: none. The browser must also stop offering a control the server will refuse, so the two admin components are in Surface.
      Done when: a `customer_service` session receives `403 PERMISSION_DENIED` from every handler the decision says it should not reach, proven in a browser rather than only in a unit test; `auth.test.ts` pins the grant for all four roles on each verb; the affected controls are absent from the CS view rather than present and failing; `npm run check`, `npm test` and `npm run build` pass.

- [x] **A-238** — Bound the buyer-facing DOKU capability endpoints, which each spend a provider call. **Done locally 2026-09-04.** The bound sits inside the shared handler path, after `requestAccess` has resolved the order and before any provider call, so both endpoints get it and a third caller inherits it — the same placement lesson A-237 learned the hard way. Two buckets, because they stop different things: the per-order bucket is what actually protects the quota, since one order is one attempt is one provider call, and the per-address bucket stops one client sweeping the orders it happens to hold capabilities for. Retry is held far tighter than status, at 5 per ten minutes against 12 per minute, because it creates an attempt and reserves stock rather than reading. A refused caller gets `429` with `retry-after`, still `no-store` like everything else on that path. Proven with a D1-backed test: twenty consecutive polls on one order are refused partway and the provider stops being reached, rather than being called and having its answer discarded. A second test pins the fail-open behaviour without a KV binding, because a missing binding must not leave a buyer unable to recover a payment they already made. 458/458 tests, zero diagnostics, clean build.
      Found by the same audit. `POST /api/payments/doku/status` reaches `reconcileDokuPaymentStatus`, which calls `retrieveCheckout` against DOKU on every request. There is no `checkRateLimit`, no lease and no cooldown on that path, while `POST /api/submit-order` and `POST /api/v1/checkout` beside it are both limited, and the scheduled reconciler in `doku-reconciliation.ts` deliberately leases and backs off. `POST /api/payments/doku/retry` is unlimited in the same way.
      A buyer holding their own valid capability cookie can loop either endpoint and turn one order into unbounded outbound calls on the merchant's DOKU credentials. Nothing is forged and no state is corrupted; the cost is provider quota and rate-limit standing, which is the merchant's to lose.
      Risk: R2 — an outbound provider path reachable by any buyer with a legitimate cookie; no schema, credential or lifecycle change.
      Surface: `TASKS.md`, `STATUS.md`, `BUILD-LOG.md`, `OBSERVABILITY.md`, `src/pages/api/payments/doku/status.ts`, `src/pages/api/payments/doku/retry.ts`, `src/lib/doku-payment-access.ts`, `src/lib/doku-payment-access.test.ts`.
      Non-scope: `/api/payments/doku/notifications`, which is signature-gated and must stay reachable by the provider; the scheduled reconciler's existing lease and backoff; changing what a reconcile or retry does when it is allowed.
      Primary requirement: REQ-224
      Constraints: REQ-219, REQ-220, REQ-222
      Dependencies: none.
      Done when: both endpoints refuse beyond a bounded window per order and per address, returning the same shape the other rate-limited endpoints use; a buyer within the window is unaffected; a test proves the provider client is not called past the bound; `OBSERVABILITY.md` records the limit alongside the reconciler's lease.

- [x] **A-239** — Stop order deletion from restoring stock that has already left the building. **Done locally 2026-09-04.** The guard mirrors the paid-order refusal beside it rather than inventing a new shape: an order whose `shipping_status` is `shipped` or `delivered` cannot be deleted, because deleting it destroys the record of a real fulfilment and restoring its stock invents inventory that is in a customer's hands. `cancelled` and `returned` are deliberately excluded — in both the goods are back, which is exactly when restoring stock is right — and so is `pending`. Five workerd-backed D1 tests: `shipped` and `delivered` are refused with the order and the stock both intact; `pending`, `cancelled` and `returned` still delete and still restore; and a batch containing one dispatched order is refused whole rather than partially applied, since bulk delete takes a list and a half-applied batch would leave the operator guessing. 456/456 tests, zero diagnostics, clean build.
      Found by the same audit. `applyOrderLifecycleMutation` builds its stock restoration for a deletion with `requireReleasedState = false`, so the only remaining guard is `stock_restored_at IS NULL`. The paid-order guard beside it blocks `paid`, `settled` and `success`, but nothing looks at fulfilment.
      So: a COD order marked `delivered` whose operator never got round to marking it paid is deleted, and the delivered quantity is added back to `product_variants.stock`. The store then believes it holds goods that are in a customer's hands, and oversells them to someone else — a phantom-inventory bug whose first symptom is a legitimate order that cannot be fulfilled.
      Risk: R2 — stock correctness on an operator-initiated deletion; uses the existing shared restoration path, no schema change.
      Surface: `TASKS.md`, `STATUS.md`, `BUILD-LOG.md`, `ARCHITECTURE.md`, `src/lib/order-lifecycle.ts`, `src/lib/order-lifecycle.test.ts`.
      Non-scope: the terminal-transition restoration path, which is correct; changing what deletion does to the order row; adding a soft-delete; the admin shipping-status vocabulary.
      Primary requirement: REQ-198
      Constraints: REQ-192, REQ-191
      Dependencies: none. Whether a delivered order should be deletable at all is the prior question and is the user's to answer.
      Done when: deleting an order whose shipping status says the goods have shipped either restores no stock or is refused, whichever the user chooses, with a workerd-backed D1 test covering delivered, in-transit and never-shipped; the existing terminal-restoration tests still pass unchanged.

- [x] **A-240** — Enforce the accepted 24-hour DOKU return-capability lifetime. **Done locally 2026-09-07.** The capability loader now measures the matched token against that attempt's D1-owned `created_at`; it accepts the instant immediately before 24 hours and fails closed at the boundary, on an invalid timestamp, or when the timestamp is in the future. Only a still-valid historical token may resolve the order's newest retry attempt, so a later retry never renews an older URL. The callback exchange clears an expired cookie instead of reminting it, and status/retry authorization fails before rate-limit or provider work. The injected request clock now also owns retry-attempt creation, removing a pre-existing split between test/runtime clocks on this money path. One workerd-backed regression crosses the exact boundary on return/result/cancel/status/retry, records zero provider calls and no additional attempt, and the existing retry test proves that a new attempt does not extend its predecessor. Verified with 9/9 focused access tests, 60/60 DOKU tests, 464/464 full tests, zero Astro/TypeScript diagnostics, and a clean production build.
      Found by the same audit, which confirmed the token itself is sound: 256-bit HMAC-SHA256 over `attemptId:orderNumber`, compared in constant time, and exchanged for an `HttpOnly` cookie by a `303` before any HTML or script can observe it. Before A-240, that construction had no expiry.
      The token is a pure function of two immutable values, so the pre-fix loader accepted it forever and deliberately let any historical attempt's token resolve the newest. The 30-minute cookie was not a bound: whoever held the original URL could re-mint it at will. Anyone who recovered that URL later — a shared device, browser history, or a URL-logging middlebox — had permanent read access to the order's status and amount and could trigger retries. There was no rotation or revocation.
      Risk: R2 — a capability boundary on the buyer recovery path; latent, since it needs the URL to leak first.
      Surface: `TASKS.md`, `STATUS.md`, `BUILD-LOG.md`, `ARCHITECTURE.md`, `PRD.md`, `DECISIONS.md`, `src/lib/doku-checkout.ts`, `src/lib/doku-payment-access.ts`, `src/lib/doku-payment-access.test.ts`, `src/pages/payment/doku/return.astro`, `src/pages/payment/doku/result.astro`, `src/pages/payment/doku/cancel.astro`, `src/pages/api/payments/doku/status.ts`, `src/pages/api/payments/doku/retry.ts`.
      Non-scope: the signature scheme, the constant-time comparison, or the cookie exchange, all of which the audit found correct; the notification path; `/order-status`, whose token is a different mechanism and needs its own read.
      Primary requirement: REQ-222
      Constraints: REQ-219, REQ-220
      Dependencies: ADR-027.
      Done when: a return capability stops being accepted exactly 24 hours after
      its associated `payment_attempts.created_at`, regardless of cookie renewal
      or a historical attempt resolving to a newer one; expiry is verified
      server-side before any DOKU call; a buyer inside the window is unaffected;
      and a test proves an expired token is refused on status, retry, return,
      result, and cancel without provider traffic or a new order/attempt.

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
