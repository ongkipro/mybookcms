# MyBookCMS Status

> Verified against disk: 2026-08-25 @ MyBookCMS working tree

## Current state

The Malaysia cutover is locally integrated. Active runtime money is MYR integer
sen; checkout supports COD/manual transfer; D1 owns Malaysia postcode/weight
shipping; Pengiriman is manual; the storefront uses one controlled Malaysia
hybrid voice; and inherited external logistics, automatic payment, TikTok, and
Indonesian address runtime paths are removed. Meta Pixel/CAPI and Google GTM/Ads
configuration are restored, together with one read-only Google
Merchant-compatible catalog URL shared by Google and Meta.

No remote D1 migration or deployment has been performed for this install.
Therefore no hosted or production behaviour is claimed.

## Verified local evidence

- Local D1 is at schema version 56 with 2,931 official Malaysia postcode rows,
  16 active state/WP first-kilogram reference rates and five weight bands in
  each of four broad fallback zones. Obsolete
  provider/ad/payment tables are absent.
- Preview data contains three fictional products with one published hybrid
  Malaysia presentation, one fictional Maybank account, editable reference
  rates, two COD orders, and one manual-transfer order.
- Runtime search resolves city, state, or exact postcode from local D1. Quotes
  prefer a matching state/WP rule and otherwise use the matching zone weight
  band. Reference rates for 1–5 kg are RM8/9/10/11/12 in Peninsular Malaysia
  and RM15/26/39/48/60 in Sabah, Sarawak, and Labuan.
- Dashboard data contains three active orders worth RM94.70; unfiltered order
  listing returns `200` and uses MYR metadata.
- `npm test`: 298 tests, 297 passed, 0 failed, 1 intentionally skipped.
- `npm run check`: 303 files, 0 errors, 0 warnings, 0 hints.
- `npm run build`: Cloudflare server build completed.
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

- The executable tree contains 361 TypeScript, TSX, Astro, CSS, and SQL source
  files (49,536 lines), including 96 page/route files, 38 API handlers, 56
  forward-only migrations, 63 Node test files, 41 React components, and 19
  Astro components.
- The runtime boundary is coherent: Astro 7 SSR on Cloudflare Workers, D1 as
  commerce authority, KV for sessions and bounded counters, R2 for merchant
  media, one Malaysia store per install, MYR integer sen, and no external
  payment or logistics dependency.
- `npm test` passed 297 of 298 tests with one intentional skip. Node's
  experimental coverage report measured 82.47% lines, 73.80% branches, and
  83.37% functions among modules loaded by the suite.
- `npm run check` reported 303 files with zero errors, warnings, or hints.
  `npm run build` completed the Cloudflare server bundle.
- A clean isolated D1 accepted all 56 migrations and contained 2,931 Malaysia
  postcode rows. The existing local D1 also reports schema version 56, one
  installed store, 2,931 postcode rows, and 36 active shipping-rate rows.
- `npm audit` reported zero known advisories across the complete lockfile and
  the production-only graph.
- `wrangler deploy --dry-run` validated the redirected Astro deployment config:
  194 Worker modules, 8,974.66 KiB uncompressed and 1,670.49 KiB gzip.
  `wrangler check startup` measured 41.4 ms active local startup CPU, including
  1.1 ms garbage collection. These are local measurements, not production
  latency claims.
- Real Chromium against the local Worker rendered the storefront at 1280 px and
  the product/checkout route at 390 px with zero root overflow, failed requests,
  or console errors. The checkout island normalized a Malaysia phone and
  advanced its disabled action from the name step to the location step. An
  unauthenticated `/admin/dashboard` request redirected to `/hello`.

### Prioritized findings

| Priority | Finding | Evidence and impact | Closure evidence |
| --- | --- | --- | --- |
| P1 — release blocker | The repository has no Git `HEAD`, tracked files, or remote. | `git rev-parse --verify HEAD` fails, `git remote -v` is empty, and every project file is untracked. Hosted CI, reviewable change history, rollback provenance, and reproducible release evidence therefore do not exist yet. | Establish the intended repository baseline and remote, then observe the committed `CI` workflow pass on that exact revision. Commit/push remain operator actions. |
| P1 — advertising reliability | The Meta CAPI outbox has retry timestamps but no independent clock. | `src/worker.ts` exports only `fetch`; `wrangler.jsonc` declares no scheduled trigger; the only `drainCapiOutbox` caller is `src/pages/api/meta-event.ts`. A retryable event is revisited only after a later Meta event reaches that route, so the final event before a quiet period or outage can remain pending indefinitely. Retention pruning has the same dependency. | Add one approved scheduled or queue-owned drain path and prove a due event retries without a new browser event, concurrent drains retain the lease invariant, and delivered/failed retention runs on schedule. |
| P1 — commerce regression evidence | The suite does not execute the authoritative D1 order write and only partially executes lifecycle mutation code. | Coverage reports `src/lib/order-persistence.ts` at 22.45% lines and 0% functions, `order-lifecycle.ts` at 41.96% lines/33.33% functions, and no test references `persistOrder` or `allocateOrderNumber`. Pricing, duplicate submission, order/item atomicity, stock decrement, oversell rejection, restoration, and deletion are load-bearing money/stock invariants. Clean migrations do not prove those transitions. | Add an isolated D1 behavioral check that creates concurrent/duplicate orders, proves authoritative price and stock, rejects oversell without partial rows, and proves terminal transition/deletion restores stock exactly once. |
| P2 — upload boundary | Two authenticated image-upload conventions enforce different trust controls. | `src/pages/api/admin/upload-r2.ts` limits files to 2 MB, verifies signatures, and applies a KV hourly limit. `src/pages/api/admin/media.ts` accepts 5 MB based on browser-supplied MIME only, reads the full multipart body before validation, and has no abuse limit. Both are reachable by the advertiser role. Same-origin delivery uses `nosniff`, reducing script-execution risk, but a compromised or malicious operator can still store malformed content or consume R2/Worker resources through the weaker route. | Cut over both callers to one upload boundary with an early body cap, signature validation, generated keys, and one shared abuse policy; prove malformed, oversized, and over-limit uploads are rejected. |
| P2 — CI supply chain | The dormant CI workflow does not declare token permissions and uses mutable action tags. | `.github/workflows/ci.yml` uses `actions/checkout@v4` and `actions/setup-node@v4` and has no `permissions` block. The workflow performs verification only and receives no project secrets, which limits impact, but action compromise inherits the repository's configured default `GITHUB_TOKEN` authority. | Set explicit read-only token permissions, pin each external action to a reviewed full commit SHA, and observe the workflow on the established remote. |
| P3 — platform drift | Worker bindings are hand-maintained and the entrypoint hides an adapter type mismatch with a double cast. | `src/env.d.ts` manually defines `CloudflareRuntimeEnv`; `src/worker.ts` casts `request as unknown as AstroRequest`; CI does not run `wrangler types --check`. Build and dry-run pass now, but config/binding drift can reach deployment before TypeScript detects it. | Generate bindings from the canonical Wrangler config, remove redundant hand-written binding declarations where compatible with Astro, and make generated-type drift a CI failure. |
| P3 — diagnostic signal | Expected failure-path tests print production-style errors and stack traces during a green run. | `npm test` passes, but intentionally failing D1/catalog/template cases emit `console.error` output. This makes a successful CI log resemble a runtime incident and can obscure a new unexpected error. | Capture/assert expected logs in those tests and leave unexpected console errors visible and failing. |

No confirmed unauthenticated admin bypass, attacker-controlled SQL
interpolation sink, or known dependency advisory was found. That statement is
bounded to inspected trust boundaries, the local Worker/D1 runtime, and the
commands above; it is not a production penetration-test claim.

## Open delivery evidence

- Remote migration, hosted CI, deployment, and production smoke checks require
  separate approval and have not been performed.

`TASKS.md` is the canonical execution queue. `BUILD-LOG.md` is historical
evidence, not a statement of current behaviour.
