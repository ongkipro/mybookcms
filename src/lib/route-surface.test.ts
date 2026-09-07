import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runInNewContext } from "node:vm";
import test, { after, before } from "node:test";
import { createTestHarness, type TestHarness } from "wrangler";
import { signJwt } from "./auth.ts";
import { encryptAdsSecret } from "./ads-secret.ts";
import { maskAdsSecret } from "./ads-config.ts";
import { splitMigrationStatements } from "./schema-version.ts";

// Exercise the built routes rather than treating a source-string match as route
// coverage. A fresh build is intentional: npm test must not certify stale dist.
const repository = resolve(import.meta.dirname, "../..");
const rootSecret = "fictional-route-test-encryption-root-only";
const origin = "https://route-fixture.test";
let directory = "";
let server: TestHarness;
let database: D1Database;
const cookies: Record<string, string> = {};

before(async () => {
  execFileSync("npm", ["run", "build"], { cwd: repository, stdio: "pipe", timeout: 120_000 });
  directory = mkdtempSync(join(tmpdir(), "mybookcms-route-surfaces-"));
  server = createTestHarness({
    root: directory,
    workers: [{ config: {
      name: "route-surfaces",
      main: join(repository, "dist/server/entry.mjs"),
      no_bundle: true,
      compatibility_date: "2026-08-01",
      compatibility_flags: ["nodejs_compat"],
      rules: [{ type: "ESModule", globs: ["**/*.mjs", "**/*.js"] }],
      assets: { directory: join(repository, "dist/client"), binding: "ASSETS" },
      d1_databases: [{ binding: "OMS_DB", database_name: "route-surfaces", database_id: "00000000-0000-4000-8000-000000000249", migrations_dir: join(repository, "src/db/migrations") }],
      kv_namespaces: [{ binding: "SESSION", id: "00000000000000000000000000000249" }],
      r2_buckets: [{ binding: "ASSET_BUCKET", bucket_name: "route-surfaces" }],
      vars: { AUTH_SECRET: rootSecret, INSTALL_TOKEN: "fictional-route-test-install", PUBLIC_SITE_URL: origin, PUBLIC_SITE_LOCALE: "ms-MY" },
    } }],
  });
  await server.listen();
  const worker = server.getWorker<{ OMS_DB: D1Database; SESSION: KVNamespace }>();
  await worker.applyD1Migrations("OMS_DB");
  const env = await worker.getEnv();
  database = env.OMS_DB;
  await database.batch(splitMigrationStatements(readFileSync(join(repository, "scripts/seed-preview-local.sql"), "utf8")).map(sql => database.prepare(sql)));
  await database.prepare("UPDATE stores SET site_url = ? WHERE id = 1").bind(origin).run();
  for (const [index, role] of ["owner", "admin", "advertiser", "customer_service"].entries()) {
    const username = `fixture_${role}`;
    const updatedAt = "2026-09-07T00:00:00.000Z";
    await database.prepare("INSERT INTO admin_credentials (id, username, password_hash, must_change_password, updated_at, role) VALUES (?, ?, ?, 0, ?, ?)")
      .bind(100 + index, username, "fixture-no-password-login", updatedAt, role).run();
    const { token, session } = await signJwt({ username, role: role as "owner" | "admin" | "advertiser" | "customer_service" }, rootSecret);
    await env.SESSION.put(`admin-session:${session.jti}`, JSON.stringify({ username, role, must_change_password: false, credential_updated_at: updatedAt }), { expirationTtl: 3600 });
    cookies[role] = `mybook_session=${token}`;
  }
});

after(async () => {
  await server?.close();
  if (directory) rmSync(directory, { recursive: true, force: true });
});

function request(path: string, role?: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}) {
  // getWorker().fetch dispatches directly to workerd, bypassing the dev proxy.
  return server.getWorker().fetch(origin + path, { ...init, redirect: "manual", headers: { ...(role ? { Cookie: cookies[role] } : {}), ...init.headers } });
}

async function html(path: string, role?: string) {
  const response = await request(path, role);
  assert.equal(response.status, 200);
  return response.text();
}

test("/produk/[slug] preselects the requested variant, emits its ViewContent value, and resolves COD", async () => {
  for (const [variant, expected] of [["10002", "10002"], ["not-a-variant", "10001"]]) {
    const document = await html(`/produk/jurnal-fokus-harian?variant_id=${variant}`);
    const inputs = document.match(/<input\b[^>]*>/g) ?? [];
    assert.ok(inputs.some(tag => /\bname="variant_id"/.test(tag) && tag.includes(`value="${expected}"`)), "checkout must use the same selected variant");
    const script = [...document.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1]).find(text => text.includes("content_id: contentId") && text.includes("'ViewContent'"));
    assert.ok(script, "the rendered PDP must emit ViewContent");
    const events: unknown[] = [];
    runInNewContext(script, { window: { __MYBOOK_TRACK__: (name: string, payload: unknown) => events.push(JSON.parse(JSON.stringify({ name, payload }))) } }, { timeout: 1000 });
    assert.deepEqual(events, [{ name: "ViewContent", payload: { content_id: `p10001-v${expected}`, content_name: "Jurnal Fokus Harian", value: expected === "10002" ? 32.9 : 24.9 } }]);
  }
  for (const enabled of [0, 1]) {
    await database.prepare("UPDATE stores SET is_cod_enabled = ? WHERE id = 1").bind(enabled).run();
    assert.equal(/Sedia dihantar[^<]*COD/.test(await html("/produk/jurnal-fokus-harian")), Boolean(enabled));
  }
});

test("/[slug] preserves product redirects and only active, non-stale admin sessions preview drafts", async () => {
  const product = await request("/jurnal-fokus-harian");
  assert.equal(product.status, 308);
  assert.equal(product.headers.get("location"), "/produk/jurnal-fokus-harian");
  assert.equal((await request("/missing-fixture-page")).status, 404);
  await database.prepare("INSERT INTO landing_pages (id, slug, title, product_id, is_active, created_at, updated_at) VALUES ('route-draft', 'route-draft', 'Route draft fixture', '10001', 0, '2026-09-07', '2026-09-07')").run();
  await database.prepare("INSERT INTO landing_sections (id, landing_page_id, type, content_html, created_at, updated_at) VALUES ('route-section', 'route-draft', 'html', '<p>Private draft fixture</p>', '2026-09-07', '2026-09-07')").run();
  assert.equal((await request("/route-draft?preview=1")).status, 404);
  const preview = await request("/route-draft?preview=1", "owner");
  assert.equal(preview.status, 200);
  assert.equal(preview.headers.get("cache-control"), "no-store");
  assert.match(await preview.text(), /Private draft fixture/);
  await database.prepare("UPDATE admin_credentials SET updated_at = '2026-09-08' WHERE username = 'fixture_admin'").run();
  assert.equal((await request("/route-draft?preview=1", "admin")).status, 404);
  await database.prepare("UPDATE admin_credentials SET updated_at = '2026-09-07T00:00:00.000Z' WHERE username = 'fixture_admin'").run();
  await database.prepare("UPDATE landing_pages SET is_active = 1, is_product_page = 1 WHERE id = 'route-draft'").run();
  const takeover = await request("/route-draft");
  assert.equal(takeover.status, 308);
  assert.equal(takeover.headers.get("location"), "/produk/jurnal-fokus-harian");
  assert.match(await html("/produk/jurnal-fokus-harian"), /Private draft fixture/);
});

test("/admin/ads/meta protects the credential surface and exposes only a masked stored token", async () => {
  const token = "fictional-meta-token-never-a-live-credential";
  const ciphertext = await encryptAdsSecret(token, rootSecret);
  await database.prepare("UPDATE stores SET meta_capi_token = ? WHERE id = 1").bind(ciphertext).run();
  for (const role of ["owner", "admin", "advertiser"]) {
    const document = await html("/admin/ads/meta", role);
    assert.ok(!document.includes(token));
    assert.ok(!document.includes(ciphertext));
    const response = await request("/api/admin/ads", role);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = await response.json() as { data: { meta_capi_configured: boolean; meta_capi_token_masked: string } };
    assert.equal(body.data.meta_capi_configured, true);
    assert.equal(body.data.meta_capi_token_masked, maskAdsSecret(token));
    assert.ok(!JSON.stringify(body).includes(token));
    assert.ok(!JSON.stringify(body).includes(ciphertext));
  }
  assert.equal((await request("/admin/ads/meta", "customer_service")).status, 302);
  assert.equal((await request("/api/admin/ads", "customer_service")).status, 403);
  assert.equal((await request("/admin/ads/meta")).status, 302);
});

test("/admin/settings/developer restricts key issuance/revocation and never lists the issued secret", async () => {
  for (const role of ["owner", "admin"]) assert.match(await html("/admin/settings/developer", role), /Headless API/);
  for (const role of ["advertiser", "customer_service"]) {
    assert.equal((await request("/admin/settings/developer", role)).status, 302);
    assert.equal((await request("/api/admin/settings/developer", role, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ name: "Forbidden fixture" }) })).status, 403);
  }
  const created = await request("/api/admin/settings/developer", "owner", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ name: "Route fixture key", scopes: ["storefront:read"], rate_limit_per_minute: 60, daily_quota: 1000 }) });
  assert.equal(created.status, 201);
  const issued = await created.json() as { data: { secret: string; key: { id: number } } };
  assert.ok(issued.data.secret);
  const listed = await request("/api/admin/settings/developer", "owner");
  assert.equal(listed.status, 200);
  assert.equal(listed.headers.get("cache-control"), "no-store");
  const listing = await listed.text();
  assert.ok(!listing.includes(issued.data.secret));
  assert.ok(!listing.includes('"key_hash"'));
  const revoked = await request("/api/admin/settings/developer", "owner", { method: "DELETE", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ id: issued.data.key.id }) });
  assert.equal(revoked.status, 200);
  const result = await database.prepare("SELECT revoked_at FROM developer_api_keys WHERE id = ?").bind(issued.data.key.id).first<{ revoked_at: string | null }>();
  assert.ok(result?.revoked_at);
});
