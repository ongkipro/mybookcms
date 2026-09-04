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

## DOKU payment signals

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
customer fields, click IDs, or complete provider response. Each bullet becomes
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
cannot blank the panel for an operator working an incident. Events that exist
only as Worker logs are out of reach here; giving them a store is A-226.

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
