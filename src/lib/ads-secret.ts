import { decryptSecret, encryptSecret, isEncryptedSecret } from "./encrypted-secret.ts";

const PURPOSE = "mybookcms:meta-capi-token:v1";

export function isEncryptedAdsSecret(value: string) {
  return isEncryptedSecret(value);
}

export function encryptAdsSecret(value: string, secret: string) {
  return encryptSecret(value, secret, PURPOSE);
}

export async function decryptAdsSecret(value: string, secret: string) {
  const clean = value.trim();
  if (!clean) return "";
  if (!isEncryptedAdsSecret(clean)) throw new Error("Token CAPI database tidak terenkripsi.");
  try {
    return await decryptSecret(clean, secret, PURPOSE);
  } catch {
    throw new Error("Format token CAPI terenkripsi tidak valid.");
  }
}
