import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

/**
 * `OBSERVABILITY.md` is the contract for what an operator can observe. It fixes
 * every stable surface label the runtime emits, and until 2026-09-08 it named
 * five of eighty. Nothing noticed, because nothing checked: `docs/CODE-MAP.md`
 * and `docs/DEVELOPMENT-MAP.md` each have a guard that fails on drift and this
 * document had none. `doku-config-unusable` shipped unregistered and was caught
 * by hand a day later, only because someone went looking.
 *
 * The check runs in both directions on purpose. An emitted label missing from
 * the registry is a signal the contract does not define. A registered label
 * nothing emits is the same lie pointing the other way, and it is the one that
 * accumulates quietly as code is deleted.
 */

const root = new URL("../..", import.meta.url).pathname;

/** Labels reaching production through a constant or a ternary, not a literal.
 *
 * A scanner that reads only string literals cannot see these, and the first
 * version of the registry missed all three for exactly that reason. They are
 * listed rather than skipped so the inventory stays complete, and each is
 * asserted to still exist at its source so this list cannot rot silently. */
const NON_LITERAL_LABELS = [
  { label: "schema-upgrade-failed", file: "src/lib/schema-version.ts" },
  { label: "capi-outbox-scheduled", file: "src/lib/system-events.ts" },
  { label: "doku-reconciliation-scheduled", file: "src/lib/system-events.ts" },
] as const;

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      sourceFiles(path, found);
      continue;
    }
    if (!/\.(ts|tsx|astro)$/.test(entry) || entry.includes(".test.")) continue;
    found.push(path);
  }
  return found;
}

function emittedLabels(): Set<string> {
  const labels = new Set<string>(NON_LITERAL_LABELS.map((entry) => entry.label));
  for (const path of sourceFiles(join(root, "src"))) {
    const source = readFileSync(path, "utf8");
    for (const match of source.matchAll(/console\.error\(\s*['"]([a-z0-9-]+)['"]/g)) {
      labels.add(match[1]);
    }
  }
  return labels;
}

function registeredLabels(): Set<string> {
  const document = readFileSync(join(root, "OBSERVABILITY.md"), "utf8");
  const table = document.slice(document.indexOf("## Emitted signal registry"));
  const labels = new Set<string>();
  for (const row of table.split("\n")) {
    // Registry rows only: `| Domain | count | `a`, `b` |`.
    if (!/^\| [A-Za-z][A-Za-z ]+ \| \d+ \| /.test(row)) continue;
    for (const match of row.matchAll(/`([a-z0-9-]+)`/g)) labels.add(match[1]);
  }
  return labels;
}

test("every production log label is registered in OBSERVABILITY.md", () => {
  const registered = registeredLabels();
  assert.ok(registered.size > 50, "the registry table must parse; it looks empty");
  const unregistered = [...emittedLabels()].filter((label) => !registered.has(label)).sort();
  assert.deepEqual(
    unregistered,
    [],
    `emitted but unregistered: ${unregistered.join(", ")}. Add each to the registry table in OBSERVABILITY.md, per AGENTS.md rule 9.`,
  );
});

test("every registered label is still emitted by production code", () => {
  const emitted = emittedLabels();
  const stale = [...registeredLabels()].filter((label) => !emitted.has(label)).sort();
  assert.deepEqual(
    stale,
    [],
    `registered but never emitted: ${stale.join(", ")}. Remove each from OBSERVABILITY.md; a registry that keeps retired names misleads an operator the same way a missing one does.`,
  );
});

test("the labels that reach production through a constant or ternary still do", () => {
  // Without this the exemption list above becomes a place to hide a label that
  // no longer exists, which is the failure the second test exists to prevent.
  for (const { label, file } of NON_LITERAL_LABELS) {
    const source = readFileSync(join(root, file), "utf8");
    assert.ok(
      source.includes(`"${label}"`) || source.includes(`'${label}'`),
      `${label} is listed as a non-literal emitter in ${file} but no longer appears there`,
    );
    assert.match(
      source,
      /console\.error\(|LABEL/,
      `${file} no longer emits or defines a label; update NON_LITERAL_LABELS`,
    );
  }
});
