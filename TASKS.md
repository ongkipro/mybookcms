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

Ordered. `G-1` blocks nothing technically but is the only task with a live
external consequence, so it is listed first and stops for the user.

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
      Note for whoever runs this: making the repository public also makes `DEFAULT_ADMIN_PASSWORD_HASH` and the documented `admin`/`admin` first-run behaviour publicly readable. That is already mitigated by `LOGIN-3`, but it becomes trivially discoverable. It also unblocks GitHub Actions, which has never run here — see `A-204`.

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

- [ ] **A-204** — Get hosted CI to actually run. **Blocked externally; not a code defect.**
      Both CI runs on `main` failed in about four seconds with `The job was not started because recent account payments have failed or your spending limit needs to be increased`. No job has ever executed, so no green CI has ever existed for this repository and local verification is the only real evidence. Nothing in `ci.yml` is wrong; it is verification-only and deploys nothing.
      Risk: R0 for the repository; the blocker is account billing and is the user's to clear.
      Surface: `.github/workflows/ci.yml` only if a real defect is found after runs start.
      Non-scope: adding a deploy step; moving CI to another provider; disabling checks to make the badge green.
      Primary requirement: REQ-200
      Constraints: none
      Dependencies: none — but note `G-1` would resolve it incidentally, since public repositories get free Actions minutes.
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
      Done when: after explicit approval, an isolated sandbox install records redacted evidence for signed create/retrieve requests and REQ-227-compliant responses, enabled Malaysia channels, correct hosted redirect, valid signed notification, duplicate delivery, success, pending, failure, expiry/cancel, eligible retry, bounded reconciliation, stock invariants, operator diagnostics, Ads single-Purchase behavior, desktop/mobile buyer recovery, and zero secret/PII leakage; production remains disabled.
      Blocked evidence 2026-09-02: the operator approved A-221 sandbox vendor traffic. Managed credentials were injected into one child process without revealing values, and the current official Malaysia contract was rechecked before use. A signed FPX-only `POST /v3/checkouts` with fictional data reached DOKU sandbox validation, but the supplied account rejected `MYR` with `currency_not_support`; the unsigned `400` was fail-closed by the adapter as `DOKU_RESPONSE_HEADERS`. The official OpenAPI currently advertises checkout language `MY`, while sandbox rejected it and accepted the runtime's `MS` far enough to evaluate currency. No checkout was created, so retrieve, hosted browser, payment states, notification/resend, reconciliation, stock, and Ads cells remain unproven. No dashboard login credential is available to enable the required account/channel capability or register a webhook, and registering a replacement account requires operator-owned email/password and Terms acceptance. No local/remote D1 state, webhook, deployment, production resource, order, charge, secret, or real customer data was created or changed. Resume only after a sandbox account accepts `MYR` and its dashboard access is available for channel/webhook configuration.
      Resumed evidence 2026-09-02: after the operator replaced the managed sandbox credential set, DOKU accepted signed fictional FPX-only MYR Checkout requests. Sandbox enforces a MYR 2.00 minimum; create and immediate retrieve then both returned `200`, matching merchant ID, MYR 2.00, and pending/initiate facts, and create returned an allowlisted DOKU-hosted URL shape. Neither successful response carried a `Signature` header, although Client ID, response timestamp, and API version were present; a separate response-header inventory found no alternate signature header. Current official artifacts conflict: the endpoint OpenAPI models empty response headers and the DOKU Malaysia Postman Checkout requests contain no response-signature assertion, while the generic Global integrity guide says DOKU signs responses. The shared adapter therefore failed closed as `DOKU_RESPONSE_HEADERS` before returning or persisting the hosted URL. This conflicts with accepted REQ-218/REQ-219 and the current A-221 signed-response gate; changing that integrity contract or its source surface requires a separate explicit decision. No local D1 order/attempt, browser redirect, payment completion, webhook, Ads event, deployment, production resource, secret value, or real customer data was created or changed. A-221 remains open.
      Remediation evidence 2026-09-02: accepted REQ-227, ADR-022, and completed A-221R resolve the create/retrieve response-contract blocker with the endpoint-specific profile proven above. A-221 remains open: dashboard channel/webhook setup, hosted browser payment states, notification/resend, retry, stock, operator diagnostics, and Ads/browser evidence have not been exercised, and only FPX create/retrieve transport is proven. Production remains disabled.
      Hosted-browser evidence 2026-09-02: an additional fictional FPX-only sandbox create returned an allowlisted hosted URL, and local headless Chrome reached a non-error DOKU document shell without exposing the URL or provider identity. The shell contained no rendered payment control or channel label; a second bounded run with additional virtual render time timed out without a DOM. This is reachability evidence only, not proof that FPX was rendered or payable. No buyer interaction, payment outcome, callback, notification, local D1 state, Ads event, dashboard mutation, webhook, production action, credential/PII disclosure, commit, or push occurred. Resume needs DOKU Dashboard access for channel/webhook configuration and an operator-observable sandbox payment flow.

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

- [ ] **A-226** — Record privileged admin mutations and scheduler failures as append-only system events. **Blocked until REQ-230 is accepted. Do not start from this entry while its PRD row reads `Proposal`.**
      Today a store-settings save, a payment configuration revision, an Ads credential save, an API key issue or revoke, an operator role or password change, and a login lockout leave no D1 record naming who did it and when; a scheduler failure leaves only a Worker log. A-225 cannot show what was never written. This task adds migration `0060_system_events.sql`, one append-only table with actor, source, label, severity, safe correlation id, redacted detail JSON, and `occurred_at`; writes a row inside the same D1 batch as each privileged mutation it names; writes best-effort rows for scheduler-level failures; prunes rows older than 90 days from the existing one-minute schedule; and makes the A-225 panel read it as one more source.
      Risk: R3 — new schema, a write on every privileged admin path, and a retention job; touches the same handlers as credentials, payment configuration, and API keys.
      Surface: `PRD.md`, `TASKS.md`, `STATUS.md`, `BUILD-LOG.md`, `OBSERVABILITY.md`, `ARCHITECTURE.md`, `docs/CODE-MAP.md`, `src/db/migrations/0060_system_events.sql`, `src/lib/version.ts`, `src/lib/system-events.ts`, `src/lib/system-events.test.ts`, `src/lib/system-log.ts`, `src/lib/system-log.test.ts`, `src/worker.ts`, `src/pages/api/admin/settings.ts`, `src/pages/api/admin/payments.ts`, `src/pages/api/admin/ads.ts`, `src/pages/api/admin/settings/developer.ts`, `src/pages/api/admin/access.ts`, `src/pages/api/admin/profile.ts`, `src/pages/hello.astro`.
      Non-scope: recording buyer or storefront traffic; recording order edits, whose rows already carry their lifecycle; placing a value, secret, token, password hash, or customer field in `detail`; any UI beyond what A-225 renders; export; alerting; editing or deleting an event through any API; changing any mutation's authorization or validation.
      Primary requirement: REQ-230
      Constraints: REQ-182, REQ-197, REQ-198, REQ-201, REQ-217, LOGIN-3
      Dependencies: A-225 delivered; REQ-230 accepted by the user; independent Opus review plus delivery-ledger approval, as for every R3 change.
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

- [ ] **A-232** — Decide and finish the COD availability control, which is currently wired at one end only.
      Found by A-228. `stores.is_cod_enabled` exists from migration `0032` (`payment_method_toggles`) and defaults to `1`. Exactly one runtime line reads it — `GET /api/payment-methods`, which hides COD from the hosted form when it is `0`. Nothing writes it: no admin API accepts it and the Payments workspace states `COD tetap tersedia`. Nothing enforces it: `orderSubmitSchema` early-returns on `payment_method === 'cod'` without a check, and neither `POST /api/submit-order`, `POST /api/v1/checkout`, nor `persistOrder` consults the column. So the control is presentation-only. It is latent today precisely because the operator cannot reach it, but the moment a toggle is added — or the column is set directly in D1 — hiding the option in one form becomes the only thing standing between a disabled method and a persisted COD order, which contradicts the repository's own rule that browser input is never authority. `manual_transfer` is the counter-example done right: `persistOrder` requires an active seller bank account and refuses without one. Either wire COD the same way end to end, or remove the read and the column claim so nothing suggests a control that does not exist.
      **Reproduced locally 2026-09-04**, so this is demonstrated rather than inferred. Against a throwaway install with `UPDATE stores SET is_cod_enabled = 0`, both read surfaces correctly reported COD as unavailable — `GET /api/v1/storefront` returned `cod_enabled: false` with `supported_methods: ["manual_transfer", "doku"]`, and `GET /api/payment-methods` returned COD with `is_active: false`. `POST /api/submit-order` with `payment_method: "cod"` and the server's own quote then answered `success: true` and persisted order `INV-10001` as `payment_method: "cod"`, `payment_status: "unpaid"`. The control is presentation-only end to end. It remains latent in shipped installs only because no admin surface writes the column, so reaching this state needs a direct D1 write.
      Risk: R2 — order acceptance policy on both submission paths; no schema change if the enforcement route is chosen, one forward migration if the removal route is.
      Surface: `PRD.md`, `TASKS.md`, `STATUS.md`, `BUILD-LOG.md`, `ARCHITECTURE.md`, `docs/CODE-MAP.md`, `src/lib/order-persistence.ts`, `src/lib/order-persistence.test.ts`, `src/lib/order-schema.ts`, `src/lib/order-schema.test.ts`, `src/pages/api/admin/settings.ts`, `src/pages/api/payment-methods.ts`, `src/pages/admin/payments.astro`.
      Non-scope: the headless read contract (A-231); DOKU channel enablement, which has its own revision-bound control; changing manual-transfer or DOKU validation; adding a per-product or per-zone COD rule.
      Primary requirement: REQ-182
      Constraints: REQ-190, REQ-198, REQ-223
      Dependencies: none. The choice between enforcing and removing is the user's; prepare both and report before writing either.
      Done when: the chosen direction is recorded in `DECISIONS.md`. If enforced: a disabled COD store refuses `payment_method: "cod"` on both `POST /api/submit-order` and `POST /api/v1/checkout` before any order row, item, stock decrement, or advertising event is written, with a test proving no partial state; an owner/admin control writes the column; the hosted form and the headless read agree with the server. If removed: a forward migration drops the column, the read in `GET /api/payment-methods` goes with it, and no document continues to describe a COD toggle.

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

- [ ] **A-234** — Decide whether the admin switch meets the 44 px target the design system asks for.
      Found while taking A-224's browser evidence. `DESIGN-SYSTEM.md` requires a minimum 44 px interactive height across the admin. The shared `src/components/ui/switch.tsx` renders an 18 px by 32 px control and expands its hit area with an `after:-inset-x-3 after:-inset-y-2` pseudo-element. Measured with `elementFromPoint` at 390 px, the effective target is 33 px by 53 px: wider than the floor, and 11 px short of it vertically. This predates A-224 and is not specific to the shipping workspace — every switch in the admin inherits it, including the ones on Order Management and Payments. Either widen the pseudo-element to reach 44 px, or record in `DESIGN-SYSTEM.md` that a switch is a deliberate exception with its measured target, so the next reviewer is not left measuring it again.
      Risk: R2 — a shared primitive rendered on every admin workspace; visual and touch behaviour only, no data, authorization, or API change.
      Surface: `TASKS.md`, `STATUS.md`, `BUILD-LOG.md`, `DESIGN-SYSTEM.md`, `src/components/ui/switch.tsx`, `src/lib/mobile-layout-guard.test.ts`.
      Non-scope: resizing any other control; changing switch semantics, labels, or the immediate-write behaviour of the switches that have it; a design-system-wide spacing revision.
      Primary requirement: REQ-182
      Constraints: REQ-186, REQ-196
      Dependencies: none. Widening a hit area changes spacing on every admin list, so this wants a designer look before the first visual edit.
      Done when: either every admin switch measures at least 44 px on its shortest axis by `elementFromPoint` at 390 px with no new page overflow on Order Management, Pengiriman, Payments and Tarif Malaysia, or `DESIGN-SYSTEM.md` states the exception and its measured target and a check pins the measurement. Run `npm run check`, `npm test`, and real-browser evidence at 390 px and 1280 px.

- [ ] **A-229** — Produce executable and independent-review evidence for the exact HEAD the next release would ship.
      `MYS-5` needs one revision on which migrations, check, test, and build all pass before the owner approves it, and nothing in the queue produces that evidence on demand. The last recorded full run, 410/410 on 2026-09-01, predates `a5bc700`. This task is the validation gate: it runs the whole local suite against the clean chain on the exact revision, re-runs browser evidence for every surface changed since the last recorded run, obtains an independent correctness and security review of the cumulative diff, and records all of it so `MYS-5` can name one hash.
      Risk: R1 — read, run, review, and record. A failing check becomes its own queue entry, never a fix under this task.
      Surface: `TASKS.md`, `STATUS.md`, `BUILD-LOG.md`, `RELEASE.md`, `.delivery/` through the delivery-ledger tool.
      Non-scope: any `src/` or migration edit; deployment; remote D1; DOKU sandbox traffic (A-221); approving the release (MYS-5).
      Primary requirement: REQ-182
      Constraints: REQ-198, REQ-200, REQ-201
      Dependencies: A-224, A-225, A-227, and A-228 delivered or explicitly deferred by the user, so the evidence covers the set that ships.
      Done when: on the recorded hash, `wrangler d1 migrations apply OMS_DB --local` against an empty database, `npm run check`, `npm test`, and `npm run build` all pass with their output digests in `BUILD-LOG.md`; authenticated browser evidence at 390 px and 1280 px exists for each admin and storefront surface edited since the previous recorded run, with no console or failed-request errors; an independent reviewer records PASS on the cumulative diff at the same hash; `STATUS.md` names the hash as the current verified revision; the ledger checkpoint points at it.

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
