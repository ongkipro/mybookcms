import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

/**
 * A-256. The admin drifted to ~1,000 raw palette uses against a semantic layer
 * that already named the colours, because nothing could notice. This is the
 * mechanism that notices.
 *
 * It forbids only the shades the sweep converted, by name. A blanket "no
 * `slate-*` in admin" rule would be shorter and wrong: several raw shades are
 * deliberate and measured, and each is listed below with why it stays.
 */

const ADMIN = new URL("../components/admin/", import.meta.url);

/** Converted 2026-09-09. Each maps to a token the semantic layer already had. */
const CONVERTED: Readonly<Record<string, string>> = {
  "text-slate-500": "text-muted-foreground",
  "text-slate-700": "text-foreground-subtle",
  "text-slate-900": "text-foreground",
  "text-slate-950": "text-foreground",
  "border-slate-200": "border-border",
  "bg-slate-50": "bg-muted",
  "bg-slate-100": "bg-muted",
  "bg-white": "bg-card",
};

const LAYOUT = new URL("../layouts/AdminLayout.astro", import.meta.url);

/**
 * The layout is included because it sets the ink every component inherits. It
 * carried `text-slate-900` on `<body>` until A-256, so converting the children
 * while the parent stayed raw would have produced the mismatch this task exists
 * to remove.
 */
const components = () => [
  ...readdirSync(ADMIN)
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => ({ name, source: readFileSync(new URL(name, ADMIN), "utf8") })),
  { name: "AdminLayout.astro", source: readFileSync(LAYOUT, "utf8") },
];

test("no admin component re-introduces a shade the semantic layer names", () => {
  const files = components();
  assert.ok(files.length > 20, `expected the admin component directory, found ${files.length} files`);

  const offences: string[] = [];
  for (const { name, source } of files) {
    for (const [shade, token] of Object.entries(CONVERTED)) {
      // Word-bounded so `bg-white` does not match `bg-whitespace`, and so a
      // variant prefix like `hover:` or `md:` is still caught.
      if (new RegExp(`\\b${shade}\\b`).test(source)) {
        offences.push(`${name}: ${shade} — use ${token}`);
      }
    }
  }
  assert.deepEqual(offences, [], `raw palette shades returned:\n${offences.join("\n")}`);
});

test("the zinc vocabulary stays retired", () => {
  // Two vocabularies for one greyscale is how the drift started. `zinc` was
  // down to six uses in one file when A-256 removed it.
  const offences = components()
    .filter(({ source }) => /\bzinc-\d{2,3}\b/.test(source))
    .map(({ name }) => name);
  assert.deepEqual(offences, [], `zinc returned in: ${offences.join(", ")}`);
});

test("the deliberate raw shades are still deliberate, and still there", () => {
  /**
   * These are the carve-outs. The guard asserts they are *present* rather than
   * merely permitted, so that a future sweep quietly converting them fails here
   * and has to argue with this comment first.
   *
   * `text-slate-600` — 90 uses across 18 files. `DESIGN-SYSTEM.md` records the
   * measurement: muted text on the admin page background uses slate-600 for
   * 7.26:1, because slate-500 there is 4.41 and fails. Mapping these to
   * `--muted-foreground` (#5f6a77, 5.13 on that ground) would pass AA and still
   * be a contrast *reduction* on text that was deliberately darkened. A-256's
   * entry claimed seventeen occurrences across three files; that figure does not
   * reproduce and the rule, not the count, is what governs.
   *
   * `text-slate-400` — the designer handoff split these by role rather than
   * mapping them: decorative icons and placeholders may stay light, while text
   * nodes among them are live AA failures at 2.56. That needs reading each
   * occurrence, so it is not swept here and not forbidden here.
   *
   * `bg-slate-900` / `bg-slate-950` — deliberate dark surfaces (primary action
   * buttons, one dark panel). `--foreground` is an ink, not a ground; there is
   * no semantic token for a dark surface, so mapping them would invent one.
   */
  const source = components()
    .map(({ source }) => source)
    .join("\n");
  assert.ok(/\btext-slate-600\b/.test(source), "the measured page-background pairing disappeared");
  assert.ok(/\btext-slate-400\b/.test(source), "the role-split shade disappeared without A-256 deciding it");
  assert.ok(/\bbg-slate-9(00|50)\b/.test(source), "the deliberate dark surfaces disappeared");
});
