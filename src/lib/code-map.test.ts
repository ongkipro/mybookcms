import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";

/**
 * `AGENTS.md` tells every agent to read `docs/CODE-MAP.md` before searching for
 * a file, which makes a stale row in it worse than no map at all: it sends the
 * next task confidently to the wrong place. The map is hand-written, so the
 * only thing that keeps it honest is a check that derives the same facts from
 * disk and refuses to agree.
 *
 * Scope is deliberately narrow. This asserts the four things that are
 * mechanically true or false — routes, paths, HTTP methods, tables — and says
 * nothing about prose, line counts, or the component and library tables. Those
 * drift slowly and a false failure would train someone to ignore this file.
 */

const repoRoot = new URL("../../", import.meta.url);
const map = readFileSync(new URL("docs/CODE-MAP.md", repoRoot), "utf8");

const PAGES_DIR = new URL("src/pages/", repoRoot);
const MIGRATIONS_DIR = new URL("src/db/migrations/", repoRoot);

/** Extensions the map is expected to name in full. Anything else is prose. */
const PATH_EXTENSIONS = [
  ".astro",
  ".ts",
  ".tsx",
  ".css",
  ".js",
  ".mjs",
  ".sql",
  ".json",
  ".jsonc",
  ".md",
  ".yml",
];

/** Directories the map addresses from the repository root rather than `src/`. */
const ROOT_RELATIVE_PREFIXES = ["src/", "public/", "scripts/", "docs/", ".github/"];

function walk(dir: URL, prefix = ""): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const child = new URL(entry, dir);
    if (statSync(child).isDirectory()) {
      out.push(...walk(new URL(`${entry}/`, dir), `${prefix}${entry}/`));
    } else {
      out.push(`${prefix}${entry}`);
    }
  }
  return out;
}

/** Every backticked token in the map, tables and prose alike. */
function backtickedTokens(): string[] {
  return [...map.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]);
}

/**
 * The public route Astro serves a page file at. File-based routing, so this is
 * derivable rather than a second thing to keep in sync: strip `src/pages`, drop
 * the final extension, and collapse `index`.
 *
 * `sitemap.xml.ts` must become `/sitemap.xml`, so only the last extension goes.
 */
function routeForPageFile(relative: string): string {
  let route = `/${relative}`;
  const lastDot = route.lastIndexOf(".");
  if (lastDot > route.lastIndexOf("/")) route = route.slice(0, lastDot);
  if (route.endsWith("/index")) route = route.slice(0, -"/index".length);
  return route === "" ? "/" : route;
}

/**
 * Routes that have a row of their own.
 *
 * Only the first cell counts. Scanning the whole document would let a route be
 * "documented" by appearing as some other row's redirect target or in prose,
 * which is exactly the drift this is meant to catch: deleting the
 * `/jejak-pesanan` row left it still mentioned as the target of
 * `/order-status`, and a whole-document scan called that fine.
 */
function documentedRoutes(): Set<string> {
  const routes = new Set<string>();
  for (const line of map.split("\n")) {
    if (!line.startsWith("| `")) continue;
    const firstCell = line.split("|")[1] ?? "";
    for (const [, raw] of firstCell.matchAll(/`([^`]+)`/g)) {
      const withoutMethod = raw.replace(/^(?:GET|POST|PUT|PATCH|DELETE|ALL)\s+/, "");
      if (!withoutMethod.startsWith("/")) continue;
      const route = withoutMethod.split("?")[0].replace(/\/$/, "");
      routes.add(route === "" ? "/" : route);
    }
  }
  return routes;
}

test("every page and endpoint on disk is named in the code map", () => {
  const documented = documentedRoutes();
  const missing: string[] = [];
  for (const relative of walk(PAGES_DIR)) {
    const route = routeForPageFile(relative);
    if (!documented.has(route)) missing.push(`src/pages/${relative} (route ${route})`);
  }
  assert.deepEqual(
    missing,
    [],
    `docs/CODE-MAP.md does not name these routes:\n  ${missing.join("\n  ")}`,
  );
});

test("every file path the code map names exists", () => {
  const missing: string[] = [];
  for (const token of new Set(backtickedTokens())) {
    if (!token.includes("/")) continue;
    if (!PATH_EXTENSIONS.some((ext) => token.endsWith(ext))) continue;
    // Prose shows globs, URLs, and `<slug>`-style templates. None is a claim
    // about a file that exists; only a concrete relative path is.
    if (token.includes("*") || token.includes("://") || token.startsWith("/")) continue;
    if (token.includes("<") || token.includes(">")) continue;
    const relative = ROOT_RELATIVE_PREFIXES.some((p) => token.startsWith(p))
      ? token
      : `src/${token}`;
    try {
      statSync(new URL(relative, repoRoot));
    } catch {
      missing.push(`${token} -> ${relative}`);
    }
  }
  assert.deepEqual(
    missing,
    [],
    `docs/CODE-MAP.md names paths that do not exist:\n  ${missing.join("\n  ")}`,
  );
});

test("every HTTP method the code map lists for an endpoint is exported by it", () => {
  const rows = map.split("\n").filter((line) => line.startsWith("| `"));
  const wrong: string[] = [];
  let checked = 0;
  for (const row of rows) {
    const cells = row.split("|").map((cell) => cell.trim());
    // `| Route | File | Methods | ...` — cells[0] is the empty pre-pipe string.
    const file = cells[2]?.replace(/`/g, "");
    if (!file?.startsWith("pages/api/")) continue;
    const declared = [...(cells[3] ?? "").matchAll(/\b(GET|POST|PUT|PATCH|DELETE|ALL)\b/g)].map(
      (m) => m[1],
    );
    if (declared.length === 0) continue;
    const source = readFileSync(new URL(`src/${file}`, repoRoot), "utf8");
    const exported = new Set(
      [...source.matchAll(/^export\s+(?:const|async function|function)\s+([A-Z]+)\b/gm)].map(
        (m) => m[1],
      ),
    );
    for (const method of declared) {
      checked += 1;
      if (!exported.has(method)) wrong.push(`${file} is documented as ${method} but does not export it`);
    }
  }
  assert.ok(checked > 20, `expected to check many endpoint methods, checked ${checked}`);
  assert.deepEqual(wrong, [], `\n  ${wrong.join("\n  ")}`);
});

test("the code map's live table list matches the migration chain", () => {
  // Replay the chain the way D1 does. A table dropped later is not live, and a
  // table recreated after a drop is — order is the whole point, so this cannot
  // be a grep for CREATE.
  const live = new Set<string>();
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = readFileSync(new URL(file, MIGRATIONS_DIR), "utf8");
    for (const match of sql.matchAll(
      /\b(CREATE TABLE(?:\s+IF NOT EXISTS)?|DROP TABLE(?:\s+IF EXISTS)?)\s+[`"]?([a-z_]+)/gi,
    )) {
      const name = match[2].toLowerCase();
      if (match[1].toUpperCase().startsWith("CREATE")) live.add(name);
      else live.delete(name);
    }
    for (const match of sql.matchAll(/\bALTER TABLE\s+[`"]?([a-z_]+)[`"]?\s+RENAME TO\s+[`"]?([a-z_]+)/gi)) {
      live.delete(match[1].toLowerCase());
      live.add(match[2].toLowerCase());
    }
  }

  const section = map.slice(map.indexOf("\n## 10."), map.indexOf("\n## 11."));
  const documented = new Set<string>();
  for (const row of section.split("\n").filter((line) => line.startsWith("| `"))) {
    for (const name of row.split("|")[1].matchAll(/`([a-z_]+)`/g)) documented.add(name[1]);
  }

  assert.deepEqual(
    [...documented].sort(),
    [...live].sort(),
    "section 10 of docs/CODE-MAP.md disagrees with the migration chain",
  );
});

test("the code map's stated table count matches its own table list", () => {
  const heading = map.match(/^## 10\. Database \(D1, (\d+) live tables\)$/m);
  assert.ok(heading, "section 10 must state how many live tables it documents");
  const section = map.slice(map.indexOf("\n## 10."), map.indexOf("\n## 11."));
  const documented = new Set<string>();
  for (const row of section.split("\n").filter((line) => line.startsWith("| `"))) {
    for (const name of row.split("|")[1].matchAll(/`([a-z_]+)`/g)) documented.add(name[1]);
  }
  assert.equal(documented.size, Number(heading[1]));
});
