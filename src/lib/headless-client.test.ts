import assert from "node:assert/strict";
import test from "node:test";
import { HeadlessApiClient, HeadlessApiError } from "./headless-client.ts";

const validCheckout = {
  customer_name: "Aisyah Rahman",
  customer_phone: "60123456789",
  address: "12 Jalan Tun Razak, Kuala Lumpur",
  district: "Kuala Lumpur",
  province: "Wilayah Persekutuan Kuala Lumpur",
  postal_code: "50450",
  payment_method: "cod" as const,
  variant_id: 10001,
  quantity: 1,
  submit_token: "headless-submit-token-0001",
};

test("headless checkout consumes the Malaysia MYR response contract without provider fields", async () => {
  let submitted: Record<string, unknown> = {};
  const client = new HeadlessApiClient("https://store.example/api/v1", "mybook_live_test", async (request) => {
    submitted = await request.json() as Record<string, unknown>;
    return Response.json({
      success: true,
      order: {
        id: 41,
        order_number: "INV-10041",
        public_status_token: "public-token",
        total_amount: 3140,
        shipping_amount: 650,
        currency: "MYR",
      },
    }, { status: 201 });
  });

  const order = await client.checkout(validCheckout);
  assert.deepEqual(order, {
    id: 41,
    order_number: "INV-10041",
    public_status_token: "public-token",
    total_amount: 3140,
    shipping_amount: 650,
    currency: "MYR",
  });
  assert.equal("payment_channel" in submitted, false);
  assert.equal("courier_code" in submitted, false);
});

test("headless checkout refuses a non-MYR response", async () => {
  const client = new HeadlessApiClient("https://store.example/api/v1", "mybook_live_test", async () => Response.json({
    success: true,
    order: {
      id: 41,
      order_number: "INV-10041",
      public_status_token: "public-token",
      total_amount: 3140,
      shipping_amount: 650,
      currency: "IDR",
    },
  }, { status: 201 }));

  await assert.rejects(() => client.checkout(validCheckout), (error: unknown) =>
    error instanceof HeadlessApiError && error.code === "INVALID_API_RESPONSE");
});

test("headless checkout sends the selected hosted DOKU channel explicitly", async () => {
  let submitted: Record<string, unknown> = {};
  const client = new HeadlessApiClient("https://store.example/api/v1", "mybook_live_test", async (request) => {
    submitted = await request.json() as Record<string, unknown>;
    return Response.json({
      success: true,
      order: {
        id: 42,
        order_number: "INV-10042",
        public_status_token: "public-token-doku",
        total_amount: 3140,
        shipping_amount: 650,
        currency: "MYR",
      },
    }, { status: 201 });
  });
  await client.checkout({
    ...validCheckout,
    payment_method: "doku",
    customer_email: "aisyah@example.com",
    doku_channel: "EWALLET_TNG",
  });
  assert.equal(submitted.doku_channel, "EWALLET_TNG");
  assert.equal("payment_channel" in submitted, false);
});

test("advertised DOKU channels are allowlisted and round-trip into checkout", async () => {
  let submitted: Record<string, unknown> = {};
  const client = new HeadlessApiClient("https://store.example/api/v1", "mybook_live_test", async (request) => {
    if (new URL(request.url).pathname.endsWith("/storefront")) {
      return Response.json({ success: true, storefront: {}, content: {}, payment: {
        cod_enabled: true, supported_methods: ["cod", "doku"], doku_requires_email: true,
        doku_channels: [
          { code: "EWALLET_TNG", label: "Touch 'n Go eWallet" },
          { code: "UNKNOWN_CHANNEL", label: "Unsupported" },
          { code: "CREDIT_CARD", label: 123 }, null,
        ],
      }});
    }
    submitted = await request.json() as Record<string, unknown>;
    return Response.json({ success: true, order: {
      id: 42, order_number: "INV-10042", public_status_token: "fictional-token",
      total_amount: 3140, shipping_amount: 650, currency: "MYR",
    }});
  });
  const bootstrap = await client.getStorefront();
  assert.deepEqual(bootstrap.payment.doku_channels, [{ code: "EWALLET_TNG", label: "Touch 'n Go eWallet" }]);
  await client.checkout({ ...validCheckout, payment_method: "doku", customer_email: "audit@example.com",
    doku_channel: bootstrap.payment.doku_channels[0].code });
  assert.equal(submitted.doku_channel, "EWALLET_TNG");
});
