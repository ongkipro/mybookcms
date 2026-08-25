import type { ExportedHandler } from "@cloudflare/workers-types";
import { handle } from "@astrojs/cloudflare/handler";
import { drainConfiguredCapiOutbox } from "./lib/capi-outbox.ts";

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
  },
} satisfies {
  fetch: typeof handle;
  scheduled: NonNullable<ExportedHandler<Env>["scheduled"]>;
};
