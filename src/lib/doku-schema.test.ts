import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { splitMigrationStatements } from "./schema-version.ts";

const migration = readFileSync(
  new URL("../db/migrations/0059_doku_malaysia_payments.sql", import.meta.url),
  "utf8",
);

function createDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec(`
    CREATE TABLE stores (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE orders (
      id INTEGER PRIMARY KEY,
      store_id INTEGER NOT NULL REFERENCES stores(id)
    );
    INSERT INTO stores (id, name) VALUES (1, 'MyBookCMS');
    INSERT INTO orders (id, store_id) VALUES (101, 1);
  `);
  for (const statement of splitMigrationStatements(migration)) {
    database.exec(statement);
  }
  return database;
}

function insertConfig(database: DatabaseSync) {
  return database
    .prepare(`
      INSERT INTO payment_provider_configs (
        store_id, environment, client_id, api_key_ciphertext,
        secret_key_ciphertext, enabled_channels_json
      ) VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(1, "sandbox", "client-id", "encrypted-api-key", "encrypted-secret", '["FPX"]')
    .lastInsertRowid;
}

function insertAttempt(
  database: DatabaseSync,
  configId: number | bigint,
  overrides: {
    id?: string;
    orderId?: number;
    invoice?: string;
    idempotencyKey?: string;
    providerReference?: string | null;
    amountSen?: number;
    status?: string;
    terminalAt?: string | null;
  } = {},
) {
  return database
    .prepare(`
      INSERT INTO payment_attempts (
        id, order_id, provider_config_id, environment, config_revision,
        merchant_invoice, idempotency_key, request_fingerprint,
        provider_reference, amount_sen, local_status, terminal_at
      ) VALUES (?, ?, ?, 'sandbox', 1, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      overrides.id ?? "attempt-1",
      overrides.orderId ?? 101,
      configId,
      overrides.invoice ?? "MYB-101-A1",
      overrides.idempotencyKey ?? "idempotency-1",
      "sha256:fingerprint",
      overrides.providerReference ?? null,
      overrides.amountSen ?? 12500,
      overrides.status ?? "created",
      overrides.terminalAt ?? null,
    );
}

test("0059 creates the minimum encrypted DOKU payment records", () => {
  const database = createDatabase();
  const tables = database
    .prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name LIKE 'payment_%'
      ORDER BY name
    `)
    .all()
    .map((row) => String(row.name));
  assert.deepEqual(tables, [
    "payment_attempts",
    "payment_events",
    "payment_provider_configs",
  ]);

  const configId = insertConfig(database);
  insertAttempt(database, configId);
  database
    .prepare(`
      INSERT INTO payment_events (
        payment_attempt_id, source, event_key, resulting_status
      ) VALUES (?, 'checkout', ?, 'created')
    `)
    .run("attempt-1", "checkout-created");
  database
    .prepare(`
      INSERT INTO payment_events (
        payment_attempt_id, source, event_key, resulting_status
      ) VALUES (?, 'return', ?, 'created')
    `)
    .run("attempt-1", "buyer-returned");

  assert.deepEqual(
    {
      ...database
        .prepare("SELECT provider, currency, amount_sen, local_status FROM payment_attempts")
        .get(),
    },
    { provider: "doku", currency: "MYR", amount_sen: 12500, local_status: "created" },
  );
});

test("0059 rejects orphan, non-integer MYR, duplicate identities, and illegal states", () => {
  const database = createDatabase();
  const configId = insertConfig(database);

  assert.throws(() => insertConfig(database));
  assert.throws(() => insertAttempt(database, configId, { orderId: 999 }));
  assert.throws(() => insertAttempt(database, configId, { amountSen: 12.5 }));
  assert.throws(() => insertAttempt(database, configId, { status: "refunded" }));
  assert.throws(() =>
    database.prepare(`
      INSERT INTO payment_events (
        payment_attempt_id, source, event_key, resulting_status
      ) VALUES ('missing-attempt', 'notification', 'orphan-event', 'pending')
    `).run(),
  );

  insertAttempt(database, configId, { providerReference: "doku-ref-1" });
  for (const duplicate of [
    { id: "attempt-2", invoice: "MYB-101-A1", idempotencyKey: "idempotency-2" },
    { id: "attempt-3", invoice: "MYB-101-A3", idempotencyKey: "idempotency-1" },
    {
      id: "attempt-4",
      invoice: "MYB-101-A4",
      idempotencyKey: "idempotency-4",
      providerReference: "doku-ref-1",
    },
  ]) {
    assert.throws(() => insertAttempt(database, configId, duplicate));
  }
});

test("0059 keeps terminal attempts monotonic and events append-only", () => {
  const database = createDatabase();
  const configId = insertConfig(database);
  insertAttempt(database, configId, {
    status: "paid",
    terminalAt: "2026-09-01T00:00:00.000Z",
  });
  database
    .prepare(`
      INSERT INTO payment_events (
        payment_attempt_id, source, event_key, resulting_status
      ) VALUES ('attempt-1', 'notification', 'notification-1', 'paid')
    `)
    .run();

  assert.throws(() =>
    database.prepare("UPDATE payment_attempts SET local_status = 'pending', terminal_at = NULL WHERE id = 'attempt-1'").run(),
  );
  assert.throws(() =>
    database.prepare("UPDATE payment_events SET resulting_status = 'failed' WHERE event_key = 'notification-1'").run(),
  );
  assert.throws(() =>
    database.prepare("DELETE FROM payment_events WHERE event_key = 'notification-1'").run(),
  );
  assert.throws(() =>
    database.prepare(`
      INSERT INTO payment_events (
        payment_attempt_id, source, event_key, resulting_status
      ) VALUES ('attempt-1', 'notification', 'notification-1', 'paid')
    `).run(),
  );
  assert.throws(() =>
    database.prepare(`
      INSERT INTO payment_events (
        payment_attempt_id, source, event_key, resulting_status
      ) VALUES ('attempt-1', 'browser', 'untrusted-browser-state', 'paid')
    `).run(),
  );
});

test("0059 exposes no plaintext secret, signature, or raw-payload column", () => {
  const database = createDatabase();
  const columns = [
    "payment_provider_configs",
    "payment_attempts",
    "payment_events",
  ].flatMap((table) =>
    database
      .prepare(`PRAGMA table_info(${table})`)
      .all()
      .map((row) => String(row.name)),
  );

  assert.ok(columns.includes("api_key_ciphertext"));
  assert.ok(columns.includes("secret_key_ciphertext"));
  assert.equal(
    columns.some((column) => /(^|_)(api_key|secret_key|signature|raw|payload|body)$/.test(column)),
    false,
  );
});
