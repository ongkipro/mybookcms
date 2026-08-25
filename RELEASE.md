# MyBookCMS Release Guide

> Verified against disk: 2026-08-24 @ MyBookCMS working tree

This product repository has no deployment target. A release is a reviewed
product revision that an individual install may adopt after its own approval.

## Required release gates

1. `npm run check`, `npm test`, and `npm run build` pass on the exact revision.
2. A clean local D1 migration applies the complete chain and validates Malaysia
   postcode zones, exact weight bands, state-first resolution, broad-zone
   fallback, and preservation of accepted historical quote snapshots.
3. Public browser flows are observed in the single `ms-MY` hybrid presentation,
   including COD and manual bank transfer, legal pages, confirmation, and
   capability-scoped order status.
4. Admin evidence covers rate configuration, local Pengiriman queue entry and
   removal, filtered CSV export, and manual fulfilment without a network request
   to a courier or payment service.
5. Public destination-search evidence covers loading, empty, failed/retry,
   keyboard selection, selected summary, and change/refocus states at desktop
   and mobile widths without horizontal overflow.
6. No live resource, secret, domain, or deployment action occurs without
   install-owner approval.
7. Ads evidence covers role authorization, empty/configured rendering, strict ID
   validation, masked CAPI state, thanks-page Purchase timing, CAPI deduplication, MYR
   value, Malaysia identity normalization, the shared Google/Meta XML feed,
   canonical variant/landing-page matching, and the explicit absence of Google
   offline upload or Merchant API calls.
8. Catalog evidence confirms that Google and Meta admin pages expose the same
   canonical URL; only published active in-stock variants appear; integer sen is
   formatted as MYR; XML is well-formed; and each target platform separately
   configures Malaysia shipping and a compatible hybrid-content language before
   any scheduled fetch.
9. Public advertising evidence covers PDP plus CMS/native landing ViewContent,
   shared checkout InitiateCheckout, and capability-verified thanks-page Purchase
   for both COD and manual transfer using one canonical variant ID and order
   number. A fixture with a different product subtotal, shipping amount, and payable
   total must prove that signal value equals the persisted merchandise subtotal
   and excludes every order-level fee.

## Deployment sequence for an approved install

1. Confirm the target Worker, D1, KV, R2, and domain are the install's own.
2. Back up or otherwise protect data according to the install owner's policy.
3. Review new forward migrations and apply them to the target database.
4. Deploy the approved revision.
5. Smoke-test login, hybrid storefront copy, catalog, shipping
   quote, COD, manual transfer, order visibility, and safe public fulfilment
   status.
6. When the install has approved vendor credentials, validate Meta Test Events
   and Google Tag Assistant without exposing secrets in logs or screenshots.
7. If the install elects to use Google Merchant Center and/or Meta Commerce
   Manager, configure shipping and target-language policy in each platform,
   submit the same public feed URL, and record platform-side diagnostics
   separately from CMS-local feed evidence.

## Rollback

Code can be redeployed to the preceding approved revision when compatible with
the migrated schema. Database migrations are forward-only: correct a migration
with a new migration rather than a destructive rollback. Record the target,
revision, checks, migration state, and observed result in the install's release
evidence.
