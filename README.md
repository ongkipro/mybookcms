# MyBookCMS

> Verified against disk: 2026-08-23 @ MyBookCMS working tree

MyBookCMS is a self-contained commerce CMS for one Malaysia store per install.
It runs on Cloudflare Workers with its own D1, KV, R2, domain, and operator
team. This repository is the product template and has no deployment target.

## Product contract

- Public storefront: one `ms-MY` Malaysia-market hybrid voice.
- Operator admin: Indonesian, with English technical labels where useful.
- Money: MYR stored as integer sen.
- Payment: COD and manual bank transfer only.
- Shipping: D1-owned official postcode search and editable state/WP weight-rate
  bands, with Peninsular, Sabah, Sarawak, and Labuan fallback zones.
- Fulfilment: operator records courier/tracking information manually.

The Malaysia cutover, hybrid public content, and manual tracking flow are
validated locally. See `STATUS.md` and `TASKS.md` for exact evidence and the
remaining install-specific release boundary.

## Local development

```bash
npm ci
npm run check
npm test
npm run build
```

For Worker bindings and local D1/KV/R2 behavior, run `npm run cf:dev`. See
`INSTALLATION.md` before creating an install or applying migrations.

## Documentation

| Document | Purpose |
| --- | --- |
| `PRD.md` | Accepted product requirements |
| `ARCHITECTURE.md` | Current system structure and invariants |
| `MALAYSIA_MARKET_SPEC.md` | Market-specific contract |
| `TASKS.md` | Canonical execution queue and historical task evidence |
| `STATUS.md` | Verified current state |
| `RELEASE.md` | Release and install approval gates |
| `AGENTS.md` | Contribution rules |
