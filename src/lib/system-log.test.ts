import assert from "node:assert/strict";
import test from "node:test";
import {
  loadSystemLog,
  SYSTEM_LOG_MAX_ENTRIES,
  SYSTEM_LOG_WINDOW_DAYS,
} from "./system-log.ts";

/**
 * The point of these is the redaction boundary.
 *
 * This module reads from five tables that between them hold a customer's name,
 * a hashed identity payload, a provider checkout URL, and an idempotency key.
 * The panel it feeds is a convenience; leaking any of that through it would not
 * be. So the central test seeds every source with a token, a Malaysian mobile
 * and a street address in the columns this module must not read, and asserts
 * that none of the three survives anywhere in the serialized response.
 */

const NOW = new Date("2026-09-04T10:00:00.000Z");
const RECENT = "2026-09-04T09:00:00.000Z";
const OLD = "2026-06-01T00:00:00.000Z";

const SECRET_TOKEN = "EAAG_super_secret_capi_token_value";
const CUSTOMER_PHONE = "60123456789";
const CUSTOMER_ADDRESS = "12 Jalan Bukit Bintang, Kuala Lumpur";

type Rows = Record<string, unknown[]>;

/**
 * A D1 stand-in that answers by matching the table named in the statement.
 *
 * Deliberately not a full engine: these tests are about which columns reach the
 * caller, so a query returning rows it did not ask for is exactly the condition
 * worth failing on. Every seeded row therefore carries the forbidden columns.
 */
function fakeDatabase(rows: Rows, failing = new Set<string>()): D1Database {
  const pick = (sql: string) => {
    if (sql.includes("capi_event_outbox")) return "capi";
    if (sql.includes("payment_events")) return "payments";
    if (sql.includes("notifications")) return "notifications";
    if (sql.includes("headless_api_audit_events")) return "api";
    return "unknown";
  };
  return {
    prepare(sql: string) {
      const table = pick(sql);
      return {
        bind() {
          return this;
        },
        async all() {
          if (failing.has(table)) throw new Error("D1_ERROR: no such table");
          return { results: rows[table] ?? [], success: true, meta: {} };
        },
        async first() {
          return (rows[table] ?? [])[0] ?? null;
        },
      };
    },
  } as unknown as D1Database;
}

/** `getSchemaVersionStatus` reads the binding off `locals`, so give it one. */
function localsWith(database: D1Database | null): App.Locals {
  return { runtime: { env: { OMS_DB: database } } } as unknown as App.Locals;
}

function seededRows(): Rows {
  return {
    capi: [
      {
        event_name: "Purchase",
        event_id: "purchase:MY-1001",
        status: "delivered",
        attempts: 1,
        updated_at: RECENT,
        // Never selected by the module. Present so a widened SELECT fails here.
        payload_json: JSON.stringify({ ph: CUSTOMER_PHONE, token: SECRET_TOKEN }),
      },
    ],
    payments: [
      {
        event_source: "notification",
        resulting_status: "paid",
        received_at: "2026-09-04 08:30:00",
        attempt_id: "att_01HZY",
        environment: "sandbox",
        error_class: null,
        order_number: "MY-1001",
        checkout_url: `https://checkout.doku.com/s/${SECRET_TOKEN}`,
        idempotency_key: SECRET_TOKEN,
        customer_address: CUSTOMER_ADDRESS,
      },
    ],
    notifications: [
      {
        type: "order",
        order_number: "MY-1001",
        created_at: RECENT,
        title: "Order baru MY-1001",
        // The real column carries the customer's name and destination.
        body: `Siti binti Ahmad · ${CUSTOMER_PHONE} · ${CUSTOMER_ADDRESS}`,
      },
    ],
    api: [
      {
        api_key_id: 7,
        operation: "productRead",
        outcome: "rate_limited",
        status_code: 429,
        created_at: RECENT,
        key_hash: SECRET_TOKEN,
      },
    ],
  };
}

test("no secret, phone number, or address reaches the system log", async () => {
  const database = fakeDatabase(seededRows());
  const entries = await loadSystemLog(localsWith(database), database, NOW);
  const serialized = JSON.stringify(entries);

  for (const [name, forbidden] of [
    ["CAPI token", SECRET_TOKEN],
    ["customer phone", CUSTOMER_PHONE],
    ["street address", CUSTOMER_ADDRESS],
    // The module's own contract puts the DOKU environment out of bounds, and an
    // earlier version selected and printed it anyway because this list did not
    // name it. Seeding a value is not asserting about it.
    ["DOKU environment", "sandbox"],
  ] as const) {
    assert.ok(
      !serialized.includes(forbidden),
      `${name} leaked into the system log response`,
    );
  }
  // Also assert the shapes those values live in never appear at all, so a
  // partial or re-encoded leak cannot slip past an exact-string check.
  assert.doesNotMatch(serialized, /doku\.com\/s\//, "a provider checkout URL leaked");
  assert.doesNotMatch(serialized, /Jalan/i, "an address fragment leaked");
  assert.doesNotMatch(serialized, /\b60\d{9}\b/, "a Malaysian mobile leaked");
});

test("every entry carries the fields the panel and the operator need", async () => {
  const database = fakeDatabase(seededRows());
  const entries = await loadSystemLog(localsWith(database), database, NOW);
  assert.ok(entries.length >= 5, `expected one entry per source, got ${entries.length}`);
  for (const entry of entries) {
    assert.ok(["schema", "ads", "payment", "order", "api"].includes(entry.source));
    assert.ok(["info", "warning", "error"].includes(entry.severity));
    assert.ok(entry.label.length > 0, "an entry has no label");
    assert.match(entry.occurred_at, /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/, "occurred_at is not ISO");
    assert.equal(typeof entry.correlation, "string");
    if (entry.href !== null) assert.match(entry.href, /^\/admin\//);
  }
});

test("entries are newest first across sources with different timestamp shapes", async () => {
  const database = fakeDatabase(seededRows());
  const entries = await loadSystemLog(localsWith(database), database, NOW);
  const times = entries.map((entry) => entry.occurred_at);
  assert.deepEqual([...times].sort().reverse(), times, "entries are not newest first");

  // The payment row is seeded in SQLite's `CURRENT_TIMESTAMP` shape. If it were
  // passed through unnormalized it would sort as text against ISO values and
  // land in the wrong place; this pins the normalization.
  const payment = entries.find((entry) => entry.source === "payment");
  assert.ok(payment, "the payment event is missing");
  assert.equal(payment.occurred_at, "2026-09-04T08:30:00.000Z");
});

test("anything outside the retention window is dropped", async () => {
  const rows = seededRows();
  rows.notifications = [
    { type: "order", order_number: "MY-OLD", created_at: OLD, title: "x", body: "x" },
  ];
  const database = fakeDatabase(rows);
  const entries = await loadSystemLog(localsWith(database), database, NOW);
  assert.ok(
    !entries.some((entry) => entry.correlation === "MY-OLD"),
    `an entry older than ${SYSTEM_LOG_WINDOW_DAYS} days was listed`,
  );
});

test("one failing source does not take the whole panel down", async () => {
  const database = fakeDatabase(seededRows(), new Set(["payments"]));
  const entries = await loadSystemLog(localsWith(database), database, NOW);
  assert.ok(
    entries.some((entry) => entry.source === "ads"),
    "a healthy source was lost when another failed",
  );
  assert.ok(
    !entries.some((entry) => entry.source === "payment"),
    "the failing source still produced entries",
  );
});

test("a noisy source is bounded and does not crowd out the others", async () => {
  const rows = seededRows();
  rows.api = Array.from({ length: 500 }, (_, index) => ({
    api_key_id: 7,
    operation: `op${index}`,
    outcome: "allowed",
    status_code: 200,
    created_at: RECENT,
    key_hash: SECRET_TOKEN,
  }));
  const database = fakeDatabase(rows);
  const entries = await loadSystemLog(localsWith(database), database, NOW);

  assert.ok(entries.length <= SYSTEM_LOG_MAX_ENTRIES, "the response is not bounded");

  // The point of a per-source ceiling. An earlier version set it equal to the
  // total, so 200 API rows filled the response and every schema, payment, order
  // and advertising entry was dropped by the final slice — while this test,
  // which only checked the total, still passed.
  for (const source of ["schema", "ads", "payment", "order"]) {
    assert.ok(
      entries.some((entry) => entry.source === source),
      `a burst of API events crowded out every "${source}" entry`,
    );
  }
});

test("the schema state is reported even with no database at all", async () => {
  const entries = await loadSystemLog(localsWith(null), null, NOW);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].source, "schema");
  assert.equal(entries[0].severity, "error", "a missing database must not read as healthy");
});

test("an unknown status is treated as noteworthy rather than silently fine", async () => {
  const rows = seededRows();
  rows.capi = [
    {
      event_name: "Purchase",
      event_id: "purchase:MY-2002",
      status: "quarantined",
      attempts: 3,
      updated_at: RECENT,
      payload_json: "{}",
    },
  ];
  const database = fakeDatabase(rows);
  const entries = await loadSystemLog(localsWith(database), database, NOW);
  const ads = entries.find((entry) => entry.source === "ads");
  assert.ok(ads);
  assert.equal(ads.severity, "warning", "an unmapped status defaulted to info");
});
