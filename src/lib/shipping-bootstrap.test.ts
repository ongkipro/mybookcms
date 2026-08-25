import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
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

test("a clean migration chain provisions complete active Malaysia shipping policy", () => {
  const stateDirectory = mkdtempSync(join(tmpdir(), "mybookcms-shipping-bootstrap-"));
  try {
    runWrangler([
      "d1",
      "migrations",
      "apply",
      "OMS_DB",
      "--local",
      "--persist-to",
      stateDirectory,
    ]);

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
  } finally {
    rmSync(stateDirectory, { recursive: true, force: true });
  }
});
