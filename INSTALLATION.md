# Installing MyBookCMS

> Verified against disk: 2026-09-04 @ MyBookCMS working tree

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
**`--assets dist/client` is not optional.** The generated
`dist/server/wrangler.json` declares `assets.directory` as the relative
`../client`, and Wrangler resolves that against the root `wrangler.jsonc` it
discovers rather than against the `--config` file it was handed — so it looks
for `../client` beside the repository and finds nothing. Every `/_astro/*`
chunk then answers a bare 404 with no error logged anywhere, no admin island
hydrates, and each admin page renders as a shell: a working header above an
empty body. That is what it looks like from the browser, and it is why the flag
is in the script. Found by A-270 after `/admin/expeditions` was reported blank.

`cf:dev` builds first, serves Astro's generated asset binding, and pins local
bindings to the repository-owned `.wrangler/state`. To expose the preview on an
approved private interface, append Wrangler arguments, for example
`npm run cf:dev -- --ip <private-ip> --port 8788`.
The preview seed is idempotent fictional data and must never be run with
`--remote`.

### Local sandbox using managed secrets

If the A-221 local sandbox setup encrypted its configuration under managed
`AUTH_SECRET`, start the worker with:

```bash
npm run cf:dev:managed
```

This optional Bash/POSIX development path requires the workstation's
`secrets-env` helper and its already-configured managed `AUTH_SECRET` and
`INSTALL_TOKEN`. It builds before injecting secrets, then uses the same local
`.wrangler/state` database. `--env-file /dev/null` deliberately bypasses
`.dev.vars` and dotenv files; Wrangler's declared required secrets come from
the managed child environment. Additional Wrangler arguments can be appended,
for example `npm run cf:dev:managed -- --ip 127.0.0.1 --port 8788`.

For the managed A-221 install, the managed `AUTH_SECRET` is authoritative.
Ordinary `npm run cf:dev` follows Wrangler's `.dev.vars`/dotenv loading and is
appropriate only when the local database credentials were encrypted under
that same root. Do not alternate roots against one persisted database or
copy secret values into documentation. The managed command does not migrate,
re-encrypt, enable DOKU, or contact the provider. If online payment is absent,
inspect the redacted `doku-config-unusable` diagnostic and configuration health
before assuming the record is missing. Provider proof still belongs to A-221.

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

The buyer-facing store uses MYR integer sen, one Malaysia-market hybrid public
voice, one full checkout, and internal postcode shipping. COD and manual bank
transfer remain independent of provider configuration. DOKU appears only when a
healthy configuration is explicitly enabled for that install.

## DOKU Malaysia setup — sandbox approval required

A-210 through A-219 implement the local schema, Global transport, encrypted
configuration, hosted Checkout, signed notification lifecycle, recovery,
reconciliation, operator/buyer UI, and Ads settlement boundary. This does not
prove provider interoperability. A-220 release controls and A-221 approved
sandbox evidence must pass before production preparation. senangPay merchants
use this same migrated DOKU Malaysia adapter; there is no second legacy adapter.

After explicit A-221 approval, prepare sandbox without exposing credentials:

1. Use a separate DOKU sandbox business account and sandbox Client ID, API Key,
   and Secret Key. Enter them only in **Admin > Pembayaran > DOKU Malaysia**.
   Saving creates a disabled revision; the browser can read only masks and
   health. Never put a value in this file, `wrangler.jsonc`, Git, logs,
   screenshots, shell history, or chat.
2. Confirm the store `site_url` is its exact public HTTPS origin. Copy the
   read-only URL shown in the DOKU workspace. Its required shape is
   `https://<store-domain>/api/payments/doku/notifications`; do not add query
   parameters, another path, or a sandbox/production suffix.
3. In the Malaysia DOKU Dashboard, open **Settings > Payment Settings >
   Webhook**, create a webhook, enter a non-sensitive description and the copied
   endpoint, select only the channels enabled for this install, then choose
   **Create**. One webhook may cover several selected channels; a channel already
   assigned to another webhook cannot be reused. An inactive, deleted, or
   unconfigured webhook sends no notification.
4. Activate only the sandbox revision and channels named by the approved test
   plan. Activation itself performs no DOKU request. Run every A-221 case in
   `RELEASE.md`; a rendered choice or successful redirect alone is insufficient.
5. Inspect delivery in **Settings > Notifications > HTTP Notifications**. DOKU
   documents an eight-day view and a resend action. The MyBookCMS endpoint must
   return a successful 2xx only after its signed idempotent transition commits.
   Record redacted invoice/correlation evidence, never raw bodies or headers.

Official procedure: [Webhook / Payment Notification](https://docs.doku.com/get-started/manage-business/set-up-integration/webhook-payment-notification)
and [Manage Operations](https://docs.doku.com/get-started/manage-business/manage-operations).

A-222 owns one explicitly approved production activation; A-223 owns its bounded
observation and keep-enabled/disable decision. Sandbox completion does not
authorize either task. Create a separate production revision using production
credentials, repeat notification registration for the production account, and
enable only sandbox-proven channels. No credential, configuration row, webhook,
payment state, or D1 data is promoted between environments.

## Approval boundary

Creating resources, applying remote migrations, setting secrets, and deploying
are live actions. They require explicit approval and are not performed by this
repository's normal validation commands.
