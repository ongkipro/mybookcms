export type HeadlessProductVariant = {
  id: string | number;
  label: string;
  price: number;
  compare_price: number;
};

export type HeadlessProduct = {
  id: string | number;
  slug: string;
  name: string;
  price: number;
  variants: HeadlessProductVariant[];
};

export type HeadlessShippingRate = {
  rate_rule_id: number;
  name: string;
  amount_sen: number;
};

export type HeadlessCheckoutOrder = {
  id: string | number;
  order_number: string;
  public_status_token: string;
  total_amount: number;
  shipping_amount: number;
  currency: "MYR";
};

export type HeadlessOrderStatus = {
  is_paid: boolean;
  order_number: string;
  payment_method: string;
  payment_status: string;
  status: string;
  total_amount: number;
  payment: Record<string, unknown> | null;
};
export type HeadlessStorefrontBootstrap = {
  storefront: Record<string, unknown>;
  content: Record<string, unknown>;
  payment: {
    cod_enabled: boolean;
    supported_methods: Array<"cod" | "manual_transfer" | "doku">;
    /** Present and non-empty only where a healthy DOKU config is enabled. */
    doku_channels: Array<{ code: string; label: string }>;
    doku_requires_email: boolean;
  };
};


export type HeadlessCheckoutInput = {
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  address: string;
  city?: string;
  district: string;
  province: string;
  postal_code: string;
  /**
   * `doku` is accepted by `POST /api/v1/checkout` wherever the install has a
   * healthy enabled DOKU configuration. Read `payment.supported_methods` from
   * `GET /api/v1/storefront` rather than assuming; `doku` additionally
   * requires `customer_email`, and `manual_transfer` a `seller_bank_account_id`.
   */
  payment_method: "cod" | "manual_transfer" | "doku";
  seller_bank_account_id?: number;
  variant_id: string | number;
  quantity: number;
  submit_token: string;
  website?: string;
};

type JsonRecord = Record<string, unknown>;
type HeadlessTransport = (request: Request) => Promise<Response>;

export class HeadlessApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function requireRecord(value: unknown, context: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HeadlessApiError(502, "INVALID_API_RESPONSE", `${context} tidak sesuai kontrak API.`);
  }
  return value as JsonRecord;
}

function requireString(value: unknown, context: string): string {
  if (typeof value !== "string" || !value) {
    throw new HeadlessApiError(502, "INVALID_API_RESPONSE", `${context} tidak sesuai kontrak API.`);
  }
  return value;
}

function requireNumber(value: unknown, context: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new HeadlessApiError(502, "INVALID_API_RESPONSE", `${context} tidak sesuai kontrak API.`);
  }
  return value;
}

function readApiError(status: number, payload: unknown): HeadlessApiError {
  const envelope = requireRecord(payload, "Error response");
  const error = requireRecord(envelope.error, "Error response.error");
  return new HeadlessApiError(
    status,
    typeof error.code === "string" ? error.code : "API_ERROR",
    typeof error.message === "string" ? error.message : "Headless API request gagal.",
  );
}

export class HeadlessApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly transport: HeadlessTransport;

  constructor(baseUrl: string, apiKey: string, transport: HeadlessTransport = fetch) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
    this.transport = transport;
  }

  private async request(path: string, init?: RequestInit): Promise<JsonRecord> {
    const headers = new Headers(init?.headers);
    headers.set("accept", "application/json");
    headers.set("x-app-key", this.apiKey);
    if (init?.body) headers.set("content-type", "application/json");
    const response = await this.transport(new Request(`${this.baseUrl}${path}`, { ...init, headers }));
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw readApiError(response.status, payload);
    const envelope = requireRecord(payload, `Response ${path}`);
    if (envelope.success !== true) {
      throw new HeadlessApiError(502, "INVALID_API_RESPONSE", `Response ${path} tidak menandai success.`);
    }
    return envelope;
  }

  async getStorefront(): Promise<HeadlessStorefrontBootstrap> {
    const envelope = await this.request("/storefront");
    const payment = requireRecord(envelope.payment, "payment");
    if (
      !Array.isArray(payment.supported_methods) ||
      payment.supported_methods.some((value) => typeof value !== "string")
    ) {
      throw new HeadlessApiError(502, "INVALID_API_RESPONSE", "payment tidak sesuai kontrak API.");
    }
    // An unknown method is dropped rather than passed through. A client that
    // rendered one could only offer the buyer a choice checkout will refuse.
    const known: ReadonlyArray<"cod" | "manual_transfer" | "doku"> = [
      "cod",
      "manual_transfer",
      "doku",
    ];
    const supported = (payment.supported_methods as string[]).filter(
      (value): value is "cod" | "manual_transfer" | "doku" =>
        (known as readonly string[]).includes(value),
    );
    // Absent on an install that predates A-231, so treated as "no DOKU" rather
    // than as a contract violation: an older store genuinely has none.
    const channels = Array.isArray(payment.doku_channels) ? payment.doku_channels : [];
    return {
      storefront: requireRecord(envelope.storefront, "storefront"),
      content: requireRecord(envelope.content, "content"),
      payment: {
        cod_enabled: payment.cod_enabled === true,
        supported_methods: supported,
        doku_channels: channels.flatMap((value) => {
          const channel = value as { code?: unknown; label?: unknown };
          return typeof channel?.code === "string" && typeof channel?.label === "string"
            ? [{ code: channel.code, label: channel.label }]
            : [];
        }),
        doku_requires_email: payment.doku_requires_email === true,
      },
    };
  }

  async listProducts(): Promise<HeadlessProduct[]> {
    const envelope = await this.request("/products");
    if (!Array.isArray(envelope.products)) {
      throw new HeadlessApiError(502, "INVALID_API_RESPONSE", "products tidak sesuai kontrak API.");
    }
    return envelope.products.map((value, productIndex) => {
      const product = requireRecord(value, `products[${productIndex}]`);
      if (!Array.isArray(product.variants)) {
        throw new HeadlessApiError(502, "INVALID_API_RESPONSE", `products[${productIndex}].variants tidak valid.`);
      }
      return {
        id: typeof product.id === "number" ? product.id : requireString(product.id, "product.id"),
        slug: requireString(product.slug, "product.slug"),
        name: requireString(product.name, "product.name"),
        price: requireNumber(product.price, "product.price"),
        variants: product.variants.map((variantValue, variantIndex) => {
          const variant = requireRecord(variantValue, `variants[${variantIndex}]`);
          return {
            id: typeof variant.id === "number" ? variant.id : requireString(variant.id, "variant.id"),
            label: requireString(variant.label, "variant.label"),
            price: requireNumber(variant.price, "variant.price"),
            compare_price: requireNumber(variant.compare_price, "variant.compare_price"),
          };
        }),
      };
    });
  }

  async quoteShipping(input: {
    postcode: string;
    variant_id: string | number;
    quantity: number;
  }): Promise<HeadlessShippingRate[]> {
    const envelope = await this.request("/geo/shipping-rates", {
      method: "POST",
      body: JSON.stringify(input),
    });
    if (!Array.isArray(envelope.rates)) {
      throw new HeadlessApiError(502, "INVALID_API_RESPONSE", "rates tidak sesuai kontrak API.");
    }
    return envelope.rates.map((value, index) => {
      const rate = requireRecord(value, `rates[${index}]`);
      return {
        rate_rule_id: requireNumber(rate.rate_rule_id, "rate.rate_rule_id"),
        name: requireString(rate.name, "rate.name"),
        amount_sen: requireNumber(rate.amount_sen, "rate.amount_sen"),
      };
    });
  }

  async checkout(input: HeadlessCheckoutInput): Promise<HeadlessCheckoutOrder> {
    const envelope = await this.request("/checkout", {
      method: "POST",
      body: JSON.stringify(input),
    });
    const order = requireRecord(envelope.order, "order");
    return {
      id: typeof order.id === "number" ? order.id : requireString(order.id, "order.id"),
      order_number: requireString(order.order_number, "order.order_number"),
      public_status_token: requireString(order.public_status_token, "order.public_status_token"),
      total_amount: requireNumber(order.total_amount, "order.total_amount"),
      shipping_amount: requireNumber(order.shipping_amount, "order.shipping_amount"),
      currency: requireString(order.currency, "order.currency") === "MYR"
        ? "MYR"
        : (() => { throw new HeadlessApiError(502, "INVALID_API_RESPONSE", "order.currency tidak sesuai kontrak API."); })(),
    };
  }

  async getOrderStatus(orderNumber: string, statusToken: string): Promise<HeadlessOrderStatus> {
    const envelope = await this.request("/orders/status", {
      method: "POST",
      body: JSON.stringify({ order_number: orderNumber, status_token: statusToken }),
    });
    const order = requireRecord(envelope.order, "order");
    return {
      is_paid: order.is_paid === true,
      order_number: requireString(order.order_number, "order.order_number"),
      payment_method: requireString(order.payment_method, "order.payment_method"),
      payment_status: requireString(order.payment_status, "order.payment_status"),
      status: requireString(order.status, "order.status"),
      total_amount: requireNumber(order.total_amount, "order.total_amount"),
      payment: order.payment === null ? null : requireRecord(order.payment, "order.payment"),
    };
  }

}

export function focusHeadlessConfirmation(
  root: ParentNode,
  selector = "[data-headless-order-confirmation]",
): boolean {
  const target = root.querySelector<HTMLElement>(selector);
  if (!target) return false;
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  target.focus();
  return true;
}

export type HeadlessCheckoutJourneyInput = Omit<
  HeadlessCheckoutInput,
  "variant_id"
> & {
  product_id: string | number;
  variant_id: string | number;
};

export async function runHeadlessCheckoutJourney(
  client: HeadlessApiClient,
  input: HeadlessCheckoutJourneyInput,
): Promise<{
  product: HeadlessProduct;
  variant: HeadlessProductVariant;
  rate: HeadlessShippingRate;
  checkout: HeadlessCheckoutOrder;
  status: HeadlessOrderStatus;
}> {
  const products = await client.listProducts();
  const product = products.find((candidate) => String(candidate.id) === String(input.product_id));
  if (!product) throw new HeadlessApiError(404, "PRODUCT_NOT_FOUND", "Produk tidak dijumpai dalam katalog.");
  const variant = product.variants.find((candidate) => String(candidate.id) === String(input.variant_id));
  if (!variant) throw new HeadlessApiError(404, "VARIANT_NOT_FOUND", "Varian tidak dijumpai pada produk.");

  const rates = await client.quoteShipping({
    postcode: input.postal_code,
    variant_id: variant.id,
    quantity: input.quantity,
  });
  const rate = rates[0];
  if (!rate) {
    throw new HeadlessApiError(422, "SHIPPING_RATE_NOT_FOUND", "Tarif pengiriman yang dipilih tidak tersedia.");
  }
  const checkout = await client.checkout({
    customer_name: input.customer_name,
    customer_phone: input.customer_phone,
    customer_email: input.customer_email,
    address: input.address,
    city: input.city,
    district: input.district,
    province: input.province,
    postal_code: input.postal_code,
    payment_method: input.payment_method,
    seller_bank_account_id: input.seller_bank_account_id,
    variant_id: variant.id,
    quantity: input.quantity,
    submit_token: input.submit_token,
    website: input.website,
  });
  const status = await client.getOrderStatus(checkout.order_number, checkout.public_status_token);
  return { product, variant, rate, checkout, status };
}
