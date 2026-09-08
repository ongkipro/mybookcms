import { ADS_CURRENCY, adsValueFromMyr } from "./ads-signal-policy.ts";
import { malaysiaPhoneDigits, metaNameParts, normalizeMetaText } from "./meta-identity.ts";

/** Verified against Meta's canonical Graph API changelog on 2026-08-24. */
export const META_GRAPH_API_VERSION = "v26.0";

export type MetaCapiDeliveryResult = {
  success: boolean;
  retryable: boolean;
  status?: number;
  providerCode?: number;
  reason?: string;
};

export type MetaSignalInput = {
  eventName: "PageView" | "ViewContent" | "InitiateCheckout" | "Lead" | "Purchase";
  eventId: string;
  eventSourceUrl: string;
  testEventCode?: string;
  userData?: {
    phone?: string;
    name?: string;
    email?: string;
    city?: string;
    state?: string;
    postcode?: string;
    externalId?: string;
    fbp?: string;
    fbc?: string;
    clientIp?: string;
    userAgent?: string;
  };
  customData?: {
    contentName?: string;
    contentIds?: string[];
    value?: number;
    orderNumber?: string;
  };
};

export type PreparedMetaPayload = {
  data: Array<{
    event_name: string;
    event_time: number;
    event_id: string;
    event_source_url: string;
    action_source: "website";
    user_data: Record<string, unknown>;
    custom_data: Record<string, unknown>;
  }>;
  test_event_code?: string;
};

async function sha256(value?: string) {
  if (!value) return undefined;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function clean(value?: string) {
  const result = String(value || "").trim();
  return result || undefined;
}

export async function prepareMetaCapiPayload(input: MetaSignalInput): Promise<PreparedMetaPayload> {
  const identity = input.userData || {};
  const name = metaNameParts(identity.name);
  const phone = malaysiaPhoneDigits(identity.phone);
  const email = clean(identity.email)?.toLowerCase();
  const normalizedExternalId = normalizeMetaText(identity.externalId);
  const contentName = clean(input.customData?.contentName);
  const contentIds = input.customData?.contentIds?.filter(Boolean) || [];
  const orderNumber = clean(input.customData?.orderNumber);
  const valueMyr = input.customData?.value;
  const hasValue = typeof valueMyr === "number" && Number.isFinite(valueMyr);
  return {
    data: [{
      event_name: input.eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: input.eventId,
      event_source_url: input.eventSourceUrl,
      action_source: "website",
      user_data: {
        ph: phone ? [await sha256(phone)] : undefined,
        em: email ? [await sha256(email)] : undefined,
        fn: name.firstName ? [await sha256(name.firstName)] : undefined,
        ln: name.lastName ? [await sha256(name.lastName)] : undefined,
        ct: normalizeMetaText(identity.city) ? [await sha256(normalizeMetaText(identity.city))] : undefined,
        st: normalizeMetaText(identity.state) ? [await sha256(normalizeMetaText(identity.state))] : undefined,
        zp: normalizeMetaText(identity.postcode) ? [await sha256(normalizeMetaText(identity.postcode))] : undefined,
        country: [await sha256("my")],
        external_id: normalizedExternalId ? [await sha256(normalizedExternalId)] : undefined,
        fbp: clean(identity.fbp),
        fbc: clean(identity.fbc),
        client_ip_address: clean(identity.clientIp)?.toLowerCase() === "unknown" ? undefined : clean(identity.clientIp),
        client_user_agent: clean(identity.userAgent),
      },
      custom_data: {
        ...(contentName ? { content_name: contentName } : {}),
        ...(contentIds.length ? { content_ids: contentIds, content_type: "product" } : {}),
        ...(hasValue ? { value: adsValueFromMyr(valueMyr), currency: ADS_CURRENCY } : {}),
        ...(orderNumber ? { order_id: orderNumber } : {}),
      },
    }],
    test_event_code: clean(input.testEventCode),
  };
}

function metaErrorCode(body: unknown) {
  if (!body || typeof body !== "object" || !("error" in body)) return undefined;
  const error = body.error;
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  const code = Number(error.code);
  return Number.isInteger(code) ? code : undefined;
}

function failureReason(status: number, providerCode?: number) {
  if (providerCode === 190) return "Meta CAPI menolak access token.";
  if (status === 429 || providerCode === 4 || providerCode === 17) {
    return "Meta CAPI membatasi permintaan. Coba lagi nanti.";
  }
  return `Meta CAPI HTTP ${status}.`;
}

export async function sendPreparedMetaCapi(
  payload: PreparedMetaPayload,
  pixelId: string,
  accessToken: string,
): Promise<MetaCapiDeliveryResult> {
  if (!pixelId || !accessToken) {
    return { success: false, retryable: false, reason: "Meta CAPI belum dikonfigurasi." };
  }
  try {
    const response = await fetch(
      `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${encodeURIComponent(pixelId)}/events`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${accessToken.trim()}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      },
    );
    const body: unknown = await response.json().catch(() => null);
    const providerCode = metaErrorCode(body);
    const retryable = response.status === 429
      || response.status >= 500
      || providerCode === 4
      || providerCode === 17;
    return {
      success: response.ok,
      retryable: response.ok ? false : retryable,
      status: response.status,
      providerCode,
      reason: response.ok ? undefined : failureReason(response.status, providerCode),
    };
  } catch (error) {
    return {
      success: false,
      retryable: true,
      reason: error instanceof Error && error.name === "TimeoutError"
        ? "Meta CAPI tidak merespons dalam batas waktu."
        : "Meta CAPI tidak dapat dihubungi.",
    };
  }
}
