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

## Delivery evidence retention

Per ADR-029, `.delivery/` is explicitly ignored machine-local verification
evidence. Keep task outcomes and dated verification summaries in the canonical
repository documents. A fresh checkout must rerun the relevant checks; it does
not inherit a local ledger PASS. Do not rewrite or prune existing local history.
Never stage the ledger with `git add -f`.

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
7. A new task entry gets its id from the highest `A-` number anywhere in
   `TASKS.md` **and** in `.delivery/runs/*.jsonl`, plus one. Two sessions each
   allocated `A-255`, `A-258`, `A-263`, and `A-264` on 2026-09-08 by reading only one of those, and
   the loser's task was overwritten or marked complete unworked. Write the entry
   before starting the run, so the id is claimed where the other session reads.
8. A new task entry goes under `## Open queue`, inserted after the queue's last
   entry — never anchored on `MYS-5`, which is the last entry of `## Release
   gate`. Nine tasks landed in the wrong section that way, invisible to Goal
   Mode and to `task-queue.test.ts`, which validates the queue alone. Confirm the
   section after inserting; a green test is not confirmation.
9. A new `console.error` label is registered in `OBSERVABILITY.md` in the same
   change, under the emitted signal registry. That document is the contract for
   what an operator can observe; an unregistered label is a signal the contract
   does not define, and `doku-config-unusable` shipped that way for a day before
   anyone noticed.
10. **A bound `boundary_review` does not, by itself, satisfy the review gate.**
    Any run whose `check-boundary` returns `REVIEW_REQUIRED` also records what
    the review examined and what it found, as a `verification` check beside the
    `boundary_review` event. A review that found nothing still records what it
    looked at; "CLEAN" with no surface named is not a finding, it is a shrug.
    The trigger is the boundary's answer, not the declared risk. A-274 was
    declared R1, escalated to R2 by `check-boundary`, and its review changed
    four documented claims — a rule keyed to R3 would have skipped it.
    The reason, so this is not read as ceremony: the `boundary_review` event has
    no field for findings. It stores reviewer, model, provider, reasoning
    effort, the boundary hash, the surface digest, the effective risk, the
    implementer route, and `status: APPROVED`. There is nowhere to say what was
    examined, what was found, or whether anything was found at all. So the event
    proves a review was *claimed*; only the verification check can show one
    *happened*.
    Measured across `.delivery/runs/` on 2026-09-09: 64 bound reviews over 53
    runs, carrying 7 reviewer identities, three of them reused 24, 17 and 15
    times — one is named `a210_review_retry` and signed off A-211 through A-221.
    Median gap from run start to bound review is 9.3 minutes, implementation
    included; twelve were bound inside three minutes, the fastest at 0.7. And 33
    of the 53 reviewed runs recorded a review-named verification check, so this
    rule formalises a practice that already holds in most runs rather than
    inventing one. None of that proves self-review and none of it is an
    accusation: the ledger cannot distinguish a real review from a renamed one,
    which `~/dotfiles/docs/task-change-boundary.md` states outright. The
    contract is sound; what was recorded against it was thin.
    The contrast is the argument. The four reviews bound by
    `independent-doku-reviewer` on 2026-09-08 changed the code four times, and
    the review bound on 2026-09-09 caught two fabricated claims in this
    repository's own documentation. A gate that cannot tell those apart from a
    0.7-minute approval is not measuring what it is relied on to measure.
    Prefer `record --command` for the checks the review asks you to re-run: the
    `verification` event carries an `executed` field, and executed evidence is
    the difference between a check that ran and a check that was typed.
    Widening `boundary_review` itself belongs to `delivery-ledger` in dotfiles
    and is out of scope here.
11. `delivery-ledger check-boundary` runs **before** `git commit`, not after.
    The boundary is evaluated against the HEAD captured at `start`; committing
    first moves HEAD past it and the check can then only report `repository HEAD
    moved after baseline capture`, which denies `finish --result PASS` for a run
    whose work was entirely in surface. There is no re-baseline command, so the
    run closes `FAIL` and the evidence has to be argued in prose instead of
    read off the tool. This cost run `RUN-20260908T174024Z-5393afaf` its clean
    close on 2026-09-09 for exactly that reason and nothing else.

12. A `before()` or `after()` hook that can fail must fail with a message
    naming itself, and must not throw away the payload it read that message
    from. The runner prints no test name for a hook, so its failure reaches you
    as a stack over whatever the hook was holding — and if that payload contains
    a migration name and a SQL-shaped word, the obvious reading is wrong. One
    `npm test` exit 1 went unattributed for a full day on 2026-09-08 for exactly
    that reason: `tail` showed migration
    `0034_remove_foreign_sample_product.sql`, and the actual cause was a
    transient port draw.
    Two traps, both hit while fixing that one. A tool often logs a wrapper line
    at the same severity as the cause it announces — wrangler emits
    `Migration <name> failed with the following errors:` through `logger.error`
    too — so taking the *first* matching line yields a sentence that announces a
    reason and never gives one. Take the last, and keep the wrapper only when it
    is all there is. And put the original error on `cause` rather than
    summarising it away: a short message is for reading a `tail`, not for
    discarding evidence.

```bash
npm run check
npm test
npm run build
npm run lint            # biome; folded into `check` by A-274, see ADR-032
npm run test:coverage   # optional; Node's built-in coverage, baseline in docs/DEVELOPMENT-MAP.md
```

`npm run lint` reads `biome.json`: a lint floor only, no formatter, and a rule
set chosen for defects rather than taste. It covers `src/**/*.ts`, `.tsx` and
`scripts/**/*.mts`; Astro and CSS are excluded because Biome's CSS parser
rejects this project's Tailwind at-rules. Do not enable the formatter or switch
the rules to `recommended` without a new decision — ADR-032 records why both are
off.

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
