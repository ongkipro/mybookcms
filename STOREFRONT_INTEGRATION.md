# MyBookCMS Storefront Integration

> Verified against disk: 2026-08-24 @ MyBookCMS working tree

This contract applies to a public storefront consuming one MyBookCMS install.

## Public contract

- Treat public presentation as one `ms-MY` Malaysia-market hybrid contract.
  Hosted pages and Headless reads do not accept a locale choice.
- Treat monetary API values as integer MYR sen; format only for display.
- Present only `cod` and `manual_transfer` payment methods.
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

COD remains unpaid until fulfilment policy permits its next state. Manual bank
transfer returns the merchant’s selected bank-account instructions and remains
pending until an authorized operator confirms payment.

The hosted confirmation may hand the order identity and status capability to
`/order-status` through same-tab session state or a URL fragment that is removed
immediately. The status page is `noindex`/`no-store` and displays only the
current order status. Courier and tracking evidence are communicated directly
through WhatsApp and are not part of the API contract.

## Privacy and security

Public clients never receive secret configuration, operator-only records, or
complete customer data unrelated to their order. Headless integrations use
scoped keys, follow configured origin policy, and must preserve idempotency
tokens when retrying checkout.

## Verification

An integration is not complete until it proves the single hybrid public voice,
invalid postcode refusal, COD, manual transfer, and accessible mobile checkout
in a running local install.
