import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
const map = readFileSync(resolve(root, "docs/DEVELOPMENT-MAP.md"), "utf8");

test("development map accounts for every route exactly once, including endpoints and tombstones", () => {
  const expected = readdirSync(resolve(root, "src/pages"), { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => resolve(entry.parentPath, entry.name).slice(resolve(root, "src/pages").length)
      .replace(/\.[^.]+$/, "").replace(/\/index$/, "") || "/")
    .sort();
  const documented = [...map.matchAll(/^\| `([^`]+)` \|/gm)].map(match => match[1]).sort();
  assert.ok(expected.length > 100, "the inventory must include endpoints, not just pages");
  assert.deepEqual(documented, expected);
});

test("development map citations resolve and its four runtime claims name executable tests", () => {
  const links = [...map.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map(match => match[1]);
  assert.ok(links.length > 20);
  for (const link of links) {
    const [path] = link.split("#");
    assert.ok(existsSync(resolve(root, "docs", path)), `missing citation: ${link}`);
  }
  const tests = readFileSync(resolve(root, "src/lib/route-surface.test.ts"), "utf8");
  for (const route of ["/produk/[slug]", "/[slug]", "/admin/ads/meta", "/admin/settings/developer"]) {
    const row = map.split("\n").find(line => line.startsWith(`| \`${route}\` |`));
    assert.ok(row?.includes("Direct runtime:") && row.includes("route-surface.test.ts"));
    assert.ok(tests.includes(`test("${route} `), `missing named runtime test: ${route}`);
  }
});
