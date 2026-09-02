import type { ExportedHandler } from "@cloudflare/workers-types";
import { handle } from "@astrojs/cloudflare/handler";
import { drainConfiguredCapiOutbox } from "./lib/capi-outbox.ts";
import { reconcileDueDokuPayments } from "./lib/doku-reconciliation.ts";

export default {
  fetch: handle,
  scheduled(_controller, env, ctx) {
    ctx.waitUntil(
      drainConfiguredCapiOutbox(env).catch((error) => {
        console.error("capi-outbox-scheduled", {
          error: error instanceof Error ? error.message : String(error),
        });
      }),
    );
    ctx.waitUntil(
      reconcileDueDokuPayments(env).catch(() => {
        console.error("doku-reconciliation-scheduled", {
          outcome: "scheduler_failed",
          error_class: "local_transition",
        });
      }),
    );
  },
} satisfies {
  fetch: typeof handle;
  scheduled: NonNullable<ExportedHandler<Env>["scheduled"]>;
};
