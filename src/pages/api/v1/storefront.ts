import type { APIRoute } from 'astro';
import { handleOptions, headlessError, headlessOk, validateHeadlessRequest } from '../../../lib/headless-api';
import { getTenantHomeContent } from '../../../lib/tenant-content';
import { getRuntimeEnv } from '../../../lib/env';
import {
  resolvePaymentAvailability,
  supportedPaymentMethods,
} from '../../../lib/payment-availability';

export const prerender = false;

export const OPTIONS = handleOptions;

export const GET: APIRoute = async ({ request, locals }) => {
  const tenantConfig = locals.tenant;
  const validation = await validateHeadlessRequest(request, locals, { operation: 'storefrontRead' });
  if (!validation.allowed) {
    return validation.errorResponse;
  }

  try {
    const homeContent = await getTenantHomeContent(locals);

    if (homeContent.state === 'unavailable') {
      return validation.finalize(headlessError(
        'Konten storefront sedang tidak tersedia.',
        503,
        { code: 'STOREFRONT_CONTENT_UNAVAILABLE' },
        validation.corsHeaders,
      ));
    }

    // Resolved, never asserted. This block used to be a literal that omitted
    // `doku` entirely, so an install with DOKU enabled told every headless
    // storefront the option did not exist while the checkout endpoint accepted
    // it. It now reads the same D1 facts as `GET /api/payment-methods`.
    const availability = await resolvePaymentAvailability(
      locals,
      getRuntimeEnv(locals)?.OMS_DB as D1Database | undefined,
    );

    return validation.finalize(headlessOk(
      {
        storefront: {
          slug: tenantConfig.slug,
          name: tenantConfig.name,
          tagline: tenantConfig.tagline,
          description: tenantConfig.description,
          site_url: tenantConfig.siteUrl,
          logo: tenantConfig.logo,
          theme_color: tenantConfig.themeColor,
          locale: tenantConfig.locale,
          template: tenantConfig.storefrontTemplate,
          admin_name: tenantConfig.adminName,
        },
        content: homeContent.content,
        payment: {
          cod_enabled: availability.codEnabled,
          supported_methods: supportedPaymentMethods(availability),
          // Labels only. No credential, environment, or configuration revision
          // crosses this public boundary.
          doku_channels: availability.doku
            ? availability.doku.channels.map((channel) => ({
                code: channel.code,
                label: channel.label,
              }))
            : [],
          doku_requires_email: Boolean(availability.doku),
        },
      },
      200,
      { ...validation.corsHeaders, 'cache-control': 'no-store' }
    ));
  } catch (error) {
    return validation.finalize(headlessError('Gagal memuat data storefront.', 500, {
      code: 'STOREFRONT_LOAD_ERROR',
      details: error instanceof Error ? error.message : String(error),
    }, validation.corsHeaders));
  }
};
