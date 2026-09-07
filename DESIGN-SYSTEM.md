# MyBookCMS Design System

> Verified against disk: 2026-09-07 @ MyBookCMS working tree

## Product surfaces

MyBookCMS has two deliberately separate presentation layers:

- The public storefront is a restrained, product-first 480 px reading column
  using Malay or English and MYR.
- The operator admin is a clean-light, data-dense workspace using Indonesian
  with English technical labels where useful.

Storefront styles must not leak into admin routes. Checkout owns
`src/styles/form-hybrid.css`; admin routes own `src/styles/admin.css`; shared
public primitives live in `src/styles/foundation.css` and
`src/styles/storefront.css`.

## Storefront tokens

| Role | Value |
| --- | --- |
| Ink | `#111111` |
| Muted text | `#555555` / `#767676` |
| Border | `#E5E5E5` |
| Warm canvas | `#F8F7F4` |
| Surface | `#FFFFFF` |
| Accent | `#C5A880` |
| Error | `#B42318` |

Inter is the primary UI face. Cinzel is reserved for the approved brand mark;
it is not a body or admin font. `foundation.css` ships Inter 400, 600, and 700
and Cinzel 700 only. Do not reference a weight that is not imported there: the
browser will synthesise it and the mark will not match the brand.

Public controls use square geometry, visible focus outlines, a minimum 44 px
interactive height, semantic HTML, and reduced-motion-safe transitions. Prices
must use the shared MYR formatter rather than handwritten symbols or separators.

## Admin system

The admin uses the semantic variables and Tailwind bridge in
`src/styles/admin.css` plus the existing shadcn components.

Muted text depends on what it sits on, and the two are not interchangeable.
`slate-500` (`#62748e`) measures 4.76 against a white card and passes the 4.5 AA
floor; on the admin page background (`#f5f6f8`) it measures 4.41 and fails.
Muted text placed directly on the page background uses `slate-600`, which gives
7.01 there. Written down because the failing pair looks identical in source and
only a measurement tells them apart.

Prefer:

- one page title and one concise operational description;
- KPI cards only for actionable totals;
- cards and tables with clear borders instead of decorative gradients;
- controls labelled by the business action and current state;
- stacked phone layouts, with wide tables placed in intentional horizontal
  scroll containers when they cannot collapse safely.

Shared admin switches reserve a real 44 × 44 CSS px interactive box at both
`default` and `sm` sizes. Their centred visual tracks remain 32 × 18.4 px and
24 × 14 px respectively. The hit area must not protrude into neighbouring
inputs or actions; an overflowing pseudo-element is not a substitute for
reserved layout space. Radix `data-state` controls track colour and thumb
position. Keep keyboard focus visible around the interactive box.

Do not introduce a second component library, a separate color vocabulary, or a
provider brand as a system accent.

Payment settings keep DOKU configuration and manual-payment management in
separate vertically stacked cards. Secret fields never provide a reveal
control or prefill stored values; stored credentials appear only as masks.
Environment, activation, health, and configuration revision are named with
text rather than colour alone. Production activation and destructive actions
require explicit confirmation, while the manual-payment workflow remains
available independently.

## Images

Product images use a square crop on catalogue cards and the native scroll-snap
gallery on product detail pages. Every image requires explicit dimensions and a
descriptive alt string. The first product-detail image is eager/high-priority;
below-the-fold images may be lazy. Uploaded catalogue derivatives use the
`-sm` convention resolved by `cardImageSrc`.

## Measured admin shell contrast

Verified in the 2026-09-07 A-234 browser audit: sidebar section labels use
`text-slate-600` (rendered #45556c) on #f9fafc, 7.26:1. Active sidebar links use
`text-blue-700` (rendered #1447e6) on the existing blended accent background
(approximately #eaeffb), 5.95:1. Keyboard hints and mobile-menu headings use
slate-600 on white, 7.58:1. Both normal and restricted sidebar branches follow
these pairs. Preserve compact typography and backgrounds; do not restore
slate-400 text or the failing blue-600 active foreground.

## Responsive and accessibility acceptance

Browser-visible changes are checked at approximately 390 px and 1280 px.
Acceptance requires:

- page overflow delta of at most 1 CSS px;
- no clipped labels, totals, actions, or dialogs;
- keyboard-reachable controls with visible focus;
- accessible names and state for toggles, radios, dialogs, and menus;
- meaningful loading, empty, error, disabled, and success states for changed
  interactions.

Static checks and screenshots alone do not prove interaction. Run the real page
through the local Cloudflare/D1 development runtime for data-backed flows.
