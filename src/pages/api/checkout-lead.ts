import type { APIRoute } from 'astro';
import { jsonError, jsonOk, methodNotAllowed } from '../../lib/api.ts';
import { getRuntimeEnv } from '../../lib/env.ts';
import { captureCheckoutLead, captureLeadSchema, CheckoutLeadError } from '../../lib/checkout-lead.ts';
import { checkRateLimit, getClientIp, rateLimitHeaders } from '../../lib/rate-limit.ts';

export const prerender = false;
export const POST: APIRoute = async ({ request, locals }) => {
  const origin = request.headers.get('origin');
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') return jsonError('Forbidden request origin', 403);
  const env = getRuntimeEnv(locals);
  const rate = await checkRateLimit(env?.SESSION as KVNamespace | undefined, `checkout-lead:${getClientIp(request.headers)}`, 30, 60_000);
  if (!rate.allowed) return new Response(JSON.stringify({success: false, error: 'Cuba lagi sebentar.'}), {status: 429, headers: {'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...rateLimitHeaders(rate.remaining, rate.resetAt)}});
  // Bound streamed bytes too; Content-Length alone is not authoritative.
  const reader = request.body?.getReader();
  if (!reader) return jsonError('Data tidak sah.', 400);
  let size = 0; const chunks: Uint8Array[] = [];
  while (true) {
    const {done, value} = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 4096) { await reader.cancel(); return jsonError('Data terlalu besar.', 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let body: unknown; try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { return jsonError('Data tidak sah.', 400); }
  const parsed = captureLeadSchema.safeParse(body);
  if (!parsed.success) return jsonError('Nama, nombor Malaysia atau varian tidak sah.', 422);
  const database = env?.OMS_DB as D1Database | undefined;
  if (!database) return jsonError('Perkhidmatan belum tersedia.', 503);
  try { await captureCheckoutLead(database, parsed.data); return jsonOk({}); }
  catch (error) { return jsonError(error instanceof CheckoutLeadError ? error.message : 'Maklumat belum dapat disimpan.', error instanceof CheckoutLeadError ? error.status : 500); }
};
export const ALL: APIRoute = () => methodNotAllowed('POST');
