import type { ExportedHandler } from "@cloudflare/workers-types";
import { handle } from "@astrojs/cloudflare/handler";
type AstroRequest = Parameters<typeof handle>[0];

export default {
  fetch(request, env, ctx) {
    // @astrojs/cloudflare's public handler uses the DOM Request type while
    // ExportedHandler supplies the structurally compatible Workers Request.
    return handle(request as unknown as AstroRequest, env, ctx);
  },
} satisfies ExportedHandler<CloudflareRuntimeEnv>;
