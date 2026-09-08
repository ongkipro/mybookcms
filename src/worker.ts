import type { ExportedHandler } from "@cloudflare/workers-types";
import { handle } from "@astrojs/cloudflare/handler";
import { drainConfiguredCapiOutbox } from "./lib/capi-outbox.ts";
import { reconcileDueDokuPayments } from "./lib/doku-reconciliation.ts";
import { pruneSystemEvents, runScheduledSystemJob } from "./lib/system-events.ts";

export default {
  fetch: handle,
  scheduled(_controller, env, ctx) {
    ctx.waitUntil(
      runScheduledSystemJob(env.OMS_DB, "capi", () => drainConfiguredCapiOutbox(env)),
    );
    ctx.waitUntil(
      runScheduledSystemJob(env.OMS_DB, "doku", () => reconcileDueDokuPayments(env)),
    );
    ctx.waitUntil(pruneSystemEvents(env.OMS_DB).catch(() => {
      console.error("system-events-retention-failed", { error_class: "local_transition" });
    }));
  },
} satisfies {
  fetch: typeof handle;
  scheduled: NonNullable<ExportedHandler<Env>["scheduled"]>;
};
