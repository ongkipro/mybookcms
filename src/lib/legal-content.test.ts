import assert from "node:assert/strict";
import test from "node:test";
import { getTenantLegalPage, legalPages } from "../data/legal.ts";

test("contact content never invents an unconfigured support channel", () => {
  const page = getTenantLegalPage("contact", "Example Store");
  const content = JSON.stringify(page);

  assert.match(content, /belum menerbitkan maklumat customer service/i);
  assert.doesNotMatch(content, /\{\{whatsapp\}\}/);
  assert.doesNotMatch(content, /WhatsApp CS:/);
});

test("contact content renders the configured support channel", () => {
  const page = getTenantLegalPage("contact", "Example Store", {
    supportWhatsapp: "+60123456789",
  });
  const content = JSON.stringify(page);

  assert.match(content, /WhatsApp CS: \+60123456789/);
  assert.doesNotMatch(content, /belum mempublikasikan/i);
});

test("default legal content avoids unsupported guarantees", () => {
  const content = JSON.stringify(legalPages);

  assert.doesNotMatch(
    content,
    /PCI-DSS|tidak pernah menjual|90 hari|1-2 hari kerja|2-5 hari kerja|retur dalam waktu 7 hari/i,
  );
});
