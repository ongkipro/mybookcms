/**
 * Decides what `stores.site_url` becomes on a settings save.
 *
 * The https rule is right for production — the value feeds canonical URLs, the
 * sitemap, and the catalog feed — but it must only judge a value the operator
 * actually submitted as a change. The local development seed writes a plain
 * http address straight into the row, so re-validating an untouched value
 * refused every save on a seeded install with an error naming a field the
 * operator had not edited.
 */
export type StoreSiteUrlResult =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

export function resolveStoreSiteUrl(submitted: string, stored: string | null): StoreSiteUrlResult {
  const next = submitted.trim();
  if (!next) return { ok: true, value: null };
  // Unchanged: grandfathered, whatever it is. The rule applies again the
  // moment it is actually edited, which is the only time it can be wrong
  // on purpose.
  if (next === (stored ?? "")) return { ok: true, value: next };
  let parsed: URL;
  try {
    parsed = new URL(next);
  } catch {
    return { ok: false, error: "Alamat toko tidak valid." };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, error: "Alamat toko harus memakai https." };
  }
  return { ok: true, value: parsed.origin };
}
