const PREFIX = "enc:v1";
const PURPOSE = "mybookcms:meta-capi-token:v1";

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function encryptionKey(secret: string) {
  if (secret.length < 32) throw new Error("AUTH_SECRET tidak memenuhi syarat enkripsi.");
  const material = new TextEncoder().encode(`${PURPOSE}:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", material);
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export function isEncryptedAdsSecret(value: string) {
  return value.startsWith(`${PREFIX}:`);
}

export async function encryptAdsSecret(value: string, secret: string) {
  const clean = value.trim();
  if (!clean) return "";
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(PURPOSE) },
    await encryptionKey(secret),
    new TextEncoder().encode(clean),
  );
  return `${PREFIX}:${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(encrypted))}`;
}

export async function decryptAdsSecret(value: string, secret: string) {
  const clean = value.trim();
  if (!clean) return "";
  if (!isEncryptedAdsSecret(clean)) throw new Error("Token CAPI database tidak terenkripsi.");
  const [, , ivRaw, encryptedRaw] = clean.split(":");
  if (!ivRaw || !encryptedRaw) throw new Error("Format token CAPI terenkripsi tidak valid.");
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ToBytes(ivRaw),
      additionalData: new TextEncoder().encode(PURPOSE),
    },
    await encryptionKey(secret),
    base64ToBytes(encryptedRaw),
  );
  return new TextDecoder().decode(decrypted);
}
