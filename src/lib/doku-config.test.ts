import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync, type StatementSync } from "node:sqlite";
import test from "node:test";
import {
  DokuConfigError,
  clearDokuConfigDraft,
  getDokuConfigStatus,
  getEnabledDokuConfig,
  replaceDokuConfigDraft,
  saveDokuConfigDraft,
  setDokuConfigEnabled,
} from "./doku-config.ts";
import { DELETE, GET, PATCH, PUT } from "../pages/api/admin/payments.ts";
import { splitMigrationStatements } from "./schema-version.ts";

const ROOT_SECRET = "mybookcms-test-auth-secret-is-long-enough-2026";

type SqliteValue = string | number | bigint | null | Uint8Array;

class SqliteD1Statement {
  readonly #statement: StatementSync;
  readonly #values: SqliteValue[];

  constructor(statement: StatementSync, values: SqliteValue[] = []) {
    this.#statement = statement;
    this.#values = values;
  }

  bind(...values: SqliteValue[]) {
    return new SqliteD1Statement(this.#statement, values);
  }

  async first<T>() {
    return (this.#statement.get(...this.#values) ?? null) as T | null;
  }

  async run() {
    const result = this.#statement.run(...this.#values);
    return {
      success: true,
      meta: { changes: Number(result.changes) },
    };
  }
}

function createDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON;");
  sqlite.exec(`
    CREATE TABLE stores (id INTEGER PRIMARY KEY, name TEXT NOT NULL, site_url TEXT);
    CREATE TABLE orders (
      id INTEGER PRIMARY KEY,
      store_id INTEGER NOT NULL REFERENCES stores(id)
    );
    INSERT INTO stores (id, name, site_url) VALUES (1, 'MyBookCMS', 'https://kedai.example/path');
  `);
  const migration = readFileSync(
    new URL("../db/migrations/0059_doku_malaysia_payments.sql", import.meta.url),
    "utf8",
  );
  for (const statement of splitMigrationStatements(migration)) sqlite.exec(statement);
  const database = {
    prepare(sql: string) {
      return new SqliteD1Statement(sqlite.prepare(sql));
    },
  } as unknown as D1Database;
  return { sqlite, database };
}

const sandboxDraft = {
  environment: "sandbox" as const,
  clientId: "BRN-001-0000001",
  apiKey: "doku_ak_test_example_123456",
  secretKey: "doku_sk_test_example_654321",
  enabledChannels: ["INTERNET_BANKING_FPX", "EWALLET_TNG"] as const,
};

test("a DOKU draft stores only environment-bound ciphertext and stays disabled", async () => {
  const { sqlite, database } = createDatabase();
  await saveDokuConfigDraft(database, ROOT_SECRET, sandboxDraft);

  const raw = sqlite.prepare(`
    SELECT provider, environment, client_id, api_key_ciphertext,
      secret_key_ciphertext, enabled_channels_json, is_enabled, config_revision
    FROM payment_provider_configs
  `).get() as Record<string, unknown>;
  assert.equal(raw.provider, "doku");
  assert.equal(raw.environment, "sandbox");
  assert.equal(raw.is_enabled, 0);
  assert.equal(raw.config_revision, 1);
  assert.match(String(raw.api_key_ciphertext), /^enc:v1:/);
  assert.match(String(raw.secret_key_ciphertext), /^enc:v1:/);
  assert.doesNotMatch(JSON.stringify(raw), /doku_[as]k_test_example/);

  const status = await getDokuConfigStatus(database, ROOT_SECRET);
  assert.deepEqual(status, {
    source: "database",
    health: "ready",
    environment: "sandbox",
    configured: true,
    enabled: false,
    clientIdMasked: "BRN-••••0001",
    apiKeyMasked: "doku••••3456",
    secretKeyMasked: "doku••••4321",
    enabledChannels: ["INTERNET_BANKING_FPX", "EWALLET_TNG"],
    configRevision: 1,
  });
  assert.equal(await getEnabledDokuConfig(database, ROOT_SECRET), null);

  sqlite.prepare("UPDATE payment_provider_configs SET is_enabled = 1").run();
  assert.deepEqual(await getEnabledDokuConfig(database, ROOT_SECRET), {
    environment: "sandbox",
    clientId: sandboxDraft.clientId,
    apiKey: sandboxDraft.apiKey,
    secretKey: sandboxDraft.secretKey,
    enabledChannels: ["INTERNET_BANKING_FPX", "EWALLET_TNG"],
    configRevision: 1,
  });
});

test("plaintext, incomplete, and cross-environment records fail closed", async () => {
  const { sqlite, database } = createDatabase();
  await saveDokuConfigDraft(database, ROOT_SECRET, sandboxDraft);

  sqlite.prepare("UPDATE payment_provider_configs SET environment = 'production'").run();
  assert.deepEqual(await getDokuConfigStatus(database, ROOT_SECRET), {
    source: "database",
    health: "invalid",
    environment: "production",
    configured: false,
    enabled: false,
    clientIdMasked: "",
    apiKeyMasked: "",
    secretKeyMasked: "",
    enabledChannels: [],
    configRevision: 1,
  });

  sqlite.prepare(`
    UPDATE payment_provider_configs SET
      environment = 'sandbox', api_key_ciphertext = 'plaintext-api-key'
  `).run();
  assert.equal((await getDokuConfigStatus(database, ROOT_SECRET)).health, "invalid");

  await clearDokuConfigDraft(database, 1);
  assert.equal((await getDokuConfigStatus(database, ROOT_SECRET)).health, "missing");

  sqlite.prepare(`
    UPDATE payment_provider_configs SET
      client_id = NULL, api_key_ciphertext = NULL,
      secret_key_ciphertext = NULL, enabled_channels_json = '[]', is_enabled = 0
  `).run();
  assert.equal((await getDokuConfigStatus(database, ROOT_SECRET)).health, "missing");
});

test("replacement increments revision, disables the draft, and clear never deletes audit identity", async () => {
  const { sqlite, database } = createDatabase();
  await saveDokuConfigDraft(database, ROOT_SECRET, sandboxDraft);
  await saveDokuConfigDraft(database, ROOT_SECRET, {
    environment: "production",
    clientId: "BRN-001-0000002",
    apiKey: "doku_ak_live_example_123456",
    secretKey: "doku_sk_live_example_654321",
    enabledChannels: ["CREDIT_CARD"],
  });
  const replaced = await getDokuConfigStatus(database, ROOT_SECRET);
  assert.equal(replaced.environment, "production");
  assert.equal(replaced.configRevision, 2);
  assert.equal(replaced.enabled, false);
  assert.deepEqual(replaced.enabledChannels, ["CREDIT_CARD"]);

  await clearDokuConfigDraft(database);
  const cleared = await getDokuConfigStatus(database, ROOT_SECRET);
  assert.equal(cleared.health, "missing");
  assert.equal(cleared.configRevision, 3);
  assert.equal(
    (sqlite.prepare("SELECT COUNT(*) AS count FROM payment_provider_configs").get() as { count: number }).count,
    1,
  );
});

test("invalid or Indonesia-only channel policy is rejected before persistence", async () => {
  const { sqlite, database } = createDatabase();
  for (const enabledChannels of [
    [],
    ["INTERNET_BANKING_FPX", "INTERNET_BANKING_FPX"],
    ["BNPL_SHOPEEPAY"],
    ["VIRTUAL_ACCOUNT_BCA"],
  ]) {
    await assert.rejects(
      saveDokuConfigDraft(database, ROOT_SECRET, { ...sandboxDraft, enabledChannels }),
      (error: unknown) => error instanceof DokuConfigError && error.code === "DOKU_CONFIG_INVALID",
    );
  }
  assert.equal(
    (sqlite.prepare("SELECT COUNT(*) AS count FROM payment_provider_configs").get() as { count: number }).count,
    0,
  );
});

function locals(database: D1Database, role: "owner" | "admin" | "advertiser" | "customer_service") {
  return {
    admin: { username: "operator", role },
    runtimeEnv: { OMS_DB: database, AUTH_SECRET: ROOT_SECRET },
  } as unknown as App.Locals;
}

test("the admin API permits owner/admin drafts but never returns or activates credentials", async () => {
  const { sqlite, database } = createDatabase();
  const payload = {
    environment: "sandbox",
    client_id: sandboxDraft.clientId,
    api_key: sandboxDraft.apiKey,
    secret_key: sandboxDraft.secretKey,
    enabled_channels: [...sandboxDraft.enabledChannels],
    expected_revision: null,
  };
  const response = await PUT({
    request: new Request("https://shop.example/api/admin/payments", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
    locals: locals(database, "admin"),
  } as never);
  const responseText = await response.text();
  assert.equal(response.status, 200);
  assert.doesNotMatch(responseText, /doku_[as]k_test_example/);
  assert.match(responseText, /"enabled":false/);
  assert.match(responseText, /https:\/\/kedai\.example\/api\/payments\/doku\/notifications/);
  assert.equal(
    (sqlite.prepare("SELECT is_enabled FROM payment_provider_configs").get() as { is_enabled: number }).is_enabled,
    0,
  );

  const ownerRead = await GET({ locals: locals(database, "owner") } as never);
  assert.equal(ownerRead.status, 200);
  assert.doesNotMatch(await ownerRead.text(), /doku_[as]k_test_example/);

  const strict = await PUT({
    request: new Request("https://shop.example/api/admin/payments", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, is_enabled: true }),
    }),
    locals: locals(database, "owner"),
  } as never);
  assert.equal(strict.status, 400);
});

test("advertiser/customer-service are refused and owner can clear without reveal", async () => {
  const { database } = createDatabase();
  await saveDokuConfigDraft(database, ROOT_SECRET, sandboxDraft);

  const deniedRead = await GET({ locals: locals(database, "customer_service") } as never);
  const deniedWrite = await PUT({
    request: new Request("https://shop.example/api/admin/payments", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
    locals: locals(database, "advertiser"),
  } as never);
  assert.equal(deniedRead.status, 403);
  assert.equal(deniedWrite.status, 403);

  const cleared = await DELETE({
    request: new Request("https://shop.example/api/admin/payments", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ expected_revision: 1 }),
    }),
    locals: locals(database, "owner"),
  } as never);
  const text = await cleared.text();
  assert.equal(cleared.status, 200);
  assert.match(text, /"health":"missing"/);
  assert.doesNotMatch(text, /doku_[as]k_test_example/);
});

test("activation is explicit, revision-bound, and never changes the configuration revision", async () => {
  const { sqlite, database } = createDatabase();
  await saveDokuConfigDraft(database, ROOT_SECRET, sandboxDraft);

  await setDokuConfigEnabled(database, ROOT_SECRET, 1, true);
  const active = sqlite.prepare(
    "SELECT is_enabled, config_revision FROM payment_provider_configs",
  ).get() as { is_enabled: number; config_revision: number };
  assert.equal(active.is_enabled, 1);
  assert.equal(active.config_revision, 1);
  await assert.rejects(
    setDokuConfigEnabled(database, ROOT_SECRET, 2, false),
    (error: unknown) => error instanceof DokuConfigError && error.code === "DOKU_CONFIG_STALE",
  );

  const response = await PATCH({
    request: new Request("https://shop.example/api/admin/payments", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "disable", expected_revision: 1 }),
    }),
    locals: locals(database, "admin"),
  } as never);
  const text = await response.text();
  assert.equal(response.status, 200);
  assert.match(text, /"enabled":false/);
  assert.doesNotMatch(text, /doku_[as]k_test_example/);
});

test("stale revisions and current nonterminal attempts block replacement and deletion", async () => {
  const { sqlite, database } = createDatabase();
  await saveDokuConfigDraft(database, ROOT_SECRET, sandboxDraft);

  await assert.rejects(
    replaceDokuConfigDraft(database, ROOT_SECRET, sandboxDraft, null),
    (error: unknown) => error instanceof DokuConfigError && error.code === "DOKU_CONFIG_STALE",
  );
  sqlite.prepare("INSERT INTO orders (id, store_id) VALUES (7, 1)").run();
  sqlite.prepare(`
    INSERT INTO payment_attempts (
      id, order_id, provider_config_id, environment, config_revision,
      merchant_invoice, idempotency_key, request_fingerprint, amount_sen
    ) VALUES ('attempt-active', 7, 1, 'sandbox', 1, 'INV-ACTIVE', 'idem-active', 'fingerprint', 1000)
  `).run();

  for (const operation of [
    () => replaceDokuConfigDraft(database, ROOT_SECRET, sandboxDraft, 1),
    () => clearDokuConfigDraft(database, 1),
  ]) {
    await assert.rejects(
      operation(),
      (error: unknown) => error instanceof DokuConfigError && error.code === "DOKU_CONFIG_ACTIVE_ATTEMPTS",
    );
  }
  assert.equal((await getDokuConfigStatus(database, ROOT_SECRET)).configRevision, 1);
});
