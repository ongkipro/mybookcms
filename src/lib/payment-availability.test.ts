import assert from "node:assert/strict";
import test from "node:test";
import {
  paymentAvailabilityTrustLine,
  resolvePaymentAvailability,
  supportedPaymentMethods,
  type PaymentAvailability,
} from "./payment-availability.ts";
import { buildDokuPaymentMethod } from "./payment-brand.ts";
import { encryptSecret } from "./encrypted-secret.ts";
import { canAccessAdminRoute } from "./auth.ts";
import { PUT as updateSettings } from "../pages/api/admin/settings.ts";

/**
 * These exist because two endpoints answered "which payment methods does this
 * install offer?" and gave different answers. `GET /api/v1/storefront` returned
 * a literal that omitted `doku` while `POST /api/v1/checkout` accepted it, so
 * an operator could enable DOKU and have every headless storefront hide it.
 *
 * The property worth pinning is therefore not any single value but that the
 * answer is derived from D1 at all, and that it changes when the store changes.
 */

function availability(overrides: Partial<PaymentAvailability> = {}): PaymentAvailability {
  return {
    codEnabled: true,
    sellerBankAccounts: [],
    doku: null,
    ...overrides,
  };
}

const ACTIVE_BANK = {
  id: 1,
  bank_code: "MAYBANK",
  account_holder: "MyBookCMS Malaysia",
  account_number: "114012345678",
  is_active: 1,
};

test("COD is offered only while the store flag allows it", () => {
  assert.deepEqual(supportedPaymentMethods(availability({ codEnabled: true })), ["cod"]);
  assert.deepEqual(supportedPaymentMethods(availability({ codEnabled: false })), []);
});

test("PDP payment trust copy names every method the install actually offers", () => {
  const doku = buildDokuPaymentMethod(["INTERNET_BANKING_FPX"]);
  assert.ok(doku);
  // The combination that shipped wrong: everything enabled, and the line still
  // said only "COD atau pindahan bank" because the old ladder returned on its
  // first match. This case is asserted first because it is the one that was
  // missing, and its absence is the whole reason the defect survived review.
  assert.equal(
    paymentAvailabilityTrustLine(availability({ sellerBankAccounts: [ACTIVE_BANK], doku })),
    "Sedia dihantar • COD, pindahan bank atau bayaran dalam talian",
  );
  assert.equal(
    paymentAvailabilityTrustLine(availability({ doku })),
    "Sedia dihantar • COD atau bayaran dalam talian",
  );
  assert.equal(
    paymentAvailabilityTrustLine(availability({ codEnabled: false, sellerBankAccounts: [ACTIVE_BANK], doku })),
    "Sedia dihantar • Pindahan bank atau bayaran dalam talian",
  );
  assert.equal(
    paymentAvailabilityTrustLine(availability({ sellerBankAccounts: [ACTIVE_BANK] })),
    "Sedia dihantar • COD atau pindahan bank",
  );
  assert.equal(
    paymentAvailabilityTrustLine(availability()),
    "Sedia dihantar • COD",
  );
  assert.equal(
    paymentAvailabilityTrustLine(availability({ codEnabled: false, sellerBankAccounts: [ACTIVE_BANK] })),
    "Sedia dihantar • Pindahan bank",
  );
  assert.equal(
    paymentAvailabilityTrustLine(availability({ codEnabled: false, doku })),
    "Sedia dihantar • Bayaran dalam talian",
  );
  // An inactive account is not an offer, the same way persistOrder refuses it.
  assert.equal(
    paymentAvailabilityTrustLine(
      availability({ codEnabled: false, sellerBankAccounts: [{ ...ACTIVE_BANK, is_active: 0 }] }),
    ),
    "Kaedah bayaran belum tersedia",
  );
  assert.equal(
    paymentAvailabilityTrustLine(availability({ codEnabled: false })),
    "Kaedah bayaran belum tersedia",
  );
});

test("only Owner and Admin can reach the COD settings mutation route", () => {
  assert.equal(canAccessAdminRoute("owner", "/api/admin/settings"), true);
  assert.equal(canAccessAdminRoute("admin", "/api/admin/settings"), true);
  assert.equal(canAccessAdminRoute("customer_service", "/api/admin/settings"), false);
  assert.equal(canAccessAdminRoute("advertiser", "/api/admin/settings"), false);
});

test("COD settings action validates a boolean and returns the saved state", async () => {
  let saved: number | null = null;
  const database = {
    async batch(statements: { run: () => Promise<unknown> }[]) {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      return results;
    },
    prepare(sql: string) {
      const statement = {
        values: [] as unknown[],
        bind(...values: unknown[]) {
          this.values = values;
          return this;
        },
        async first() {
          if (!/FROM stores/.test(sql)) throw new Error(`Unexpected first query: ${sql}`);
          return { id: 1, is_cod_enabled: 1 };
        },
        async run() {
          if (/INSERT INTO system_events/.test(sql)) {
            assert.equal(this.values[0], "fixture_owner");
            assert.equal(this.values[1], "store.cod.updated");
            return { success: true, meta: { changes: 1 } };
          }
          if (!/UPDATE stores SET is_cod_enabled/.test(sql)) {
            throw new Error(`Unexpected run query: ${sql}`);
          }
          saved = Number(this.values[0]);
          return { success: true };
        },
      };
      return statement;
    },
  } as unknown as D1Database;
  const locals = { runtimeEnv: { OMS_DB: database }, admin: { username: "fixture_owner", role: "owner" } } as unknown as App.Locals;

  const invalid = await updateSettings({
    request: new Request("https://shop.example/api/admin/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "save-cod-availability", cod_enabled: 0 }),
    }),
    locals,
  } as never);
  assert.equal(invalid.status, 400);
  assert.equal(saved, null);

  const response = await updateSettings({
    request: new Request("https://shop.example/api/admin/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "save-cod-availability", cod_enabled: false }),
    }),
    locals,
  } as never);
  assert.equal(response.status, 200);
  assert.equal(saved, 0);
  assert.deepEqual(await response.json(), {
    success: true,
    message: "COD dinonaktifkan untuk checkout baru.",
    data: { cod_enabled: false },
  });
});

test("manual transfer needs an active bank account, not merely a row", () => {
  assert.deepEqual(
    supportedPaymentMethods(availability({ sellerBankAccounts: [ACTIVE_BANK] })),
    ["cod", "manual_transfer"],
  );
  // `persistOrder` refuses manual transfer without an active account, so
  // advertising it here would send the buyer down a path the server rejects.
  assert.deepEqual(
    supportedPaymentMethods(
      availability({ sellerBankAccounts: [{ ...ACTIVE_BANK, is_active: 0 }] }),
    ),
    ["cod"],
  );
});

test("an enabled DOKU configuration adds exactly one hosted method", () => {
  // Built by the real builder rather than hand-written, so this cannot pass
  // against a shape the runtime never produces.
  const doku = buildDokuPaymentMethod(["INTERNET_BANKING_FPX"]);
  assert.ok(doku, "the builder must produce a method for an allowlisted channel");
  const withDoku = availability({ doku });
  assert.equal(doku.channels.length, 1);
  assert.equal(doku.channels[0].code, "INTERNET_BANKING_FPX");

  // A code outside the allowlist yields no method at all, so an unrecognised
  // channel can never reach a storefront as an offerable option.
  assert.equal(buildDokuPaymentMethod(["FPX"]), null);
  assert.equal(buildDokuPaymentMethod([]), null);
  assert.deepEqual(supportedPaymentMethods(withDoku), ["cod", "doku"]);
  assert.deepEqual(supportedPaymentMethods(availability({ doku: null })), ["cod"]);
});

/** A D1 stand-in that answers by matching the table named in the statement. */
function fakeDatabase(options: {
  codEnabled?: boolean;
  banks?: Array<typeof ACTIVE_BANK>;
  storeThrows?: boolean;
  dokuConfig?: Record<string, unknown>;
}): D1Database {
  return {
    prepare(sql: string) {
      return {
        bind() {
          return this;
        },
        async first() {
          if (sql.includes("payment_provider_configs")) return options.dokuConfig ?? null;
          if (options.storeThrows) throw new Error("D1_ERROR");
          return { is_cod_enabled: options.codEnabled === false ? 0 : 1 };
        },
        async all() {
          if (options.storeThrows) throw new Error("D1_ERROR");
          return { results: options.banks ?? [], success: true, meta: {} };
        },
      };
    },
  } as unknown as D1Database;
}

const NO_LOCALS = {} as App.Locals;

test("availability is read from D1 rather than asserted", async () => {
  const enabled = await resolvePaymentAvailability(
    NO_LOCALS,
    fakeDatabase({ codEnabled: true, banks: [ACTIVE_BANK] }),
  );
  assert.equal(enabled.codEnabled, true);
  assert.equal(enabled.sellerBankAccounts.length, 1);

  const disabled = await resolvePaymentAvailability(
    NO_LOCALS,
    fakeDatabase({ codEnabled: false }),
  );
  assert.equal(disabled.codEnabled, false);
  assert.deepEqual(supportedPaymentMethods(disabled), []);
});

test("a transient store read failure leaves COD available rather than closing the shop", async () => {
  // Asymmetric on purpose: an unreadable store falls back to the column default,
  // while an unreadable DOKU configuration is never presented as available.
  const result = await resolvePaymentAvailability(NO_LOCALS, fakeDatabase({ storeThrows: true }));
  assert.equal(result.codEnabled, true);
  assert.equal(result.doku, null);
});

test("no database at all yields the safe default without throwing", async () => {
  const result = await resolvePaymentAvailability(NO_LOCALS, null);
  assert.deepEqual(result, { codEnabled: true, sellerBankAccounts: [], doku: null });
});

test("DOKU is absent whenever no credential secret is configured", async () => {
  // An unconfigured install never offers DOKU.
  const result = await resolvePaymentAvailability(NO_LOCALS, fakeDatabase({}));
  assert.equal(result.doku, null);
  assert.ok(!supportedPaymentMethods(result).includes("doku"));
});

test("availability diagnoses an enabled encrypted configuration even when its root secret is missing", async () => {
  const fixtureRoot = "fictional-root-for-availability-regression-only";
  const dokuConfig = {
    environment: "sandbox", client_id: "BRN-001-0000001",
    api_key_ciphertext: await encryptSecret("fictional-api-key", fixtureRoot, "mybookcms:doku:sandbox:api-key:v1"),
    secret_key_ciphertext: await encryptSecret("fictional-secret-key", fixtureRoot, "mybookcms:doku:sandbox:secret-key:v1"),
    enabled_channels_json: JSON.stringify(["INTERNET_BANKING_FPX"]),
    is_enabled: 1, config_revision: 7,
  };
  const recorded: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { recorded.push(args); };
  try {
    for (const root of ["", "short", "a-different-fictional-root-of-sufficient-length"]) {
      recorded.length = 0;
      const locals = { runtimeEnv: { AUTH_SECRET: root } } as unknown as App.Locals;
      const result = await resolvePaymentAvailability(locals, fakeDatabase({ dokuConfig }));
      assert.equal(result.doku, null);
      assert.deepEqual(recorded, [["doku-config-unusable", {
        environment: "sandbox", configRevision: 7, enabled: true,
        reason: "EncryptedSecretError", code: null,
      }]]);
    }
    recorded.length = 0;
    const locals = { runtimeEnv: { AUTH_SECRET: fixtureRoot } } as unknown as App.Locals;
    const healthy = await resolvePaymentAvailability(locals, fakeDatabase({ dokuConfig }));
    assert.deepEqual(healthy.doku?.channels.map(channel => channel.code), ["INTERNET_BANKING_FPX"]);
    const empty = await resolvePaymentAvailability(NO_LOCALS, fakeDatabase({}));
    assert.equal(empty.doku, null);
    assert.deepEqual(recorded, []);
  } finally {
    console.error = original;
  }
});
