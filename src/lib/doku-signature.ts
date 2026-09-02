const GLOBAL_SIGNATURE_PREFIX = "HMACSHA256=";
const DEFAULT_MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000;

export type DokuRawBody = string | Uint8Array | ArrayBuffer;

export class DokuSignatureError extends Error {
  readonly code:
    | "DOKU_SIGNATURE_COMPONENT_INVALID"
    | "DOKU_GLOBAL_TARGET_INVALID"
    | "DOKU_CARDS_SIGNATURE_NOT_ALLOWED";

  constructor(code: DokuSignatureError["code"]) {
    super(code);
    this.name = "DokuSignatureError";
    this.code = code;
  }
}

function rawBodyBuffer(body: DokuRawBody): ArrayBuffer {
  if (typeof body === "string") return new TextEncoder().encode(body).buffer;
  if (body instanceof ArrayBuffer) return body;
  const copy = new Uint8Array(body.byteLength);
  copy.set(body);
  return copy.buffer;
}

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64Decode(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value)) return null;
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    if (binary.length !== 32 || base64Encode(bytes) !== value) {
      return null;
    }
    return bytes;
  } catch {
    return null;
  }
}

function assertComponent(value: string): string {
  if (!value || /[\r\n\0]/.test(value)) {
    throw new DokuSignatureError("DOKU_SIGNATURE_COMPONENT_INVALID");
  }
  return value;
}

const CARDS_ONLY_TARGET = /^\/(?:credit-card|check-three-d-secure|cancellation\/credit-card|tokenization\/v2|orders\/v1\/status)(?:\/|$)/;

export function assertDokuGlobalTarget(target: string): string {
  if (CARDS_ONLY_TARGET.test(target)) {
    throw new DokuSignatureError("DOKU_CARDS_SIGNATURE_NOT_ALLOWED");
  }
  if (
    !target.startsWith("/") ||
    target.startsWith("//") ||
    target.includes("?") ||
    target.includes("#") ||
    /[\r\n\0]/.test(target)
  ) {
    throw new DokuSignatureError("DOKU_GLOBAL_TARGET_INVALID");
  }
  return target;
}

export async function dokuBodyDigest(body: DokuRawBody): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", rawBodyBuffer(body));
  return base64Encode(new Uint8Array(digest));
}

export async function buildDokuGlobalRequestComponent(input: {
  clientId: string;
  requestTimestamp: string;
  requestTarget: string;
  rawBody?: DokuRawBody;
}): Promise<string> {
  const parts = [
    assertComponent(input.clientId),
    assertComponent(input.requestTimestamp),
    assertDokuGlobalTarget(input.requestTarget),
  ];
  if (input.rawBody !== undefined) parts.push(await dokuBodyDigest(input.rawBody));
  return parts.join("\n");
}

export async function buildDokuGlobalResponseComponent(input: {
  clientId: string;
  responseTimestamp: string;
  rawBody: DokuRawBody;
}): Promise<string> {
  return [
    assertComponent(input.clientId),
    assertComponent(input.responseTimestamp),
    await dokuBodyDigest(input.rawBody),
  ].join("\n");
}

async function importHmacKey(secretKey: string, usage: KeyUsage[]) {
  assertComponent(secretKey);
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usage,
  );
}

async function signComponent(component: string, secretKey: string): Promise<string> {
  const key = await importHmacKey(secretKey, ["sign"]);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(component),
  );
  return `${GLOBAL_SIGNATURE_PREFIX}${base64Encode(new Uint8Array(signature))}`;
}

async function verifyComponent(
  component: string,
  secretKey: string,
  signature: string,
): Promise<boolean> {
  if (!signature.startsWith(GLOBAL_SIGNATURE_PREFIX)) return false;
  const bytes = base64Decode(signature.slice(GLOBAL_SIGNATURE_PREFIX.length));
  if (!bytes) return false;
  const key = await importHmacKey(secretKey, ["verify"]);
  // Web Crypto performs the HMAC comparison inside the runtime rather than in
  // application JavaScript, avoiding an early-exit string comparison.
  return crypto.subtle.verify(
    "HMAC",
    key,
    bytes.buffer,
    new TextEncoder().encode(component),
  );
}

export async function createDokuGlobalRequestSignature(
  input: Parameters<typeof buildDokuGlobalRequestComponent>[0] & { secretKey: string },
): Promise<string> {
  return signComponent(await buildDokuGlobalRequestComponent(input), input.secretKey);
}

export async function createDokuGlobalResponseSignature(
  input: Parameters<typeof buildDokuGlobalResponseComponent>[0] & { secretKey: string },
): Promise<string> {
  return signComponent(await buildDokuGlobalResponseComponent(input), input.secretKey);
}

export function isFreshDokuTimestamp(
  timestamp: string,
  options: {
    now?: number;
    maxSkewMs?: number;
  } = {},
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(timestamp)) {
    return false;
  }
  const parsed = Date.parse(timestamp);
  const canonicalTimestamp = timestamp.replace(
    /(?:\.(\d{1,3}))?Z$/,
    (_match, fraction: string | undefined) => `.${(fraction ?? "000").padEnd(3, "0")}Z`,
  );
  const now = options.now ?? Date.now();
  const maxSkewMs = options.maxSkewMs ?? DEFAULT_MAX_TIMESTAMP_SKEW_MS;
  return (
    Number.isFinite(parsed) &&
    new Date(parsed).toISOString() === canonicalTimestamp &&
    Number.isFinite(now) &&
    Number.isSafeInteger(maxSkewMs) &&
    maxSkewMs > 0 &&
    Math.abs(now - parsed) <= maxSkewMs
  );
}

export async function verifyDokuGlobalRequestSignature(
  input: Parameters<typeof buildDokuGlobalRequestComponent>[0] & {
    secretKey: string;
    signature: string;
    now?: number;
    maxSkewMs?: number;
  },
): Promise<boolean> {
  if (!isFreshDokuTimestamp(input.requestTimestamp, input)) return false;
  try {
    return verifyComponent(
      await buildDokuGlobalRequestComponent(input),
      input.secretKey,
      input.signature,
    );
  } catch {
    return false;
  }
}

export async function verifyDokuGlobalResponseSignature(
  input: Parameters<typeof buildDokuGlobalResponseComponent>[0] & {
    secretKey: string;
    signature: string;
    now?: number;
    maxSkewMs?: number;
  },
): Promise<boolean> {
  if (!isFreshDokuTimestamp(input.responseTimestamp, input)) return false;
  try {
    return verifyComponent(
      await buildDokuGlobalResponseComponent(input),
      input.secretKey,
      input.signature,
    );
  } catch {
    return false;
  }
}

export function readDokuGlobalSignatureHeaders(
  headers: Headers,
  direction: "request" | "response",
): { clientId: string; timestamp: string; signature: string } {
  if (headers.has("Request-Id")) {
    throw new DokuSignatureError("DOKU_CARDS_SIGNATURE_NOT_ALLOWED");
  }
  const clientId = headers.get("Client-Id");
  const timestamp = headers.get(
    direction === "request" ? "Request-Timestamp" : "Response-Timestamp",
  );
  const signature = headers.get("Signature");
  if (!clientId || !timestamp || !signature) {
    throw new DokuSignatureError("DOKU_SIGNATURE_COMPONENT_INVALID");
  }
  return {
    clientId: assertComponent(clientId),
    timestamp: assertComponent(timestamp),
    signature: assertComponent(signature),
  };
}
