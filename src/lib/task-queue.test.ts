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
  const found = blocks(openQueue());
  assert.ok(found.length > 0, "the open queue must not be empty of parsed tasks");
  for (const block of found) {
    const id = block.match(/\*\*([A-Z]+-\d+)\*\*/)?.[1] ?? block.slice(0, 40);
    for (const field of required) {
      assert.ok(block.includes(field), `${id} is missing "${field}"`);
    }
  }
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
