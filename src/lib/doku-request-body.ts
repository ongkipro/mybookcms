/**
 * The one place the DOKU Hosted Checkout request body is built.
 *
 * It used to be built twice — once in `doku-checkout.ts` for the first attempt
 * and once in `doku-payment-access.ts` for retry — and the copies had already
 * drifted 25 lines apart. Most of that was plumbing, but one difference was
 * not: create ran its money fields through a guard that refuses a value which
 * is not a safe non-negative integer, and retry divided by 100 raw. A corrupt
 * or negative sen value was therefore refused on the way in and sent to the
 * provider on the way back. Both paths now share the guard.
 *
 * "Its money fields", not every one: any `shippingCostSen` that fails the
 * `> 0` test — zero, negative, or NaN — is dropped as a line item rather than
 * refused, so the guard never sees it. NaN is the surprising member of that
 * set, which is why it is named here and asserted in the tests. That matches the create path exactly and is therefore not a
 * regression, and `DokuClient` re-checks the total against `expectedAmountSen`
 * afterwards — but the earlier wording here claimed more than the code does.
 * Noted by the independent review of A-260.
 *
 * Key order is load-bearing. This body is serialized and then signed, so the
 * bytes must not move; `metadata` is appended last and only when a device
 * fingerprint exists, which is what keeps the retry body byte-identical to the
 * one it replaced while the create body keeps its trailing `metadata` object.
 */

export class DokuRequestBodyError extends Error {
  // Declared, not a constructor parameter property: Node's strip-only
  // TypeScript mode — the one `npm test` runs under — rejects those.
  readonly field: string;

  constructor(field: string) {
    super(`invalid ${field}`);
    this.name = "DokuRequestBodyError";
    this.field = field;
  }
}

export type DokuCheckoutBodyInput = {
  attemptId: string;
  merchantInvoice: string;
  orderNumber: string;
  /** DOKU refuses a null or absent `order.expired_at` with `missing_parameter`,
   *  so this is not nullable and `requiredExpiry` below refuses an empty one. */
  expiresAt: string;
  channel: string | null;
  totalAmountSen: number;
  unitPriceSen: number;
  shippingCostSen: number;
  quantity: number;
  variantId: number | string;
  variantSku: string;
  productTitle: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: string;
  city: string;
  postalCode: string;
  origin: string;
  returnToken: string;
  /** Present on the first attempt only; retry has no browser fingerprint. */
  deviceFingerprint?: string;
};

/** DOKU answers a missing `order.expired_at` with HTTP 400 `missing_parameter`,
 *  observed 2026-09-09. The retry path reads its expiry from a D1 column that
 *  migration `0059` declares nullable, so refuse it here rather than spend a
 *  provider round trip learning the same thing. */
function requiredExpiry(value: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new DokuRequestBodyError("expiry");
  }
  return value;
}

/** Sen to MYR major units, refusing anything that is not a safe, non-negative integer. */
function majorMyr(sen: number, field: string): number {
  if (!Number.isSafeInteger(sen) || sen < 0) throw new DokuRequestBodyError(field);
  return sen / 100;
}

function callbacks(origin: string, orderNumber: string, returnToken: string) {
  const capability = new URLSearchParams({
    order_number: orderNumber,
    return_token: returnToken,
  });
  return {
    callback_url: `${origin}/payment/doku/return?${capability}`,
    callback_url_cancel: `${origin}/payment/doku/cancel?${capability}`,
    callback_url_result: `${origin}/payment/doku/result?${capability}`,
  };
}

export function buildDokuCheckoutBody(input: DokuCheckoutBodyInput): string {
  const nameParts = input.customerName.split(/\s+/);
  const firstName = nameParts.shift() || input.customerName;
  const lastName = nameParts.join(" ") || firstName;

  const lineItems: Array<Record<string, unknown>> = [{
    id: String(input.variantId),
    name: input.productTitle.slice(0, 255),
    quantity: input.quantity,
    price: majorMyr(input.unitPriceSen, "unit price"),
    sku: input.variantSku.slice(0, 120),
  }];
  if (input.shippingCostSen > 0) {
    lineItems.push({
      id: "shipping",
      name: "Penghantaran",
      quantity: 1,
      price: majorMyr(input.shippingCostSen, "shipping cost"),
    });
  }

  const body: Record<string, unknown> = {
    id: input.attemptId,
    order: {
      amount: majorMyr(input.totalAmountSen, "total amount"),
      invoice_number: input.merchantInvoice,
      currency: "MYR",
      line_items: lineItems,
      expired_at: requiredExpiry(input.expiresAt),
    },
    checkout_experience: {
      payment_channels: [input.channel],
      language: "MS",
      auto_redirect: false,
      retry_payment: { enabled: true },
      ...callbacks(input.origin, input.orderNumber, input.returnToken),
    },
    customer: {
      id: input.orderNumber,
      name: input.customerName,
      email: input.customerEmail,
      phone: `+${input.customerPhone}`,
      country: "MY",
      address: input.address,
    },
    shipping_address: {
      first_name: firstName,
      last_name: lastName,
      address: input.address,
      city: input.city,
      postal_code: input.postalCode,
      phone: `+${input.customerPhone}`,
      country_code: "MY",
    },
  };
  if (input.deviceFingerprint !== undefined) {
    body.metadata = { device_id: input.deviceFingerprint };
  }
  return JSON.stringify(body);
}
