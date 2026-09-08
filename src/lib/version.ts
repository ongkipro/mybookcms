export type CmsVersionInfo = {
  version: string;
  channel: string;
  releaseTag: string;
  coreEngine: string;
  schemaVersion: number;
  lastUpdated: string;
};

export const CMS_VERSION: CmsVersionInfo = {
  version: "1.4.0",
  channel: "production",
  // Migration 0063 adds typed landing content; schemaVersion must match the
  // ordered migration files that Worker boot applies. Getting this wrong is not
  // cosmetic: boot refuses with SCHEMA_UPGRADE_CHAIN_INVALID and every route
  // answers 503 until it agrees.
  releaseTag: "2026.08-landing",
  coreEngine: "Astro 7 SSR + Cloudflare Workers",
  schemaVersion: 64,
  lastUpdated: "2026-09-01",
};
