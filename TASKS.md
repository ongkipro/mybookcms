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
