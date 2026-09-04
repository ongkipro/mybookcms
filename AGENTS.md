# MyBookCMS Working Agreement

> Verified against disk: 2026-09-04 @ MyBookCMS working tree

## Product boundary

MyBookCMS is one Malaysia store per install. Public surfaces use Malay/English,
money is MYR integer sen, and shipping is D1-owned postcode/weight policy. The
operator admin remains Indonesian.

Checkout offers COD and manual bank transfer, and — where an operator has
enabled a healthy DOKU configuration — one hosted DOKU choice carrying only its
allowlisted Malaysia channels. That path is implemented and verified locally
only: `A-221` still owns sandbox proof, so no install may claim it works against
the provider.

## Source of truth

- Repository code and executable checks win over documentation.
- `PRD.md` owns requirements; `TASKS.md` owns the execution queue;
  `STATUS.md` owns current verified state; `BUILD-LOG.md` owns history.
- `src/db/migrations/` is the schema record. Migrations are forward-only and
  hand-authored.
- `docs/CODE-MAP.md` is the navigation index: which file serves a URL, which
  API a surface calls, which table a module owns. Read it before searching for
  a file. It is a map, never authority — when it disagrees with the code, the
  code is right and the map is stale.
- **`docs/lineage/inherited-tasks.md` is not a backlog.** This repository was
  forked from the AdsBookCMS / CMSAds engine, and that file holds the upstream
  task history. Every requirement it cites (`REQ-1`-`REQ-172`, `T1`-`T295`, and
  the `SEC-*` / `PAY-*` / `ORD-*` / `TRK-*` / `TYP-*` / `DOC-*` / `CAT-*` /
  `UI-*` families) is undefined in this product. Never start work from an
  unchecked box in that file, and never cite one of those ids as a requirement.
- A requirement id is valid here only if `PRD.md` defines it: `REQ-173`+ for
  the product, `LOGIN-*` for admin access. If a task cites an id `PRD.md` does
  not contain, the task is wrong — stop and say so rather than implementing it.
- A `PRD.md` row marked `Proposal` is not accepted. Do not implement it, and do
  not treat it as a gap to close.
- Work only `TASKS.md` > `## Open queue`. Each task there states `Risk`,
  `Surface`, `Non-scope`, `Dependencies` and a runnable `Done when`. `Surface`
  is the complete set of paths that task may edit; going outside it is scope
  expansion that stops for the user. A task marked **`Approval: required`** is
  never executed autonomously — prepare it, report it, stop. Sections below the
  Open queue are delivered history, and `docs/lineage/` is another product's.

## Required practice

1. Inspect the relevant flow and every caller before changing it.
2. Reuse existing code and platform capability before adding a dependency.
3. Preserve input validation, stock/order lifecycle safeguards, authorization,
   accessibility, and error handling.
4. Add the smallest regression check for non-trivial logic.
5. Run the project’s relevant check; never claim behavior without evidence.
6. Adding, removing, or repointing a route, an API endpoint, or a migration
   makes `docs/CODE-MAP.md` wrong. Update it in the same change and name it in
   the task `Surface`. Nothing else in that file needs touching.

```bash
npm run check
npm test
npm run build
```

Browser-visible changes require a real browser check in addition to compilation.

## Safety

- Never read, print, commit, or return a secret.
- Ask before remote migrations, deployment, resource creation/destruction,
  domain changes, or other live mutations.
- Do not overwrite unrelated working-tree changes.
- Do not add an external logistics or payment-provider dependency.
- Do not commit or push unless the user asked.

Repository documentation and code comments are English. Public product copy is
Malay or English; admin product copy is Indonesian.
