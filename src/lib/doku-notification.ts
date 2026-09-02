import { getEnabledDokuConfig } from "./doku-config.ts";
import {
  applyDokuNotification,
  type DokuNotificationFact,
  type DokuPaymentConfigIdentity,
} from "./doku-payment-lifecycle.ts";
import {
  readDokuGlobalSignatureHeaders,
  verifyDokuGlobalRequestSignature,
} from "./doku-signature.ts";

const MAX_NOTIFICATION_BYTES = 256 * 1024;
const IDENTITY_PATTERN = /^[A-Za-z0-9_-]{1,255}$/;
const INVOICE_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const STATUS_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/;

export class DokuNotificationError extends Error {
  readonly code:
    | "DOKU_NOTIFICATION_CONFIGURATION"
    | "DOKU_NOTIFICATION_SIGNATURE"
    | "DOKU_NOTIFICATION_INVALID"
    | "DOKU_NOTIFICATION_MISMATCH";

  constructor(code: DokuNotificationError["code"]) {
    super(code);
    this.name = "DokuNotificationError";
    this.code = code;
  }
}

function amountSen(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  const sen = Math.round(value * 100);
  return Number.isSafeInteger(sen) && Math.abs(value * 100 - sen) < 1e-7 ? sen : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function requiredString(value: unknown, pattern: RegExp): string {
  if (typeof value !== "string" || !pattern.test(value)) {
    throw new DokuNotificationError("DOKU_NOTIFICATION_INVALID");
  }
  return value;
}

async function semanticEventKey(fact: Omit<DokuNotificationFact, "eventKey">) {
  const canonical = JSON.stringify([
    fact.providerReference,
    fact.merchantInvoice,
    fact.amountSen,
    fact.channel,
    fact.providerStatus,
    fact.providerState,
    fact.orderStatus ?? null,
  ]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `notification-${hex}`;
}

export async function parseDokuGlobalNotification(rawBody: Uint8Array) {
  if (rawBody.byteLength === 0 || rawBody.byteLength > MAX_NOTIFICATION_BYTES) {
    throw new DokuNotificationError("DOKU_NOTIFICATION_INVALID");
  }
  let payload: Record<string, unknown>;
  try {
    payload = record(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(rawBody)))!;
  } catch {
    throw new DokuNotificationError("DOKU_NOTIFICATION_INVALID");
  }
  if (!payload) throw new DokuNotificationError("DOKU_NOTIFICATION_INVALID");
  const order = record(payload.order);
  const payment = record(payload.payment);
  if (!order || !payment) throw new DokuNotificationError("DOKU_NOTIFICATION_INVALID");

  const orderAmount = amountSen(order.amount);
  const paymentAmount = amountSen(payment.amount);
  if (
    order.currency !== "MYR" ||
    payment.currency !== "MYR" ||
    orderAmount === null ||
    paymentAmount === null ||
    orderAmount !== paymentAmount
  ) {
    throw new DokuNotificationError("DOKU_NOTIFICATION_MISMATCH");
  }
  const fact = {
    providerReference: requiredString(payload.id, IDENTITY_PATTERN),
    merchantInvoice: requiredString(order.invoice_number, INVOICE_PATTERN),
    amountSen: orderAmount,
    channel: requiredString(payment.channel, STATUS_PATTERN),
    providerStatus: requiredString(payment.status, STATUS_PATTERN),
    providerState: requiredString(payment.state, STATUS_PATTERN),
    orderStatus:
      typeof order.status === "string"
        ? requiredString(order.status, STATUS_PATTERN)
        : undefined,
  };
  return { ...fact, eventKey: await semanticEventKey(fact) };
}

async function configIdentity(database: D1Database) {
  return database.prepare(`
    SELECT id, environment, config_revision
    FROM payment_provider_configs
    WHERE provider = 'doku' AND is_enabled = 1
    ORDER BY id LIMIT 1
  `).first<{ id: number; environment: string; config_revision: number }>();
}

export async function processDokuGlobalNotification(input: {
  database: D1Database;
  rootSecret: string;
  rawBody: Uint8Array;
  headers: Headers;
  requestTarget: string;
  now?: number;
}) {
  const [config, identity] = await Promise.all([
    getEnabledDokuConfig(input.database, input.rootSecret),
    configIdentity(input.database),
  ]);
  if (
    !config ||
    !identity ||
    identity.environment !== config.environment ||
    identity.config_revision !== config.configRevision
  ) {
    throw new DokuNotificationError("DOKU_NOTIFICATION_CONFIGURATION");
  }

  let signatureHeaders: ReturnType<typeof readDokuGlobalSignatureHeaders>;
  try {
    signatureHeaders = readDokuGlobalSignatureHeaders(input.headers, "request");
  } catch {
    throw new DokuNotificationError("DOKU_NOTIFICATION_SIGNATURE");
  }
  if (signatureHeaders.clientId !== config.clientId) {
    throw new DokuNotificationError("DOKU_NOTIFICATION_SIGNATURE");
  }
  const signatureValid = await verifyDokuGlobalRequestSignature({
    clientId: signatureHeaders.clientId,
    requestTimestamp: signatureHeaders.timestamp,
    requestTarget: input.requestTarget,
    rawBody: input.rawBody,
    secretKey: config.secretKey,
    signature: signatureHeaders.signature,
    now: input.now,
  });
  if (!signatureValid) {
    throw new DokuNotificationError("DOKU_NOTIFICATION_SIGNATURE");
  }

  const notification = await parseDokuGlobalNotification(input.rawBody);
  if (!config.enabledChannels.some((channel) => channel === notification.channel)) {
    throw new DokuNotificationError("DOKU_NOTIFICATION_MISMATCH");
  }
  return applyDokuNotification(
    input.database,
    {
      id: identity.id,
      environment: config.environment,
      configRevision: config.configRevision,
    } satisfies DokuPaymentConfigIdentity,
    notification,
  );
}
