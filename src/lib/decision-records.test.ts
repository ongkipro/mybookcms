import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";

/**
 * An `ADR-0NN` in code, configuration, or a normative document is a promise
 * that a reader can go and read that decision. This repository was forked from
 * AdsBookCMS and carried across citations to `ADR-013` through `ADR-020`, whose
 * decisions stayed behind. So `wrangler.jsonc` explained a retired template, and
 * a navigation test explained a deliberately hidden route, by pointing at
 * documents nobody here can open.
 *
 * This fails when that happens again.
 */

const repoRoot = new URL("../../", import.meta.url);
const decisions = readFileSync(new URL("DECISIONS.md", repoRoot), "utf8");

/**
 * Files whose job is to narrate history or the gap itself, and which therefore
 * may name an id this product never recorded.
 *
 * `BUILD-LOG.md` declares in its own header that entries before the fork are
 * the upstream engineering narrative. `docs/lineage/` is quarantined by
 * `AGENTS.md`. `STATUS.md`, `TASKS.md` and `DECISIONS.md` describe the gap and
 * what was done about it, which requires naming the ids.
 */
const NARRATIVE = new Set([
  "BUILD-LOG.md",
  "STATUS.md",
  "TASKS.md",
  "DECISIONS.md",
]);

/**
 * Applied migrations are never edited, so migration `0044`'s comment keeps the
 * upstream id it shipped with. `ADR-024` supersedes it in the record instead.
 */
function isExempt(relative: string): boolean {
  if (NARRATIVE.has(relative)) return true;
  if (relative.startsWith("docs/lineage/")) return true;
  if (relative.startsWith("src/db/migrations/")) return true;
  // This file names the upstream range to explain the rule it enforces.
  if (relative === "src/lib/decision-records.test.ts") return true;
  return false;
}

/** Build output is a copy of source, not a citation anyone reads. */
const GENERATED_DIRS = new Set(["dist", "node_modules", "coverage"]);

const SCANNED_EXTENSIONS = [".md", ".ts", ".tsx", ".astro", ".jsonc", ".json", ".sql", ".mjs"];

function walk(relativeDir: string): string[] {
  const out: string[] = [];
  const dir = new URL(relativeDir, repoRoot);
  for (const entry of readdirSync(dir)) {
    if (GENERATED_DIRS.has(entry) || entry.startsWith(".")) continue;
    const childRelative = `${relativeDir}${entry}`;
    if (statSync(new URL(childRelative, repoRoot)).isDirectory()) {
      out.push(...walk(`${childRelative}/`));
    } else if (SCANNED_EXTENSIONS.some((ext) => entry.endsWith(ext))) {
      out.push(childRelative);
    }
  }
  return out;
}

function definedRecords(): Set<string> {
  return new Set(
    [...decisions.matchAll(/^## (ADR-\d{3})\b/gm)].map((match) => match[1]),
  );
}

test("every ADR cited as authority resolves to a record in DECISIONS.md", () => {
  const defined = definedRecords();
  assert.ok(defined.size > 10, `expected DECISIONS.md to define records, found ${defined.size}`);

  const dangling: string[] = [];
  for (const relative of [...walk(""), ...walk("src/"), ...walk("docs/")]) {
    if (isExempt(relative)) continue;
    const source = readFileSync(new URL(relative, repoRoot), "utf8");
    for (const [, id] of source.matchAll(/\b(ADR-\d{3})\b/g)) {
      if (!defined.has(id)) dangling.push(`${relative} cites ${id}`);
    }
  }

  assert.deepEqual(
    [...new Set(dangling)].sort(),
    [],
    `these point at a decision this repository does not contain:\n  ${dangling.join("\n  ")}`,
  );
});

test("decision records are uniquely numbered and never renumbered into the upstream range", () => {
  const ids = [...decisions.matchAll(/^## (ADR-\d{3})\b/gm)].map((match) => match[1]);
  assert.deepEqual(ids, [...new Set(ids)], "DECISIONS.md defines an ADR id twice");

  // ADR-013 through ADR-020 belong to the upstream AdsBookCMS record. Reusing
  // one here would make `BUILD-LOG.md`'s historical citations resolve to a
  // different decision than the one they were written about.
  const upstream = ids.filter((id) => {
    const n = Number(id.slice(4));
    return n >= 13 && n <= 20;
  });
  assert.deepEqual(
    upstream,
    [],
    "an upstream ADR number was reused; pick the next free number instead",
  );
});
