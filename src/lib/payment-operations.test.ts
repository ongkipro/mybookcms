import assert from "node:assert/strict";
import test from "node:test";
import { loadPaymentOperations, sanitizeAdminOrder } from "./payment-operations.ts";

function fakeDatabase() {
  const attempt = {
    id: "pay_safe_correlation_123",
    environment: "sandbox",
    config_revision: 3,
    provider_reference: "checkout-reference-12345678",
    amount_sen: 4090,
    channel: "INTERNET_BANKING_FPX",
    provider_status: "PENDING",
    provider_state: "INIT",
    local_status: "pending",
    error_class: null,
    reconcile_attempts: 1,
    expires_at: "2026-09-01T08:00:00.000Z",
    initiated_at: "2026-09-01T07:00:00.000Z",
    paid_at: null,
    terminal_at: null,
    stock_released_at: null,
    created_at: "2026-09-01T07:00:00.000Z",
    updated_at: "2026-09-01T07:01:00.000Z",
    lease_until: null,
    next_reconcile_at: null,
    provider_config_id: 7,
    checkout_url: "https://must-not-leak.example/secret",
    lease_token: "must-not-leak-lease",
    idempotency_key: "must-not-leak-idempotency",
  };
  return {
    prepare(sql: string) {
      return {
        bind() { return this; },
        async first() {
          if (sql.includes("SELECT payment_method")) return { payment_method: "doku", shipping_status: "pending" };
          if (sql.includes("FROM payment_provider_configs")) {
            return { id: 7, environment: "sandbox", config_revision: 3, is_enabled: 1, has_credentials: 1 };
          }
          return null;
        },
        async all() {
          if (sql.includes("FROM payment_attempts")) return { results: [attempt] };
          if (sql.includes("FROM payment_events")) return { results: [{
            id: 91,
            payment_attempt_id: attempt.id,
            source: "reconciliation",
            provider_status: "PENDING",
            provider_state: "INIT",
            resulting_status: "pending",
            received_at: "2026-09-01T07:01:00.000Z",
            event_key: "must-not-leak-event-key",
          }] };
          return { results: [] };
        },
      };
    },
  } as unknown as D1Database;
}

test("payment operations expose a bounded redacted role-aware history", async () => {
  const database = fakeDatabase();
  const owner = await loadPaymentOperations(database, 1, "owner", "invalid-test-root-secret-at-least-32-chars");
  const customerService = await loadPaymentOperations(database, 1, "customer_service", "invalid-test-root-secret-at-least-32-chars");
  assert.ok(owner);
  assert.ok(customerService);
  assert.equal(owner.can_reconcile, false);
  assert.equal(owner.reconcile_action_visible, true);
  assert.equal(customerService.can_reconcile, false);
  assert.equal(customerService.reconcile_action_visible, false);
  assert.match(customerService.reconcile_block_reason || "", /Owner atau Admin/);
  assert.equal(owner.attempts[0].provider_reference_masked, "••••12345678");
  assert.equal(owner.attempts[0].last_automatic_check_at, "2026-09-01T07:01:00.000Z");
  const serialized = JSON.stringify(owner);
  assert.doesNotMatch(serialized, /must-not-leak|checkout_url|lease_token|idempotency_key|event_key/);
});

test("admin order serialization uses an allowlist and omits tokens and advertising identity", () => {
  const safe = sanitizeAdminOrder({
    id: 1,
    order_number: "INV-10001",
    customer_name: "Aina",
    public_status_token: "public-secret",
    submit_token: "submit-secret",
    ad_click_ids: "gclid-secret",
    checkout_url: "checkout-secret",
    request_fingerprint: "fingerprint-secret",
    lease_token: "lease-secret",
  });
  assert.deepEqual(safe, { id: 1, order_number: "INV-10001", customer_name: "Aina" });
  assert.doesNotMatch(JSON.stringify(safe), /secret|token|gclid|fingerprint/);
});
