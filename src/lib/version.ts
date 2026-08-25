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
  // Malaysia attribution recovery adds migration 0057; schemaVersion must
  // match the ordered migration files that Worker boot applies.
  releaseTag: "2026.08-landing",
  coreEngine: "Astro 7 SSR + Cloudflare Workers",
  schemaVersion: 58,
  lastUpdated: "2026-08-25",
};
