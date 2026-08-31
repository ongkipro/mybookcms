# MyBookCMS Working Agreement

> Verified against disk: 2026-08-23 @ MyBookCMS working tree

## Product boundary

MyBookCMS is one Malaysia store per install. Public surfaces use Malay/English,
money is MYR integer sen, checkout is COD/manual transfer, and shipping is
D1-owned postcode/weight policy. The operator admin remains Indonesian.

## Source of truth

- Repository code and executable checks win over documentation.
- `PRD.md` owns requirements; `TASKS.md` owns the execution queue;
  `STATUS.md` owns current verified state; `BUILD-LOG.md` owns history.
- `src/db/migrations/` is the schema record. Migrations are forward-only and
  hand-authored.
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

## Required practice

1. Inspect the relevant flow and every caller before changing it.
2. Reuse existing code and platform capability before adding a dependency.
3. Preserve input validation, stock/order lifecycle safeguards, authorization,
   accessibility, and error handling.
4. Add the smallest regression check for non-trivial logic.
5. Run the project’s relevant check; never claim behavior without evidence.

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
