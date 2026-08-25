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
  // Malaysia ads signals and the CAPI outbox add migration 0055; schemaVersion must
  // match the ordered migration files that Worker boot applies.
  releaseTag: "2026.08-landing",
  coreEngine: "Astro 7 SSR + Cloudflare Workers",
  schemaVersion: 56,
  lastUpdated: "2026-08-24",
};
