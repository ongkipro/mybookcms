import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { formatAdminDateTime } from "./admin-date-filter.ts";
import { MALAYSIA_STATES, malaysiaStateCode } from "./malaysia-states.ts";
import { MalaysiaShippingError, quoteMalaysiaShipping } from "./malaysia-shipping.ts";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

/**
 * Market invariants that no single module owns, each pinned because it was
 * actually wrong on 2026-08-31. A green build proved none of them.
 */

test("one admin timestamp rendering, always carrying its zone", () => {
  const rendered = formatAdminDateTime("2026-08-17T01:30:00.000Z");
  // 01:30 UTC is 09:30 MYT. The zone label is what made the old list/detail
  // disagreement invisible to the operator.
  assert.match(rendered, /09[.:]30/);
  assert.ok(rendered.endsWith(" MYT"), `expected a zone label, got ${rendered}`);
  assert.equal(formatAdminDateTime("not a date"), "not a date");
});

test("the orders list and order detail cannot drift apart again", () => {
  for (const file of ["OrdersTable", "OrderDetail", "ShippingOperations"]) {
    const source = read(`src/components/admin/${file}.tsx`);
    assert.doesNotMatch(
      source,
      /new Intl\.DateTimeFormat/,
      `${file}.tsx builds its own timestamp format; use formatAdminDateTime`,
    );
  }
});

test("no buyer-facing layout hardcodes a document language", () => {
  const dir = new URL("../layouts/", import.meta.url);
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".astro") || name === "AdminLayout.astro") continue;
    // AdminLayout is deliberately Indonesian (REQ-185); every public frame
    // must follow the tenant locale instead.
    const source = readFileSync(new URL(name, dir), "utf8");
    assert.doesNotMatch(
      source,
      /<html lang="[a-z]{2}(-[A-Z]{2})?"/,
      `${name} pins a language instead of resolving the tenant locale`,
    );
  }
});

test("the privacy notice does not deny processing the storefront performs", () => {
  const legal = read("src/data/legal.ts");
  const mountsTrackers = /<AdsBase\s*\/>/.test(read("src/layouts/BaseLayout.astro"));
  assert.ok(mountsTrackers, "BaseLayout no longer mounts AdsBase; revisit this invariant");
  assert.doesNotMatch(
    legal,
    /tidak menggunakan tracker/i,
    "the privacy page denies advertising trackers while BaseLayout mounts them",
  );
  assert.match(legal, /SHA-256/, "the hashed-matching disclosure is missing");
});

test("errors a buyer can reach are Malay, not Indonesian", () => {
  for (const file of ["malaysia-shipping.ts", "headless-client.ts"]) {
    assert.doesNotMatch(
      read(`src/lib/${file}`),
      /tidak ditemukan/,
      `${file} returns Indonesian to a buyer or a public API client`,
    );
  }
});

test("every state resolves from the exact name the postcode directory stores", () => {
  assert.equal(MALAYSIA_STATES.length, 16, "13 states plus 3 federal territories");
  const directory = read("src/db/migrations/0050_malaysia_postcode_directory.sql");
  for (const state of MALAYSIA_STATES) {
    assert.equal(malaysiaStateCode(state.sourceName), state.code);
    assert.ok(
      directory.includes(`('${state.sourceName}',`),
      `${state.sourceName} is not the name the directory seeds; the state rate would silently fall back to its broad zone`,
    );
  }
});

test("a cart over the ceiling is told the limit, not just refused", () => {
  const rateRules = [
    { id: 1, zoneCode: "peninsular" as const, minWeightGrams: 1, maxWeightGrams: 1000, amountSen: 800, isActive: 1, stateCode: null },
    { id: 2, zoneCode: "peninsular" as const, minWeightGrams: 1001, maxWeightGrams: 5000, amountSen: 1200, isActive: 1, stateCode: null },
  ];
  const postcodeRanges = [
    { id: 1, zoneCode: "peninsular" as const, postcodeStart: "01000", postcodeEnd: "86999", isActive: 1 },
  ];
  const quote = () => quoteMalaysiaShipping({ postcode: "50450", weightGrams: 6200, postcodeRanges, rateRules });
  assert.throws(quote, (error: MalaysiaShippingError) => {
    assert.equal(error.code, "RATE_UNAVAILABLE");
    assert.match(error.message, /6\.2 kg/, "the buyer is not told their own cart weight");
    assert.match(error.message, /5 kg/, "the buyer is not told the ceiling");
    return true;
  });
  // Inside the ceiling the band still resolves; the message must not fire early.
  assert.equal(
    quoteMalaysiaShipping({ postcode: "50450", weightGrams: 4000, postcodeRanges, rateRules }).amountSen,
    1200,
  );
});

test("buyer-facing components do not mix Indonesian into Malay copy", () => {
  // Found in a real browser, not by reading source: the checkout trust strip
  // rendered `Harga disahkan` (Malay) beside `Konfirmasi admin` (Indonesian),
  // and the same review step was called `Semakan admin` on the thanks page.
  const surfaces = [
    "src/components/storefront/forms/MalaysiaCheckoutForm.astro",
    "src/pages/thanks.astro",
    "src/data/legal.ts",
  ];
  for (const file of surfaces) {
    assert.doesNotMatch(read(file), /konfirmasi/i, `${file} uses Indonesian "konfirmasi"; Malay is "pengesahan"`);
  }
});

test("canonical checkout exposes one hosted DOKU choice without card fields or provider leakage", () => {
  const checkout = read("src/components/storefront/forms/MalaysiaCheckoutForm.astro");
  const legal = read("src/data/legal.ts");
  const legalPage = read("src/components/storefront/shared/LegalPage.astro");
  const styles = read("src/styles/form-hybrid.css");
  const methods = read("src/pages/api/payment-methods.ts");
  assert.match(checkout, /E-mel untuk pembayaran DOKU/);
  assert.match(checkout, /DOKU menggunakan e-mel dan maklumat pesanan ini untuk menyediakan pembayaran dan resit/);
  assert.match(checkout, /href="\/dasar-privasi#pembayaran-doku" target="_blank" rel="noopener"/);
  assert.match(checkout, /Baca pendedahan privasi DOKU dalam Bahasa Melayu dan bahasa Inggeris \(dibuka dalam tab baharu\)/);
  assert.match(checkout, /aria-describedby=\{`\$\{instanceId\}-doku-helper \$\{instanceId\}-doku-privacy \$\{instanceId\}-doku-disclosure`\}/);
  assert.match(checkout, /meninggalkan kedai ini dan membuka halaman pembayaran DOKU/);
  assert.match(checkout, /navigateToDokuCheckout/);
  assert.match(checkout, /Sambungan ke DOKU tergendala/);
  assert.ok(
    checkout.indexOf("new FormData(form)") < checkout.indexOf("submitting = true; setSubmitState()"),
    "DOKU email must be captured before submit-state disables payment controls",
  );
  assert.match(checkout, /input\.value === 'doku'.*doku-disclosure/s);
  assert.match(legal, /id: 'pembayaran-doku'[\s\S]+title: 'Pembayaran melalui DOKU'[\s\S]+title: 'Payments through DOKU'/);
  assert.match(legal, /Jika anda memilih pembayaran DOKU, \{\{store\}\} menghantar nama, nombor telefon, alamat e-mel, alamat penghantaran, butiran pesanan, jumlah dalam MYR/);
  assert.match(legal, /Pembayaran diselesaikan pada halaman hos DOKU[\s\S]+tidak mengumpul atau menyimpan nombor kad, CVV atau kelayakan perbankan anda/);
  assert.match(legal, /If you choose DOKU payment, \{\{store\}\} sends your name, phone number, email address, delivery address, order details, MYR amount/);
  assert.match(legal, /Payment is completed on DOKU’s hosted page[\s\S]+does not collect or store your card number, CVV, or online-banking credentials/);
  assert.match(legalPage, /id=\{section\.id\}/);
  assert.match(styles, /\.doku-privacy-link[\s\S]+min-height: 44px/);
  assert.match(styles, /\.doku-privacy-link:focus-visible/);
  assert.doesNotMatch(checkout, /name=["'](?:pan|card_number|cvv|cvc)["']/i);
  assert.match(methods, /getEnabledDokuConfig/);
  assert.doesNotMatch(methods, /clientId|apiKey|secretKey|configRevision|environment/);

  for (const route of ["result", "return", "cancel"]) {
    const recovery = read(`src/pages/payment/doku/${route}.astro`);
    assert.match(recovery, /navigateToDokuCheckout/);
    assert.match(recovery, /hidden=\{!payment\.can_reconcile\}/);
    assert.match(recovery, /hidden=\{!payment\.can_retry\}/);
  }
});

test("canonical documents distinguish local DOKU delivery from sandbox and production", () => {
  const prd = read("PRD.md");
  const plan = read("PLAN.md");
  const architecture = read("ARCHITECTURE.md");
  const installation = read("INSTALLATION.md");
  const observability = read("OBSERVABILITY.md");
  const release = read("RELEASE.md");

  assert.match(prd, /conditionally offers DOKU Malaysia hosted Checkout/);
  assert.match(prd, /REQ-220[^\n]+Verified locally 2026-09-01/);
  assert.match(prd, /REQ-226[^\n]+Verified locally 2026-09-02; A-221 sandbox evidence pending/);
  assert.doesNotMatch(prd, /accepted next phase adds optional DOKU/i);
  assert.doesNotMatch(prd, /Partially verified locally through create\/notification/);

  assert.match(plan, /Delivered locally: authoritative DOKU success owns/);
  assert.match(plan, /A-221 owns provider sandbox evidence/);
  assert.match(plan, /Delivered locally: A-220 links the operator-accepted bilingual DOKU/);
  assert.doesNotMatch(plan, /DOKU disclosure pending operator acceptance/);
  assert.doesNotMatch(plan, /## Planned DOKU Malaysia architecture/);

  assert.match(architecture, /`\/full-form` is the only executable checkout/);
  assert.doesNotMatch(architecture, /`\/middle-form` is the short form confirmed by CS/);
  assert.match(installation, /https:\/\/<store-domain>\/api\/payments\/doku\/notifications/);
  assert.match(observability, /currently has no alert endpoint or pager integration/);
  assert.match(release, /### DOKU evidence matrix/);
  assert.match(release, /A local\s+mock PASS cannot fill a sandbox cell/);
  assert.match(release, /linked beside the conditional DOKU email field/);
  assert.match(release, /does\s+not accept proposed REQ-211\/REQ-212/);
});

test("no public API route answers a buyer in Indonesian", () => {
  for (const file of ["shipping-rates.ts", "submit-order.ts", "locations.ts"]) {
    assert.doesNotMatch(
      read(`src/pages/api/${file}`),
      /tidak ditemukan|dihitung|silakan/i,
      `src/pages/api/${file} returns Indonesian to a buyer`,
    );
  }
});

const RETIRED_SLUGS = {
  "kebijakan-privasi": "dasar-privasi",
  "kebijakan-cookie": "dasar-kuki",
  "syarat-ketentuan": "terma-syarat",
  "pengiriman": "penghantaran",
  "kontak": "hubungi-kami",
  "order-status": "jejak-pesanan",
  "landing-page": "halaman",
};

/** A route file is either `pages/<slug>.astro` or `pages/<slug>/index.astro`. */
const readRoute = (slug: string) => {
  try {
    return read(`src/pages/${slug}.astro`);
  } catch {
    return read(`src/pages/${slug}/index.astro`);
  }
};

/** `/api/...` shares these names but is a contract, not public copy. */
const stripApiPaths = (source: string) => source.replace(/\/api\/[\w./-]+/g, "");

test("a retired slug redirects once to its Malay canonical", () => {
  for (const [retired, canonical] of Object.entries(RETIRED_SLUGS)) {
    const stub = read(`src/pages/${retired}.astro`);
    assert.match(stub, /Astro\.redirect\(/, `/${retired} must stay reachable, not 404`);
    assert.match(stub, new RegExp(`/${canonical}\\\$\\{Astro\\.url\\.search\\}`),
      `/${retired} must forward its query string; a dropped gclid breaks ad attribution`);
    assert.match(stub, /, 308\)/, `/${retired} must be a permanent 308, not a 301 or 302`);
    assert.ok(readRoute(canonical).length > 0, `/${canonical} must exist or the redirect 404s`);
  }
});

test("only the Malay address is advertised anywhere", () => {
  const surfaces = [
    "src/components/storefront/shared/SiteFooter.astro",
    "src/data/site.ts",
    "src/pages/sitemap.astro",
    "src/pages/sitemap.xml.ts",
  ];
  for (const file of surfaces) {
    const source = stripApiPaths(read(file));
    for (const retired of Object.keys(RETIRED_SLUGS)) {
      assert.doesNotMatch(source, new RegExp(`/${retired}\\b`),
        `${file} still links /${retired}; a link to a redirect wastes the hop and splits the signal`);
    }
  }
  // Each canonical page must own its own breadcrumb, not the address it replaced.
  for (const [retired, canonical] of Object.entries(RETIRED_SLUGS)) {
    assert.doesNotMatch(stripApiPaths(readRoute(canonical)), new RegExp(`/${retired}\\b`),
      `the /${canonical} route still self-references /${retired}`);
  }
});

test("renaming public slugs did not touch the API or admin contracts", () => {
  // `/order-status` and `/landing-page` became Malay as public addresses only.
  // `/api/order-status` is consumed by the thanks page and the v1 API, and
  // `/admin/landing-pages` is an operator route the Indonesian admin owns.
  // Renaming either would be a silent breaking change, so pin them.
  assert.match(read("src/pages/thanks.astro"), /fetch\('\/api\/order-status'/,
    "the thanks page must still poll /api/order-status");
  assert.match(read("src/pages/jejak-pesanan.astro"), /'\/api\/order-status'/,
    "the status page must still call /api/order-status");
  assert.ok(readdirSync(new URL("../pages/api/", import.meta.url)).includes("order-status.ts"),
    "/api/order-status must still exist");
  assert.match(read("src/lib/auth.ts"), /'\/admin\/landing-pages'/,
    "the admin route policy must still name /admin/landing-pages");
});

test("the cookie policy the privacy page cites is reachable from the footer", () => {
  const footer = read("src/components/storefront/shared/SiteFooter.astro");
  assert.match(read("src/data/legal.ts"), /Dasar Kuki/, "the privacy page cites it");
  assert.match(footer, /\/dasar-kuki/, "a cited legal page reachable only via sitemap.xml is not reachable");
});
