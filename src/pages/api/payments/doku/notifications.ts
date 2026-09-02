import type { APIRoute } from "astro";
import { getEnvValue, getRuntimeEnv } from "../../../../lib/env.ts";
import {
  DokuNotificationError,
  processDokuGlobalNotification,
} from "../../../../lib/doku-notification.ts";
import { DokuPaymentLifecycleError } from "../../../../lib/doku-payment-lifecycle.ts";

export const prerender = false;

const REQUEST_TARGET = "/api/payments/doku/notifications";
const MAX_NOTIFICATION_BYTES = 256 * 1024;

const response = (status: number) =>
  new Response(null, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

async function readBoundedBody(request: Request): Promise<Uint8Array | null> {
  const contentLength = request.headers.get("Content-Length");
  if (contentLength !== null) {
    const parsed = Number(contentLength);
    if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > MAX_NOTIFICATION_BYTES) {
      return null;
    }
  }
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_NOTIFICATION_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  if (total === 0) return null;
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  if (
    url.pathname !== REQUEST_TARGET ||
    url.search ||
    request.headers.get("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json"
  ) {
    return response(400);
  }
  const runtime = getRuntimeEnv(locals);
  const database = runtime?.OMS_DB as D1Database | undefined;
  if (!database?.prepare) return response(503);
  const rawBody = await readBoundedBody(request);
  if (!rawBody) return response(400);

  try {
    await processDokuGlobalNotification({
      database,
      rootSecret: getEnvValue("AUTH_SECRET", runtime),
      rawBody,
      headers: request.headers,
      requestTarget: REQUEST_TARGET,
    });
    return response(204);
  } catch (error) {
    if (error instanceof DokuNotificationError) {
      if (error.code === "DOKU_NOTIFICATION_SIGNATURE") return response(401);
      if (error.code === "DOKU_NOTIFICATION_CONFIGURATION") return response(503);
      if (error.code === "DOKU_NOTIFICATION_MISMATCH") return response(409);
      return response(400);
    }
    if (error instanceof DokuPaymentLifecycleError) {
      if (error.code === "DOKU_ATTEMPT_NOT_FOUND") return response(404);
      if (error.code === "DOKU_PAYMENT_MISMATCH") return response(409);
      return response(500);
    }
    console.error("doku-notification", { error: "unclassified" });
    return response(500);
  }
};
