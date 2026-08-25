import assert from "node:assert/strict";
import test from "node:test";
import {
  generateApiKeySecret,
  hashApiKeySecret,
  maskApiKeySecret,
  verifyApiKeySecret,
} from "./developer-api-keys.ts";

const SECRET = "mybook_live_9pQ2vX7tKmR4bN8sLdF1hJ0wYcZ3aE6uT5gI2oP4kQs";

test("a MyBookCMS key validates only against its own hash", async () => {
  const storedHash = await hashApiKeySecret(SECRET);
  assert.equal(await verifyApiKeySecret(SECRET, storedHash), true);
  assert.equal(await verifyApiKeySecret(`${SECRET}x`, storedHash), false);
});

test("masked previews stay coherent for the MyBookCMS prefix", () => {
  const issued = generateApiKeySecret();
  assert.ok(issued.startsWith("mybook_live_"));

  for (const secret of [issued]) {
    const preview = maskApiKeySecret(secret);
    assert.ok(preview.startsWith(secret.slice(0, secret.indexOf("live_") + 5)));
    assert.ok(preview.includes("••••"));
    assert.equal(preview.endsWith(secret.slice(-4)), true);
    assert.equal(preview.includes(secret), false);
    assert.ok(preview.length < secret.length);
  }
});

test("an unrecognised secret masks to dots instead of leaking characters", () => {
  assert.equal(maskApiKeySecret("sk_live_someone_elses_token_format"), "••••••••");
  assert.equal(maskApiKeySecret("mybook_live_short"), "••••••••");
  assert.equal(maskApiKeySecret(""), "••••••••");
});
