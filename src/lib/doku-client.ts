import {
  createDokuGlobalRequestSignature,
  isFreshDokuTimestamp,
  verifyDokuGlobalResponseSignature,
  type DokuRawBody,
} from "./doku-signature.ts";

export type DokuEnvironment = "sandbox" | "production";

export const DOKU_BASE_URLS: Readonly<Record<DokuEnvironment, string>> = {
  sandbox: "https://api-sandbox.doku.com",
  production: "https://api.doku.com",
};

export const DOKU_API_VERSIONS = {
  createCheckout: "arabica.2025-12-01",
  retrieveCheckout: "arabica.2025-12-01",
} as const;

const MAX_DOKU_RESPONSE_BYTES = 256 * 1024;

export type DokuClientErrorCode =
  | "DOKU_CONFIGURATION"
  | "DOKU_INVALID_REQUEST"
  | "DOKU_TIMEOUT"
  | "DOKU_NETWORK"
  | "DOKU_HTTP"
  | "DOKU_RESPONSE_HEADERS"
  | "DOKU_RESPONSE_SIGNATURE"
  | "DOKU_RESPONSE_BODY"
  | "DOKU_AMOUNT_MISMATCH";

export class DokuClientError extends Error {
  readonly code: DokuClientErrorCode;
  readonly status: number | null;

  constructor(code: DokuClientErrorCode, status: number | null = null) {
    super(code);
    this.name = "DokuClientError";
    this.code = code;
    this.status = status;
  }
}

type DokuClientOptions = {
  environment: DokuEnvironment;
  clientId: string;
  apiKey: string;
  secretKey: string;
  fetch?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
};

type DokuResult<T> = {
  status: number;
  data: T;
  responseTimestamp: string;
};

function assertVisibleCredential(value: string): string {
  if (!value || value.length > 512 || !/^[\x21-\x7E]+$/.test(value)) {
    throw new DokuClientError("DOKU_CONFIGURATION");
  }
  return value;
}

export function dokuBasicAuthorization(apiKey: string): string {
  const key = assertVisibleCredential(apiKey);
  if (key.includes(":")) throw new DokuClientError("DOKU_CONFIGURATION");
  return `Basic ${btoa(`${key}:`)}`;
}

function assertIdentity(value: string): string {
  if (!/^[A-Za-z0-9_-]{1,255}$/.test(value)) {
    throw new DokuClientError("DOKU_INVALID_REQUEST");
  }
  return value;
}

function amountSen(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  const sen = Math.round(value * 100);
  return Number.isSafeInteger(sen) && Math.abs(value * 100 - sen) < 1e-7 ? sen : null;
}

function paymentFacts(
  value: unknown,
): { hasCurrency: boolean; currency: unknown; hasAmount: boolean; amount: unknown }[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const payload = value as Record<string, unknown>;
  return [payload.order, payload.payment]
    .filter((entry): entry is Record<string, unknown> =>
      Boolean(entry && typeof entry === "object" && !Array.isArray(entry)),
    )
    .filter((entry) => "currency" in entry || "amount" in entry)
    .map((entry) => ({
      hasCurrency: "currency" in entry,
      currency: entry.currency,
      hasAmount: "amount" in entry,
      amount: entry.amount,
    }));
}

export function assertDokuMyrPayload(value: unknown, expectedAmountSen: number): void {
  if (!Number.isSafeInteger(expectedAmountSen) || expectedAmountSen < 0) {
    throw new DokuClientError("DOKU_INVALID_REQUEST");
  }
  const facts = paymentFacts(value);
  const completeFacts = facts.filter((fact) => fact.hasCurrency && fact.hasAmount);
  if (
    completeFacts.length === 0 ||
    facts.some((fact) => fact.hasCurrency && fact.currency !== "MYR") ||
    facts.some(
      (fact) => fact.hasAmount && amountSen(fact.amount) !== expectedAmountSen,
    )
  ) {
    throw new DokuClientError("DOKU_AMOUNT_MISMATCH");
  }
}

function parseJson(rawBody: Uint8Array, code: DokuClientErrorCode): unknown {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(rawBody));
  } catch {
    throw new DokuClientError(code);
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function createRequestIdentity(value: unknown): { checkoutId: string; invoice: string } {
  const payload = record(value);
  const order = record(payload?.order);
  if (
    typeof payload?.id !== "string" ||
    typeof order?.invoice_number !== "string"
  ) {
    throw new DokuClientError("DOKU_INVALID_REQUEST");
  }
  return {
    checkoutId: assertIdentity(payload.id),
    invoice: assertIdentity(order.invoice_number),
  };
}

function assertCheckoutResponseIdentity(
  value: unknown,
  expectedCheckoutId: string,
  expectedInvoice?: string,
): void {
  const payload = record(value);
  if (payload?.id !== expectedCheckoutId) {
    throw new DokuClientError("DOKU_RESPONSE_BODY");
  }
  if (expectedInvoice !== undefined) {
    const order = record(payload.order);
    if (order?.invoice_number !== expectedInvoice) {
      throw new DokuClientError("DOKU_RESPONSE_BODY");
    }
  }
}

function readCheckoutResponseEnvelope(
  headers: Headers,
  expectedClientId: string,
  expectedApiVersion: string,
  now: number,
  status: number,
): { timestamp: string; signature: string | null } {
  if (headers.has("Request-Id")) {
    throw new DokuClientError("DOKU_RESPONSE_HEADERS", status);
  }
  const clientId = headers.get("Client-Id");
  const timestamp = headers.get("Response-Timestamp");
  const apiVersion = headers.get("API-Version");
  const contentType = headers.get("Content-Type");
  const signaturePresent = headers.has("Signature");
  const jsonContentType =
    contentType !== null && /^application\/json(?:\s*;|$)/i.test(contentType);
  if (
    clientId !== expectedClientId ||
    timestamp === null ||
    !isFreshDokuTimestamp(timestamp, { now }) ||
    (!signaturePresent && !jsonContentType) ||
    (!signaturePresent && apiVersion !== expectedApiVersion) ||
    (signaturePresent && apiVersion !== null && apiVersion !== expectedApiVersion)
  ) {
    throw new DokuClientError("DOKU_RESPONSE_HEADERS", status);
  }
  if (!signaturePresent) return { timestamp, signature: null };
  const signature = headers.get("Signature");
  if (!signature) throw new DokuClientError("DOKU_RESPONSE_SIGNATURE", status);
  return { timestamp, signature };
}

function asBytes(body: DokuRawBody): Uint8Array {
  if (typeof body === "string") return new TextEncoder().encode(body);
  if (body instanceof Uint8Array) return body;
  return new Uint8Array(body);
}

function asArrayBuffer(body: DokuRawBody): ArrayBuffer {
  if (typeof body === "string") return new TextEncoder().encode(body).buffer;
  if (body instanceof ArrayBuffer) return body;
  const copy = new Uint8Array(body.byteLength);
  copy.set(body);
  return copy.buffer;
}

async function readBoundedResponseBody(response: Response): Promise<Uint8Array<ArrayBuffer>> {
  const declaredLength = response.headers.get("Content-Length");
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (!Number.isSafeInteger(parsedLength) || parsedLength < 0 || parsedLength > MAX_DOKU_RESPONSE_BYTES) {
      throw new DokuClientError("DOKU_RESPONSE_BODY", response.status);
    }
  }
  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_DOKU_RESPONSE_BYTES) {
      await reader.cancel();
      throw new DokuClientError("DOKU_RESPONSE_BODY", response.status);
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export class DokuClient {
  readonly #environment: DokuEnvironment;
  readonly #clientId: string;
  readonly #apiKey: string;
  readonly #secretKey: string;
  readonly #fetch: typeof fetch;
  readonly #now: () => Date;
  readonly #timeoutMs: number;

  constructor(options: DokuClientOptions) {
    if (options.environment !== "sandbox" && options.environment !== "production") {
      throw new DokuClientError("DOKU_CONFIGURATION");
    }
    this.#environment = options.environment;
    this.#clientId = assertVisibleCredential(options.clientId);
    this.#apiKey = assertVisibleCredential(options.apiKey);
    this.#secretKey = assertVisibleCredential(options.secretKey);
    this.#fetch = options.fetch ?? fetch;
    this.#now = options.now ?? (() => new Date());
    const timeoutMs = options.timeoutMs ?? 10_000;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30_000) {
      throw new DokuClientError("DOKU_CONFIGURATION");
    }
    this.#timeoutMs = timeoutMs;
  }

  async createCheckout<T>(input: {
    rawBody: DokuRawBody;
    idempotencyId: string;
    expectedAmountSen: number;
  }): Promise<DokuResult<T>> {
    const requestPayload = parseJson(asBytes(input.rawBody), "DOKU_INVALID_REQUEST");
    assertDokuMyrPayload(requestPayload, input.expectedAmountSen);
    const identity = createRequestIdentity(requestPayload);
    return this.#request<T>({
      method: "POST",
      target: "/v3/checkouts",
      apiVersion: DOKU_API_VERSIONS.createCheckout,
      rawBody: input.rawBody,
      idempotencyId: assertIdentity(input.idempotencyId),
      expectedAmountSen: input.expectedAmountSen,
      expectedCheckoutId: identity.checkoutId,
      expectedInvoice: identity.invoice,
    });
  }

  async retrieveCheckout<T>(input: {
    checkoutId: string;
    expectedAmountSen: number;
  }): Promise<DokuResult<T>> {
    return this.#request<T>({
      method: "GET",
      target: `/v3/checkouts/${assertIdentity(input.checkoutId)}`,
      apiVersion: DOKU_API_VERSIONS.retrieveCheckout,
      expectedAmountSen: input.expectedAmountSen,
      expectedCheckoutId: assertIdentity(input.checkoutId),
    });
  }

  async #request<T>(input: {
    method: "GET" | "POST";
    target: string;
    apiVersion: string;
    rawBody?: DokuRawBody;
    idempotencyId?: string;
    expectedAmountSen: number;
    expectedCheckoutId: string;
    expectedInvoice?: string;
  }): Promise<DokuResult<T>> {
    const requestTimestamp = this.#now().toISOString();
    const signature = await createDokuGlobalRequestSignature({
      clientId: this.#clientId,
      requestTimestamp,
      requestTarget: input.target,
      rawBody: input.rawBody,
      secretKey: this.#secretKey,
    });
    const headers = new Headers({
      Authorization: dokuBasicAuthorization(this.#apiKey),
      "Client-Id": this.#clientId,
      "Request-Timestamp": requestTimestamp,
      Signature: signature,
      "API-Version": input.apiVersion,
      Accept: "application/json",
    });
    if (input.rawBody !== undefined) headers.set("Content-Type", "application/json");
    if (input.idempotencyId) headers.set("Idempotency-Id", input.idempotencyId);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
    let response: Response;
    let rawResponse: Uint8Array<ArrayBuffer>;
    let responseEnvelope: { timestamp: string; signature: string | null };
    try {
      response = await this.#fetch(`${DOKU_BASE_URLS[this.#environment]}${input.target}`, {
        method: input.method,
        headers,
        body: input.rawBody === undefined ? undefined : asArrayBuffer(input.rawBody),
        signal: controller.signal,
        redirect: "manual",
      });
      responseEnvelope = readCheckoutResponseEnvelope(
        response.headers,
        this.#clientId,
        input.apiVersion,
        this.#now().getTime(),
        response.status,
      );
      rawResponse = await readBoundedResponseBody(response);
    } catch (error) {
      if (error instanceof DokuClientError) throw error;
      throw new DokuClientError(
        controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")
          ? "DOKU_TIMEOUT"
          : "DOKU_NETWORK",
      );
    } finally {
      clearTimeout(timer);
    }
    // ADR-022 / REQ-227: DOKU does not sign Checkout responses, so this branch
    // is conditional by decision, not by oversight. Observed unsigned by A-221
    // on 2026-09-02 (A-221R is the task that implemented the accepted profile,
    // not the one that observed it) and re-confirmed by A-221's outbound run on
    // 2026-09-09 across all five Malaysia channels on both create and retrieve,
    // with a full header inventory showing no signature under any alternate
    // name. An unsigned response is still not accepted loosely:
    // `readCheckoutResponseEnvelope` above has already required an absent
    // Cards-only `Request-Id`, an exact `Client-Id`, a fresh
    // `Response-Timestamp`, a JSON content type and an exact `API-Version`, and
    // `assertDokuMyrPayload` plus `assertCheckoutResponseIdentity` run below.
    // What is absent is body-origin HMAC assurance, which ADR-022 records as
    // its accepted cost.
    // Do not "fix" this into a hard requirement: today that would refuse every
    // DOKU response and stop payments. Whether *production* signs is still
    // unanswered — ADR-022's Context notes DOKU's own artifacts contradict each
    // other — and A-222 must resolve it before enabling production.
    if (responseEnvelope.signature !== null) {
      const validSignature = await verifyDokuGlobalResponseSignature({
        clientId: this.#clientId,
        responseTimestamp: responseEnvelope.timestamp,
        rawBody: rawResponse,
        secretKey: this.#secretKey,
        signature: responseEnvelope.signature,
        now: this.#now().getTime(),
      });
      if (!validSignature) {
        throw new DokuClientError("DOKU_RESPONSE_SIGNATURE", response.status);
      }
    }
    if (!response.ok) throw new DokuClientError("DOKU_HTTP", response.status);

    const data = parseJson(rawResponse, "DOKU_RESPONSE_BODY");
    assertDokuMyrPayload(data, input.expectedAmountSen);
    assertCheckoutResponseIdentity(data, input.expectedCheckoutId, input.expectedInvoice);
    return {
      status: response.status,
      data: data as T,
      responseTimestamp: responseEnvelope.timestamp,
    };
  }
}
