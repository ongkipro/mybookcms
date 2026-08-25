import type { APIRoute } from "astro";
import { getStorefrontProductsStrict } from "../../../../lib/catalog.ts";
import {
  buildGoogleCatalog,
  PUBLIC_CATALOG_FEED_PATH,
} from "../../../../lib/google-catalog.ts";

export const prerender = false;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  },
});

export const GET: APIRoute = async ({ locals }) => {
  try {
    const products = await getStorefrontProductsStrict(locals);
    const catalog = buildGoogleCatalog(products, locals.tenant.siteUrl, locals.tenant.locale);
    const feedUrl = new URL(PUBLIC_CATALOG_FEED_PATH, locals.tenant.siteUrl).toString();
    return json({
      success: true,
      data: {
        feed_url: feedUrl,
        target_country: "Malaysia",
        currency: "MYR",
        format: "RSS 2.0 XML",
        platforms: ["Google Merchant Center", "Meta Commerce Manager"],
        cache: "1 jam",
        product_count: catalog.productCount,
        offer_count: catalog.items.length,
        warning_count: catalog.warnings.length,
        readiness: catalog.readiness,
        readiness_label: catalog.readinessLabel,
        warnings: catalog.warnings,
        preview: catalog.items.slice(0, 10),
      },
    });
  } catch (error) {
    console.error("google-catalog-admin", error);
    return json({ success: false, error: "Katalog Google gagal dimuat." }, 500);
  }
};
