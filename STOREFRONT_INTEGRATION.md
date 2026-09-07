# MyBookCMS Storefront Integration

> Verified against disk: 2026-09-07 @ MyBookCMS working tree

This contract applies to a public storefront consuming one MyBookCMS install.

## Public contract

- Treat public presentation as one `ms-MY` Malaysia-market hybrid contract.
  Hosted pages and Headless reads do not accept a locale choice.
- Treat monetary API values as integer MYR sen; format only for display.
- Present the payment methods the install actually offers. `cod` and
  `manual_transfer` are always candidates; a store with a healthy enabled DOKU
  configuration exposes each allowlisted Malaysia channel as a direct hosted
  choice. Submit that choice as `payment_method: "doku"` plus its exact
  `doku_channel`; do not add a generic DOKU/all-channel choice or collect card
  fields. `manual_transfer` requires an active seller bank account and `doku`
  requires a customer e-mail plus one advertised channel, all enforced
  server-side.
  Do not hard-code the set. `GET /api/v1/storefront` returns
  `payment.supported_methods` resolved from the install's own state, alongside
  `payment.doku_channels` (allowlisted labels only, empty when DOKU is off) and
  `payment.doku_requires_email`. It shares one resolver with the hosted
  `GET /api/payment-methods`, so the two cannot report different states for one
  store. No credential, environment, or configuration revision crosses either.
- Search the local Malaysia directory, retain its location identifier, and
  request shipping with the selected five-digit postcode and cart weight.
  Display the returned D1-owned state/WP quote only for its validity window.
- Never regard a browser-submitted price, shipping cost, stock count, or payment
  result as authoritative.

## Checkout

The server validates product/variant, stock, price, public customer fields,
payment method, postcode, cart weight, and shipping rule before persisting an
order. It returns an order identifier and public status capability according to
the install’s API contract.

For DOKU, the server validates `doku_channel` against the current install
policy before any order or stock write, persists it on the payment attempt, and
sends it as the only Hosted Checkout `payment_channels` entry. Reusing a submit
token with a different channel is a conflict. An eligible retry keeps the same
stored channel; if that channel is no longer enabled, retry fails closed instead
of silently changing the buyer's payment intent.

COD remains unpaid until fulfilment policy permits its next state. Manual bank
transfer returns the merchant’s selected bank-account instructions and remains
pending until an authorized operator confirms payment.

The hosted confirmation may hand the order identity and status capability to
`/jejak-pesanan` through same-tab session state or a URL fragment that is removed
immediately. The retired English slug `/order-status` answers one query-preserving
`308` to it (REQ-203); `POST /api/order-status` is an API contract and keeps its
name. The status page is `noindex`/`no-store` and displays only the current order
status. Courier and tracking evidence are communicated directly
through WhatsApp and are not part of the API contract.

An unsupported method answers `405` with a JSON body and an `Allow` header
naming the methods the route accepts. It does not return an HTML page.

## Privacy and security

Public clients never receive secret configuration, operator-only records, or
complete customer data unrelated to their order. Headless integrations use
scoped keys, follow configured origin policy, and must preserve idempotency
tokens when retrying checkout.

## Verification

An integration is not complete until it proves the single hybrid public voice,
invalid postcode refusal, COD, manual transfer, and accessible mobile checkout
in a running local install. Where the install enables DOKU, also prove the
hosted redirect, the cancel and failure paths, and that a browser return is
never treated as payment evidence. Verify that each enabled channel is a direct
accessible choice, the submitted channel is the only channel sent to DOKU, and
retry cannot switch it.
