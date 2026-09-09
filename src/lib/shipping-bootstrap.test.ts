import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test, { after, before } from "node:test";
import {
  describeWranglerFailure,
  isTransientPortDraw,
  retryTransient,
} from "./wrangler-failure.ts";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const wranglerBin = join(projectRoot, "node_modules", "wrangler", "bin", "wrangler.js");

function runWrangler(args: string[]) {
  return execFileSync(process.execPath, [wranglerBin, ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/**
 * One chain for the whole file. Applying it is what costs — roughly twenty
 * seconds — while querying it afterwards is nearly free, and two tests each
 * spawning their own wrangler also raced each other into an intermittent
 * failure.
 */
let stateDirectory = "";

const applyArgs = ["d1", "migrations", "apply", "OMS_DB", "--local", "--persist-to"] as const;

before(() => {
  const abandoned: string[] = [];
  retryTransient(() => {
    stateDirectory = mkdtempSync(join(tmpdir(), "mybookcms-clean-chain-"));
    abandoned.push(stateDirectory);
    return runWrangler([...applyArgs, stateDirectory]);
  }, applyArgs);
  // Every attempt but the one that succeeded left a half-applied directory.
  for (const directory of abandoned) {
    if (directory !== stateDirectory) rmSync(directory, { recursive: true, force: true });
  }
});

after(() => {
  if (stateDirectory) rmSync(stateDirectory, { recursive: true, force: true });
});

test("a clean migration chain provisions complete active Malaysia shipping policy", () => {
  const output = runWrangler([
      "d1",
      "execute",
      "OMS_DB",
      "--local",
      "--persist-to",
      stateDirectory,
      "--json",
      "--command",
      `SELECT
        (SELECT COUNT(*) FROM shipping_zones WHERE is_active = 1) AS active_zones,
        (SELECT COUNT(*) FROM shipping_postcode_ranges WHERE is_active = 1) AS active_ranges,
        (SELECT COUNT(*) FROM shipping_rate_rules WHERE is_active = 1) AS active_rules,
        (SELECT COUNT(*) FROM shipping_rate_rules WHERE is_active = 1 AND state_code IS NOT NULL) AS active_state_rules,
        (SELECT COUNT(*) FROM shipping_rate_rules WHERE is_active = 1 AND state_code IS NULL) AS active_fallback_rules,
        (SELECT COUNT(*) FROM malaysia_postcodes) AS postcode_rows,
        (SELECT COUNT(*) FROM malaysia_postcodes p WHERE NOT EXISTS (
          SELECT 1 FROM shipping_postcode_ranges r
          INNER JOIN shipping_zones z ON z.id = r.shipping_zone_id
          WHERE r.is_active = 1 AND z.is_active = 1
            AND p.postcode BETWEEN r.postcode_start AND r.postcode_end
        )) AS unmapped_postcodes,
        (SELECT COUNT(*) FROM malaysia_postcodes p
          INNER JOIN shipping_postcode_ranges r ON p.postcode BETWEEN r.postcode_start AND r.postcode_end
          INNER JOIN shipping_zones z ON z.id = r.shipping_zone_id
          WHERE p.postcode = '91400' AND p.city = 'Kalabakan'
            AND r.is_active = 1 AND z.code = 'sabah'
        ) AS kalabakan_sabah_matches`,
    ]);

    const result = JSON.parse(output) as Array<{ results?: Array<Record<string, number>> }>;
    assert.deepEqual(result[0]?.results?.[0], {
      active_zones: 4,
      active_ranges: 4,
      active_rules: 36,
      active_state_rules: 16,
      active_fallback_rules: 20,
      postcode_rows: 2931,
    unmapped_postcodes: 0,
    kalabakan_sabah_matches: 1,
  });
});

/**
 * The four reads `loadSystemLog` performs, with the same shape and ordering.
 *
 * Asserted as query *plans* rather than as "does a migration create an index",
 * because an index that exists but leads with the wrong column — which is what
 * `payment_events` already had — looks identical to a correct one from source.
 * Three of these used to cost a full scan plus a temporary B-tree to sort.
 */
const SYSTEM_LOG_READS: ReadonlyArray<{ source: string; sql: string }> = [
  {
    source: "capi_event_outbox",
    sql: "SELECT event_name, event_id, status, attempts, updated_at FROM capi_event_outbox WHERE updated_at >= '2026-08-05' ORDER BY updated_at DESC, id DESC LIMIT 40",
  },
  {
    source: "notifications",
    sql: "SELECT type, order_number, created_at FROM notifications WHERE created_at >= '2026-08-05' ORDER BY created_at DESC, id DESC LIMIT 40",
  },
  {
    source: "payment_events",
    sql: "SELECT e.source, e.resulting_status, e.received_at, e.payment_attempt_id, a.error_class, o.order_number FROM payment_events e JOIN payment_attempts a ON a.id = e.payment_attempt_id JOIN orders o ON o.id = a.order_id WHERE e.received_at >= '2026-08-05' ORDER BY e.received_at DESC, e.id DESC LIMIT 40",
  },
  {
    source: "headless_api_audit_events",
    sql: "SELECT api_key_id, operation, outcome, status_code, created_at FROM headless_api_audit_events WHERE created_at >= '2026-08-05' ORDER BY created_at DESC, id DESC LIMIT 40",
  },
];

test("a clean migration chain leaves every system-log read on an index with no sort", () => {
  // Shares this file because applying the chain is what costs; asking for the
  // plans afterwards is nearly free, and a second file paid the whole 20 seconds
  // again.
  const output = runWrangler([
      "d1", "execute", "OMS_DB", "--local", "--persist-to", stateDirectory, "--json",
      "--command", SYSTEM_LOG_READS.map((read) => `EXPLAIN QUERY PLAN ${read.sql}`).join("; "),
    ]);
    const resultSets = JSON.parse(output.slice(output.indexOf("["))) as Array<{
      results: Array<{ detail: string }>;
    }>;
    assert.equal(resultSets.length, SYSTEM_LOG_READS.length, "expected one plan per read");

    for (const [index, read] of SYSTEM_LOG_READS.entries()) {
      const details = resultSets[index].results.map((row) => row.detail);
      assert.ok(details.length > 0, `${read.source}: no query plan came back`);
      // The driving table must be reached through an index. Joined tables are
      // allowed to be searched by key, which is what they already do.
      assert.match(
        details[0],
        /^SEARCH .* USING (?:COVERING )?INDEX/,
        `${read.source} is not using an index: ${details[0]}`,
      );
      // And the ordering must come from that index rather than a sort — the
      // half a "does the index exist" check would miss.
      assert.ok(
        !details.some((detail) => /TEMP B-TREE/.test(detail)),
        `${read.source} still sorts in a temporary B-tree: ${details.join(" | ")}`,
    );
  }
});


/** An `execFileSync` failure carries wrangler's output on `stderr`. */
function wranglerError(stderr: string) {
  return Object.assign(new Error("Command failed"), { stderr, stdout: "" });
}

test("a wrangler failure names itself and does not lose its cause", () => {
  // A-275, rebuilt after the independent review proved the first version of
  // this test passed only against an unfaithful fixture. Wrangler logs the
  // wrapper line through `logger.error` as well, so BOTH lines carry the
  // `[ERROR]` prefix and the wrapper comes first — verified in
  // node_modules/wrangler/wrangler-dist/cli.js. The first draft stripped that
  // prefix off the wrapper, which wrangler cannot emit, and so the reporter
  // appeared to work while being inert on real output.
  const esc = "\u001B";
  const colour = (line: string) =>
    `${esc}[31m x ${esc}[41;31m[${esc}[41;97mERROR${esc}[41;31m]${esc}[0m ${esc}[1m${line}${esc}[0m`;
  const faithful = [
    colour("Migration 0034_remove_foreign_sample_product.sql failed with the following errors:"),
    "",
    colour("bad port"),
  ].join("\n");

  const described = describeWranglerFailure(applyArgs, wranglerError(faithful));
  assert.match(described, /^shipping-bootstrap: /, "the message must name the file it came from");
  assert.match(described, /bad port/, "it must carry the cause, not the wrapper that announces one");
  assert.match(described, /transient port draw/, "and clear the migration chain of blame");
  assert.doesNotMatch(described, /0034/, "the migration name must not lead the message");
  assert.ok(described.length < 400, `a tail-readable message, got ${described.length} chars`);

  // A genuine SQL failure keeps its reason. Taking the first `[ERROR]` line
  // reported "...with the following errors:" and stopped there, which is less
  // than the raw payload used to carry.
  const sqlFailure = [
    colour("Migration 0044_retire_wide_catalog.sql failed with the following errors:"),
    "",
    colour('near "CREATE": syntax error'),
  ].join("\n");
  const genuine = describeWranglerFailure(applyArgs, wranglerError(sqlFailure));
  assert.match(genuine, /near "CREATE": syntax error/, "a real failure must keep its cause");
  assert.doesNotMatch(genuine, /transient port draw/, "and must not be dressed up as a port draw");
  assert.equal(isTransientPortDraw(genuine), false);

  // The wrapper alone is all there is: report it rather than nothing.
  const wrapperOnly = describeWranglerFailure(
    applyArgs,
    wranglerError(colour("Migration 0001_x.sql failed with the following errors:")),
  );
  assert.match(wrapperOnly, /failed with the following errors:/);

  // Degrade rather than crash when there is no wrangler output at all.
  assert.match(describeWranglerFailure(applyArgs, new Error("spawn ENOENT")), /spawn ENOENT/);
  assert.match(describeWranglerFailure(applyArgs, "plain string"), /plain string/);
});

test("a transient port draw is retried on a fresh state directory, and a real refusal is not", () => {
  const slept: number[] = [];
  const directories: string[] = [];
  let calls = 0;
  const flaky = () => {
    calls += 1;
    directories.push(`state-${calls}`);
    if (calls < 3) throw wranglerError("[ERROR] bad port");
    return "applied";
  };
  assert.equal(retryTransient(flaky, applyArgs, 3, (ms) => slept.push(ms)), "applied");
  assert.equal(calls, 3, "two transient draws must not end the run");
  assert.deepEqual(slept, [750, 1500], "and the attempts must be spaced, not spun");
  assert.equal(new Set(directories).size, 3, "each attempt must start from its own state");

  // Exhausting the attempts reports rather than hangs, and keeps the payload.
  const original = wranglerError("[ERROR] bad port");
  let always = 0;
  let exhausted: unknown;
  try {
    retryTransient(() => { always += 1; throw original; }, applyArgs, 3, () => {});
    assert.fail("exhausting the attempts must throw");
  } catch (error) {
    exhausted = error;
  }
  assert.match(String((exhausted as Error).message), /shipping-bootstrap: .*bad port/);
  assert.equal(always, 3);
  assert.equal((exhausted as { cause?: unknown }).cause, original, "the full output must stay reachable");

  // A syntax error is a refusal, not a draw: one attempt, no retry, no delay.
  let once = 0;
  assert.throws(
    () =>
      retryTransient(
        () => { once += 1; throw wranglerError('[ERROR] near "CREATE": syntax error'); },
        applyArgs,
        3,
        () => assert.fail("a real refusal must not sleep"),
      ),
    /syntax error/,
  );
  assert.equal(once, 1, "a real refusal must be reported on the first attempt");
});
