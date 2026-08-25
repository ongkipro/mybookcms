# Installing MyBookCMS

> Verified against disk: 2026-08-25 @ MyBookCMS working tree

Each installation is a new Malaysia store. Create resources owned by that store:
one Cloudflare Worker, D1 database, KV namespace, R2 bucket, domain, and a
separate secret set. Never reuse another store's identifiers or data.

## Prerequisites

- Node 22+ and npm 10+.
- A Cloudflare account with permission to create Worker, D1, KV, and R2
  resources.
- A 32+ character `AUTH_SECRET` and a one-time `INSTALL_TOKEN`.

## Local preparation

```bash
npm ci
npm run cf:types
npm run check
npm test
npm run db:migrate:local
npm run db:seed:preview:local # optional fictional local preview only
npm run cf:dev
```

Use `npm run cf:dev` for flows requiring D1, KV, or R2 bindings. `npm run dev`
is suitable only for rendering work that does not use Worker bindings.
`cf:dev` builds first, serves Astro's generated asset binding, and pins local
bindings to the repository-owned `.wrangler/state`. To expose the preview on an
approved private interface, append Wrangler arguments, for example
`npm run cf:dev -- --ip <private-ip> --port 8788`.
The preview seed is idempotent fictional data and must never be run with
`--remote`.

## Store setup

1. Copy the product into a new install repository.
2. Create new D1, KV, and R2 resources and place only their identifiers in the
   install's `wrangler.jsonc`. Run `npm run cf:types`; generated binding names
   must be committed with that install, while `npm run check` rejects drift.
3. Configure `AUTH_SECRET` and `INSTALL_TOKEN` as Worker secrets.
4. Apply the checked-in migration chain to the new database only after review.
   Migration `0056` provisions the active canonical Malaysia shipping policy;
   migration `0057` restores order advertising attribution after the Malaysia
   table rebuild. No separate remote seed is required.
5. Open `/install` and create the store identity and first operator credential.
6. Review seller bank accounts, all four active shipping zones, official
   postcode coverage, every state/WP rate, and all fallback weight bands before
   accepting checkout traffic.

The store uses MYR integer sen, one Malaysia-market hybrid public voice, COD/manual bank
transfer, and internal postcode shipping. It requires no external courier or
payment provider configuration.

## Approval boundary

Creating resources, applying remote migrations, setting secrets, and deploying
are live actions. They require explicit approval and are not performed by this
repository's normal validation commands.
