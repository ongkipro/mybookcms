import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../pages/api/submit-middle-order.ts";

test("retired middle checkout is a no-store tombstone and never needs runtime bindings", async () => {
  const response = await POST({
    locals: {},
    request: new Request("https://store.example/api/submit-middle-order", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ submit_token: "legacy-token-must-not-write" }),
    }),
  } as never);

  assert.equal(response.status, 410);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    success: false,
    code: "LEGACY_CHECKOUT_REMOVED",
    error: "Checkout ringkas sudah ditamatkan. Gunakan borang pesanan lengkap.",
  });
});
