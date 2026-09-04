import type { APIRoute } from "astro";
import {
  dokuNoStoreHeaders,
  handleDokuStatusRequest,
} from "../../../../lib/doku-payment-access.ts";
import { getEnvValue, getRuntimeEnv } from "../../../../lib/env.ts";
import { getClientIp } from "../../../../lib/rate-limit.ts";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const runtime = getRuntimeEnv(locals);
  return handleDokuStatusRequest({
    request,
    database: runtime?.OMS_DB as D1Database | undefined,
    rootSecret: getEnvValue("AUTH_SECRET", runtime),
    sessions: runtime?.SESSION as KVNamespace | undefined,
    clientIp: getClientIp(request.headers),
  });
};

export const ALL: APIRoute = () => new Response(null, {
  status: 405,
  headers: dokuNoStoreHeaders({ Allow: "POST" }),
});
