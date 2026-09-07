import { getEnabledDokuConfig } from "./doku-config.ts";
import { getEnvValue, getRuntimeEnv } from "./env.ts";
import { buildDokuPaymentMethod } from "./payment-brand.ts";

/**
 * The one place that decides which payment methods an install currently offers.
 *
 * It exists because two endpoints answered that question and disagreed.
 * `GET /api/payment-methods` resolved it from D1 — the store's COD flag, the
 * active seller bank accounts, the enabled DOKU configuration — while
 * `GET /api/v1/storefront` returned the literal
 * `{ cod_enabled: true, supported_methods: ['cod', 'manual_transfer'] }`. An
 * operator could enable DOKU, have the server accept `payment_method: "doku"`
 * on `POST /api/v1/checkout`, and still have every headless storefront told the
 * option did not exist.
 *
 * Both endpoints now read through here, so the two can only disagree if this
 * function is wrong for both of them at once. That is the property worth having;
 * a second copy of the logic is not.
 */

export type SellerBankAccountRow = {
  id: number;
  bank_code: string;
  account_holder: string;
  account_number: string;
  is_active: number;
};

export type PaymentAvailability = {
  /** The store's COD flag, shared by buyer reads and order persistence. */
  codEnabled: boolean;
  sellerBankAccounts: SellerBankAccountRow[];
  /** Null when DOKU is absent, disabled, unreadable, or has no usable channel. */
  doku: ReturnType<typeof buildDokuPaymentMethod>;
};

/**
 * The method identifiers a client may send to checkout, given this state.
 *
 * `manual_transfer` appears only with at least one active bank account, because
 * `persistOrder` refuses it otherwise — advertising it without one would send
 * the buyer down a path the server rejects at submit.
 */
export function supportedPaymentMethods(
  availability: PaymentAvailability,
): Array<"cod" | "manual_transfer" | "doku"> {
  const methods: Array<"cod" | "manual_transfer" | "doku"> = [];
  if (availability.codEnabled) methods.push("cod");
  if (availability.sellerBankAccounts.some((account) => account.is_active)) {
    methods.push("manual_transfer");
  }
  if (availability.doku) methods.push("doku");
  return methods;
}

/**
 * Compact Malay payment truth for the repeated PDP variant rows.
 *
 * It names every method the install actually offers rather than the first pair
 * it matches. The earlier version fell out of a ladder of `if`s whose first arm
 * caught COD plus manual transfer and returned, so an install with COD, bank
 * transfer and all five DOKU channels enabled still told the buyer only "COD
 * atau pindahan bank" — the store's strongest signal, instant online payment,
 * was the one thing the product page never mentioned. No test covered that
 * combination, which is why it went unnoticed.
 */
export function paymentAvailabilityTrustLine(availability: PaymentAvailability) {
  const methods: string[] = [];
  if (availability.codEnabled) methods.push("COD");
  if (availability.sellerBankAccounts.some((account) => account.is_active)) {
    methods.push("pindahan bank");
  }
  if (availability.doku) methods.push("bayaran dalam talian");
  if (!methods.length) return "Kaedah bayaran belum tersedia";
  const listed = methods.length > 1
    ? `${methods.slice(0, -1).join(", ")} atau ${methods[methods.length - 1]}`
    : methods[0];
  return `Sedia dihantar • ${listed.charAt(0).toUpperCase()}${listed.slice(1)}`;
}

/**
 * Fails soft on purpose, and asymmetrically.
 *
 * A store read that throws leaves COD enabled, matching the column default and
 * the behaviour before this module existed: a transient D1 error must not make
 * a working storefront look closed. A DOKU read that throws yields null, since
 * an unreadable or undecryptable configuration must never be presented as an
 * available payment method.
 */
export async function resolvePaymentAvailability(
  locals: App.Locals,
  database: D1Database | null | undefined,
): Promise<PaymentAvailability> {
  let codEnabled = true;
  let sellerBankAccounts: SellerBankAccountRow[] = [];
  let doku: PaymentAvailability["doku"] = null;

  if (database?.prepare) {
    try {
      const [store, bankAccounts] = await Promise.all([
        database
          .prepare("SELECT is_cod_enabled FROM stores ORDER BY id LIMIT 1")
          .first<{ is_cod_enabled?: number | null }>(),
        database
          .prepare(
            `SELECT id, bank_code, account_holder, account_number, is_active
               FROM seller_bank_accounts
              WHERE store_id = (SELECT id FROM stores ORDER BY id LIMIT 1)
              ORDER BY display_order, id`,
          )
          .all<SellerBankAccountRow>(),
      ]);
      codEnabled = store?.is_cod_enabled !== 0;
      sellerBankAccounts = bankAccounts.results || [];
    } catch (error) {
      console.error("payment-availability-config", error);
    }

    try {
      // The decryption here is load-bearing, not incidental. `enabled_channels_json`
      // is a plain column and could be read without a secret, but the health
      // verdict that gates the offer cannot: an undecryptable credential must
      // make DOKU absent rather than advertised. Reading the channel list
      // directly would offer DOKU on an install whose secret is corrupt, and the
      // buyer would meet the failure at the provider instead of never seeing it.
      const rootSecret = getEnvValue("AUTH_SECRET", getRuntimeEnv(locals));
      // An enabled row with a missing root secret must emit the same safe
      // health diagnostic as any other unreadable configuration.
      const config = await getEnabledDokuConfig(database, rootSecret);
      doku = buildDokuPaymentMethod(config?.enabledChannels || []);
    } catch {
      doku = null;
    }
  }

  return { codEnabled, sellerBankAccounts, doku };
}
