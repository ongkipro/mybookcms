import assert from "node:assert/strict";
import test from "node:test";
import { PUT as updateAds } from "../pages/api/admin/ads.ts";
import { getStoreAdsConfig } from "./ads-config.ts";
import { encryptAdsSecret } from "./ads-secret.ts";

const AUTH_SECRET = "mybookcms-test-auth-secret-is-long-enough-2026";

function localsWith(row: Record<string, unknown>, environmentToken = "") {
  const database = {
    prepare() {
      return { async first() { return row; } };
    },
  } as unknown as D1Database;
  return {
    runtimeEnv: {
      OMS_DB: database,
      AUTH_SECRET,
      META_CAPI_ACCESS_TOKEN: environmentToken,
    },
  } as unknown as App.Locals;
}

test("Meta token source distinguishes encrypted database and environment credentials", async () => {
  const encrypted = await encryptAdsSecret("database-token", AUTH_SECRET);
  const database = await getStoreAdsConfig(localsWith({ meta_capi_token: encrypted }, "environment-token"));
  assert.equal(database.metaCapiToken, "database-token");
  assert.equal(database.metaCapiTokenSource, "database");
  assert.equal(database.metaCapiEnvironmentFallback, true);

  const environment = await getStoreAdsConfig(localsWith({ meta_capi_token: null }, "environment-token"));
  assert.equal(environment.metaCapiToken, "environment-token");
  assert.equal(environment.metaCapiTokenSource, "environment");
});

test("an invalid database token fails closed instead of silently using the environment fallback", async () => {
  const config = await getStoreAdsConfig(localsWith({ meta_capi_token: "plaintext-token" }, "environment-token"));
  assert.equal(config.metaCapiToken, "");
  assert.equal(config.metaCapiTokenSource, "invalid");
  assert.equal(config.metaCapiEnvironmentFallback, true);
});

test("the admin API cannot pretend to delete an environment-managed token", async () => {
  let writes = 0;
  const database = {
    prepare() {
      return {
        bind() { return this; },
        async first() { return { meta_capi_token: null }; },
        async run() { writes += 1; return { success: true, meta: { changes: 1 } }; },
      };
    },
  } as unknown as D1Database;
  const response = await updateAds({
    request: new Request("https://shop.example/api/admin/ads", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "save-meta", clear_meta_capi_token: true }),
    }),
    locals: {
      runtimeEnv: {
        OMS_DB: database,
        AUTH_SECRET,
        META_CAPI_ACCESS_TOKEN: "environment-token",
      },
    },
  } as never);

  assert.equal(response.status, 409);
  assert.equal(writes, 0);
});
