const PREFIX = "enc:v1";
const MIN_ROOT_SECRET_LENGTH = 32;
const MAX_PLAINTEXT_LENGTH = 4096;
const MAX_CIPHERTEXT_LENGTH = 8192;

export class EncryptedSecretError extends Error {
  readonly code:
    | "ENCRYPTED_SECRET_ROOT_INVALID"
    | "ENCRYPTED_SECRET_PURPOSE_INVALID"
    | "ENCRYPTED_SECRET_FORMAT_INVALID"
    | "ENCRYPTED_SECRET_VALUE_INVALID"
    | "ENCRYPTED_SECRET_DECRYPT_FAILED";

  constructor(code: EncryptedSecretError["code"]) {
    super(code);
    this.name = "EncryptedSecretError";
    this.code = code;
  }
}

function assertPurpose(purpose: string): string {
  if (!/^[a-z0-9][a-z0-9:._-]{0,127}$/i.test(purpose)) {
    throw new EncryptedSecretError("ENCRYPTED_SECRET_PURPOSE_INVALID");
  }
  return purpose;
}

function assertRootSecret(secret: string): string {
  if (secret.length < MIN_ROOT_SECRET_LENGTH || secret.length > 4096) {
    throw new EncryptedSecretError("ENCRYPTED_SECRET_ROOT_INVALID");
  }
  return secret;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string, expectedLength?: number): Uint8Array<ArrayBuffer> {
  if (!value || value.length > MAX_CIPHERTEXT_LENGTH || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new EncryptedSecretError("ENCRYPTED_SECRET_FORMAT_INVALID");
  }
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    if (
      (expectedLength !== undefined && bytes.length !== expectedLength) ||
      bytesToBase64(bytes) !== value
    ) {
      throw new EncryptedSecretError("ENCRYPTED_SECRET_FORMAT_INVALID");
    }
    return bytes;
  } catch (error) {
    if (error instanceof EncryptedSecretError) throw error;
    throw new EncryptedSecretError("ENCRYPTED_SECRET_FORMAT_INVALID");
  }
}

async function encryptionKey(rootSecret: string, purpose: string, usage: KeyUsage[]) {
  const material = new TextEncoder().encode(
    `${assertPurpose(purpose)}:${assertRootSecret(rootSecret)}`,
  );
  const digest = await crypto.subtle.digest("SHA-256", material);
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, usage);
}

export function isEncryptedSecret(value: string): boolean {
  return value.startsWith(`${PREFIX}:`);
}

export async function encryptSecret(
  value: string,
  rootSecret: string,
  purpose: string,
): Promise<string> {
  const clean = value.trim();
  if (!clean) return "";
  if (clean.length > MAX_PLAINTEXT_LENGTH) {
    throw new EncryptedSecretError("ENCRYPTED_SECRET_VALUE_INVALID");
  }
  const checkedPurpose = assertPurpose(purpose);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: new TextEncoder().encode(checkedPurpose),
    },
    await encryptionKey(rootSecret, checkedPurpose, ["encrypt"]),
    new TextEncoder().encode(clean),
  );
  return `${PREFIX}:${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(encrypted))}`;
}

export async function decryptSecret(
  value: string,
  rootSecret: string,
  purpose: string,
): Promise<string> {
  const clean = value.trim();
  if (!clean) return "";
  if (clean.length > MAX_CIPHERTEXT_LENGTH || !isEncryptedSecret(clean)) {
    throw new EncryptedSecretError("ENCRYPTED_SECRET_FORMAT_INVALID");
  }
  const parts = clean.split(":");
  if (parts.length !== 4 || parts[0] !== "enc" || parts[1] !== "v1") {
    throw new EncryptedSecretError("ENCRYPTED_SECRET_FORMAT_INVALID");
  }
  const iv = base64ToBytes(parts[2], 12);
  const ciphertext = base64ToBytes(parts[3]);
  if (ciphertext.length < 16) {
    throw new EncryptedSecretError("ENCRYPTED_SECRET_FORMAT_INVALID");
  }
  const checkedPurpose = assertPurpose(purpose);
  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv.buffer,
        additionalData: new TextEncoder().encode(checkedPurpose),
      },
      await encryptionKey(rootSecret, checkedPurpose, ["decrypt"]),
      ciphertext.buffer,
    );
    const plaintext = new TextDecoder("utf-8", { fatal: true }).decode(decrypted);
    if (!plaintext || plaintext.length > MAX_PLAINTEXT_LENGTH) {
      throw new EncryptedSecretError("ENCRYPTED_SECRET_VALUE_INVALID");
    }
    return plaintext;
  } catch (error) {
    if (error instanceof EncryptedSecretError) throw error;
    throw new EncryptedSecretError("ENCRYPTED_SECRET_DECRYPT_FAILED");
  }
}
