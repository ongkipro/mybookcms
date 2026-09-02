import assert from "node:assert/strict";
import test from "node:test";
import {
  EncryptedSecretError,
  decryptSecret,
  encryptSecret,
  isEncryptedSecret,
} from "./encrypted-secret.ts";

const ROOT_SECRET = "mybookcms-test-auth-secret-is-long-enough-2026";
const META_PURPOSE = "mybookcms:meta-capi-token:v1";
const DOKU_PURPOSE = "mybookcms:doku:sandbox:api-key:v1";

test("AES-GCM secrets round-trip without plaintext storage", async () => {
  const encrypted = await encryptSecret("provider-secret-value", ROOT_SECRET, DOKU_PURPOSE);
  assert.equal(isEncryptedSecret(encrypted), true);
  assert.doesNotMatch(encrypted, /provider-secret-value/);
  assert.equal(await decryptSecret(encrypted, ROOT_SECRET, DOKU_PURPOSE), "provider-secret-value");
});

test("purpose-bound AAD refuses cross-provider and cross-environment decryption", async () => {
  const encrypted = await encryptSecret("provider-secret-value", ROOT_SECRET, DOKU_PURPOSE);
  await assert.rejects(decryptSecret(encrypted, ROOT_SECRET, META_PURPOSE));
  await assert.rejects(
    decryptSecret(encrypted, ROOT_SECRET, "mybookcms:doku:production:api-key:v1"),
  );
});

test("plaintext, malformed envelopes, weak roots, and invalid purposes fail closed", async () => {
  const cases = [
    "plaintext-secret",
    "enc:v1:not-base64:not-base64",
    "enc:v1:YWJjZA==:YWJjZA==",
    "enc:v2:AAAAAAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAA==",
  ];
  for (const value of cases) {
    await assert.rejects(decryptSecret(value, ROOT_SECRET, DOKU_PURPOSE));
  }
  await assert.rejects(
    encryptSecret("value", "too-short", DOKU_PURPOSE),
    (error: unknown) =>
      error instanceof EncryptedSecretError && error.code === "ENCRYPTED_SECRET_ROOT_INVALID",
  );
  await assert.rejects(encryptSecret("value", ROOT_SECRET, "bad\npurpose"));
});
