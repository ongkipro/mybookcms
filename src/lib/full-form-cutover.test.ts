import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("every retired checkout route performs one query-preserving permanent redirect", () => {
  for (const route of [
    "pages/middle-form.astro",
    "pages/hybrid-form.astro",
    "pages/form-middle.astro",
    "pages/form-hybrid.astro",
    "pages/form-full.astro",
    "pages/geoipform.astro",
  ]) {
    const routeSource = source(route);
    assert.match(routeSource, /Astro\.redirect\(`\/full-form\$\{Astro\.url\.search\}`, 308\)/, route);
    assert.equal((routeSource.match(/Astro\.redirect/g) || []).length, 1, route);
  }
});

test("public form producers expose only the canonical mode-less full checkout", () => {
  const files = [
    "lib/form-config.ts",
    "pages/api/form-config.ts",
    "pages/embed/form.astro",
    "pages/api/v1/products/index.ts",
    "pages/api/v1/products/[slug].ts",
    "components/admin/ProductCatalog.tsx",
    "components/admin/LandingPageEditor.tsx",
  ];
  const combined = files.map(source).join("\n");

  assert.doesNotMatch(combined, /\/(?:middle|hybrid)-form/);
  assert.doesNotMatch(combined, /(?:requested_mode|resolved_mode|hybrid_url|middle_url|checkout_hybrid)/);
  assert.doesNotMatch(combined, /[?&]mode=/);
  assert.match(source("pages/api/v1/products/index.ts"), /form:\s*\{\s*render_url:[\s\S]*embed_url:/);
  assert.match(source("pages/api/v1/products/[slug].ts"), /form:\s*\{\s*render_url:[\s\S]*embed_url:/);
  assert.match(source("pages/api/v1/products/index.ts"), /form_render:\s*`\/full-form/);
  assert.match(source("pages/api/v1/products/[slug].ts"), /full_url:\s*`\/full-form/);
});

test("the legacy submission endpoint is an inert 410 tombstone", () => {
  const endpoint = source("pages/api/submit-middle-order.ts");
  assert.match(endpoint, /status:\s*410/);
  assert.match(endpoint, /"cache-control": "no-store"/);
  assert.doesNotMatch(endpoint, /D1Database|persistOrder|prepare\(/);
});
