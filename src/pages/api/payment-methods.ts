import type { APIRoute } from "astro";
import { getRuntimeEnv } from "../../lib/env";
import { resolvePaymentAvailability } from "../../lib/payment-availability";
import { paymentBrandAsset, paymentBrandLabel } from "../../lib/payment-brand";

export const prerender = false;

/**
 * The hosted checkout's payment list. It and `GET /api/v1/storefront` resolve
 * availability through the same function so the two cannot disagree about one
 * store's state; only the response shape differs, because this one carries the
 * buyer-facing labels, logos, and per-account rows the form renders.
 */
export const GET: APIRoute = async ({ locals }) => {
  try {
    const database = getRuntimeEnv(locals)?.OMS_DB as D1Database | undefined;
    const availability = await resolvePaymentAvailability(locals, database);

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
            is_active: availability.codEnabled,
          },
          ...availability.sellerBankAccounts.map((account) => ({
            code: `MANUAL_${account.id}`,
            payment_method: "manual_transfer",
            seller_bank_account_id: account.id,
            bank_code: account.bank_code,
            name: `Pindahan Bank ${paymentBrandLabel(account.bank_code)}`,
            logo_url: paymentBrandAsset(account.bank_code),
            description: `a.n. ${account.account_holder}`,
            is_active: Boolean(account.is_active),
          })),
          ...(availability.doku ? [availability.doku] : []),
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
