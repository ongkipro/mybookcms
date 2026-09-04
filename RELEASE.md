# MyBookCMS Release Guide

> Verified against disk: 2026-09-04 @ MyBookCMS working tree

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

## Additional gates for a DOKU-enabled release

A-210–A-219 and A-221R satisfy the local schema, transport, lifecycle, recovery,
reconciliation, admin/buyer, and Ads portions of these gates. A-220 adds the
accepted bilingual disclosure and local release controls. These do not prove
DOKU sandbox or production interoperability; approved A-221 sandbox evidence
must pass before production preparation.

1. The complete forward migration chain provisions provider configuration,
   unique payment attempts, and deduplicated payment events without plaintext
   secret or raw-payload columns.
2. Official-vector tests prove Global request/notification signatures over
   exact raw bytes, timestamp/target binding, replay refusal, MYR/amount
   validation, per-endpoint API versions, and rejection of Cards-only schemes.
   Checkout create/retrieve verifies any present response signature and accepts
   an absent signature only under REQ-227's fixed-origin, exact-envelope, and
   D1-correlation profile.
3. Workerd-backed tests prove duplicate create/notification/reconciliation,
   out-of-order and unknown states, success, failure, expiry, retry, and stock
   restoration converge without duplicate order, charge attempt, stock change,
   or terminal-state revival.
4. Approved sandbox evidence covers hosted FPX/e-wallet/card checkout,
   strictly validated and exactly correlated status retrieval, signed webhook
   registration/retry, cancel/return/recovery, bounded
   scheduled reconciliation, and redacted operator diagnostics.
5. Chromium at 390 and 1280 px covers the canonical full checkout, safe external
   redirect explanation, pending/cancel/failure/expiry/retry/success states,
   keyboard/accessibility behavior, zero overflow, and no secret/PII response.
6. Ads evidence proves DOKU initiation/pending/failure emits no Purchase,
   authoritative success emits exactly one canonical browser/server Purchase,
   and COD/manual timing is unchanged.
7. The operator accepts the required Malay/English DOKU payment/privacy
   disclosure and verifies it is linked beside the conditional DOKU email field
   before any DOKU-bound personal or payment data is submitted. This gate does
   not accept proposed REQ-211/REQ-212.
8. Production credentials, production webhook registration, remote migration,
   deployment, and live payment remain separate explicit approval actions after
   sandbox passes; no sandbox credential or state is promoted implicitly.
9. A-222 records the exact approved production activation and bounded live smoke
   evidence; A-223 records the observation window and keep-enabled or
   disable/rollback decision. Neither is implied by sandbox approval.

### DOKU evidence matrix

Every row must be recorded against the exact revision and environment. A local
mock PASS cannot fill a sandbox cell, and sandbox cannot fill production.

| Gate | Local evidence required | Sandbox evidence required before A-222 | Production evidence required before keep-enabled |
| --- | --- | --- | --- |
| Signature and target | Official-vector request and raw-notification signatures pass; Checkout responses verify a present signature or satisfy REQ-227; malformed/freshness/target/Card-shape cases fail closed | Signed requests receive create/retrieve responses that satisfy the observed DOKU envelope; any present invalid signature is refused without state change | Valid signed notification and exactly correlated retrieve for the approved smoke; no raw signature/body retained |
| Duplicate and idempotency | Same submit, notification, reconciliation, and result loads converge | Provider resend plus repeated create/retrieve leaves one order/attempt and one terminal transition | Repeat notification/reload creates no duplicate order, stock, or Purchase |
| Success | Authenticated provider success marks one eligible order paid | One approved sandbox success reaches paid through signed notification or exactly correlated retrieve | One separately approved bounded live payment reaches paid |
| Pending | Pending remains nonterminal and schedules bounded reconciliation | Hosted return while pending renders recovery without Purchase | No fulfilment or Purchase before provider-authoritative paid |
| Failure | Failure is terminal, emits no Purchase, and restores stock once when eligible | One provider failure is visible in buyer/admin recovery | Failed smoke, if encountered, remains terminal and COD/manual stay usable |
| Expiry/cancel | Expiry/cancel recovery and uninitiated deadline restore stock once | Hosted cancel/expiry and provider truth converge | Expired/cancelled attempt does not block rollback or leak stock |
| Retry | Stable submit intent and eligible same-order retry do not create a new order | Retry opens only an eligible replacement hosted session | No operator retry outside the approved idempotent path |
| Stock/order | D1 transaction tests cover reserve, paid, release, downgrade/revival refusal | Before/after stock and order state match the provider outcome | Smoke stock/order facts match and rollback criteria are evaluated |
| Ads | DOKU initiation/pending/failure are silent; paid owns one Meta/Google Purchase; COD/manual timing is unchanged | Test sinks observe exactly one paid Purchase and no live Ads request unless separately approved | Approved Ads validation observes one canonical Purchase without replaying payment |
| Browser and privacy | Chromium 390/1280 covers full checkout, disclosure link, redirect, recovery, accessibility, and no secret/PII leakage | Real hosted flow covers enabled channels, return/cancel/result, mobile/desktop, and redacted diagnostics | Bounded smoke checks the same critical path on the approved domain |
| Operations | Redacted health/history, bounded schedule, manual lease/cooldown, and no generic DOKU status edit | HTTP Notification log/resend and local correlation are recorded without payloads | Observation window evaluates overdue, attention, duplicate, stock, and Ads conditions |

The A-221 record must name which allowlisted channels were actually proven:
FPX, Touch 'n Go eWallet, GrabPay, ShopeePay, and/or credit/debit card. Unproven
channels remain disabled even if DOKU lists them for the account.

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

For an approved DOKU release, insert these steps after the base smoke test:

1. Confirm the operator accepted the exact Malay/English DOKU disclosure and the
   checkout link reaches it before DOKU submission.
2. Confirm the enabled revision uses the intended environment and only
   sandbox-proven channels; masks and health may be recorded, values may not.
3. Register the exact admin-generated HTTPS notification URL using the procedure
   in `INSTALLATION.md`, then prove signed notification and bounded resend.
4. Execute only the separately approved sandbox or production cases from the
   evidence matrix. Keep COD/manual transfer available throughout.
5. Record rollback triggers before enabling traffic: invalid config/signature,
   unresolved `attention_required`, stock divergence, duplicate Purchase, or a
   buyer path that cannot recover. Disabling DOKU stops new hosted attempts but
   does not erase existing records or authorize a database rollback.

## Rollback

Code can be redeployed to the preceding approved revision when compatible with
the migrated schema. Database migrations are forward-only: correct a migration
with a new migration rather than a destructive rollback. Record the target,
revision, checks, migration state, and observed result in the install's release
evidence.
