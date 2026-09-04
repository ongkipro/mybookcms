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
  assert.match(workspace, /ratesRef\.current/);
  assert.match(workspace, /draftsRef\.current/);
  // And the operator is told, rather than left to notice.
  assert.match(workspace, /Berpindah panel tidak menghapusnya/);
});

test("a draft counts as dirty by value, not by how it was spelled", async () => {
  // This one is a real unit, not a regex, because the first version of these
  // tests asserted the exact expression that carried the bug and passed.
  //
  // The defect it now covers: dirtiness was compared as strings, and
  // `ringgitOf` always renders two decimals. An operator who typed `10` and
  // saved it left a draft of "10" against a server rendering of "10.00", so the
  // row was classified dirty forever — the amber banner never cleared and the
  // reload kept preferring a draft equal to the stored value. The browser
  // evidence had used `9.99`, the one shape that round-trips unchanged.
  const { isDraftDirty, isDraftSavable } = await import("./tariff-draft.ts");

  // Same money, different spelling: not dirty.
  for (const spelling of ["10", "10.0", "10.00", " 10.00 "]) {
    assert.equal(isDraftDirty(spelling, 1000), false, `${JSON.stringify(spelling)} should be clean against 1000 sen`);
  }
  // Rounding to the same sen is also not dirty.
  assert.equal(isDraftDirty("10.001", 1000), false);

  // Genuinely different money is dirty.
  assert.equal(isDraftDirty("10.01", 1000), true);
  assert.equal(isDraftDirty("9.99", 1000), true);
  assert.equal(isDraftDirty("0", 1000), true);

  // No draft at all is not dirty; unparseable input is, because it is something
  // the operator typed that the store does not hold.
  assert.equal(isDraftDirty(undefined, 1000), false);
  assert.equal(isDraftDirty("abc", 1000), true);
  assert.equal(isDraftDirty("Infinity", 1000), true);

  // An emptied field is dirty even against a stored zero. `Number("")` is 0, so
  // a value-only comparison would call a cleared input identical to a RM 0.00
  // rate — the same mistake as "10" versus "10.00", the other way round.
  assert.equal(isDraftDirty("", 1000), true);
  assert.equal(isDraftDirty("", 0), true);
  assert.equal(isDraftDirty("   ", 0), true);
  // While a real zero against a stored zero is clean.
  assert.equal(isDraftDirty("0", 0), false);
  assert.equal(isDraftDirty("0.00", 0), false);

  // Dirty and savable are different questions, and conflating them let an empty
  // box save RM 0.00 and make that band's shipping free.
  assert.equal(isDraftSavable("", 800), false, "an empty box must never be savable");
  assert.equal(isDraftSavable("   ", 800), false);
  assert.equal(isDraftSavable(undefined, 800), false);
  assert.equal(isDraftSavable("abc", 800), false);
  assert.equal(isDraftSavable("-5", 800), false, "a negative tariff must never be savable");
  assert.equal(isDraftSavable("10", 800), true);
  // A real zero typed on purpose is savable; an emptied field is not.
  assert.equal(isDraftSavable("0", 800), true);
  assert.equal(isDraftSavable("8.00", 800), false, "an unchanged value is not a save");
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
  assert.match(workspace, /if \(opener\.isConnected\) \{/);
  // And a remounted opener falls back to the selected tab rather than <body>,
  // which is the same failure the guard exists to prevent.
  assert.match(workspace, /\[role="tab"\]\[aria-selected="true"\]/);
  // Two open paths: `openRangeEditor`, which both the add and edit postcode
  // controls route through, and the add-weight-band button. Counting call sites
  // is a weak check — it passes if a restore is moved rather than removed — so
  // it is here to catch a *new* sheet added without one, not to prove the
  // behaviour. The behaviour itself was proven in a browser.
  assert.equal((workspace.match(/rememberOpener\(\)/g) ?? []).length, 2);
  // Restored on every close path: refuse-then-close, discard, and save, for
  // both sheets.
  assert.ok(
    (workspace.match(/restoreOpenerFocus\(\)/g) ?? []).length >= 6,
    "a sheet close path is missing its focus restore",
  );
});
