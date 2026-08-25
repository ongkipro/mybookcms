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
type Fetcher = import("@cloudflare/workers-types/index.ts").Fetcher;

// Optional install-level values are intentionally absent from Wrangler's
// required bindings. Keep only these optional augmentations hand-written; all
// configured bindings come from worker-configuration.d.ts.
interface OptionalInstallEnv {
  PUBLIC_HEADLESS_ALLOWED_ORIGINS?: string;
  OPS_ALERT_WEBHOOK_URL?: string;
  BOOTSTRAP_ADMIN_PASSWORD?: string;
}

interface Env extends OptionalInstallEnv {}

declare namespace Cloudflare {
  interface Env extends OptionalInstallEnv {}
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
}
