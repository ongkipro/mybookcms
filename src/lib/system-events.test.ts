import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after, before } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { PUT as savePayment, PATCH as togglePayment, DELETE as clearPayment } from "../pages/api/admin/payments.ts";
import { PUT as saveProfile } from "../pages/api/admin/profile.ts";
import { loadSystemLog } from "./system-log.ts";
import * as credentials from "./admin-credentials.ts";
import * as authentication from "./auth.ts";
import * as runtimeEnvironment from "./env.ts";
import * as loginLimits from "./rate-limit.ts";
import { getPlatformProxy, type PlatformProxy } from "wrangler";
import { splitMigrationStatements } from "./schema-version.ts";
import { POST as issueKey, PATCH as updateKey, DELETE as revokeKey, GET as listKeys } from "../pages/api/admin/settings/developer.ts";
import { POST as createOperator, PATCH as updateOperator, DELETE as deleteOperator } from "../pages/api/admin/access.ts";
import { PUT as saveAds } from "../pages/api/admin/ads.ts";
import { decryptAdsSecret } from "./ads-secret.ts";
import { PUT as saveSettings } from "../pages/api/admin/settings.ts";
import { CMS_VERSION } from "./version.ts";
import {
  commitSystemMutation, pruneSystemEvents, recordLoginLockout, runScheduledSystemJob,
  SYSTEM_EVENT_LABELS, SYSTEM_EVENT_RETENTION_DAYS, type AdminSystemEventAction,
} from "./system-events.ts";

const NOW = new Date("2026-09-08T00:00:00.000Z");
const PRIVATE_MARKERS = ["fictional-token", "fixture@example.com", "60123456789", "12 Example Street"];
const PRIVATE_FIXTURE = PRIVATE_MARKERS.join(" ");
let directory: string;
let platform: PlatformProxy<{ OMS_DB: D1Database; SESSION: KVNamespace }>;
let database: D1Database;

before(async () => {
  directory = mkdtempSync(join(tmpdir(), "mybookcms-system-events-"));
  const configPath = join(directory, "wrangler.jsonc");
  writeFileSync(configPath, JSON.stringify({
    name: "system-events-fixture", compatibility_date: "2026-08-01",
    kv_namespaces: [{ binding: "SESSION", id: "00000000000000000000000000000226" }],
    d1_databases: [{ binding: "OMS_DB", database_name: "system-events-fixture", database_id: "00000000-0000-4000-8000-000000000226" }],
  }));
  platform = await getPlatformProxy({ configPath, envFiles: [], persist: false, remoteBindings: false });
  database = platform.env.OMS_DB;
  const migrations = new URL("../db/migrations/", import.meta.url);
  const files = readdirSync(migrations).filter(name => name.endsWith(".sql")).sort();
  assert.equal(files.length, CMS_VERSION.schemaVersion);
  for (const file of files) {
    await database.batch(splitMigrationStatements(readFileSync(new URL(file, migrations), "utf8")).map(sql => database.prepare(sql)));
  }
  await database.prepare("INSERT INTO stores (id, name, slug, created_at) VALUES (1, 'Fixture Store', 'fixture-store', ?)")
    .bind(NOW.toISOString()).run();
});

after(async () => {
  await platform?.dispose();
  if (directory) rmSync(directory, { recursive: true, force: true });
});

async function events() {
  return (await database.prepare("SELECT actor, source, action, label, severity, correlation, detail, occurred_at FROM system_events ORDER BY id").all()).results;
}

const update = () => database.prepare("UPDATE stores SET description = ? WHERE id = 1").bind(PRIVATE_FIXTURE);
const event = { action: "store.profile.updated" as const, actor: "fixture_owner", targetId: 1 };

test("an admin mutation and its redacted audit commit or roll back together in real D1", async () => {
  const result = await commitSystemMutation(database, update(), event, NOW);
  assert.equal(result.meta.changes, 1);
  assert.deepEqual((await events()).at(-1), {
    actor: "fixture_owner", source: "admin", action: "store.profile.updated",
    label: "Profil toko diperbarui.", severity: "info", correlation: "store:1", detail: "{}", occurred_at: NOW.toISOString(),
  });
  const before = await database.prepare("SELECT name, description FROM stores WHERE id = 1").first();
  const auditBefore = await events();
  await database.prepare("CREATE TRIGGER reject_fixture_audit BEFORE INSERT ON system_events WHEN NEW.actor = 'rejector' BEGIN SELECT RAISE(ABORT, 'fixture audit failure'); END").run();
  try {
    await assert.rejects(commitSystemMutation(database, database.prepare("UPDATE stores SET name = 'Must Roll Back' WHERE id = 1"), { ...event, actor: "rejector" }, NOW), /fixture audit failure/);
    assert.deepEqual(await database.prepare("SELECT name, description FROM stores WHERE id = 1").first(), before);
    assert.deepEqual(await events(), auditBefore);
  } finally {
    await database.prepare("DROP TRIGGER reject_fixture_audit").run();
  }
  await assert.rejects(commitSystemMutation(database, database.prepare("UPDATE stores SET name = NULL WHERE id = 1"), event, NOW));
  assert.deepEqual(await events(), auditBefore);
  const noop = await commitSystemMutation(database, database.prepare("UPDATE stores SET name = 'No Row' WHERE id = -1"), event, NOW);
  assert.equal(noop.meta.changes, 0);
  assert.deepEqual(await events(), auditBefore, "an optimistic no-op must not manufacture a successful audit");
});

test("insert correlation uses the mutation row id rather than the audit row id", async () => {
  await database.prepare("CREATE TABLE fixture_audit_targets (id INTEGER PRIMARY KEY, value TEXT)").run();
  const result = await commitSystemMutation(database,
    database.prepare("INSERT INTO fixture_audit_targets (id, value) VALUES (9123, ?)").bind(PRIVATE_FIXTURE),
    { action: "operator.created", actor: "fixture_owner" }, NOW);
  assert.equal(result.meta.last_row_id, 9123);
  assert.equal((await events()).at(-1)?.correlation, "operator:9123");
});

test("every admin event excludes changed values and rejects unknown actions, actors and targets", async () => {
  for (const action of Object.keys(SYSTEM_EVENT_LABELS)) {
    if (action.startsWith("scheduler.") || action === "login.lockout") continue;
    await commitSystemMutation(database, update(), { ...event, action: action as AdminSystemEventAction }, NOW);
    const row = (await events()).at(-1)!;
    assert.equal(row.action, action);
    assert.equal(row.detail, "{}");
    for (const forbidden of PRIVATE_MARKERS) assert.ok(!JSON.stringify(row).includes(forbidden));
  }
  const before = await events();
  for (const invalid of [
    { ...event, action: "unexpected" as AdminSystemEventAction },
    { ...event, action: "login.lockout" as AdminSystemEventAction },
    { ...event, actor: "fixture@example.com" },
    { ...event, targetId: -1 },
    { ...event, targetId: undefined },
  ]) await assert.rejects(commitSystemMutation(database, update(), invalid, NOW));
  assert.deepEqual(await events(), before);
  await assert.rejects(database.prepare("UPDATE system_events SET label = 'Rewritten' WHERE id = 1").run(), /append-only/);
  await assert.rejects(database.prepare("INSERT INTO system_events (actor, source, action, label, severity, correlation, detail, occurred_at) VALUES ('fixture_owner', 'admin', 'store.profile.updated', 'Fixture', 'info', 'store:1', ?, ?)")
    .bind(JSON.stringify({ token: PRIVATE_FIXTURE }), NOW.toISOString()).run(), /CHECK constraint/);
});

test("scheduler and login sink failures do not escape or leak raw errors", async (t) => {
  const logs: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => { logs.push(args); });
  const before = (await events()).length;
  await runScheduledSystemJob(database, "capi", async () => {});
  assert.equal((await events()).length, before);
  for (const job of ["capi", "doku"] as const) {
    await runScheduledSystemJob(database, job, async () => { throw new Error(PRIVATE_FIXTURE); });
    const row = (await events()).at(-1)!;
    assert.equal(row.actor, "system");
    assert.equal(row.action, `scheduler.${job}.failed`);
    assert.equal(row.source, "scheduler");
    assert.equal(row.severity, "error");
  }
  await recordLoginLockout(database, NOW);
  assert.equal((await events()).at(-1)?.actor, "anonymous");
  await database.prepare("CREATE TRIGGER reject_diagnostic_audit BEFORE INSERT ON system_events BEGIN SELECT RAISE(ABORT, 'fixture sink failure'); END").run();
  try {
    await assert.doesNotReject(runScheduledSystemJob(database, "doku", async () => { throw new Error(PRIVATE_FIXTURE); }));
    await assert.doesNotReject(recordLoginLockout(database, NOW));
    await assert.doesNotReject(runScheduledSystemJob(undefined, "capi", async () => { throw new Error(PRIVATE_FIXTURE); }));
  } finally {
    await database.prepare("DROP TRIGGER reject_diagnostic_audit").run();
  }
  assert.ok(logs.length > 0);
  assert.ok(!JSON.stringify(logs).includes(PRIVATE_FIXTURE));
  assert.ok(!JSON.stringify(await events()).includes(PRIVATE_FIXTURE));
});

test("retention prunes only strictly older than 90 days in bounded batches", async () => {
  const cutoff = new Date(NOW.getTime() - SYSTEM_EVENT_RETENTION_DAYS * 86_400_000);
  const insert = database.prepare("INSERT INTO system_events (actor, source, action, label, severity, correlation, detail, occurred_at) VALUES ('fixture_retention', 'admin', 'store.profile.updated', 'Fixture', 'info', 'store:1', '{}', ?)");
  const expired = new Date(cutoff.getTime() - 1).toISOString();
  for (let i = 0; i < 1003; i += 100) {
    await database.batch(Array.from({ length: Math.min(100, 1003 - i) }, () => insert.bind(expired)));
  }
  await database.batch([insert.bind(cutoff.toISOString()), insert.bind(new Date(cutoff.getTime() + 1).toISOString()), insert.bind(NOW.toISOString())]);
  const remaining = async () => (await database.prepare("SELECT COUNT(*) AS count FROM system_events WHERE actor = 'fixture_retention'").first<{ count: number }>())!.count;
  await pruneSystemEvents(database, NOW);
  assert.equal(await remaining(), 6);
  await pruneSystemEvents(database, NOW);
  assert.equal(await remaining(), 3);
  const dates = (await database.prepare("SELECT occurred_at FROM system_events WHERE actor = 'fixture_retention' ORDER BY occurred_at").all<{ occurred_at: string }>()).results.map(row => row.occurred_at);
  assert.deepEqual(dates, [cutoff.toISOString(), new Date(cutoff.getTime() + 1).toISOString(), NOW.toISOString()]);
});


test("the actual scheduled handler isolates both jobs and retention failures", async (t) => {
  const logs: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => { logs.push(args); });
  const source = readFileSync(new URL("../worker.ts", import.meta.url), "utf8")
    .replace(/^import .*;\n/gm, "")
    .replace("export default", "globalThis.worker =");
  const script = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const calls: string[] = [];
  const pending: Promise<unknown>[] = [];
  const context = {
    handle: () => {},
    drainConfiguredCapiOutbox: async () => { calls.push("capi"); throw new Error(PRIVATE_FIXTURE); },
    reconcileDueDokuPayments: async () => { calls.push("doku"); throw new Error(PRIVATE_FIXTURE); },
    runScheduledSystemJob,
    pruneSystemEvents: async () => { calls.push("prune"); throw new Error(PRIVATE_FIXTURE); },
    console: { error: (...args: unknown[]) => { logs.push(args); } },
    worker: undefined as unknown as { scheduled(controller: unknown, env: { OMS_DB: D1Database }, ctx: { waitUntil(promise: Promise<unknown>): void }): void },
  };
  await database.prepare("CREATE TRIGGER reject_worker_fixture_audit BEFORE INSERT ON system_events BEGIN SELECT RAISE(ABORT, 'fixture sink failure'); END").run();
  try {
    runInNewContext(script, context);
    assert.doesNotThrow(() => context.worker.scheduled({}, { OMS_DB: database }, { waitUntil: promise => { pending.push(promise); } }));
    assert.equal(pending.length, 3);
    assert.deepEqual((await Promise.allSettled(pending)).map(result => result.status), ["fulfilled", "fulfilled", "fulfilled"]);
    assert.deepEqual(calls.sort(), ["capi", "doku", "prune"]);
    assert.ok(logs.some(args => args[0] === "system-events-retention-failed"));
    assert.ok(!JSON.stringify(logs).includes(PRIVATE_FIXTURE));
  } finally {
    await database.prepare("DROP TRIGGER reject_worker_fixture_audit").run();
  }
});


test("real settings handler audits each direct save and rolls back on an unavailable audit sink", async (t) => {
  t.mock.method(console, "error", () => {});
  const save = (body: Record<string, unknown>, actor = "fixture_owner") => saveSettings({
    request: new Request("https://fixture.invalid/api/admin/settings", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }),
    locals: { runtimeEnv: { OMS_DB: database }, admin: { username: actor, role: "owner" } },
  } as unknown as Parameters<typeof saveSettings>[0]);
  const fixtures = [
    { body: { action: "save-cod-availability", cod_enabled: false }, action: "store.cod.updated", column: "is_cod_enabled", value: 0 },
    { body: { action: "save-embed-origins", embed_allowed_origins: "https://embed.fixture.invalid" }, action: "store.embed.updated", column: "embed_allowed_origins", value: "https://embed.fixture.invalid" },
    { body: { action: "save-headless-origins", headless_allowed_origins: "https://headless.fixture.invalid" }, action: "store.headless.updated", column: "headless_allowed_origins", value: "https://headless.fixture.invalid" },
    { body: { action: "save-crm", crm_templates: { welcome: PRIVATE_FIXTURE } }, action: "store.crm.updated", column: "crm_templates", value: undefined },
    { body: { action: "save-store", store_name: "Updated Fixture", support_whatsapp: "+60123456789", store_description: PRIVATE_FIXTURE }, action: "store.profile.updated", column: "name", value: "Updated Fixture" },
  ];
  for (const fixture of fixtures) {
    const count = (await events()).length;
    const response = await save(fixture.body);
    assert.equal(response.status, 200, `${fixture.action}: ${await response.text()}`);
    const rows = await events();
    assert.equal(rows.length, count + 1);
    assert.equal(rows.at(-1)?.action, fixture.action);
    assert.equal(rows.at(-1)?.actor, "fixture_owner");
    assert.equal(rows.at(-1)?.correlation, "store:1");
    assert.equal(rows.at(-1)?.detail, "{}");
    assert.ok(!JSON.stringify(rows.at(-1)).includes(PRIVATE_FIXTURE));
    const stored = await database.prepare(`SELECT ${fixture.column} AS value FROM stores WHERE id = 1`).first<{ value: string | number }>();
    if (fixture.value === undefined) assert.equal(JSON.parse(String(stored?.value)).welcome, PRIVATE_FIXTURE);
    else assert.equal(stored?.value, fixture.value);
  }
  await database.prepare("UPDATE stores SET name = 'Before rejected saves', is_cod_enabled = 1, embed_allowed_origins = NULL, headless_allowed_origins = NULL, crm_templates = NULL, description = NULL WHERE id = 1").run();
  const original = await database.prepare("SELECT * FROM stores WHERE id = 1").first();
  const before = await events();
  await database.prepare("CREATE TRIGGER reject_settings_audit BEFORE INSERT ON system_events BEGIN SELECT RAISE(ABORT, 'fixture sink unavailable'); END").run();
  try {
    for (const fixture of fixtures) {
      assert.equal((await save(fixture.body)).status, 500);
      assert.deepEqual(await database.prepare("SELECT * FROM stores WHERE id = 1").first(), original);
      assert.deepEqual(await events(), before);
    }
  } finally {
    await database.prepare("DROP TRIGGER reject_settings_audit").run();
  }
  for (const body of [
    { action: "save-cod-availability", cod_enabled: "false" },
    { action: "save-embed-origins", embed_allowed_origins: "http://unsafe.invalid" },
    { action: "save-headless-origins", headless_allowed_origins: "https://unsafe.invalid/path" },
    { action: "save-store", store_name: "", support_whatsapp: "invalid" },
  ]) assert.equal((await save(body)).status, 400);
  assert.deepEqual(await events(), before);
});


test("API key routes audit issue, policy change and revoke without exposing credentials", async (t) => {
  t.mock.method(console, "error", () => {});
  const call = (handler: typeof issueKey, method: string, body?: Record<string, unknown>, actor = "fixture_owner") => handler({
    request: new Request("https://fixture.invalid/api/admin/settings/developer", {
      method, ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    }),
    locals: { runtimeEnv: { OMS_DB: database }, admin: { username: actor, role: "owner" } },
  } as unknown as Parameters<typeof issueKey>[0]);
  const policy = { scopes: ["catalog:read"], rate_limit_per_minute: 30, daily_quota: 100 };
  const before = (await events()).length;
  assert.equal((await call(issueKey, "POST", { name: "Fixture key", ...policy }, "")).status, 401);
  assert.equal((await call(issueKey, "POST", { name: "x", ...policy })).status, 422);
  assert.equal((await events()).length, before);
  const created = await call(issueKey, "POST", { name: PRIVATE_FIXTURE, ...policy });
  assert.equal(created.status, 201);
  const issued = await created.json();
  const id = issued.data.key.id;
  assert.ok(id > 0);
  const stored = await database.prepare("SELECT * FROM developer_api_keys WHERE id = ?").bind(id).first<Record<string, unknown>>();
  assert.ok(stored);
  assert.notEqual(stored.key_hash, issued.data.secret);
  assert.equal((await events()).at(-1)?.action, "api_key.issued");
  assert.equal((await events()).at(-1)?.correlation, `api_key:${id}`);
  const changedPolicy = { id, scopes: ["orders:read"], rate_limit_per_minute: 40, daily_quota: 200 };
  assert.equal((await call(updateKey, "PATCH", changedPolicy)).status, 200);
  assert.equal((await events()).at(-1)?.action, "api_key.updated");
  assert.equal((await database.prepare("SELECT scopes FROM developer_api_keys WHERE id = ?").bind(id).first())?.scopes, "orders:read");
  const original = await database.prepare("SELECT * FROM developer_api_keys ORDER BY id").all();
  const auditBefore = await events();
  await database.prepare("CREATE TRIGGER reject_key_audit BEFORE INSERT ON system_events BEGIN SELECT RAISE(ABORT, 'fixture audit unavailable'); END").run();
  try {
    assert.equal((await call(issueKey, "POST", { name: "Rejected key", ...policy })).status, 500);
    assert.equal((await call(updateKey, "PATCH", { id, ...policy })).status, 500);
    assert.equal((await call(revokeKey, "DELETE", { id })).status, 500);
    assert.deepEqual((await database.prepare("SELECT * FROM developer_api_keys ORDER BY id").all()).results, original.results);
    assert.deepEqual(await events(), auditBefore);
  } finally {
    await database.prepare("DROP TRIGGER reject_key_audit").run();
  }
  assert.equal((await call(revokeKey, "DELETE", { id })).status, 200);
  assert.equal((await events()).at(-1)?.action, "api_key.revoked");
  const finalEvents = await events();
  assert.equal((await call(revokeKey, "DELETE", { id })).status, 404);
  assert.equal((await call(updateKey, "PATCH", { id, ...policy })).status, 404);
  assert.equal((await call(updateKey, "PATCH", { id: -1, ...policy })).status, 400);
  assert.deepEqual(await events(), finalEvents);
  const list = await call(listKeys, "GET");
  assert.equal(list.status, 200);
  assert.ok(!JSON.stringify(await list.json()).includes(issued.data.secret));
  for (const row of finalEvents.slice(before)) {
    assert.equal(row.actor, "fixture_owner");
    assert.equal(row.detail, "{}");
    for (const forbidden of [issued.data.secret, stored.key_hash, ...PRIVATE_MARKERS]) {
      assert.ok(!JSON.stringify(row).includes(String(forbidden)), "audit must exclude generated credential and submitted values");
    }
  }
});


test("Ads saves audit both Meta token branches, removal and Google config with atomic rollback", async (t) => {
  t.mock.method(console, "error", () => {});
  const root = "fictional-audit-encryption-root-2026-not-a-real-secret";
  const call = (body: Record<string, unknown>) => saveAds({
    request: new Request("https://fixture.invalid/api/admin/ads", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }),
    locals: { runtimeEnv: { OMS_DB: database, AUTH_SECRET: root }, admin: { username: "fixture_advertiser", role: "advertiser" } },
  } as unknown as Parameters<typeof saveAds>[0]);
  const before = (await events()).length;
  assert.equal((await call({ action: "save-meta", meta_pixel_id: "invalid" })).status, 422);
  assert.equal((await call({ action: "save-google", google_ads_conversion_id: "AW-12345" })).status, 422);
  assert.equal((await events()).length, before);
  const saveToken = { action: "save-meta", meta_pixel_id: "123456789", meta_capi_token: PRIVATE_FIXTURE };
  const tokenResponse = await call(saveToken);
  assert.equal(tokenResponse.status, 200);
  assert.ok(!(await tokenResponse.text()).includes(PRIVATE_FIXTURE));
  const encrypted = (await database.prepare("SELECT meta_capi_token FROM stores WHERE id = 1").first<{ meta_capi_token: string }>())!.meta_capi_token;
  assert.equal(await decryptAdsSecret(encrypted, root), PRIVATE_FIXTURE);
  assert.equal((await call({ action: "save-meta", meta_pixel_id: "987654321" })).status, 200);
  assert.equal((await database.prepare("SELECT meta_capi_token FROM stores WHERE id = 1").first())?.meta_capi_token, encrypted);
  const google = { action: "save-google", google_tag_manager_id: "GTM-ABCD1234", google_ads_conversion_id: "AW-123456789", google_ads_conversion_label: "Fixture_Purchase" };
  assert.equal((await call(google)).status, 200);
  const original = await database.prepare("SELECT * FROM stores WHERE id = 1").first();
  const audits = await events();
  await database.prepare("CREATE TRIGGER reject_ads_audit BEFORE INSERT ON system_events BEGIN SELECT RAISE(ABORT, 'fixture sink unavailable'); END").run();
  try {
    for (const body of [saveToken, { action: "save-meta", meta_pixel_id: "111111111" }, { action: "save-meta", clear_meta_capi_token: true }, { action: "save-google", google_tag_manager_id: "GTM-ROLLBACK" }]) {
      assert.equal((await call(body)).status, 500);
      assert.deepEqual(await database.prepare("SELECT * FROM stores WHERE id = 1").first(), original);
      assert.deepEqual(await events(), audits);
    }
  } finally {
    await database.prepare("DROP TRIGGER reject_ads_audit").run();
  }
  assert.equal((await call({ action: "save-meta", clear_meta_capi_token: true })).status, 200);
  assert.equal((await database.prepare("SELECT meta_capi_token FROM stores WHERE id = 1").first())?.meta_capi_token, null);
  const rows = (await events()).slice(before);
  assert.deepEqual(rows.map(row => row.action), ["ads.meta.updated", "ads.meta.updated", "ads.google.updated", "ads.meta.updated"]);
  for (const row of rows) {
    assert.equal(row.actor, "fixture_advertiser");
    assert.equal(row.correlation, "ads:1");
    assert.equal(row.detail, "{}");
    for (const forbidden of [encrypted, root, ...PRIVATE_MARKERS]) assert.ok(!JSON.stringify(row).includes(forbidden));
  }
});


test("operator routes audit create, role/password change and deletion while preserving session revocation", async (t) => {
  t.mock.method(console, "error", () => {});
  const call = (handler: typeof createOperator, method: string, body: Record<string, unknown>, role = "owner") => handler({
    request: new Request("https://fixture.invalid/api/admin/access", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    locals: { runtimeEnv: platform.env, admin: { username: "fixture_owner", role } },
  } as unknown as Parameters<typeof createOperator>[0]);
  const password = "FictionalOperatorPass!226";
  const replacement = "FictionalReplacement!226";
  const body = { username: "fixture_operator", display_name: "Fixture Operator", email: "fixture@example.com", role: "admin", password };
  const before = (await events()).length;
  for (const role of ["admin", "advertiser", "customer_service"]) {
    assert.equal((await call(createOperator, "POST", body, role)).status, 403);
    assert.equal((await call(updateOperator, "PATCH", { id: 1, role: "admin" }, role)).status, 403);
    assert.equal((await call(deleteOperator, "DELETE", { id: 1 }, role)).status, 403);
  }
  assert.equal((await call(createOperator, "POST", { ...body, role: "owner" })).status, 422);
  assert.equal((await events()).length, before);
  const created = await call(createOperator, "POST", body);
  assert.equal(created.status, 201);
  const id = (await created.json()).data.id;
  const credential = () => database.prepare("SELECT * FROM admin_credentials WHERE id = ?").bind(id).first<Record<string, unknown>>();
  const original = await credential();
  assert.ok(original);
  await platform.env.SESSION.put("admin-session:fixture_operator", JSON.stringify({ username: body.username }));
  await platform.env.SESSION.put("admin-session:fixture_other", JSON.stringify({ username: "fixture_other" }));
  const auditBefore = await events();
  await database.prepare("CREATE TRIGGER reject_operator_audit BEFORE INSERT ON system_events BEGIN SELECT RAISE(ABORT, 'fixture sink unavailable'); END").run();
  try {
    assert.equal((await call(createOperator, "POST", { ...body, username: "fixture_rejected" })).status, 500);
    assert.equal(await database.prepare("SELECT id FROM admin_credentials WHERE username = 'fixture_rejected'").first(), null);
    assert.equal((await call(updateOperator, "PATCH", { id, role: "advertiser", password: replacement })).status, 500);
    assert.equal((await call(deleteOperator, "DELETE", { id })).status, 500);
    assert.deepEqual(await credential(), original);
    assert.ok(await platform.env.SESSION.get("admin-session:fixture_operator"));
    assert.deepEqual(await events(), auditBefore);
  } finally {
    await database.prepare("DROP TRIGGER reject_operator_audit").run();
  }
  assert.equal((await call(updateOperator, "PATCH", { id, role: "advertiser", password: replacement })).status, 200);
  const changed = await credential();
  assert.equal(changed?.role, "advertiser");
  assert.equal(changed?.must_change_password, 1);
  assert.notEqual(changed?.password_hash, original.password_hash);
  assert.equal(await platform.env.SESSION.get("admin-session:fixture_operator"), null);
  assert.ok(await platform.env.SESSION.get("admin-session:fixture_other"));
  await platform.env.SESSION.put("admin-session:fixture_operator", JSON.stringify({ username: body.username }));
  assert.equal((await call(deleteOperator, "DELETE", { id })).status, 200);
  assert.equal(await credential(), null);
  assert.equal(await platform.env.SESSION.get("admin-session:fixture_operator"), null);
  assert.equal((await call(deleteOperator, "DELETE", { id })).status, 404);
  const rows = (await events()).slice(before);
  assert.deepEqual(rows.map(row => row.action), ["operator.created", "operator.updated", "operator.deleted"]);
  for (const row of rows) {
    assert.equal(row.actor, "fixture_owner");
    assert.equal(row.correlation, `operator:${id}`);
    assert.equal(row.detail, "{}");
    for (const forbidden of [password, replacement, original.password_hash, changed?.password_hash, body.email]) assert.ok(!JSON.stringify(row).includes(String(forbidden)));
  }
});


test("actual login frontmatter audits a lockout transition once, not repeated denied requests", async (t) => {
  t.mock.method(console, "error", () => {});
  const frontmatter = readFileSync(new URL("../pages/hello.astro", import.meta.url), "utf8").split("---")[1]
    .replace(/^import[\s\S]*?;\s*/gm, "").replace("export const prerender", "const prerender");
  const compiled = ts.transpileModule(`(async () => { ${frontmatter} })()`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  const username = "fictional_lockout_user";
  const ip = "192.0.2.226";
  const execute = async (overrides: Record<string, unknown> = {}, origin = "https://fixture.invalid") => {
    const response = { status: 200, headers: new Headers() };
    const request = new Request("https://fixture.invalid/hello", {
      method: "POST", headers: { Origin: origin, "CF-Connecting-IP": ip },
      body: new URLSearchParams({ username, password: PRIVATE_FIXTURE }),
    });
    await runInNewContext(compiled, {
      ...credentials, ...authentication, ...runtimeEnvironment, ...loginLimits, recordLoginLockout,
      console, Date, Promise,
      Astro: { request, response, url: new URL(request.url), locals: { runtimeEnv: { ...platform.env, AUTH_SECRET: "fictional-login-root-secret-at-least-32-chars", BOOTSTRAP_ADMIN_PASSWORD: "fictional-bootstrap-password-226" } } },
      ...overrides,
    });
    return response;
  };
  const before = await events();
  assert.equal((await execute({}, "https://other.invalid")).status, 403);
  for (let i = 0; i < 4; i++) {
    assert.equal((await execute()).status, 401);
    assert.deepEqual(await events(), before);
  }
  assert.equal((await execute()).status, 401);
  const locked = await events();
  assert.equal(locked.length, before.length + 1);
  const row = locked.at(-1)!;
  assert.equal(row.action, "login.lockout");
  assert.equal(row.actor, "anonymous");
  for (const value of [username, ip, ...PRIVATE_MARKERS]) assert.ok(!JSON.stringify(row).includes(value));
  for (let i = 0; i < 6; i++) assert.equal((await execute()).status, 429);
  assert.deepEqual(await events(), locked);
  await loginLimits.clearAdminLoginFailures(platform.env.SESSION, username, ip);
  for (let i = 0; i < 4; i++) await loginLimits.recordAdminLoginFailure(platform.env.SESSION, username, ip);
  await database.prepare("CREATE TRIGGER reject_login_audit BEFORE INSERT ON system_events BEGIN SELECT RAISE(ABORT, 'fixture sink unavailable'); END").run();
  try {
    assert.equal((await execute()).status, 401, "an audit sink failure must not change the failed-login result");
    assert.equal((await execute()).status, 429);
    assert.deepEqual(await events(), locked);
  } finally {
    await database.prepare("DROP TRIGGER reject_login_audit").run();
  }
  await loginLimits.clearAdminLoginFailures(platform.env.SESSION, username, ip);
  let checks = 0;
  assert.equal((await execute({ checkAdminLoginRateLimit: async (...args: Parameters<typeof loginLimits.checkAdminLoginRateLimit>) => {
    if (++checks === 2) throw new Error(PRIVATE_FIXTURE);
    return loginLimits.checkAdminLoginRateLimit(...args);
  } })).status, 401, "a diagnostic recheck failure must not change the failed-login result");
  assert.deepEqual(await events(), locked);
});


test("payment routes audit configuration changes atomically without credential payloads", async (t) => {
  t.mock.method(console, "error", () => {});
  const root = "fictional-payment-audit-root-secret-2026";
  const call = (handler: typeof savePayment, method: string, body: Record<string, unknown>) => handler({
    request: new Request("https://fixture.invalid/api/admin/payments", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    locals: { runtimeEnv: { OMS_DB: database, AUTH_SECRET: root }, admin: { username: "fixture_owner", role: "owner" } },
  } as unknown as Parameters<typeof savePayment>[0]);
  const draft = { environment: "sandbox", client_id: "BRN-001-0000001", api_key: "fictional-api-key-226", secret_key: "fictional-secret-key-226", enabled_channels: ["INTERNET_BANKING_FPX"], expected_revision: null };
  const before = (await events()).length;
  assert.equal((await call(savePayment, "PUT", draft)).status, 200);
  const original = await database.prepare("SELECT * FROM payment_provider_configs").first();
  assert.ok(original);
  const auditBefore = await events();
  assert.equal((await call(savePayment, "PUT", draft)).status, 409);
  assert.deepEqual(await events(), auditBefore);
  await database.prepare("CREATE TRIGGER reject_payment_audit BEFORE INSERT ON system_events BEGIN SELECT RAISE(ABORT, 'fixture sink unavailable'); END").run();
  try {
    assert.equal((await call(savePayment, "PUT", { ...draft, expected_revision: 1, client_id: "BRN-001-0000002" })).status, 500);
    assert.equal((await call(togglePayment, "PATCH", { expected_revision: 1, action: "enable" })).status, 500);
    assert.equal((await call(clearPayment, "DELETE", { expected_revision: 1 })).status, 500);
    assert.deepEqual(await database.prepare("SELECT * FROM payment_provider_configs").first(), original);
    assert.deepEqual(await events(), auditBefore);
  } finally { await database.prepare("DROP TRIGGER reject_payment_audit").run(); }
  assert.equal((await call(togglePayment, "PATCH", { expected_revision: 1, action: "enable" })).status, 200);
  assert.equal((await call(togglePayment, "PATCH", { expected_revision: 1, action: "disable" })).status, 200);
  assert.equal((await call(savePayment, "PUT", { ...draft, expected_revision: 1 })).status, 200);
  assert.equal((await call(clearPayment, "DELETE", { expected_revision: 2 })).status, 200);
  const rows = (await events()).slice(before);
  assert.deepEqual(rows.map(row => row.action), ["payment.config.saved", "payment.config.enabled", "payment.config.disabled", "payment.config.saved", "payment.config.cleared"]);
  for (const value of [root, draft.client_id, draft.api_key, draft.secret_key, original.api_key_ciphertext, original.secret_key_ciphertext]) assert.ok(!JSON.stringify(rows).includes(String(value)));
  const projection = await loadSystemLog({ runtimeEnv: { OMS_DB: database }, admin: { role: "owner" } } as unknown as App.Locals, database);
  assert.ok(projection.some(row => row.source === "audit" && row.actor === "fixture_owner" && row.label === SYSTEM_EVENT_LABELS["payment.config.cleared"]));
});

test("credential and template routes preserve rollback, actor identity and redacted projection", async (t) => {
  t.mock.method(console, "error", () => {});
  const username = "fixture_profile";
  const password = "FictionalCurrentPassword!226";
  const nextPassword = "FictionalNewPassword!226";
  const hash = await credentials.hashAdminPassword(password);
  await database.prepare("INSERT INTO admin_credentials (username,password_hash,must_change_password,updated_at,role) VALUES (?, ?, 0, ?, 'admin')").bind(username,hash,NOW.toISOString()).run();
  await platform.env.SESSION.put("admin-session:profile_fixture", JSON.stringify({ username }));
  let cookieDeletes = 0;
  const profileBody = { username: "fixture_profile_renamed", current_password: password, new_password: nextPassword, confirm_password: nextPassword };
  const profile = (body: Record<string, unknown>) => saveProfile({
    request: new Request("https://fixture.invalid/api/admin/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    locals: { runtimeEnv: platform.env, admin: { username, role: "admin" } }, cookies: { delete: () => { cookieDeletes++; } },
  } as unknown as Parameters<typeof saveProfile>[0]);
  const templateBody = { action: "add-storefront-template", storefront_template_definition: { id: "fixture-audit-template", name: "Fixture audit template", composition: { layout: "compact", sections: { hero: false, catalog: true, proofs: true } } } };
  const template = () => saveSettings({
    request: new Request("https://fixture.invalid/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(templateBody) }),
    locals: { runtimeEnv: platform.env, admin: { username: "fixture_owner", role: "owner" } },
  } as unknown as Parameters<typeof saveSettings>[0]);
  const before = await events();
  assert.equal((await profile({ ...profileBody, current_password: "wrong" })).status, 400);
  assert.deepEqual(await events(), before);
  await database.prepare("CREATE TRIGGER reject_profile_template_audit BEFORE INSERT ON system_events BEGIN SELECT RAISE(ABORT, 'fixture sink unavailable'); END").run();
  try {
    assert.equal((await profile(profileBody)).status, 500);
    assert.equal((await template()).status, 500);
    assert.equal((await database.prepare("SELECT password_hash FROM admin_credentials WHERE username = ?").bind(username).first())?.password_hash, hash);
    assert.equal(await database.prepare("SELECT id FROM storefront_templates WHERE template_id = 'fixture-audit-template'").first(), null);
    assert.ok(await platform.env.SESSION.get("admin-session:profile_fixture"));
    assert.equal(cookieDeletes, 0);
    assert.deepEqual(await events(), before);
  } finally { await database.prepare("DROP TRIGGER reject_profile_template_audit").run(); }
  assert.equal((await profile(profileBody)).status, 200);
  assert.equal(cookieDeletes, 1);
  assert.equal(await platform.env.SESSION.get("admin-session:profile_fixture"), null);
  assert.equal((await template()).status, 200);
  const rows = (await events()).slice(before.length);
  assert.deepEqual(rows.map(row => row.action), ["operator.credentials.updated", "store.template.added"]);
  assert.equal(rows[0].actor, username, "credential audit must identify the authenticated pre-rename actor");
  assert.equal((await template()).status, 409);
  assert.deepEqual(await events(), [...before, ...rows]);
  for (const value of [password,nextPassword,hash]) assert.ok(!JSON.stringify(rows).includes(value));
  const projection = await loadSystemLog({ runtimeEnv: platform.env, admin: { role: "owner" } } as unknown as App.Locals, database);
  assert.ok(projection.some(row => row.actor === username && row.label === SYSTEM_EVENT_LABELS["operator.credentials.updated"]));
  assert.ok(projection.some(row => row.actor === "fixture_owner" && row.label === SYSTEM_EVENT_LABELS["store.template.added"]));
});
