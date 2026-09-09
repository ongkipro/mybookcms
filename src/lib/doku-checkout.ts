import { DokuClient, DokuClientError } from "./doku-client.ts";
import { buildDokuCheckoutBody, DokuRequestBodyError } from "./doku-request-body.ts";
import { getEnabledDokuConfig, type DokuPaymentChannel } from "./doku-config.ts";
import {
  DuplicateSubmissionError,
  persistOrder,
  type PersistOrderInput,
  type PersistedOrder,
} from "./order-persistence.ts";
import { isValidMalaysiaPhone } from "./validation.ts";

const CHECKOUT_TTL_MS = 60 * 60 * 1000;
const DOKU_HOST_PATTERN = /(^|\.)doku\.com$/i;

export type DokuCheckoutInput = Omit<
  PersistOrderInput,
  "paymentMethod" | "sellerBankAccountId" | "metaPurchase" | "dokuPaymentAttempt"
> & {
  customerEmail: string;
  selectedChannel: DokuPaymentChannel;
  requestUrl: string;
  clientIp: string;
  userAgent: string;
};

export type DokuCheckoutResult = {
  order: PersistedOrder;
  payment: {
    attemptId: string;
    providerReference: string;
    checkoutUrl: string;
    expiresAt: string;
    status: string;
    state: string;
  };
};

export class DokuCheckoutError extends Error {
  readonly code:
    | "DOKU_UNAVAILABLE"
    | "DOKU_CONFLICT"
    | "DOKU_RESPONSE_INVALID"
    | "DOKU_PROVIDER_FAILED";

  constructor(code: DokuCheckoutError["code"]) {
    super(code);
    this.name = "DokuCheckoutError";
    this.code = code;
  }
}

type PersistedDokuOrder = PersistedOrder & {
  submitToken: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  address: string;
  province: string;
  city: string;
  district: string;
  postalCode: string;
  variantId: number;
  variantSku: string;
  variantTitle: string;
  productTitle: string;
  quantity: number;
  shippingCost: number;
  attemptId: string;
  providerConfigId: number;
  environment: "sandbox" | "production";
  configRevision: number;
  merchantInvoice: string;
  idempotencyKey: string;
  requestFingerprint: string;
  channel: DokuPaymentChannel;
  checkoutUrl: string | null;
  providerReference: string | null;
  expiresAt: string;
  providerStatus: string | null;
  providerState: string | null;
};

type DokuCreateResponse = {
  id?: unknown;
  order?: {
    amount?: unknown;
    currency?: unknown;
    invoice_number?: unknown;
    expired_at?: unknown;
  };
  payment?: {
    checkout_url?: unknown;
    status?: unknown;
    state?: unknown;
  };
};

function boundedText(value: string, maxLength: number): string {
  const clean = value.trim();
  if (!clean || clean.length > maxLength || /[\0\r\n]/.test(clean)) {
    throw new DokuCheckoutError("DOKU_CONFLICT");
  }
  return clean;
}

function requestOrigin(requestUrl: string): string {
  try {
    const url = new URL(requestUrl);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("unsafe");
    return url.origin;
  } catch {
    throw new DokuCheckoutError("DOKU_CONFLICT");
  }
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(rootSecret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(rootSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createDokuReturnToken(
  rootSecret: string,
  attemptId: string,
  orderNumber: string,
): Promise<string> {
  if (
    !/^pay_[a-f0-9]{40}$/.test(attemptId) ||
    !/^[A-Z0-9-]{1,64}$/.test(orderNumber)
  ) {
    throw new DokuCheckoutError("DOKU_CONFLICT");
  }
  return hmacHex(
    rootSecret,
    `mybookcms:doku-return:v1:${attemptId}:${orderNumber}`,
  );
}

function parseRequestFingerprint(value: string) {
  const match = /^v1:([a-f0-9]{64}):([a-f0-9]{64})$/.exec(value);
  return match ? { intent: match[1], device: match[2] } : null;
}


function checkoutBody(
  order: PersistedDokuOrder,
  origin: string,
  returnToken: string,
  deviceFingerprint: string,
): string {
  try {
    return buildDokuCheckoutBody({
      attemptId: order.attemptId,
      merchantInvoice: order.merchantInvoice,
      orderNumber: order.orderNumber,
      expiresAt: order.expiresAt,
      channel: order.channel,
      totalAmountSen: order.totalAmount,
      unitPriceSen: order.unitPrice,
      shippingCostSen: order.shippingCost,
      quantity: order.quantity,
      variantId: order.variantId,
      variantSku: order.variantSku,
      productTitle: order.productTitle,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      address: order.address,
      city: order.city,
      postalCode: order.postalCode,
      origin,
      returnToken,
      deviceFingerprint,
    });
  } catch (error) {
    // Preserved from the guard this used to carry inline: a money value that is
    // not a safe non-negative integer is a conflict, never a provider request.
    if (error instanceof DokuRequestBodyError) throw new DokuCheckoutError("DOKU_CONFLICT");
    throw error;
  }
}

async function enabledConfigIdentity(database: D1Database) {
  return database
    .prepare(`
      SELECT id, environment, config_revision
      FROM payment_provider_configs
      WHERE provider = 'doku' AND is_enabled = 1
      ORDER BY id LIMIT 1
    `)
    .first<{ id: number; environment: string; config_revision: number }>();
}

async function loadPersistedDokuOrder(
  database: D1Database,
  submitToken: string,
): Promise<PersistedDokuOrder | null> {
  const row = await database
    .prepare(`
      SELECT
        o.id, o.order_number, o.public_status_token, o.submit_token,
        o.customer_name, o.customer_phone, o.customer_email, o.address,
        o.province, o.city, o.district, o.postal_code, o.total_amount,
        o.shipping_cost, oi.unit_price, oi.quantity, pv.id AS variant_id,
        COALESCE(pv.sku, CAST(pv.id AS TEXT)) AS variant_sku,
        pv.title AS variant_title, p.id AS product_id, p.title AS product_title,
        pa.id AS attempt_id, pa.provider_config_id, pa.environment,
        pa.config_revision, pa.merchant_invoice, pa.idempotency_key,
        pa.request_fingerprint, pa.channel, pa.checkout_url, pa.provider_reference,
        pa.expires_at, pa.provider_status, pa.provider_state
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN product_variants pv ON pv.id = oi.variant_id
      JOIN products p ON p.id = pv.product_id
      JOIN payment_attempts pa ON pa.order_id = o.id AND pa.provider = 'doku'
      WHERE o.submit_token = ? AND o.payment_method = 'doku'
      ORDER BY pa.created_at, pa.id
      LIMIT 1
    `)
    .bind(submitToken)
    .first<Record<string, unknown>>();
  if (!row) return null;
  return {
    id: Number(row.id),
    orderNumber: String(row.order_number),
    publicStatusToken: String(row.public_status_token),
    contentId: `p${String(row.product_id)}-v${String(row.variant_id)}`,
    totalAmount: Number(row.total_amount),
    productValue: Number(row.unit_price) * Number(row.quantity),
    unitPrice: Number(row.unit_price),
    submitToken: String(row.submit_token),
    customerName: String(row.customer_name),
    customerPhone: String(row.customer_phone),
    customerEmail: String(row.customer_email),
    address: String(row.address),
    province: String(row.province),
    city: String(row.city),
    district: String(row.district),
    postalCode: String(row.postal_code),
    variantId: Number(row.variant_id),
    variantSku: String(row.variant_sku),
    variantTitle: String(row.variant_title),
    productTitle: String(row.product_title),
    quantity: Number(row.quantity),
    shippingCost: Number(row.shipping_cost),
    attemptId: String(row.attempt_id),
    providerConfigId: Number(row.provider_config_id),
    environment: String(row.environment) as "sandbox" | "production",
    configRevision: Number(row.config_revision),
    merchantInvoice: String(row.merchant_invoice),
    idempotencyKey: String(row.idempotency_key),
    requestFingerprint: String(row.request_fingerprint),
    channel: String(row.channel) as DokuPaymentChannel,
    checkoutUrl: row.checkout_url ? String(row.checkout_url) : null,
    providerReference: row.provider_reference ? String(row.provider_reference) : null,
    // A-280. The four siblings here guard with `row.x ? String(row.x) : null`;
    // this one did not, so a NULL became the string "null" — non-empty, so it
    // walked past A-279's `requiredExpiry` and reached DOKU. Empty refuses.
    expiresAt: row.expires_at ? String(row.expires_at) : "",
    providerStatus: row.provider_status ? String(row.provider_status) : null,
    providerState: row.provider_state ? String(row.provider_state) : null,
  };
}

function sameIntent(order: PersistedDokuOrder, input: DokuCheckoutInput): boolean {
  return (
    order.submitToken === input.submitToken &&
    order.customerName === input.customerName &&
    order.customerPhone === input.customerPhone &&
    order.customerEmail === input.customerEmail &&
    order.address === input.address &&
    order.province === input.province &&
    order.city === input.city &&
    order.district === input.district &&
    order.postalCode === input.postalCode &&
    order.quantity === input.quantity &&
    order.shippingCost === input.shippingCost &&
    order.channel === input.selectedChannel &&
    (String(order.variantId) === input.variantKey || order.variantSku === input.variantKey)
  );
}

function existingResult(order: PersistedDokuOrder): DokuCheckoutResult | null {
  if (!order.checkoutUrl || !order.providerReference || !order.providerStatus || !order.providerState) {
    return null;
  }
  return {
    order,
    payment: {
      attemptId: order.attemptId,
      providerReference: order.providerReference,
      checkoutUrl: order.checkoutUrl,
      expiresAt: order.expiresAt,
      status: order.providerStatus,
      state: order.providerState,
    },
  };
}

function parseProviderResponse(
  value: DokuCreateResponse,
  order: PersistedDokuOrder,
): DokuCheckoutResult["payment"] {
  const providerReference = typeof value.id === "string" ? value.id : "";
  const checkoutUrl = typeof value.payment?.checkout_url === "string" ? value.payment.checkout_url : "";
  const status = typeof value.payment?.status === "string" ? value.payment.status : "";
  const state = typeof value.payment?.state === "string" ? value.payment.state : "";
  const expiresAt = typeof value.order?.expired_at === "string" ? value.order.expired_at : "";
  let parsedCheckoutUrl: URL;
  try {
    parsedCheckoutUrl = new URL(checkoutUrl);
  } catch {
    throw new DokuCheckoutError("DOKU_RESPONSE_INVALID");
  }
  if (
    !/^[A-Za-z0-9_-]{1,255}$/.test(providerReference) ||
    value.order?.invoice_number !== order.merchantInvoice ||
    expiresAt !== order.expiresAt ||
    parsedCheckoutUrl.protocol !== "https:" ||
    !DOKU_HOST_PATTERN.test(parsedCheckoutUrl.hostname) ||
    parsedCheckoutUrl.username ||
    parsedCheckoutUrl.password ||
    parsedCheckoutUrl.hash ||
    !/^[A-Z][A-Z0-9_]{1,63}$/.test(status) ||
    !/^[A-Z][A-Z0-9_]{1,63}$/.test(state)
  ) {
    throw new DokuCheckoutError("DOKU_RESPONSE_INVALID");
  }
  return {
    attemptId: order.attemptId,
    providerReference,
    checkoutUrl: parsedCheckoutUrl.toString(),
    expiresAt,
    status,
    state,
  };
}

function failureClass(error: unknown): string {
  if (error instanceof DokuCheckoutError) return "provider";
  if (!(error instanceof DokuClientError)) return "provider";
  if (error.status === 401 || error.status === 403) return "authentication";
  if (["DOKU_RESPONSE_HEADERS", "DOKU_RESPONSE_SIGNATURE", "DOKU_AMOUNT_MISMATCH"].includes(error.code)) {
    return "signature";
  }
  if (error.code === "DOKU_TIMEOUT") return "timeout";
  if (error.code === "DOKU_CONFIGURATION") return "configuration";
  return "provider";
}

async function recordFailure(database: D1Database, attemptId: string, error: unknown) {
  await database
    .prepare(`
      UPDATE payment_attempts
      SET error_class = ?, updated_at = ?
      WHERE id = ? AND checkout_url IS NULL AND local_status = 'created'
    `)
    .bind(failureClass(error), new Date().toISOString(), attemptId)
    .run();
}

export async function createDokuHostedCheckout(
  database: D1Database,
  rootSecret: string,
  input: DokuCheckoutInput,
  options: { fetch?: typeof fetch; now?: () => Date } = {},
): Promise<DokuCheckoutResult> {
  if (
    !input.customerEmail ||
    input.customerEmail.length > 160 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.customerEmail)
  ) {
    throw new DokuCheckoutError("DOKU_CONFLICT");
  }
  if (!isValidMalaysiaPhone(input.customerPhone)) {
    throw new DokuCheckoutError("DOKU_CONFLICT");
  }
  const clientIp = boundedText(input.clientIp, 64);
  const userAgent = boundedText(input.userAgent, 512);
  const [config, identity] = await Promise.all([
    getEnabledDokuConfig(database, rootSecret),
    enabledConfigIdentity(database),
  ]);
  if (
    !config ||
    !identity ||
    identity.environment !== config.environment ||
    identity.config_revision !== config.configRevision
  ) {
    throw new DokuCheckoutError("DOKU_UNAVAILABLE");
  }
  if (!config.enabledChannels.includes(input.selectedChannel)) {
    throw new DokuCheckoutError("DOKU_UNAVAILABLE");
  }
  const origin = requestOrigin(input.requestUrl);
  const intent = JSON.stringify({
    submitToken: input.submitToken,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    customerEmail: input.customerEmail,
    address: input.address,
    province: input.province,
    city: input.city,
    district: input.district,
    postalCode: input.postalCode,
    variantKey: input.variantKey,
    quantity: input.quantity,
    shippingCost: input.shippingCost,
    selectedChannel: input.selectedChannel,
    configRevision: config.configRevision,
    origin,
  });
  const tokenHash = await sha256Hex(input.submitToken);
  const attemptId = `pay_${tokenHash.slice(0, 40)}`;
  const idempotencyKey = `checkout_${tokenHash}`;
  const intentFingerprint = await sha256Hex(intent);
  const deviceFingerprint = await sha256Hex(`${clientIp}\n${userAgent}`);
  const requestFingerprint = `v1:${intentFingerprint}:${deviceFingerprint}`;
  const expiresAt = new Date((options.now?.() ?? new Date()).getTime() + CHECKOUT_TTL_MS).toISOString();

  let order = await loadPersistedDokuOrder(database, input.submitToken);
  if (!order) {
    try {
      await persistOrder(database, {
        ...input,
        paymentMethod: "doku",
        metaPurchase: undefined,
        dokuPaymentAttempt: {
          id: attemptId,
          providerConfigId: identity.id,
          environment: config.environment,
          configRevision: config.configRevision,
          merchantInvoice: `MYB-${tokenHash.slice(0, 24)}`,
          idempotencyKey,
          requestFingerprint,
          channel: input.selectedChannel,
          expiresAt,
        },
      });
    } catch (error) {
      if (!(error instanceof DuplicateSubmissionError)) throw error;
    }
    order = await loadPersistedDokuOrder(database, input.submitToken);
  }
  const persistedFingerprint = order ? parseRequestFingerprint(order.requestFingerprint) : null;
  if (
    !order ||
    !sameIntent(order, input) ||
    persistedFingerprint?.intent !== intentFingerprint ||
    order.providerConfigId !== identity.id ||
    order.environment !== config.environment ||
    order.configRevision !== config.configRevision
  ) {
    throw new DokuCheckoutError("DOKU_CONFLICT");
  }
  const prior = existingResult(order);
  if (prior) return prior;

  const returnToken = await createDokuReturnToken(
    rootSecret,
    order.attemptId,
    order.orderNumber,
  );
  const rawBody = checkoutBody(
    order,
    origin,
    returnToken,
    persistedFingerprint.device,
  );
  const client = new DokuClient({
    environment: config.environment,
    clientId: config.clientId,
    apiKey: config.apiKey,
    secretKey: config.secretKey,
    fetch: options.fetch,
    now: options.now,
  });
  try {
    const response = await client.createCheckout<DokuCreateResponse>({
      rawBody,
      idempotencyId: order.idempotencyKey,
      expectedAmountSen: order.totalAmount,
    });
    const payment = parseProviderResponse(response.data, order);
    const nowIso = (options.now?.() ?? new Date()).toISOString();
    await database.batch([
      database.prepare(`
        UPDATE payment_attempts SET
          provider_reference = ?, checkout_url = ?, expires_at = ?,
          provider_status = ?, provider_state = ?, local_status = 'pending',
          error_class = NULL, initiated_at = COALESCE(initiated_at, ?), updated_at = ?
        WHERE id = ? AND local_status IN ('created', 'pending')
      `).bind(
        payment.providerReference,
        payment.checkoutUrl,
        payment.expiresAt,
        payment.status,
        payment.state,
        nowIso,
        nowIso,
        order.attemptId,
      ),
      database.prepare(`
        INSERT OR IGNORE INTO payment_events (
          payment_attempt_id, source, event_key, provider_status,
          provider_state, resulting_status, received_at
        ) VALUES (?, 'checkout', ?, ?, ?, 'pending', ?)
      `).bind(order.attemptId, `provider-${payment.providerReference}`, payment.status, payment.state, nowIso),
    ]);
    return { order, payment };
  } catch (error) {
    await recordFailure(database, order.attemptId, error);
    if (error instanceof DokuCheckoutError) throw error;
    throw new DokuCheckoutError("DOKU_PROVIDER_FAILED");
  }
}
