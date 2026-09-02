import type { APIRoute } from "astro";

export const prerender = false;

export const POST: APIRoute = async () =>
  new Response(
    JSON.stringify({
      success: false,
      code: "LEGACY_CHECKOUT_REMOVED",
      error: "Checkout ringkas sudah ditamatkan. Gunakan borang pesanan lengkap.",
    }),
    {
      status: 410,
      headers: {
        "cache-control": "no-store",
        "content-type": "application/json; charset=utf-8",
      },
    },
  );
