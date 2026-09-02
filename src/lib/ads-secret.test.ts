import assert from "node:assert/strict";
import test from "node:test";
import { decryptAdsSecret, encryptAdsSecret, isEncryptedAdsSecret } from "./ads-secret.ts";

const AUTH_SECRET = "mybookcms-test-auth-secret-is-long-enough-2026";

test("Meta CAPI tokens are encrypted at rest and round-trip with the same key", async () => {
  const token = "EAAB-test-token-that-must-not-appear-in-D1";
  const encrypted = await encryptAdsSecret(token, AUTH_SECRET);

  assert.equal(isEncryptedAdsSecret(encrypted), true);
  assert.doesNotMatch(encrypted, /EAAB-test-token/);
  assert.equal(await decryptAdsSecret(encrypted, AUTH_SECRET), token);
});

test("Meta CAPI token decryption fails closed with the wrong key", async () => {
  const encrypted = await encryptAdsSecret("EAAB-test-token", AUTH_SECRET);
  await assert.rejects(
    decryptAdsSecret(encrypted, "another-test-auth-secret-that-is-long-enough"),
  );
});

test("plaintext database tokens fail closed instead of bypassing encryption", async () => {
  await assert.rejects(
    decryptAdsSecret("EAAB-plaintext-token", AUTH_SECRET),
    /tidak terenkripsi/,
  );
});

test("the generalized helper decrypts ciphertext produced by the original Meta format", async () => {
  const legacyCiphertext = "enc:v1:I6o+1E6+TMvOd77s:D/kVoXX2N7ISCfY5F75rzj16r06J6TDTvGiKQpERsWO0";
  assert.equal(await decryptAdsSecret(legacyCiphertext, AUTH_SECRET), "legacy-meta-token");
});
