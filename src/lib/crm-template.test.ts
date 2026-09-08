import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWaUrl,
  defaultCrmTemplates,
  parseCrmTemplates,
  renderCrmMessage,
} from "./crm-template.ts";

const context = {
  customerName: "Aisyah",
  customerPhone: "012-345 6789",
  address: "12 Jalan Ampang",
  district: "Kuala Lumpur",
  city: "Kuala Lumpur",
  province: "Wilayah Persekutuan Kuala Lumpur",
  postalCode: "50450",
  orderNumber: "INV-10001",
  productName: "Jurnal Fokus Harian",
  productPrice: 2_000,
  shippingCost: 650,
  totalAmount: 2_650,
  sellerName: "MyBookCMS Malaysia",
  bankAccounts: "Maybank 114012345678 a.n. MyBookCMS Malaysia",
  epaymentLink: "https://shop.example/payment/INV-10001",
  orderDetailsLink: "https://shop.example/orders/INV-10001",
};

test("renders canonical Malaysia CRM variables in MYR", () => {
  const rendered = renderCrmMessage(
    "{{name}}|{{phone}}|{{full_address}}|{{shipping_cost}}|{{total_price}}",
    context,
  );
  assert.equal(
    rendered,
    "Aisyah|012-345 6789|12 Jalan Ampang, Kuala Lumpur, Kuala Lumpur, Wilayah Persekutuan Kuala Lumpur, 50450|RM\u00a06.50|RM\u00a026.50",
  );
});

test("builds a WhatsApp URL from a formatted Malaysia phone number", () => {
  const url = new URL(buildWaUrl(context.customerPhone, "Hai Aisyah"));
  assert.equal(url.origin, "https://wa.me");
  assert.equal(url.pathname, "/60123456789");
  assert.equal(url.searchParams.get("text"), "Hai Aisyah");
});

test("stored CRM templates fail closed to the Malay defaults", () => {
  const parsed = parseCrmTemplates(JSON.stringify({ welcome: "  Hai dari kedai  ", 1: 42 }));
  assert.equal(parsed.welcome, "Hai dari kedai");
  assert.equal(parsed[1], defaultCrmTemplates[1]);
  assert.deepEqual(parseCrmTemplates("{broken"), defaultCrmTemplates);
});

test("default welcome and redirect copy render without unresolved canonical fields", () => {
  const welcome = renderCrmMessage(defaultCrmTemplates.welcome, context);
  assert.match(welcome, /Hai Aisyah/);
  assert.match(welcome, /Jurnal Fokus Harian/);
  assert.match(welcome, /RM\s*20\.00/);
  assert.match(welcome, /RM\s*26\.50/);
  assert.doesNotMatch(welcome, /{{/);

  assert.equal(
    renderCrmMessage(defaultCrmTemplates.redirect, context),
    "Hai, saya telah membuat pesanan Jurnal Fokus Harian atas nama Aisyah. Sila semak butiran pesanan saya.",
  );
});

test("all operator-exposed placeholders render and preserve normalized text", () => {
  const template = [
    "{{name}}", "{{phone}}", "{{product_name}}", "{{product_price}}",
    "{{shipping_cost}}", "{{shipping_cost_cod_cost}}", "{{total_price}}",
    "{{address}}", "{{district}}", "{{city}}", "{{bank_accounts}}",
    "{{epayment_link}}", "{{seller_name}}", "{{receipt_number}}",
    "{{order_details_link}}", "📦 Cafe\u0301 😊",
  ].join("|");
  const rendered = renderCrmMessage(template, context);
  assert.doesNotMatch(rendered, /{{/);
  assert.match(rendered, /Maybank/);
  assert.match(rendered, /isi manual di WhatsApp/);
  assert.match(rendered, /📦 Café 😊/);
  assert.equal(rendered, rendered.normalize("NFC"));
});
test('variant token renders independently without changing legacy product text', () => {
  assert.equal(renderCrmMessage('{{product_name}} / {{variant_name}}', {productName:'Fixture Book - A5',variantName:'A5'}), 'Fixture Book - A5 / A5');
  assert.equal(renderCrmMessage('{{variant_name}}', {}), '');
});
