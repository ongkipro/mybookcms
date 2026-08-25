# MyBookCMS Observability

> Verified against disk: 2026-08-25 @ MyBookCMS working tree

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

## Alerting

An install may configure a redacted operator alert endpoint. Alerts must be
deduplicated by transition and bounded so a repeated failure does not become an
incident of its own. Alerting is supplementary: an order flow must still return
a clear local error and leave no partial state that an operator cannot inspect.

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
