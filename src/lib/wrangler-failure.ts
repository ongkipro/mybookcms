/**
 * Reading a wrangler failure. Extracted from `shipping-bootstrap.test.ts` under
 * A-275 after an independent review pointed out that exporting these from a test
 * module makes importing them run that file's migration chain.
 */
/**
 * A-275. A wrangler failure arrives here through `execFileSync`, in `before()`,
 * where the runner prints no test name — so the tail of `npm test` is a stack
 * over wrangler's own output and nothing says which file died. One such failure
 * went unattributed for a day on 2026-09-08.
 *
 * The subtlety that defeated the first attempt at this: wrangler logs
 * `Migration <name> failed with the following errors:` through `logger.error`
 * too, so BOTH that wrapper and the real cause carry the `[ERROR]` prefix, and
 * the wrapper comes first. Taking the first `[ERROR]` line yields a sentence
 * ending in "the following errors:" and nothing else — which is how a genuine
 * SQL failure loses its reason. Take the last, and keep the wrapper only when
 * it is all there is.
 */
export function describeWranglerFailure(args: readonly string[], error: unknown): string {
  const streams = error as { stderr?: unknown; stdout?: unknown };
  const text = `${String(streams?.stderr ?? "")}\n${String(streams?.stdout ?? "")}`;
  // Strip wrangler's own ANSI colouring before matching.
  const plain = text.replace(/\u001B\[[0-9;]*m/g, "");
  const reported = [...plain.matchAll(/\[ERROR\]\s*(.+)/g)]
    .map((match) => match[1].trim())
    .filter((line) => line.length > 0);
  // The wrapper announces that causes follow; it is never the cause itself.
  const causes = reported.filter((line) => !/failed with the following errors:$/.test(line));
  const detail =
    causes.at(-1) ?? reported.at(-1) ?? String((error as Error)?.message ?? error).split("\n")[0];
  const command = `wrangler ${args.slice(0, 3).join(" ")}`;
  const note = isTransientPortDraw(detail)
    ? " — a transient port draw, not a migration error, whichever migration the chain was on when it died"
    : "";
  return `shipping-bootstrap: ${command} failed: ${detail}${note}`;
}

/**
 * The failures worth another attempt, and why each one is transient.
 *
 * `bad port` is the surprise. It is not a bind failure: undici raises it from
 * `requestBadPort`, the WHATWG blocked-port check, when wrangler fetches its own
 * local server on a port in that list. Nineteen blocked ports sit at or above
 * 1024 — 6000, 6566, 6665-6669, 6697 among them — and this machine's
 * `ip_local_port_range` is 1024-65535, so an ephemeral draw lands on one about
 * once in 3,400. That is the shape of the observed flake: rare, unrelated to the
 * migration it names, and unaffected by how many peer test files hold ports. A
 * fresh attempt draws a fresh port, which is why retrying is the fix rather than
 * serialising the suite.
 *
 * `EADDRINUSE` and a failed listen are included because workerd does bind, and
 * a genuine collision is transient in the same way. Neither has been observed
 * here; they are not the diagnosis, only the same remedy.
 */
export function isTransientPortDraw(detail: string): boolean {
  return /bad port|EADDRINUSE|address already in use|listen[^\n]*failed/i.test(detail);
}

/** Sleep inside a synchronous hook. `execFileSync` and `before()` are both sync. */
function pauseSync(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Retries a whole attempt, not a command. Each attempt gets its own state
 * directory: the recorded failure died mid-chain, and D1 local does not wrap a
 * migration body and its `d1_migrations` bookkeeping insert in one transaction,
 * so resuming over a half-applied directory can re-run an applied migration into
 * a permanent "already exists". Reapplying the chain is what this hook does
 * anyway, so a fresh directory costs nothing and removes the question.
 */
export function retryTransient<T>(
  attemptOnce: () => T,
  args: readonly string[],
  attempts = 3,
  pause: (ms: number) => void = pauseSync,
): T {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return attemptOnce();
    } catch (error) {
      const described = describeWranglerFailure(args, error);
      // `cause` keeps wrangler's full output reachable. The message is short so
      // a `tail` is readable; nothing is discarded to achieve that.
      if (attempt >= attempts || !isTransientPortDraw(described)) {
        throw new Error(described, { cause: error });
      }
      pause(attempt * 750);
    }
  }
}
