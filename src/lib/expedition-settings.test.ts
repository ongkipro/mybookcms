import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { PATCH, POST } from "../pages/api/admin/expeditions.ts";

function createDatabase(options: { overlap?: boolean; zoneCode?: string } = {}) {
  const statements: Array<{ query: string; values: unknown[] }> = [];
  const database = {
    prepare(query: string) {
      const entry = { query, values: [] as unknown[] };
      statements.push(entry);
      const statement = {
        bind(...values: unknown[]) {
          entry.values = values;
          return statement;
        },
        async first() {
          return query.includes("FROM shipping_zones") ? { id: 2, code: options.zoneCode || "peninsular" } : null;
        },
        async run() {
          if (options.overlap && query.includes("UPDATE shipping_postcode_ranges")) {
            throw new Error("D1_ERROR: active shipping postcode ranges overlap");
          }
          return { meta: { changes: 1, last_row_id: 17 } };
        },
      };
      return statement;
    },
  } as unknown as D1Database;
  return { database, statements };
}

function context(database: D1Database, method: "POST" | "PATCH", body: Record<string, unknown>) {
  return {
    locals: { runtimeEnv: { OMS_DB: database } },
    request: new Request("https://store.example/api/admin/expeditions", {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  } as never;
}

test("a new Malaysia postcode range is always created inactive", async () => {
  const { database, statements } = createDatabase();
  const response = await POST(context(database, "POST", {
    kind: "postcode",
    zoneId: 2,
    postcodeStart: "87000",
    postcodeEnd: "87033",
  }));
  assert.equal(response.status, 201);
  const insert = statements.find((entry) => entry.query.includes("INSERT INTO shipping_postcode_ranges"));
  assert.deepEqual(insert?.values, [2, "87000", "87033"]);
  assert.match(insert?.query || "", /VALUES \(\?, \?, \?, 0\)/);
});

test("state rates are stored only under their canonical fallback zone", async () => {
  const valid = createDatabase();
  const validResponse = await POST(context(valid.database, "POST", {
    kind: "rate",
    zoneId: 2,
    stateCode: "johor",
    minWeightGrams: 5001,
    maxWeightGrams: 10000,
    amountSen: 900,
    isActive: false,
  }));
  assert.equal(validResponse.status, 201);
  const insert = valid.statements.find((entry) => entry.query.includes("INSERT INTO shipping_rate_rules"));
  assert.deepEqual(insert?.values, [2, 5001, 10000, 900, 0, "johor"]);

  const mismatch = createDatabase();
  const mismatchResponse = await POST(context(mismatch.database, "POST", {
    kind: "rate",
    zoneId: 2,
    stateCode: "sabah",
    minWeightGrams: 5001,
    maxWeightGrams: 10000,
    amountSen: 1500,
    isActive: false,
  }));
  assert.equal(mismatchResponse.status, 400);
  assert.match(JSON.stringify(await mismatchResponse.json()), /tidak cocok/);
});

test("postcode range mutations reject malformed or overlapping active policy", async () => {
  const invalid = createDatabase();
  const invalidResponse = await POST(context(invalid.database, "POST", {
    kind: "postcode",
    zoneId: 1,
    postcodeStart: "900",
    postcodeEnd: "800",
  }));
  assert.equal(invalidResponse.status, 400);
  assert.equal(invalid.statements.length, 0);

  const overlap = createDatabase({ overlap: true });
  const overlapResponse = await PATCH(context(overlap.database, "PATCH", {
    kind: "postcode",
    id: 4,
    zoneId: 2,
    postcodeStart: "86000",
    postcodeEnd: "88000",
    isActive: true,
  }));
  assert.equal(overlapResponse.status, 409);
  assert.match(JSON.stringify(await overlapResponse.json()), /bertindih/);
});

/**
 * A-224 split the workspace into three URL-addressable panels. These are the
 * source-level guards for the properties a browser check proves once but a
 * refactor could quietly remove: the panel identifiers stay addressable, the
 * three jobs stay separate, and — the actual defect A-224 fixed — a reload
 * triggered by another row's save no longer discards an unsaved tariff.
 */
const workspace = readFileSync(
  new URL("../components/admin/ExpeditionSettings.tsx", import.meta.url),
  "utf8",
);

test("the three shipping jobs stay separate and URL-addressable", () => {
  assert.match(workspace, /const PANELS = \["states", "zones", "fallback"\] as const/);
  // `?panel=` is read on mount and written on change, so a reload or a link
  // from a runbook lands on the same job.
  assert.match(workspace, /new URLSearchParams\(window\.location\.search\)\.get\("panel"\)/);
  assert.match(workspace, /url\.searchParams\.set\("panel", next\)/);
  assert.match(workspace, /window\.history\.replaceState/);
  // One Tabs panel per job, so only the selected one occupies page flow.
  for (const value of ["states", "zones", "fallback"]) {
    assert.match(workspace, new RegExp(`<TabsContent value="${value}">`));
  }
});

test("an unsaved tariff survives a reload caused by another row", () => {
  // The defect: `load` rebuilt every draft from the server response, and every
  // mutation calls `load`. Editing row A then toggling row B discarded A.
  assert.match(workspace, /const dirty = new Set\(/);
  assert.match(workspace, /dirty\.has\(rate\.id\)/);
  // Dirtiness is measured against the server value the draft was edited from,
  // which is what the refs exist to make available inside `load`.
  assert.match(workspace, /draft !== undefined && draft !== ringgitOf\(rate\.amountSen\)/);
  assert.match(workspace, /ratesRef\.current/);
  assert.match(workspace, /draftsRef\.current/);
  // And the operator is told, rather than left to notice.
  assert.match(workspace, /Berpindah panel tidak menghapusnya/);
});

test("postcode and fallback editing refuse to close over unsaved input", () => {
  assert.match(workspace, /const requestRangeEditorClose = \(open: boolean\)/);
  assert.match(workspace, /const requestNewRuleClose = \(open: boolean\)/);
  assert.match(workspace, /Simpan atau batalkan perubahan rentang poskod terlebih dahulu/);
  assert.match(workspace, /Simpan atau batalkan weight band yang sedang disusun/);
  // Discarding is possible, but only as a deliberate act.
  assert.match(workspace, /const discardRangeEditor = /);
  assert.match(workspace, /const discardNewRule = /);
  // A server refusal keeps the sheet open with the values intact.
  assert.match(workspace, /setRangeEditorError\(cause instanceof Error/);
  assert.match(workspace, /setNewRuleServerError\(message\)/);
});

test("zones collapse independently and immediate switches are unchanged", () => {
  assert.match(workspace, /const \[openZones, setOpenZones\] = useState<number\[\]>\(\[\]\)/);
  assert.match(workspace, /aria-expanded=\{open\}/);
  assert.match(workspace, /aria-controls=\{panelId\}/);
  // A switch still writes immediately; an amount still needs its own save.
  assert.match(workspace, /onCheckedChange=\{\(checked\) => void patch\(\{ kind: "zone"/);
  assert.match(workspace, /disabled=\{!changed \|\| pending === `rate-\$\{rate\.id\}`\}/);
  // New rules are still created inactive for explicit review.
  assert.match(workspace, /isActive: false,/);
});

test("closing a sheet puts focus back on the control that opened it", () => {
  // Measured, not assumed. Both sheets are state-controlled with no
  // `SheetTrigger`, and Radix's own restore did not run: focus landed on
  // `<body>` and stayed there through eight polls, which would drop a keyboard
  // or screen-reader user at the top of the document after every edit.
  assert.match(workspace, /const sheetOpenerRef = useRef<HTMLElement \| null>\(null\)/);
  assert.match(workspace, /const rememberOpener = \(\) => \{/);
  assert.match(workspace, /const restoreOpenerFocus = \(\) => \{/);
  // Only refocus a control that is still in the document: saving a postcode
  // re-renders its row, and focusing a detached node silently does nothing.
  assert.match(workspace, /if \(opener\.isConnected\) opener\.focus\(\)/);
  // Two open paths: `openRangeEditor`, which both the add and edit postcode
  // controls route through, and the add-weight-band button.
  assert.equal((workspace.match(/rememberOpener\(\)/g) ?? []).length, 2);
  // Restored on every close path: refuse-then-close, discard, and save, for
  // both sheets.
  assert.ok(
    (workspace.match(/restoreOpenerFocus\(\)/g) ?? []).length >= 6,
    "a sheet close path is missing its focus restore",
  );
});
