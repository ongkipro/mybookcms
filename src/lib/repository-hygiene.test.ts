import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

/**
 * REQ-210: the repository contains no host or network address belonging to one
 * developer's machine, and seeds, fixtures and docs use documentation addresses.
 *
 * Until 2026-09-08 nothing asserted that, and the requirement was true only
 * because nobody had pasted one in recently — which was not the case earlier:
 * A-241 was reproduced against a Tailscale origin and the address travelled into
 * a task entry, where it sat until this guard was written. That is the shape of
 * leak this repository actually has, so `docs/` and the root Markdown files are
 * scanned alongside `src/` and `scripts/`. A guard that only read code would
 * have missed the one real incident.
 *
 * The rule is an allowlist of ranges, never a ban on IP literals. Banning every
 * literal would fail on the loopback and RFC 5737 addresses the requirement
 * explicitly asks for, and a check that fires on correct code is a check the
 * next author disables.
 */

const root = new URL("../..", import.meta.url).pathname;

/** Addresses a tracked file may contain, and why each is allowed. */
const PERMITTED = [
  { name: "loopback (127.0.0.0/8)", test: (o: number[]) => o[0] === 127 },
  { name: "unspecified (0.0.0.0)", test: (o: number[]) => o.every((part) => part === 0) },
  { name: "broadcast (255.255.255.255)", test: (o: number[]) => o.every((part) => part === 255) },
  // RFC 5737, reserved for documentation and examples — what REQ-210 asks for.
  { name: "RFC 5737 TEST-NET-1 (192.0.2.0/24)", test: (o: number[]) => o[0] === 192 && o[1] === 0 && o[2] === 2 },
  { name: "RFC 5737 TEST-NET-2 (198.51.100.0/24)", test: (o: number[]) => o[0] === 198 && o[1] === 51 && o[2] === 100 },
  { name: "RFC 5737 TEST-NET-3 (203.0.113.0/24)", test: (o: number[]) => o[0] === 203 && o[1] === 0 && o[2] === 113 },
];

const SCANNED = /^(src|scripts|docs)\/|^[A-Za-z0-9_-]+\.md$/;
// `.delivery/` is the ledger's own append-only evidence and is not edited here;
// `package-lock.json` is generated and carries registry hosts, not machines.
const EXCLUDED = /^\.delivery\/|^package-lock\.json$|^src\/lib\/repository-hygiene\.test\.ts$/;

/** Only well-formed IPv4: octets 0-255. Fixtures deliberately carry malformed
 *  strings like `562.253.647.394` to exercise validation, and those are not
 *  addresses of anything. */
const IPV4 = /\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g;

function trackedFiles(): string[] {
  return execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter((path) => path && SCANNED.test(path) && !EXCLUDED.test(path));
}

test("no tracked file carries a host address outside the documentation ranges", () => {
  const found: string[] = [];
  for (const path of trackedFiles()) {
    const source = readFileSync(join(root, path), "utf8");
    for (const match of source.matchAll(IPV4)) {
      const octets = match.slice(1, 5).map(Number);
      if (octets.some((part) => part > 255)) continue;
      if (PERMITTED.some((range) => range.test(octets))) continue;
      const line = source.slice(0, match.index).split("\n").length;
      found.push(`${path}:${line} ${match[0]}`);
    }
  }
  assert.deepEqual(
    found,
    [],
    `REQ-210: replace with a documentation address (${PERMITTED.map((range) => range.name).join("; ")}), or a descriptive placeholder where naming the real origin adds nothing:\n${found.join("\n")}`,
  );
});

test("the permitted ranges are the ones REQ-210 names, and the guard still reads them", () => {
  // Without this, the allowlist above could quietly grow to cover a real
  // address and the first test would keep passing.
  assert.equal(PERMITTED.length, 6);
  for (const [address, allowed] of [
    ["127.0.0.1", true], ["192.0.2.1", true], ["198.51.100.10", true], ["203.0.113.4", true],
    ["100.127.67.86", false], ["10.0.0.5", false], ["192.168.1.20", false], ["70.41.3.18", false],
  ] as const) {
    const octets = address.split(".").map(Number);
    assert.equal(
      PERMITTED.some((range) => range.test(octets)),
      allowed,
      `${address} should be ${allowed ? "permitted" : "refused"}`,
    );
  }
});
