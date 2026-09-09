# MyBookCMS Observability

> Verified against disk: 2026-09-04 @ MyBookCMS working tree

Operational logs must help an operator decide whether a Malaysia store can
accept, fulfil, or investigate an order without exposing customer data or
secrets.

## Required signals

- Authentication: failed login, rate limiting, session rejection, and access
  denial without credentials or cookie values.
- Checkout: validation refusal, price/stock mismatch, invalid postcode, missing
  shipping band, duplicate submission, and order persistence failure.
- Operations: manual bank-transfer review, stock restoration, local fulfilment
  transition, and tracking update.
- Advertising: configuration refusal, transactional CAPI enqueue,
  immediate/scheduled delivery, retry/terminal failure, deduplicated Purchase
  eligibility, and safe merchandise-value source without raw tokens, customer
  identity, shipping, or fee detail.

## Event fields

Use a stable surface label, severity, safe order identifier where applicable,
and correlation/request identifier when available. Do not log passwords,
session tokens, API keys, payment account numbers, complete addresses, or raw
customer contact information. Advertising logs may contain the safe event name
and order number, but never access tokens, click IDs, unhashed matching fields,
or complete vendor payloads.

## Emitted signal registry

Every stable surface label this repository emits from production code, resolved
from disk on 2026-09-08 by scanning `console.error` call sites under `src/`
excluding tests. It exists because the categories above name *what* must be
observable while nothing named *which label* satisfies them, so the requirement
and the code were never joined. Before this list, five labels were named
anywhere in this document and 75 were not — including every
checkout, authentication, and advertising signal the required-signal list calls
for.

**The registration rule.** A production log label is part of this contract the
moment it is emitted. Adding one without adding it here leaves the runtime
emitting a signal the observability contract does not define, which is exactly
what happened to `doku-config-unusable`: it was caught by hand a day after it
shipped, and only because someone went looking. Two consequences follow. An
operator reading this document can tell an actionable signal from an incidental
catch. And a reviewer can check registration mechanically instead of trusting
that the author remembered.

| Domain | Labels | Stable surface labels |
| --- | ---: | --- |
| Authentication and access | 6 | `admin-access-delete`, `admin-access-get`, `admin-access-patch`, `admin-access-post`, `admin-login`, `admin-login-default-notice` |
| Checkout and orders | 6 | `admin-order-update`, `admin-orders-list`, `headless-checkout`, `notification-record-failed`, `submit-order`, `submit-order-shipping-quote` |
| Payments | 5 | `doku-config-unusable`, `doku-notification`, `doku-paid-meta-prepare`, `doku-reconciliation-scheduled`, `payment-availability-config` |
| Advertising | 8 | `accepted-order-meta-prepare`, `ads-config-load`, `ads-config-update`, `capi-outbox-drain`, `capi-outbox-scheduled`, `google-catalog-admin`, `google-catalog-feed`, `meta-event` |
| Shipping and location | 8 | `admin-shipping-queue`, `headless-location-search`, `malaysia-location-search`, `malaysia-shipping-rates`, `malaysia-shipping-settings`, `malaysia-shipping-settings-list`, `manual-shipping-list`, `manual-shipping-update` |
| Catalog and storefront | 20 | `home-content-no-database-binding`, `home-landing-pages-load`, `native-landing-claim-read-failed`, `native-landing-reconcile-failed`, `sitemap-landing-pages`, `sitemap-products`, `storefront-catalog-load`, `storefront-content-invalid`, `storefront-home-content-invalid`, `storefront-home-content-load`, `storefront-product-content-load`, `storefront-support-whatsapp-load`, `storefront-support-whatsapp-no-database-binding`, `storefront-support-whatsapp-no-store-row`, `storefront-template-invalid`, `storefront-template-list`, `storefront-template-resolve`, `tenant-identity-load`, `tenant-identity-unmigrated`, `tenant-malformed-storefront-template` |
| Admin operations | 18 | `admin-analytics-get`, `admin-developer-keys-delete`, `admin-developer-keys-get`, `admin-developer-keys-patch`, `admin-developer-keys-post`, `admin-media-post`, `admin-notifications-read`, `admin-notifications-write`, `admin-products-delete`, `admin-products-get`, `admin-products-initial-load`, `admin-products-patch`, `admin-products-post`, `admin-products-status-patch`, `admin-profile-get`, `admin-profile-put`, `settings-get`, `settings-put` |
| Headless API | 1 | `headless-api-audit-write-failed` |
| Install and platform | 11 | `install-completed`, `install-missing-auth-secret`, `install-missing-setup-token`, `install-no-credential-row`, `install-no-database-binding`, `install-run`, `schema-upgrade-failed`, `system-event-write-failed`, `system-events-retention-failed`, `system-log-read-failed`, `system-log-source-failed` |

Three labels reach production through a constant or a ternary rather than a
string literal: `schema-upgrade-failed` (`SCHEMA_UPGRADE_ERROR_LABEL` in
`src/lib/schema-version.ts`), and `capi-outbox-scheduled` /
`doku-reconciliation-scheduled` (a ternary in `src/lib/system-events.ts`). They
are registered above and named here because a scanner that reads only literals
cannot see them — the first version of this registry missed all three for
exactly that reason.

`failureClass` maps a refusal to one of `provider`, `authentication`,
`signature`, `timeout`, `configuration`, or `local_transition`. Until A-268 it
returned `provider` for anything that was not a `DokuClientError`, which meant a
refusal raised *before* the provider was contacted was filed as a provider
failure — and the two an operator can actually act on arrived with no
`error_class` at all, because they threw outside the block that records one. The
system log renders its reason from that column, so those refusals showed up
without a reason on the one surface whose purpose is explaining them.

Registry entries carry the label only. Fields stay governed by **Event fields**
above, and the DOKU and system-event sections below remain authoritative where
they additionally fix allowed fields and operator decisions for a signal.

Nothing enforces this list yet. `docs/CODE-MAP.md` and `docs/DEVELOPMENT-MAP.md`
each have a guard test that fails when the document drifts from disk; this
document has none, which is why it drifted to 75 unregistered labels
without a single failing check. `src/lib/observability-registry.test.ts` is that guard (A-257).

## DOKU payment signals

For the managed A-221 local sandbox, use `npm run cf:dev:managed` as documented
in `INSTALLATION.md`. It resolves the same managed encryption root as setup;
ordinary `cf:dev` may instead load a different root from `.dev.vars`. Do not
print either value while diagnosing `doku-config-unusable`.


The local A-210–A-219 implementation persists redacted configuration health,
attempt state, sanitized failure class, deduplicated notification events,
bounded scheduled reconciliation, role-aware payment operations, and the
exactly-once Ads settlement record. Hosted sandbox/production telemetry remains
A-221–A-223; no provider dashboard, alert delivery, retention, SLO, or paging
behavior is claimed locally.

- Configuration health: disabled/sandbox/production, credential source and
  validity, enabled-channel policy, and configuration revision—never values.
- Initiation: D1 attempt state, environment, timestamps, safe error class, and
  idempotent replay. The current runtime does not emit a separate initiation
  latency metric or log provider response contents.
- Notification: an accepted notification persists its source, bounded provider
  status/state, resulting local status, and receipt time. Rejected requests
  expose only bounded HTTP outcomes (`400`, `401`, `404`, `409`, or `503`); the
  current runtime does not log a signature, timestamp, target, header, or body.
- Reconciliation: lease acquisition, due/terminal skip, signed status result,
  transition, backoff, and exhaustion/attention-required outcome.
- Lifecycle: paid-once, terminal stock release, rejected downgrade/revival, and
  DOKU Ads Purchase eligibility/deduplication.

A configured DOKU record that cannot be inspected emits one event at the point
of inspection. Its stable event name is `doku-config-unusable`; allowed fields
are `environment`, `configRevision`, `enabled`, bounded `reason` (an error class
name), and `code` (a `DokuConfigError` code or null). It carries no root secret,
no credential, and no ciphertext. It fires only for a record that claims to be
configured and is not usable: a store that never configured DOKU returns earlier
and stays silent, so the signal keeps meaning "this install is broken" rather
than "this install has no DOKU".

This signal exists because its absence was itself the defect. Every credential
failure was swallowed, `getEnabledDokuConfig` returned null, availability
resolved to no DOKU method, and the storefront quietly omitted online payment —
indistinguishable from an unconfigured install, on the buyer surface and in the
logs alike. The decision table below can only be used if the failure is visible.

The scheduled reconciliation journey emits one terminal structured event per
leased attempt at the handling boundary. Its stable event name is
`doku-reconciliation`; allowed fields are `attempt_id`, `source`, `outcome`, and
bounded `error_class`. The scheduler-level failure event is
`doku-reconciliation-scheduled` with only `outcome=scheduler_failed` and
`error_class=local_transition`. Attempt IDs are restricted diagnostic
correlation values, never metric labels. Expected lease conflicts and
non-eligible/terminal skips do not become error logs. These local Worker logs
are diagnostic telemetry, not actor-attributed audit records.

The operator decision is whether a pending DOKU order needs intervention.
Order Detail therefore exposes redacted attempt/event freshness and safe error
classification. Owner/Admin may request one leased check; Customer Service is
read-only. Success is a signed provider result applied through the canonical
lifecycle; retryable failure is a released lease with bounded backoff;
exhaustion becomes `attention_required`; an uninitiated attempt past its local
deadline expires and restores stock once. No SLO or paging alert is claimed
until hosted A-221/A-223 evidence establishes a real measurement and responder.

### Redacted decision table

These are operator decisions over fields and events already exposed by the
runtime. They are not automated alerts or proof that a responder exists.

| Observed condition | Evidence source | Operator decision |
| --- | --- | --- |
| Configuration is missing, invalid, disabled, or does not match the attempt revision/environment | Payments health plus Order Detail `config_health` | Keep DOKU disabled; replace or re-enable only the reviewed revision. Never copy credentials into logs or tickets. |
| The storefront offers no online payment while D1 holds an enabled DOKU record | `doku-config-unusable` naming environment, revision, and error class | Inspect the error class/code and redacted configuration health. Causes include malformed configuration, invalid channel policy, corrupt ciphertext, and a missing or mismatched runtime `AUTH_SECRET`; this event alone does not prove a key mismatch. Check the configured secret source without exposing its value before replacing credentials. Buyers correctly see no DOKU until it resolves. |
| A retry refused before the provider was contacted: `error_class` is `local_transition` and the attempt has no `provider_reference` | Attempt diagnostics plus the operator system log entry, which now renders a reason for it | The refusal is on this side, not DOKU's: a persisted value the request builder would not serialize, so a corrupt amount needs repair on the order rather than another retry. Do not investigate the provider; nothing was sent. A retry refused because the install disabled the committed channel is a different case that records no class — read `retry_blocked_reason` on the payment summary instead, where it appears as `DOKU_CHANNEL_DISABLED`. **Read it the same day.** `expireUninitiatedAttempt` sets `error_class` back to NULL when it expires the attempt, and the system log joins `payment_attempts` live rather than copying the class into `payment_events`, so this reason disappears from every past log line within the retry TTL of one hour. That is true of provider failures too; it is stated here because this row is what promises a reason. |
| `authentication` or `signature` error class | Redacted attempt plus `doku-reconciliation` outcome | Treat as configuration/integrity failure. Do not mark paid or repeatedly retry by hand; inspect the matching environment and signed transport setup. |
| `timeout` or `provider` remains retryable | Attempt `next_reconcile_at`, `reconcile_attempts`, and scheduler event | Allow bounded automatic backoff. Investigate only after freshness is overdue or the attempt becomes `attention_required`. |
| `attention_required`, no next check, or eight reconciliation attempts | Attempt state and chronological events | Owner/Admin reviews provider truth and may run the one idempotent manual check when the UI says it is eligible. Customer Service remains read-only. |
| Terminal `failed`/`expired` with `stock_released_at` absent, or a released order later appears paid | Attempt/order diagnostics | Stop fulfilment and escalate as a lifecycle incident; never repair with a generic status edit. |
| `paid` is present but the canonical Ads Purchase record is absent, or `doku-paid-meta-prepare` appears | Local payment/Ads evidence and bounded error log | Keep payment truth unchanged, investigate Ads enqueue separately, and do not synthesize another Purchase from the browser. |
| Notification is absent or non-2xx in DOKU HTTP Notifications | DOKU Dashboard plus matching local attempt/correlation ID | Confirm the exact endpoint, inspect local redacted diagnostics, then use the provider's bounded resend action. Duplicate delivery must converge idempotently. |

For a production install, an operator may turn the rows above into alerts only
after A-221 establishes measurable baselines and A-223 assigns a responder,
window, threshold, and rollback decision. Candidate alerts must use bounded
counts or attempt IDs; customer fields, invoice contents, credentials,
signatures, URLs, click IDs, and provider bodies are forbidden labels/payloads.

Never log the Client ID when it is treated as an account identifier, API Key,
Secret Key, Authorization/Signature headers, raw body/digest, checkout URL,
customer fields, click IDs, or complete provider response. **That covers DOKU's
*response* headers, not only ours.** Observed 2026-09-09 (A-277): DOKU echoes our
own `Authorization: Basic` request header back on both create and retrieve, so a
diagnostic that dumps a DOKU response's headers logs the API Key. Nothing does
today: `doku-client.ts` reaches a DOKU response's headers in exactly two places,
`readCheckoutResponseEnvelope` — which reads six names by hand, `Request-Id`,
`Client-Id`, `Response-Timestamp`, `API-Version`, `Content-Type` and
`Signature` — and `readBoundedResponseBody`, which compares `Content-Length`
numerically. Neither logs or forwards them, and nothing should start. Each bullet becomes
runtime truth only when its owning task records executable evidence; the list is
not evidence that the still-open configuration, Ads, or hosted paths already
exist.

## Operator system log

`/admin/settings/log` is a read-only merge of system events D1 already holds:
schema version state, `capi_event_outbox` delivery outcomes, DOKU
`payment_events` transitions with their attempt environment and error class,
operator `notifications`, and `headless_api_audit_events`. Owner and admin
reach it; advertiser and customer service receive `403` from
`GET /api/admin/system-log` and see no entry point. It is bounded to the newest
200 events within 30 days, and it writes nothing.

Every label is composed in `src/lib/system-log.ts` from structured columns.
Stored prose is never read, because `notifications.body` carries the customer's
name by design. `capi_event_outbox.payload_json`, `payment_attempts.checkout_url`,
`idempotency_key`, `request_fingerprint`, and `provider_reference` are likewise
outside the projection. A regression test seeds a token, a Malaysian mobile, and
a street address into those columns and fails if any reaches the response.

A source that fails is skipped rather than fatal, logged as
`system-log-source-failed` with a bounded `error_class`, so one missing table
cannot blank the panel for an operator working an incident. Each source is also
capped at its own share of the total, so a burst from one cannot push the others
out of the merged result. Free-form Worker logs are not imported. A-226 supplies durable, fixed events
for the named admin, login and scheduler boundaries described below.

Three of the four reads currently cost a table scan, measured with
`EXPLAIN QUERY PLAN`: `capi_event_outbox` and `notifications` have no index
leading with the timestamp they are filtered and ordered on, and
`payment_events` has one that leads with `payment_attempt_id` instead. Only
`headless_api_audit_events` searches an index. It is free on a small store and
bites on a busy one, which is when the panel is most wanted; A-235 adds the
indexes.

## Alerting

MyBookCMS currently has no alert endpoint or pager integration. If an install
adds one in separately accepted work, alerts must be deduplicated by transition
and bounded so a repeated failure does not become an incident of its own.
Alerting is supplementary: an order flow must still return a clear local error
and leave no partial state that an operator cannot inspect.

## Test signal discipline

Failure-path tests that intentionally trigger a production `console.error` must
capture and assert the exact safe label and bounded message/object. This keeps a
green suite quiet without suppressing diagnostics globally. An unexpected
console error remains visible in the test process and must be investigated
rather than hidden by a shared mock.

## Evidence boundary

Local logs and tests prove local paths only. Hosted alert delivery, retention,
and third-party dashboards require separately recorded evidence for the target
install.


### Disabled committed-channel recovery (A-245)

`DOKU_CHANNEL_DISABLED` is a buyer capability API refusal (409), not a provider
failure or a new diagnostic log. It is returned only when an inspected healthy,
enabled configuration omits the attempt's canonical committed channel. Missing,
disabled or unreadable configuration retains the generic unavailable handling.

The read-only recovery projection carries `retry_blocked_reason` and suppresses
`can_retry` for retryable failed/expired attempts. Return/result/cancel render
this before interaction, and status refresh returns the same projection. Buyer
tracking and merchant contact remain available; the operator can inspect the
existing order and use its existing permitted cancellation flow. No order,
stock, attempt, channel or provider state changes merely to display this reason.


### A-226 audit persistence and operator projection

`system_events` is an append-only audit/diagnostic table with a 90-day retention
policy. Admin audit helpers accept only a fixed action, authenticated operator
username and internal numeric target. Labels are selected from a fixed catalog;
`detail` is constrained to `{}` at both writer and database boundaries. Neither
changed values nor request/provider/error payloads are accepted. The direct store-profile, COD, embed-origin, headless-origin and CRM settings writes
fail closed with their audit in the same D1 batch; zero-row optimistic mutations
produce no successful event. Meta/Google config, API-key issue/policy/revoke and operator create/update/delete
use the same transaction. Payment configuration, credential and template mutations use their existing
helpers and the same transaction; the panel remains a read-only projection.
The privileged HTTP mutations named in REQ-230 are audited; direct bootstrap/test
configuration and template helper calls without an actor are outside that boundary.

Scheduler failures use actor `system`, source `scheduler`, error severity and
`scheduler.capi.failed` or `scheduler.doku.failed`. The existing scheduled jobs
remain independent `waitUntil` work. Their failures emit only fixed outcome/class
fields; audit sink failures emit `system-event-write-failed` with source only and
never fail the scheduled job. The login writer uses actor `anonymous`, never a
submitted username. The login boundary writes only after an admitted failed
attempt becomes denied by the existing KV limiter. Sequential pre-denied 429s
are write-free; audit sink or diagnostic recheck failure preserves the 401
result. Existing non-atomic KV windows do not guarantee exactly-once emission
under concurrent requests.

The existing one-minute schedule also deletes at most 1,000 rows strictly older
than 90 days; a backlog is drained on subsequent ticks. Exact-cutoff/newer rows
remain. Retention failures emit `system-events-retention-failed` with fixed
`error_class: local_transition`. There is no API to modify or remove an audit.

References checked 2026-09-08: [D1 batch transactions](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch),
[SQLite changes/row IDs](https://www.sqlite.org/lang_corefunc.html), and
[Workers lifecycle practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/).


The read-only system log adds source `audit` to its existing five sources. It
selects only action, principal, source, safe correlation and occurrence time;
labels and severity are rebuilt from the fixed catalog, never stored free-form
text. Invalid actor/source/action/target combinations are dropped. Owner/Admin
can read the source; restricted roles remain denied by the existing API guard.
Operator-management links are omitted for non-Owner readers. Each source receives
33 slots within the existing 200-row/30-day maximum, so a burst cannot displace
all other sources. The panel shows `Oleh:` and an `Aktivitas sistem` filter.
