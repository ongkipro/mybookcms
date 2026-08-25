# MyBookCMS Observability

> Verified against disk: 2026-08-24 @ MyBookCMS working tree

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
- Advertising: configuration refusal, CAPI enqueue/delivery/retry/terminal
  failure, deduplicated Purchase eligibility, and safe merchandise-value source
  (`order_items`) without raw tokens, customer identity, shipping, or fee detail.

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

## Evidence boundary

Local logs and tests prove local paths only. Hosted alert delivery, retention,
and third-party dashboards require separately recorded evidence for the target
install.
