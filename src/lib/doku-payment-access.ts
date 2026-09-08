import { DokuClient, DokuClientError } from "./doku-client.ts";
import { checkRateLimit, rateLimitHeaders } from "./rate-limit.ts";
import {
  DOKU_PAYMENT_CHANNELS,
  getEnabledDokuConfig,
  type DokuPaymentChannel,
  type DokuRuntimeConfig,
} from "./doku-config.ts";
import { createDokuReturnToken } from "./doku-checkout.ts";
import { buildDokuCheckoutBody, DokuRequestBodyError } from "./doku-request-body.ts";
import {
  applyDokuPaymentFact,
  type DokuLocalPaymentStatus,
  type DokuNotificationFact,
  type DokuPaymentConfigIdentity,
} from "./doku-payment-lifecycle.ts";

const ACCESS_COOKIE_NAME = "__Host-mybook_doku_access";
const ACCESS_COOKIE_MAX_AGE_SECONDS = 30 * 60;
export const DOKU_RETURN_CAPABILITY_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ACCESS_REQUEST_BYTES = 4096;
const RETRY_TTL_MS = 60 * 60 * 1000;
const SAFE_JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
} as const;

const PAID_ORDER_STATUSES = new Set(["paid", "settled", "success"]);
const TERMINAL_LOCAL_STATUSES = new Set<DokuLocalPaymentStatus>(["paid", "failed", "expired"]);

export type DokuPaymentAccess = {
  orderId: number;
  orderNumber: string;
  attemptId: string;
  providerConfigId: number;
  environment: "sandbox" | "production";
  configRevision: number;
  merchantInvoice: string;
  idempotencyKey: string;
  providerReference: string | null;
  amountSen: number;
  totalAmountSen: number;
  productValueSen: number;
  checkoutUrl: string | null;
  expiresAt: string | null;
  channel: string | null;
  providerStatus: string | null;
  providerState: string | null;
  localStatus: DokuLocalPaymentStatus;
  errorClass: string | null;
  createdAt: string;
  orderPaymentStatus: string;
  orderShippingStatus: string;
  stockRestoredAt: string | null;
  returnToken: string;
};

export type PublicDokuPaymentStatus = {
  order_number: string;
  payment_method: "doku";
  payment_status: string;
  shipping_status: string;
  local_status: DokuLocalPaymentStatus;
  amount: number;
  total_amount: number;
  product_value_myr: number;
  expires_at: string | null;
  can_retry: boolean;
  retry_blocked_reason: "DOKU_CHANNEL_DISABLED" | null;
  can_reconcile: boolean;
};

export class DokuPaymentAccessError extends Error {
  readonly code:
    | "DOKU_ACCESS_DENIED"
    | "DOKU_UNAVAILABLE"
    | "DOKU_CHANNEL_DISABLED"
    | "DOKU_PROVIDER_FAILED"
    | "DOKU_RETRY_NOT_ALLOWED"
    | "DOKU_STOCK_UNAVAILABLE"
    | "DOKU_CONFLICT";
  readonly status: number;

  constructor(code: DokuPaymentAccessError["code"], status = 409) {
    super(code);
    this.name = "DokuPaymentAccessError";
    this.code = code;
    this.status = status;
  }
}

type AccessRow = {
  order_id: number;
  order_number: string;
  payment_status: string;
  shipping_status: string;
  stock_restored_at: string | null;
  total_amount: number;
  product_value_sen: number;
  attempt_id: string;
  provider_config_id: number;
  environment: string;
  config_revision: number;
  merchant_invoice: string;
  idempotency_key: string;
  provider_reference: string | null;
  amount_sen: number;
  checkout_url: string | null;
  expires_at: string | null;
  channel: string | null;
  provider_status: string | null;
  provider_state: string | null;
  local_status: DokuLocalPaymentStatus;
  error_class: string | null;
  created_at: string;
};

type RetryOrder = {
  orderId: number;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  address: string;
  province: string;
  city: string;
  district: string;
  postalCode: string;
  paymentStatus: string;
  shippingStatus: string;
  stockRestoredAt: string | null;
  totalAmountSen: number;
  shippingCostSen: number;
  productValueSen: number;
  variantId: number;
  variantSku: string;
  productTitle: string;
  unitPriceSen: number;
  quantity: number;
  variantStock: number | null;
};

type AttemptRow = {
  id: string;
  merchant_invoice: string;
  idempotency_key: string;
  request_fingerprint: string;
  provider_config_id: number;
  environment: "sandbox" | "production";
  config_revision: number;
  channel: string | null;
  provider_reference: string | null;
  checkout_url: string | null;
  expires_at: string | null;
  provider_status: string | null;
  provider_state: string | null;
  local_status: DokuLocalPaymentStatus;
};

type DokuStatusResponse = {
  id?: unknown;
  order?: {
    amount?: unknown;
    currency?: unknown;
    expired_at?: unknown;
    invoice_number?: unknown;
    status?: unknown;
  };
  payment?: {
    amount?: unknown;
    currency?: unknown;
    channel?: unknown;
    checkout_url?: unknown;
    status?: unknown;
    state?: unknown;
  };
};

type ConfigIdentityRow = {
  id: number;
  environment: string;
  config_revision: number;
};

function normalizeOrderNumber(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return /^[A-Z0-9-]{1,64}$/.test(normalized) ? normalized : null;
}

function normalizeReturnToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(normalized) ? normalized : null;
}

function timingSafeHexEqual(left: string, right: string): boolean {
  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    diff |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return diff === 0;
}

function majorMyrToSen(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  const sen = Math.round(value * 100);
  return Number.isSafeInteger(sen) && Math.abs(value * 100 - sen) < 1e-7 ? sen : null;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function requestOrigin(requestUrl: string): string {
  try {
    const url = new URL(requestUrl);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("unsafe");
    return url.origin;
  } catch {
    throw new DokuPaymentAccessError("DOKU_CONFLICT");
  }
}

export function dokuNoStoreHeaders(extra: Record<string, string> = {}): Headers {
  return new Headers({
    ...SAFE_JSON_HEADERS,
    ...extra,
  });
}

function json(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: dokuNoStoreHeaders(),
  });
}

export function buildDokuAccessCookie(orderNumber: string, returnToken: string): string {
  const safeOrderNumber = normalizeOrderNumber(orderNumber);
  const safeReturnToken = normalizeReturnToken(returnToken);
  if (!safeOrderNumber || !safeReturnToken) {
    throw new DokuPaymentAccessError("DOKU_ACCESS_DENIED", 404);
  }
  return [
    `${ACCESS_COOKIE_NAME}=${safeOrderNumber}.${safeReturnToken}`,
    `Max-Age=${ACCESS_COOKIE_MAX_AGE_SECONDS}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");
}

export function buildClearDokuAccessCookie(): string {
  return [
    `${ACCESS_COOKIE_NAME}=`,
    "Max-Age=0",
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");
}

function parseCookieHeader(cookieHeader: string | null): { orderNumber: string; returnToken: string } | null {
  if (!cookieHeader || cookieHeader.length > 4096) return null;
  for (const rawPart of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = rawPart.trim().split("=");
    if (rawName !== ACCESS_COOKIE_NAME) continue;
    const [orderNumber, returnToken] = rawValue.join("=").split(".");
    const safeOrderNumber = normalizeOrderNumber(orderNumber);
    const safeReturnToken = normalizeReturnToken(returnToken);
    return safeOrderNumber && safeReturnToken
      ? { orderNumber: safeOrderNumber, returnToken: safeReturnToken }
      : null;
  }
  return null;
}

function accessFromRow(row: AccessRow, returnToken: string): DokuPaymentAccess | null {
  if (row.environment !== "sandbox" && row.environment !== "production") return null;
  if (
    !Number.isSafeInteger(row.order_id) ||
    !Number.isSafeInteger(row.provider_config_id) ||
    !Number.isSafeInteger(row.config_revision) ||
    !Number.isSafeInteger(row.amount_sen) ||
    !Number.isSafeInteger(row.total_amount) ||
    (
      !TERMINAL_LOCAL_STATUSES.has(row.local_status) &&
      !["created", "pending", "attention_required"].includes(row.local_status)
    )
  ) {
    return null;
  }
  return {
    orderId: row.order_id,
    orderNumber: row.order_number,
    attemptId: row.attempt_id,
    providerConfigId: row.provider_config_id,
    environment: row.environment,
    configRevision: row.config_revision,
    merchantInvoice: row.merchant_invoice,
    idempotencyKey: row.idempotency_key,
    providerReference: row.provider_reference,
    amountSen: row.amount_sen,
    totalAmountSen: row.total_amount,
    productValueSen: Number(row.product_value_sen || 0),
    checkoutUrl: row.checkout_url,
    expiresAt: row.expires_at,
    channel: row.channel,
    providerStatus: row.provider_status,
    providerState: row.provider_state,
    localStatus: row.local_status,
    errorClass: row.error_class,
    createdAt: row.created_at,
    orderPaymentStatus: row.payment_status,
    orderShippingStatus: row.shipping_status,
    stockRestoredAt: row.stock_restored_at,
    returnToken,
  };
}

async function loadAttemptsForOrder(database: D1Database, orderNumber: string): Promise<AccessRow[]> {
  const rows = await database
    .prepare(`
      SELECT
        o.id AS order_id, o.order_number, o.payment_status, o.shipping_status,
        o.stock_restored_at, o.total_amount,
        (SELECT COALESCE(SUM(oi.unit_price * oi.quantity), 0)
          FROM order_items oi WHERE oi.order_id = o.id) AS product_value_sen,
        pa.id AS attempt_id, pa.provider_config_id, pa.environment,
        pa.config_revision, pa.merchant_invoice, pa.idempotency_key,
        pa.provider_reference, pa.amount_sen, pa.checkout_url, pa.expires_at,
        pa.channel, pa.provider_status, pa.provider_state, pa.local_status,
        pa.error_class, pa.created_at
      FROM orders o
      JOIN payment_attempts pa ON pa.order_id = o.id AND pa.provider = 'doku'
      WHERE o.order_number = ? AND o.payment_method = 'doku'
      ORDER BY pa.created_at DESC, pa.id DESC
      LIMIT 20
    `)
    .bind(orderNumber)
    .all<AccessRow>();
  return rows.results || [];
}

export async function loadDokuPaymentAccess(
  database: D1Database,
  rootSecret: string,
  orderNumber: string,
  returnToken: string,
  options: { now?: () => Date } = {},
): Promise<DokuPaymentAccess | null> {
  const safeOrderNumber = normalizeOrderNumber(orderNumber);
  const safeReturnToken = normalizeReturnToken(returnToken);
  if (!database?.prepare || !rootSecret || !safeOrderNumber || !safeReturnToken) return null;

  const rows = await loadAttemptsForOrder(database, safeOrderNumber);
  const nowMs = (options.now?.() ?? new Date()).getTime();
  if (!Number.isFinite(nowMs)) return null;
  for (const row of rows) {
    const expected = await createDokuReturnToken(rootSecret, row.attempt_id, row.order_number);
    if (timingSafeHexEqual(expected, safeReturnToken)) {
      const createdAt = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(row.created_at)
        ? `${row.created_at.replace(" ", "T")}Z`
        : row.created_at;
      const createdAtMs = Date.parse(createdAt);
      if (
        !Number.isFinite(createdAtMs) ||
        createdAtMs > nowMs ||
        nowMs - createdAtMs >= DOKU_RETURN_CAPABILITY_TTL_MS
      ) {
        return null;
      }
      // The matched checkout-issued capability authorizes recovery for this
      // order only inside its own lifetime. Surface the newest attempt while
      // that capability remains valid so a retry does not strand the browser
      // on the terminal attempt that originally issued the cookie.
      return rows[0] ? accessFromRow(rows[0], safeReturnToken) : null;
    }
  }
  return null;
}

export async function loadDokuPaymentAccessFromCookie(
  database: D1Database,
  rootSecret: string,
  cookieHeader: string | null,
  expectedOrderNumber?: string,
  options: { now?: () => Date } = {},
): Promise<DokuPaymentAccess | null> {
  const parsed = parseCookieHeader(cookieHeader);
  if (!parsed) return null;
  if (expectedOrderNumber && parsed.orderNumber !== expectedOrderNumber) return null;
  return loadDokuPaymentAccess(
    database,
    rootSecret,
    parsed.orderNumber,
    parsed.returnToken,
    options,
  );
}

export async function exchangeDokuCallbackQuery(
  database: D1Database | undefined,
  rootSecret: string,
  url: URL,
  options: { now?: () => Date } = {},
): Promise<{ type: "none" } | { type: "redirect"; status: 303; headers: Headers; accepted: boolean }> {
  if (!url.searchParams.has("order_number") && !url.searchParams.has("return_token")) {
    return { type: "none" };
  }
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    Location: url.pathname,
    "X-Robots-Tag": "noindex, nofollow",
  });
  const orderNumber = normalizeOrderNumber(url.searchParams.get("order_number"));
  const returnToken = normalizeReturnToken(url.searchParams.get("return_token"));
  const access = orderNumber && returnToken && database?.prepare
    ? await loadDokuPaymentAccess(database, rootSecret, orderNumber, returnToken, options)
    : null;
  headers.append("Set-Cookie", access
    ? buildDokuAccessCookie(access.orderNumber, access.returnToken)
    : buildClearDokuAccessCookie());
  return { type: "redirect", status: 303, headers, accepted: Boolean(access) };
}

export function summarizeDokuPayment(access: DokuPaymentAccess): PublicDokuPaymentStatus {
  const paymentStatus = access.orderPaymentStatus.toLowerCase();
  return {
    order_number: access.orderNumber,
    payment_method: "doku",
    payment_status: paymentStatus,
    shipping_status: access.orderShippingStatus,
    local_status: access.localStatus,
    amount: access.amountSen,
    total_amount: access.totalAmountSen,
    product_value_myr: Math.round(access.productValueSen) / 100,
    expires_at: access.expiresAt,
    can_retry: canRetry(access),
    retry_blocked_reason: null,
    can_reconcile: canReconcile(access),
  };
}

export const DOKU_CHANNEL_DISABLED_MESSAGE =
  "Kaedah pembayaran asal untuk pesanan ini telah dinyahaktifkan. Semak status pesanan atau hubungi pihak kedai untuk bantuan.";

/** Read-only recovery projection; unavailable/corrupt config is not a disabled channel. */
export async function summarizeDokuPaymentForRecovery(
  database: D1Database,
  rootSecret: string,
  access: DokuPaymentAccess,
): Promise<PublicDokuPaymentStatus> {
  const payment = summarizeDokuPayment(access);
  if (!payment.can_retry || !DOKU_PAYMENT_CHANNELS.some(channel => channel === access.channel)) {
    return payment;
  }
  const config = await getEnabledDokuConfig(database, rootSecret);
  if (config && !config.enabledChannels.some(channel => channel === access.channel)) {
    payment.can_retry = false;
    payment.retry_blocked_reason = "DOKU_CHANNEL_DISABLED";
  }
  return payment;
}

function canReconcile(access: DokuPaymentAccess): boolean {
  return Boolean(access.providerReference) && !TERMINAL_LOCAL_STATUSES.has(access.localStatus);
}

function canRetry(access: DokuPaymentAccess): boolean {
  return (
    (access.localStatus === "failed" || access.localStatus === "expired") &&
    !PAID_ORDER_STATUSES.has(access.orderPaymentStatus) &&
    !["cancelled", "returned"].includes(access.orderShippingStatus)
  );
}

async function enabledConfigIdentity(database: D1Database) {
  const row = await database
    .prepare(`
      SELECT id, environment, config_revision
      FROM payment_provider_configs
      WHERE provider = 'doku' AND is_enabled = 1
      ORDER BY id LIMIT 1
    `)
    .first<ConfigIdentityRow>();
  if (!row || (row.environment !== "sandbox" && row.environment !== "production")) return null;
  if (!Number.isSafeInteger(row.id) || !Number.isSafeInteger(row.config_revision)) return null;
  return {
    id: row.id,
    environment: row.environment,
    configRevision: row.config_revision,
  } satisfies DokuPaymentConfigIdentity;
}

async function runtimeConfigForAttempt(
  database: D1Database,
  rootSecret: string,
  access: DokuPaymentAccess,
): Promise<{ config: DokuRuntimeConfig; identity: DokuPaymentConfigIdentity }> {
  const [config, identity] = await Promise.all([
    getEnabledDokuConfig(database, rootSecret),
    enabledConfigIdentity(database),
  ]);
  if (
    !config ||
    !identity ||
    identity.id !== access.providerConfigId ||
    identity.environment !== access.environment ||
    identity.configRevision !== access.configRevision ||
    config.environment !== access.environment ||
    config.configRevision !== access.configRevision
  ) {
    throw new DokuPaymentAccessError("DOKU_UNAVAILABLE", 503);
  }
  return { config, identity };
}

async function runtimeConfigForRetry(
  database: D1Database,
  rootSecret: string,
): Promise<{ config: DokuRuntimeConfig; identity: DokuPaymentConfigIdentity }> {
  const [config, identity] = await Promise.all([
    getEnabledDokuConfig(database, rootSecret),
    enabledConfigIdentity(database),
  ]);
  if (
    !config ||
    !identity ||
    identity.environment !== config.environment ||
    identity.configRevision !== config.configRevision
  ) {
    throw new DokuPaymentAccessError("DOKU_UNAVAILABLE", 503);
  }
  return { config, identity };
}

function stringField(value: unknown, pattern: RegExp): string | null {
  return typeof value === "string" && pattern.test(value) ? value : null;
}

function parseDokuStatusFact(
  data: DokuStatusResponse,
  access: DokuPaymentAccess,
): DokuNotificationFact {
  const providerReference = stringField(data.id, /^[A-Za-z0-9_-]{1,255}$/);
  const order = data.order && typeof data.order === "object" ? data.order : {};
  const payment = data.payment && typeof data.payment === "object" ? data.payment : {};
  const merchantInvoice = stringField(order.invoice_number, /^[A-Za-z0-9_-]{1,64}$/);
  const orderAmountSen = majorMyrToSen(order.amount);
  const paymentAmountSen = majorMyrToSen(payment.amount);
  // An absent channel may reuse the committed intent; a present invalid one
  // must never be replaced with it and become an apparently matching fact.
  const channel = payment.channel === undefined
    ? access.channel || "UNKNOWN"
    : stringField(payment.channel, /^[A-Z][A-Z0-9_]{1,63}$/);
  const providerStatus = stringField(payment.status, /^[A-Z][A-Z0-9_]{1,63}$/);
  const providerState = stringField(payment.state, /^[A-Z][A-Z0-9_]{1,63}$/);
  const orderStatus = stringField(order.status, /^[A-Z][A-Z0-9_]{1,63}$/) || undefined;
  if (
    !providerReference ||
    providerReference !== access.providerReference ||
    merchantInvoice !== access.merchantInvoice ||
    order.currency !== "MYR" ||
    payment.currency !== "MYR" ||
    orderAmountSen !== access.amountSen ||
    paymentAmountSen !== access.amountSen ||
    !channel ||
    !providerStatus ||
    !providerState
  ) {
    throw new DokuPaymentAccessError("DOKU_PROVIDER_FAILED", 502);
  }
  return {
    providerReference,
    merchantInvoice,
    amountSen: access.amountSen,
    channel,
    providerStatus,
    providerState,
    orderStatus,
    eventKey: [
      "status",
      providerReference,
      merchantInvoice,
      String(access.amountSen),
      channel,
      providerStatus,
      providerState,
      orderStatus || "",
    ].join(":"),
  };
}

function parseDokuCreatePayment(data: DokuStatusResponse, attempt: AttemptRow, order: RetryOrder) {
  const providerReference = stringField(data.id, /^[A-Za-z0-9_-]{1,255}$/);
  const checkoutUrl = typeof data.payment?.checkout_url === "string" ? data.payment.checkout_url : "";
  const providerStatus = stringField(data.payment?.status, /^[A-Z][A-Z0-9_]{1,63}$/);
  const providerState = stringField(data.payment?.state, /^[A-Z][A-Z0-9_]{1,63}$/);
  const orderAmountSen = majorMyrToSen(data.order?.amount);
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(checkoutUrl);
  } catch {
    throw new DokuPaymentAccessError("DOKU_PROVIDER_FAILED", 502);
  }
  if (
    !providerReference ||
    data.order?.invoice_number !== attempt.merchant_invoice ||
    data.order?.currency !== "MYR" ||
    orderAmountSen !== order.totalAmountSen ||
    parsedUrl.protocol !== "https:" ||
    !/(^|\.)doku\.com$/i.test(parsedUrl.hostname) ||
    parsedUrl.username ||
    parsedUrl.password ||
    parsedUrl.hash ||
    !providerStatus ||
    !providerState
  ) {
    throw new DokuPaymentAccessError("DOKU_PROVIDER_FAILED", 502);
  }
  return {
    providerReference,
    checkoutUrl: parsedUrl.toString(),
    providerStatus,
    providerState,
    expiresAt: typeof data.order?.expired_at === "string" ? data.order.expired_at : attempt.expires_at,
  };
}

export async function reconcileDokuPaymentStatus(
  database: D1Database,
  rootSecret: string,
  access: DokuPaymentAccess,
  options: { fetch?: typeof fetch; now?: () => Date } = {},
): Promise<PublicDokuPaymentStatus> {
  if (!canReconcile(access) || !access.providerReference) {
    return summarizeDokuPaymentForRecovery(database, rootSecret, access);
  }
  const { config, identity } = await runtimeConfigForAttempt(database, rootSecret, access);
  const client = new DokuClient({
    environment: config.environment,
    clientId: config.clientId,
    apiKey: config.apiKey,
    secretKey: config.secretKey,
    fetch: options.fetch,
    now: options.now,
  });
  let fact: DokuNotificationFact;
  try {
    const response = await client.retrieveCheckout<DokuStatusResponse>({
      checkoutId: access.providerReference,
      expectedAmountSen: access.amountSen,
    });
    fact = parseDokuStatusFact(response.data, access);
  } catch (error) {
    if (error instanceof DokuPaymentAccessError) throw error;
    throw new DokuPaymentAccessError("DOKU_PROVIDER_FAILED", 502);
  }
  await applyDokuPaymentFact(database, identity, fact, "status");
  const updated = await loadDokuPaymentAccess(
    database,
    rootSecret,
    access.orderNumber,
    access.returnToken,
    { now: options.now },
  );
  return summarizeDokuPaymentForRecovery(database, rootSecret, updated ?? access);
}

async function loadRetryOrder(database: D1Database, orderId: number): Promise<RetryOrder | null> {
  const row = await database.prepare(`
    SELECT
      o.id AS order_id, o.order_number, o.customer_name, o.customer_phone,
      o.customer_email, o.address, o.province, o.city, o.district,
      o.postal_code, o.payment_status, o.shipping_status, o.stock_restored_at,
      o.total_amount, o.shipping_cost,
      oi.variant_id, oi.unit_price, oi.quantity,
      COALESCE(pv.sku, CAST(pv.id AS TEXT)) AS variant_sku,
      pv.stock AS variant_stock, p.title AS product_title,
      (SELECT COALESCE(SUM(value.unit_price * value.quantity), 0)
        FROM order_items value WHERE value.order_id = o.id) AS product_value_sen
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN product_variants pv ON pv.id = oi.variant_id
    JOIN products p ON p.id = pv.product_id
    WHERE o.id = ? AND o.payment_method = 'doku'
    ORDER BY oi.id
    LIMIT 1
  `).bind(orderId).first<Record<string, unknown>>();
  if (!row) return null;
  return {
    orderId: Number(row.order_id),
    orderNumber: String(row.order_number),
    customerName: String(row.customer_name),
    customerPhone: String(row.customer_phone),
    customerEmail: String(row.customer_email || ""),
    address: String(row.address),
    province: String(row.province),
    city: String(row.city),
    district: String(row.district),
    postalCode: String(row.postal_code),
    paymentStatus: String(row.payment_status),
    shippingStatus: String(row.shipping_status),
    stockRestoredAt: row.stock_restored_at ? String(row.stock_restored_at) : null,
    totalAmountSen: Number(row.total_amount),
    shippingCostSen: Number(row.shipping_cost || 0),
    productValueSen: Number(row.product_value_sen || 0),
    variantId: Number(row.variant_id),
    variantSku: String(row.variant_sku),
    productTitle: String(row.product_title),
    unitPriceSen: Number(row.unit_price),
    quantity: Number(row.quantity),
    variantStock: row.variant_stock === null || row.variant_stock === undefined
      ? null
      : Number(row.variant_stock),
  };
}

async function latestActiveAttempt(database: D1Database, orderId: number): Promise<AttemptRow | null> {
  return database.prepare(`
    SELECT id, merchant_invoice, idempotency_key, request_fingerprint,
      provider_config_id, environment, config_revision, channel, provider_reference,
      checkout_url, expires_at, provider_status, provider_state, local_status
    FROM payment_attempts
    WHERE order_id = ? AND provider = 'doku' AND local_status IN ('created', 'pending')
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `).bind(orderId).first<AttemptRow>();
}

async function createRetryAttempt(
  database: D1Database,
  access: DokuPaymentAccess,
  order: RetryOrder,
  identity: DokuPaymentConfigIdentity,
  channel: DokuPaymentChannel,
  requestFingerprint: string,
  now: Date,
  expiresAt: string,
): Promise<AttemptRow> {
  if (!canRetry(access)) {
    throw new DokuPaymentAccessError("DOKU_RETRY_NOT_ALLOWED", 409);
  }
  if (PAID_ORDER_STATUSES.has(order.paymentStatus) || ["cancelled", "returned"].includes(order.shippingStatus)) {
    throw new DokuPaymentAccessError("DOKU_RETRY_NOT_ALLOWED", 409);
  }
  const needsStockReservation = Boolean(order.stockRestoredAt);
  if (
    needsStockReservation &&
    order.variantStock !== null &&
    order.variantStock < order.quantity
  ) {
    throw new DokuPaymentAccessError("DOKU_STOCK_UNAVAILABLE", 409);
  }
  const attemptHash = await sha256Hex(`${order.orderNumber}\n${access.attemptId}\n${randomHex(20)}`);
  const attempt: AttemptRow = {
    id: `pay_${attemptHash.slice(0, 40)}`,
    merchant_invoice: `MYB-${attemptHash.slice(0, 24)}`,
    idempotency_key: `retry_${attemptHash}`,
    request_fingerprint: requestFingerprint,
    provider_config_id: identity.id,
    environment: identity.environment,
    config_revision: identity.configRevision,
    channel,
    provider_reference: null,
    checkout_url: null,
    expires_at: expiresAt,
    provider_status: null,
    provider_state: null,
    local_status: "created",
  };
  const nowIso = now.toISOString();
  const abortIfNoChange = (marker: string) => database.prepare(`
    INSERT INTO payment_events (
      payment_attempt_id, source, event_key, resulting_status, received_at
    )
    SELECT '__missing_retry_attempt__', 'retry', ?, 'created', ?
    WHERE changes() <> 1
  `).bind(marker, nowIso);
  const statements: D1PreparedStatement[] = [];
  if (needsStockReservation && order.variantStock !== null) {
    statements.push(
      database.prepare(`
        UPDATE product_variants
        SET stock = stock - ?
        WHERE id = ? AND stock IS NOT NULL AND stock >= ?
      `).bind(order.quantity, order.variantId, order.quantity),
      abortIfNoChange(`retry-stock:${access.attemptId}`),
    );
  }
  statements.push(
    database.prepare(`
      UPDATE orders
      SET payment_status = 'pending', stock_restored_at = NULL
      WHERE id = ?
        AND payment_method = 'doku'
        AND payment_status NOT IN ('paid', 'settled', 'success')
        AND shipping_status NOT IN ('cancelled', 'returned')
        AND NOT EXISTS (
          SELECT 1 FROM payment_attempts active
          WHERE active.order_id = orders.id
            AND active.provider = 'doku'
            AND active.local_status IN ('created', 'pending')
        )
    `).bind(order.orderId),
    abortIfNoChange(`retry-order:${access.attemptId}`),
    database.prepare(`
      INSERT INTO payment_attempts (
        id, order_id, provider_config_id, provider, environment,
        config_revision, merchant_invoice, idempotency_key, request_fingerprint,
        amount_sen, currency, channel, expires_at, local_status, created_at, updated_at
      ) VALUES (?, ?, ?, 'doku', ?, ?, ?, ?, ?, ?, 'MYR', ?, ?, 'created', ?, ?)
    `).bind(
      attempt.id,
      order.orderId,
      attempt.provider_config_id,
      attempt.environment,
      attempt.config_revision,
      attempt.merchant_invoice,
      attempt.idempotency_key,
      attempt.request_fingerprint,
      order.totalAmountSen,
      attempt.channel,
      attempt.expires_at,
      nowIso,
      nowIso,
    ),
    abortIfNoChange(`retry-attempt:${attempt.id}`),
    database.prepare(`
      INSERT OR IGNORE INTO payment_events (
        payment_attempt_id, source, event_key, resulting_status, received_at
      ) VALUES (?, 'retry', ?, 'created', ?)
    `).bind(attempt.id, `retry:${access.attemptId}:${attempt.id}`, nowIso),
  );
  try {
    await database.batch(statements);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("stock unavailable")) {
      throw new DokuPaymentAccessError("DOKU_STOCK_UNAVAILABLE", 409);
    }
    throw new DokuPaymentAccessError("DOKU_CONFLICT", 409);
  }
  return attempt;
}

function checkoutBody(
  order: RetryOrder,
  attempt: AttemptRow,
  origin: string,
  returnToken: string,
): string {
  try {
    return buildDokuCheckoutBody({
      attemptId: attempt.id,
      merchantInvoice: attempt.merchant_invoice,
      orderNumber: order.orderNumber,
      expiresAt: attempt.expires_at,
      channel: attempt.channel,
      totalAmountSen: order.totalAmountSen,
      unitPriceSen: order.unitPriceSen,
      shippingCostSen: order.shippingCostSen,
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
    });
  } catch (error) {
    // Retry previously divided by 100 with no guard at all, so a corrupt sen
    // value reached the provider here while create refused it. Same refusal now.
    if (error instanceof DokuRequestBodyError) throw new DokuPaymentAccessError("DOKU_CONFLICT");
    throw error;
  }
}

/** The six values `payment_attempts.error_class` permits, per migration `0059`.
 *  Typed rather than `string` so a code mapped outside the set is a compile
 *  error instead of a CHECK violation that `recordAttemptFailure` would swallow,
 *  leaving the column NULL and nobody told — the exact symptom this function
 *  exists to remove, but undiagnosable. */
type DokuFailureClass =
  | "provider"
  | "authentication"
  | "signature"
  | "timeout"
  | "configuration"
  | "local_transition";

function failureClass(error: unknown): DokuFailureClass {
  // A refusal raised before the provider is contacted is not a provider
  // failure, and recording it as one sends the operator to check DOKU when the
  // problem is on this side. The default is inverted deliberately: everything
  // this class raises is local unless it names the provider or the install
  // configuration, so a code added to the union later is classified correctly
  // without anyone remembering to come back here.
  if (error instanceof DokuPaymentAccessError) {
    if (error.code === "DOKU_PROVIDER_FAILED") return "provider";
    if (error.code === "DOKU_UNAVAILABLE" || error.code === "DOKU_CHANNEL_DISABLED") {
      return "configuration";
    }
    // DOKU_CONFLICT, DOKU_STOCK_UNAVAILABLE, DOKU_RETRY_NOT_ALLOWED and
    // DOKU_ACCESS_DENIED are all conditions on this side. None is a provider
    // failure, and the first version of this branch filed the last three as one.
    return "local_transition";
  }
  if (!(error instanceof DokuClientError)) return "provider";
  if (error.status === 401 || error.status === 403) return "authentication";
  if (["DOKU_RESPONSE_HEADERS", "DOKU_RESPONSE_SIGNATURE", "DOKU_AMOUNT_MISMATCH"].includes(error.code)) {
    return "signature";
  }
  if (error.code === "DOKU_TIMEOUT") return "timeout";
  if (error.code === "DOKU_CONFIGURATION") return "configuration";
  return "provider";
}

/**
 * Record why an attempt failed, and never let that recording change the answer.
 *
 * The call sites rethrow a specific refusal after this returns. If the write
 * itself threw, that thrown value would replace the refusal and the outer catch
 * would answer 502 DOKU_PROVIDER_FAILED — telling a buyer the provider failed
 * because a diagnostic column could not be written. An observability write does
 * not get to do that.
 */
async function recordAttemptFailure(database: D1Database, attemptId: string, error: unknown) {
  try {
    await recordAttemptFailureUnguarded(database, attemptId, error);
  } catch {
    // Deliberately swallowed: the refusal being recorded is the thing that
    // matters, and it is already on its way to the caller.
  }
}

async function recordAttemptFailureUnguarded(database: D1Database, attemptId: string, error: unknown) {
  await database.prepare(`
    UPDATE payment_attempts
    SET error_class = ?, updated_at = ?
    WHERE id = ? AND checkout_url IS NULL AND local_status = 'created'
  `).bind(failureClass(error), new Date().toISOString(), attemptId).run();
}

async function sendRetryAttemptToDoku(
  database: D1Database,
  rootSecret: string,
  order: RetryOrder,
  attempt: AttemptRow,
  config: DokuRuntimeConfig,
  requestUrl: string,
  options: { fetch?: typeof fetch; now?: () => Date } = {},
): Promise<{ checkoutUrl: string; summary: PublicDokuPaymentStatus; accessCookie: string }> {
  if (
    !attempt.channel ||
    !DOKU_PAYMENT_CHANNELS.includes(attempt.channel as DokuPaymentChannel) ||
    !config.enabledChannels.includes(attempt.channel as DokuPaymentChannel)
  ) {
    // Defence in depth. `retryDokuPayment` validates the channel against the
    // enabled set before it reaches here, so no known route arrives with a bad
    // one; this stays because the function is reachable from any future caller.
    const refusal = new DokuPaymentAccessError("DOKU_UNAVAILABLE", 503);
    await recordAttemptFailure(database, attempt.id, refusal);
    throw refusal;
  }
  // Everything above and below this point can refuse before the provider is
  // contacted, and until A-268 those refusals left `error_class` NULL while a
  // provider failure set it. The operator system log renders its reason from
  // that column, so the two refusals an operator is most able to act on — a
  // disabled channel and a corrupt persisted amount — were the two that arrived
  // with no reason at all.
  let origin: string;
  let returnToken: string;
  let rawBody: string;
  try {
    origin = requestOrigin(requestUrl);
    returnToken = await createDokuReturnToken(rootSecret, attempt.id, order.orderNumber);
    rawBody = checkoutBody(order, attempt, origin, returnToken);
  } catch (error) {
    await recordAttemptFailure(database, attempt.id, error);
    throw error;
  }
  const client = new DokuClient({
    environment: config.environment,
    clientId: config.clientId,
    apiKey: config.apiKey,
    secretKey: config.secretKey,
    fetch: options.fetch,
    now: options.now,
  });
  try {
    const response = await client.createCheckout<DokuStatusResponse>({
      rawBody,
      idempotencyId: attempt.idempotency_key,
      expectedAmountSen: order.totalAmountSen,
    });
    const payment = parseDokuCreatePayment(response.data, attempt, order);
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
        payment.providerStatus,
        payment.providerState,
        nowIso,
        nowIso,
        attempt.id,
      ),
      database.prepare(`
        INSERT OR IGNORE INTO payment_events (
          payment_attempt_id, source, event_key, provider_status,
          provider_state, resulting_status, received_at
        ) VALUES (?, 'retry', ?, ?, ?, 'pending', ?)
      `).bind(
        attempt.id,
        `provider:${payment.providerReference}`,
        payment.providerStatus,
        payment.providerState,
        nowIso,
      ),
    ]);
    const access = await loadDokuPaymentAccess(
      database,
      rootSecret,
      order.orderNumber,
      returnToken,
      { now: options.now },
    );
    if (!access) throw new DokuPaymentAccessError("DOKU_CONFLICT");
    return {
      checkoutUrl: payment.checkoutUrl,
      summary: summarizeDokuPayment(access),
      accessCookie: buildDokuAccessCookie(order.orderNumber, returnToken),
    };
  } catch (error) {
    await recordAttemptFailure(database, attempt.id, error);
    if (error instanceof DokuPaymentAccessError) throw error;
    throw new DokuPaymentAccessError("DOKU_PROVIDER_FAILED", 502);
  }
}

export async function retryDokuPayment(
  database: D1Database,
  rootSecret: string,
  access: DokuPaymentAccess,
  input: {
    requestUrl: string;
    clientIp: string;
    userAgent: string;
    fetch?: typeof fetch;
    now?: () => Date;
  },
): Promise<{ checkoutUrl: string; payment: PublicDokuPaymentStatus; accessCookie: string }> {
  let retryAccess = access;
  let order = await loadRetryOrder(database, access.orderId);
  if (!order) throw new DokuPaymentAccessError("DOKU_ACCESS_DENIED", 404);
  if (PAID_ORDER_STATUSES.has(order.paymentStatus) || ["cancelled", "returned"].includes(order.shippingStatus)) {
    throw new DokuPaymentAccessError("DOKU_RETRY_NOT_ALLOWED", 409);
  }
  const { config, identity } = await runtimeConfigForRetry(database, rootSecret);
  const selectedChannel = retryAccess.channel;
  if (!selectedChannel || !DOKU_PAYMENT_CHANNELS.includes(selectedChannel as DokuPaymentChannel)) {
    throw new DokuPaymentAccessError("DOKU_CONFLICT", 409);
  }
  const now = input.now?.() ?? new Date();
  let active = await latestActiveAttempt(database, order.orderId);
  if (!config.enabledChannels.includes(selectedChannel as DokuPaymentChannel)) {
    // Active checkout reuse still requires the enabled channel, as before.
    // Only a retry-eligible terminal attempt receives the new recovery reason.
    if (canRetry(retryAccess) && !active) {
      throw new DokuPaymentAccessError("DOKU_CHANNEL_DISABLED", 409);
    }
    throw new DokuPaymentAccessError("DOKU_UNAVAILABLE", 503);
  }
  if (
    active &&
    (
      active.provider_config_id !== identity.id ||
      active.environment !== identity.environment ||
      active.config_revision !== identity.configRevision ||
      active.channel !== selectedChannel
    )
  ) {
    throw new DokuPaymentAccessError("DOKU_UNAVAILABLE", 503);
  }
  if (active?.checkout_url) {
    const activeToken = await createDokuReturnToken(rootSecret, active.id, order.orderNumber);
    const activeAccess = await loadDokuPaymentAccess(
      database,
      rootSecret,
      order.orderNumber,
      activeToken,
      { now: input.now },
    );
    if (!activeAccess) throw new DokuPaymentAccessError("DOKU_CONFLICT");
    const expiresAt = active.expires_at ? Date.parse(active.expires_at) : Number.NaN;
    if (Number.isFinite(expiresAt) && expiresAt > now.getTime()) {
      return {
        checkoutUrl: active.checkout_url,
        payment: summarizeDokuPayment(activeAccess),
        accessCookie: buildDokuAccessCookie(order.orderNumber, activeToken),
      };
    }
    const reconciled = await reconcileDokuPaymentStatus(database, rootSecret, activeAccess, {
      fetch: input.fetch,
      now: input.now,
    });
    if (!TERMINAL_LOCAL_STATUSES.has(reconciled.local_status)) {
      throw new DokuPaymentAccessError("DOKU_CONFLICT");
    }
    order = await loadRetryOrder(database, access.orderId);
    if (!order) throw new DokuPaymentAccessError("DOKU_ACCESS_DENIED", 404);
    const refreshedAccess = await loadDokuPaymentAccess(
      database,
      rootSecret,
      access.orderNumber,
      access.returnToken,
      { now: input.now },
    );
    if (!refreshedAccess) throw new DokuPaymentAccessError("DOKU_ACCESS_DENIED", 404);
    retryAccess = refreshedAccess;
    if (retryAccess.channel !== selectedChannel) {
      throw new DokuPaymentAccessError("DOKU_CONFLICT", 409);
    }
    active = await latestActiveAttempt(database, order.orderId);
    if (active) throw new DokuPaymentAccessError("DOKU_CONFLICT");
  }
  const fingerprint = `v1:${await sha256Hex([
    order.orderNumber,
    retryAccess.attemptId,
    identity.id,
    identity.configRevision,
    selectedChannel,
  ].join("\n"))}:${await sha256Hex(`${input.clientIp.trim()}\n${input.userAgent.trim()}`)}`;
  const attempt = active || await createRetryAttempt(
    database,
    retryAccess,
    order,
    identity,
    selectedChannel as DokuPaymentChannel,
    fingerprint,
    now,
    new Date(now.getTime() + RETRY_TTL_MS).toISOString(),
  );
  const result = await sendRetryAttemptToDoku(
    database,
    rootSecret,
    order,
    attempt,
    config,
    input.requestUrl,
    { fetch: input.fetch, now: input.now },
  );
  return {
    checkoutUrl: result.checkoutUrl,
    payment: result.summary,
    accessCookie: result.accessCookie,
  };
}

async function parseBoundedJson(request: Request): Promise<Record<string, unknown> | null> {
  const contentType = request.headers.get("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") return null;
  const length = request.headers.get("Content-Length");
  if (length !== null) {
    const parsedLength = Number(length);
    if (
      !Number.isSafeInteger(parsedLength) ||
      parsedLength <= 0 ||
      parsedLength > MAX_ACCESS_REQUEST_BYTES
    ) return null;
  }
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_ACCESS_REQUEST_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  if (total === 0) return null;
  const raw = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    raw.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
  } catch {
    return null;
  }
  return body && typeof body === "object" && !Array.isArray(body)
    ? body as Record<string, unknown>
    : null;
}

async function requestAccess(
  request: Request,
  database: D1Database,
  rootSecret: string,
  now?: () => Date,
): Promise<DokuPaymentAccess> {
  const body = await parseBoundedJson(request);
  const orderNumber = normalizeOrderNumber(body?.order_number);
  if (!orderNumber) throw new DokuPaymentAccessError("DOKU_ACCESS_DENIED", 404);
  const access = await loadDokuPaymentAccessFromCookie(
    database,
    rootSecret,
    request.headers.get("Cookie"),
    orderNumber,
    { now },
  );
  if (!access) throw new DokuPaymentAccessError("DOKU_ACCESS_DENIED", 404);
  return access;
}

function accessErrorMessage(error: DokuPaymentAccessError): string {
  switch (error.code) {
    case "DOKU_ACCESS_DENIED":
      return "Sesi pembayaran tidak ditemui.";
    case "DOKU_UNAVAILABLE":
      return "DOKU belum tersedia.";
    case "DOKU_CHANNEL_DISABLED":
      return DOKU_CHANNEL_DISABLED_MESSAGE;
    case "DOKU_RETRY_NOT_ALLOWED":
      return "Pembayaran ini tidak dapat dicuba semula.";
    case "DOKU_STOCK_UNAVAILABLE":
      return "Stok tidak lagi mencukupi untuk mencuba semula pembayaran.";
    default:
      return "Status pembayaran belum dapat disahkan.";
  }
}


/**
 * Bounds the two buyer-facing capability endpoints.
 *
 * Each of them spends a real call against the merchant's DOKU credentials, and
 * neither was bounded — while `POST /api/submit-order` and `POST /api/v1/checkout`
 * beside them are, and the scheduled reconciler leases and backs off. A buyer
 * holding their own valid cookie could loop either one and turn a single order
 * into unbounded outbound traffic on the merchant's quota. Nothing is forged and
 * no state is corrupted; the cost is provider standing, which is the merchant's
 * to lose.
 *
 * Two buckets, because they stop different things. The order bucket is what
 * actually protects the quota, since one order is one attempt is one provider
 * call. The address bucket stops one client sweeping many orders it happens to
 * hold capabilities for.
 *
 * `checkRateLimit` fails open without KV, deliberately: a missing binding must
 * not make a payment unrecoverable for every buyer.
 */
async function enforceCapabilityRateLimit(
  sessions: KVNamespace | undefined,
  clientIp: string,
  orderNumber: string,
  scope: "status" | "retry",
): Promise<Response | null> {
  const limits = scope === "retry"
    // Retry creates an attempt and reserves stock, so it is held much tighter
    // than a read.
    ? { perOrder: 5, perAddress: 10, windowMs: 10 * 60_000 }
    : { perOrder: 12, perAddress: 40, windowMs: 60_000 };

  for (const [key, limit] of [
    [`doku-${scope}-order:${orderNumber}`, limits.perOrder],
    [`doku-${scope}-ip:${clientIp}`, limits.perAddress],
  ] as const) {
    const result = await checkRateLimit(sessions, key, limit, limits.windowMs);
    if (!result.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Terlalu banyak permintaan status pembayaran. Cuba sebentar lagi.",
          code: "DOKU_RATE_LIMITED",
        }),
        {
          status: 429,
          // `dokuNoStoreHeaders` keeps this response uncacheable like every
          // other on this path; the retry hints ride alongside it.
          headers: dokuNoStoreHeaders(
            rateLimitHeaders(result.remaining, result.resetAt) as Record<string, string>,
          ),
        },
      );
    }
  }
  return null;
}

export async function handleDokuStatusRequest(input: {
  request: Request;
  database?: D1Database;
  rootSecret: string;
  sessions?: KVNamespace;
  clientIp: string;
  fetch?: typeof fetch;
  now?: () => Date;
}): Promise<Response> {
  if (!input.database?.prepare || !input.rootSecret) {
    return json({ success: false, error: "Sistem pembayaran belum tersedia.", code: "DOKU_UNAVAILABLE" }, 503);
  }
  try {
    const access = await requestAccess(input.request, input.database, input.rootSecret, input.now);
    const limited = await enforceCapabilityRateLimit(
      input.sessions,
      input.clientIp,
      access.orderNumber,
      "status",
    );
    if (limited) return limited;
    const payment = await reconcileDokuPaymentStatus(input.database, input.rootSecret, access, {
      fetch: input.fetch,
      now: input.now,
    });
    return json({ success: true, payment });
  } catch (error) {
    if (error instanceof DokuPaymentAccessError) {
      return json({ success: false, error: accessErrorMessage(error), code: error.code }, error.status);
    }
    return json({ success: false, error: "Status pembayaran belum dapat disahkan.", code: "DOKU_PROVIDER_FAILED" }, 502);
  }
}

export async function handleDokuRetryRequest(input: {
  request: Request;
  database?: D1Database;
  rootSecret: string;
  sessions?: KVNamespace;
  clientIp: string;
  userAgent: string;
  fetch?: typeof fetch;
  now?: () => Date;
}): Promise<Response> {
  if (!input.database?.prepare || !input.rootSecret) {
    return json({ success: false, error: "Sistem pembayaran belum tersedia.", code: "DOKU_UNAVAILABLE" }, 503);
  }
  try {
    const access = await requestAccess(input.request, input.database, input.rootSecret, input.now);
    const limited = await enforceCapabilityRateLimit(
      input.sessions,
      input.clientIp,
      access.orderNumber,
      "retry",
    );
    if (limited) return limited;
    const retry = await retryDokuPayment(input.database, input.rootSecret, access, {
      requestUrl: input.request.url,
      clientIp: input.clientIp,
      userAgent: input.userAgent,
      fetch: input.fetch,
      now: input.now,
    });
    const response = json({ success: true, checkout_url: retry.checkoutUrl, payment: retry.payment });
    response.headers.append("Set-Cookie", retry.accessCookie);
    return response;
  } catch (error) {
    if (error instanceof DokuPaymentAccessError) {
      return json({ success: false, error: accessErrorMessage(error), code: error.code }, error.status);
    }
    return json({ success: false, error: "Pembayaran belum dapat dicuba semula.", code: "DOKU_PROVIDER_FAILED" }, 502);
  }
}
