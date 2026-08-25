/// <reference path="../.astro/types.d.ts" />
/// <reference types="@astrojs/cloudflare" />
type KVNamespace = import("@cloudflare/workers-types/index.ts").KVNamespace;
type D1Database = import("@cloudflare/workers-types/index.ts").D1Database;
type D1PreparedStatement =
  import("@cloudflare/workers-types/index.ts").D1PreparedStatement;
type D1Result<T = unknown> =
  import("@cloudflare/workers-types/index.ts").D1Result<T>;
type R2Bucket = import("@cloudflare/workers-types/index.ts").R2Bucket;
type Ai = import("@cloudflare/workers-types/index.ts").Ai;

interface SharedEnvVars {
  PUBLIC_SITE_NAME?: string;
  PUBLIC_SITE_URL?: string;
  PUBLIC_SITE_DESCRIPTION?: string;
  PUBLIC_SITE_LOGO?: string;
  PUBLIC_SITE_TAGLINE?: string;
  PUBLIC_SITE_THEME_COLOR?: string;
  PUBLIC_SITE_LOCALE?: string;
  PUBLIC_STOREFRONT_TEMPLATE?: string;
  PUBLIC_ADMIN_NAME?: string;
  PUBLIC_EMBED_ALLOWED_ORIGINS?: string;
  PUBLIC_HEADLESS_ALLOWED_ORIGINS?: string;
  AUTH_SECRET?: string;
  INSTALL_TOKEN?: string;
  /** Optional per-install HTTPS endpoint for redacted operational alerts. */
  OPS_ALERT_WEBHOOK_URL?: string;
  BOOTSTRAP_ADMIN_PASSWORD?: string;
}

interface CloudflareRuntimeEnv extends SharedEnvVars {
  SESSION: KVNamespace;
  OMS_DB: D1Database;
  ASSET_BUCKET: R2Bucket;
  AI: Ai;
  ASSETS: unknown;
}
declare namespace Cloudflare {
  interface Env extends CloudflareRuntimeEnv {}
}

declare module "cloudflare:workers" {
  export const env: Cloudflare.Env;
}


declare namespace App {
  interface Locals {
    runtimeEnv?: Record<string, unknown>;
    /**
     * Store identity, resolved once per request in middleware from the `stores`
     * row with environment fallback. Read this instead of importing a
     * build-time constant — see DECISIONS.md ADR-003.
     */
    tenant: import("./lib/tenant").PublicTenantConfig;
    admin?: {
      username: string;
      role: import("./lib/auth").AdminRole;
      mustChangePassword: boolean;
    };
  }
}

interface Window {
  dataLayer: unknown[];
  gtag?: (...args: unknown[]) => void;
  fbq?: ((...args: unknown[]) => void) & {
    callMethod?: (...args: unknown[]) => void;
    queue: unknown[];
    push: unknown;
    loaded: boolean;
    version: string;
  };
  _fbq?: Window["fbq"];
  __MYBOOK_TRACK__?: (eventName: string, payload?: Record<string, unknown>) => string | undefined;
  __MYBOOK_GOOGLE_PURCHASE__?: (value: number, transactionId: string) => void;
  __MYBOOK_UPDATE_AD_CONSENT__?: (granted: boolean) => void;
}
