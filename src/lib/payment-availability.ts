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
  /**
   * The store's COD flag. Note that nothing on any submission path enforces it
   * today — see A-232. This value is what the storefront is told, not a
   * guarantee the server will refuse a COD order when it is false.
   */
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
      const rootSecret = getEnvValue("AUTH_SECRET", getRuntimeEnv(locals));
      const config = rootSecret ? await getEnabledDokuConfig(database, rootSecret) : null;
      doku = buildDokuPaymentMethod(config?.enabledChannels || []);
    } catch {
      doku = null;
    }
  }

  return { codEnabled, sellerBankAccounts, doku };
}
