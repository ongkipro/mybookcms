import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../pages/api/submit-middle-order.ts";

function request(body: Record<string, unknown>) {
  return {
    locals: { runtimeEnv: {} },
    request: new Request("https://store.example/api/submit-middle-order", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  } as never;
}

test("middle checkout refuses a non-Malaysia phone before any database write", async () => {
  const response = await POST(request({
    submit_token: "middle-form-token-12345",
    customer_name: "Aina Rahman",
    customer_phone: "08123456789",
    address: "Alamat akan disahkan oleh CS melalui WhatsApp",
    variant_id: "10003",
  }));

  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Nombor telefon Malaysia tidak sah. Contoh: 0123456789",
    code: "VALIDATION_ERROR",
  });
});

