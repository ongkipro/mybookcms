import type { APIRoute } from "astro";
import { getStorefrontProductsStrict } from "../../lib/catalog.ts";
import { buildGoogleCatalog, generateGoogleCatalogXml } from "../../lib/google-catalog.ts";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  try {
    const products = await getStorefrontProductsStrict(locals);
    const catalog = buildGoogleCatalog(products, locals.tenant.siteUrl, locals.tenant.locale);
    const xml = generateGoogleCatalogXml(catalog, {
      title: locals.tenant.name,
      link: locals.tenant.siteUrl,
      description: `Google and Meta product catalog for ${locals.tenant.name}.`,
    });
    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("google-catalog-feed", error);
    return new Response("<?xml version=\"1.0\" encoding=\"UTF-8\"?><error>Catalog temporarily unavailable.</error>", {
      status: 500,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
};
