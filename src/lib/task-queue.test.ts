import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const tasks = readFileSync(new URL("../../TASKS.md", import.meta.url), "utf8");

/**
 * Goal Mode reads `## Open queue` and acts on it without a human in the loop
 * for anything not marked `Approval: required`. A task there that omits its
 * risk, its allowed paths, or its completion evidence is not a task an agent
 * can execute safely — it is an invitation to improvise. These pin the shape.
 */

// Anchored to line start on purpose: the file's own reading instructions
// mention `## Open queue` in prose, and a plain indexOf matches that first.
const HEADING = /^## Open queue$/m;

const openQueue = () => {
  const match = HEADING.exec(tasks);
  assert.ok(match, "TASKS.md must have an `## Open queue` section");
  const rest = tasks.slice(match.index + match[0].length);
  const nextHeading = rest.search(/^## /m);
  return nextHeading === -1 ? rest : rest.slice(0, nextHeading);
};

const blocks = (section: string) =>
  section.split(/\n(?=- \[[ x]\] \*\*)/).filter((b) => b.trim().startsWith("- ["));

test("every open task carries what Goal Mode needs to execute it", () => {
  const required = ["Risk:", "Surface:", "Non-scope:", "Dependencies:", "Done when"];
  // `[x]` blocks are excluded: this contract exists so an agent can *execute* an
  // open task, and a finished one has nothing left to execute. Requiring the
  // full shape on closed entries only forced long closure notes, which ADR-033
  // set out to stop. Id uniqueness, below, still covers both.
  const found = blocks(openQueue()).filter((block) => block.startsWith("- [ ]"));
  assert.ok(found.length > 0, "the open queue must not be empty of parsed tasks");
  for (const block of found) {
    const id = block.match(/\*\*([A-Z]+-\d+)\*\*/)?.[1] ?? block.slice(0, 40);
    for (const field of required) {
      assert.ok(block.includes(field), `${id} is missing "${field}"`);
    }
  }
});

/**
 * Ids collided four times on 2026-09-08 — `A-255`, `A-258`, `A-263`, `A-264` —
 * because two sessions allocated from the same range without seeing each other,
 * and each time the loser's entry was overwritten or marked complete unworked.
 * Every one of those collisions was inside `## Open queue`, which is what makes
 * them harmful: that is the section Goal Mode executes and the only one this
 * file otherwise validates.
 *
 * The rule is deliberately not a list of allowed duplicates. Ten ids —
 * `A-176`–`A-185` — legitimately head two different closed tasks each, because
 * the fork restarted numbering after the 2026-08-23 `## A23` era, and those
 * entries carry 55 cross-references in `BUILD-LOG.md`, the docs, and the
 * delivery ledger. Renumbering closed history to satisfy a checker would
 * invalidate all of them to fix nothing an agent can trip over. So the check
 * asks the two questions that actually matter: an id may not repeat inside one
 * section, and an id in the open queue may not appear anywhere else. A new
 * collision fails wherever it lands; settled history stays settled.
 */
const sections = () => {
  const found = new Map<string, string[]>();
  let current = "(preamble)";
  for (const line of tasks.split("\n")) {
    if (line.startsWith("## ")) current = line.slice(3).trim();
    const id = line.match(/^- \[[ x]\] \*\*([A-Z]+-\d+)\*\*/)?.[1];
    if (id) found.set(current, [...(found.get(current) ?? []), id]);
  }
  return found;
};

test("no task id is used twice inside one section", () => {
  for (const [section, ids] of sections()) {
    const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))].sort();
    assert.deepEqual(
      duplicates,
      [],
      `${section} heads more than one entry with ${duplicates.join(", ")}; allocate the next free id per AGENTS.md rule 7`,
    );
  }
});

test("an open-queue id is not reused from a closed section", () => {
  const all = sections();
  const open = new Set(all.get("Open queue") ?? []);
  const elsewhere = [...all]
    .filter(([section]) => section !== "Open queue")
    .flatMap(([, ids]) => ids)
    .filter((id) => open.has(id));
  assert.deepEqual(
    [...new Set(elsewhere)].sort(),
    [],
    "an open task reuses an id a closed entry already owns; the ledger and BUILD-LOG cannot tell them apart",
  );
});

test("no open task cites a requirement PRD.md does not define", () => {
  const prd = readFileSync(new URL("../../PRD.md", import.meta.url), "utf8");
  const defined = new Set(prd.match(/REQ-\d+/g) ?? []);
  for (const cited of new Set(openQueue().match(/REQ-\d+/g) ?? [])) {
    assert.ok(defined.has(cited), `the open queue cites ${cited}, which PRD.md does not define`);
  }
});

test("outward-facing tasks are marked so they are never run autonomously", () => {
  // R4 is the level reserved for work with a live external consequence.
  // Every one of them must also say so in words an agent cannot misread.
  // Scanned across the whole file, not just the open queue: the release gate
  // lives in its own section and is exactly the kind of task this protects.
  for (const block of blocks(tasks)) {
    const id = block.match(/\*\*([A-Z]+-\d+)\*\*/)?.[1] ?? "?";
    if (/Risk: R4/.test(block)) {
      assert.match(block, /Approval: required/, `${id} is R4 but is not marked "Approval: required"`);
    }
  }
});

test("the quarantined lineage is never presented as work", () => {
  const heading = HEADING.exec(tasks);
  assert.ok(heading, "TASKS.md must have an `## Open queue` section");
  const start = heading.index;
  assert.doesNotMatch(
    tasks.slice(0, start),
    /^- \[ \]/m,
    "an unchecked box appears above the open queue, where delivered history lives",
  );
  const lineage = readFileSync(new URL("../../docs/lineage/inherited-tasks.md", import.meta.url), "utf8");
  assert.match(lineage.slice(0, 900), /not a backlog/i, "the lineage file must say what it is not");
});
