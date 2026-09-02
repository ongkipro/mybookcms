import type { APIRoute } from "astro";
import { getRuntimeEnv } from "../../lib/env";
import { getEnvValue } from "../../lib/env";
import { getEnabledDokuConfig } from "../../lib/doku-config";
import { buildDokuPaymentMethod, paymentBrandAsset, paymentBrandLabel } from "../../lib/payment-brand";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  try {
    const database = getRuntimeEnv(locals)?.OMS_DB as D1Database | undefined;
    let isCodEnabled = true;
    let sellerBankAccounts: Array<{
      id: number;
      bank_code: string;
      account_holder: string;
      account_number: string;
      is_active: number;
    }> = [];
    let dokuPaymentMethod: ReturnType<typeof buildDokuPaymentMethod> = null;
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
            .all<{
              id: number;
              bank_code: string;
              account_holder: string;
              account_number: string;
              is_active: number;
            }>(),
        ]);
        isCodEnabled = store?.is_cod_enabled !== 0;
        sellerBankAccounts = bankAccounts.results || [];
      } catch (error) {
        console.error("payment-methods-config", error);
      }
      try {
        const rootSecret = getEnvValue("AUTH_SECRET", getRuntimeEnv(locals));
        const config = rootSecret ? await getEnabledDokuConfig(database, rootSecret) : null;
        dokuPaymentMethod = buildDokuPaymentMethod(config?.enabledChannels || []);
      } catch {
        dokuPaymentMethod = null;
      }
    }

  return new Response(
    JSON.stringify({
      success: true,
      meta: {
        currency: "MYR",
        logo_aspect_ratio: "3:2",
      },
      data: [
        {
          code: "cod",
          payment_method: "cod",
          name: "COD (Bayar di Tempat)",
          logo_url: paymentBrandAsset("COD"),
          description: "Bayar tunai apabila bungkusan tiba",
          is_active: isCodEnabled,
        },
        ...sellerBankAccounts.map((account) => ({
          code: `MANUAL_${account.id}`,
          payment_method: "manual_transfer",
          seller_bank_account_id: account.id,
          bank_code: account.bank_code,
          name: `Pindahan Bank ${paymentBrandLabel(account.bank_code)}`,
          logo_url: paymentBrandAsset(account.bank_code),
          description: `a.n. ${account.account_holder}`,
          is_active: Boolean(account.is_active),
        })),
        ...(dokuPaymentMethod ? [dokuPaymentMethod] : []),
      ],
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
  } catch (error) {
    console.error("GET /api/payment-methods error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Kaedah bayaran gagal dimuatkan" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
