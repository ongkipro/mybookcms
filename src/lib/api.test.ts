import assert from "node:assert/strict";
import test from "node:test";
import { methodNotAllowed } from "./api.ts";

/**
 * Without this, Astro falls through to the storefront 404 route and a client
 * holding a valid API key received a complete HTML page — layout, header and
 * all — where it expected JSON, then failed obscurely while parsing it. The
 * DOKU capability routes already answered `405`; this is that decision made
 * shareable so every route applies it.
 *
 * That each route actually exports `ALL` is enforced elsewhere: the code-map
 * check compares an endpoint's exported methods against the documented ones in
 * both directions, so a route that drops its handler fails there. Importing the
 * route modules here is not an option — they pull in their whole dependency
 * graph, which the raw Node runner cannot resolve.
 */

test("an unsupported method answers bounded JSON with Allow", async () => {
  const response = methodNotAllowed("POST", "OPTIONS");
  assert.equal(response.status, 405);
  assert.match(response.headers.get("content-type") || "", /application\/json/);
  // RFC 9110 requires `Allow` on a 405, and it is the part that actually tells
  // an integrator what to do differently.
  assert.equal(response.headers.get("allow"), "POST, OPTIONS");
  // Never cached: which methods a route supports is a property of the deployment.
  assert.match(response.headers.get("cache-control") || "", /no-store/);

  const body = (await response.json()) as { success: boolean; code: string; error: string };
  assert.equal(body.success, false);
  assert.equal(body.code, "METHOD_NOT_ALLOWED");
  assert.ok(body.error.length > 0);
  // Nothing about the request or the runtime leaks into the message.
  assert.doesNotMatch(JSON.stringify(body), /src\/|\.ts:|at \w+ \(/);
});

test("a single supported method still produces a well-formed Allow", () => {
  assert.equal(methodNotAllowed("POST").headers.get("allow"), "POST");
});
