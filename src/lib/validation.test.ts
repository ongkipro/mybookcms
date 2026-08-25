import assert from "node:assert/strict";
import test from "node:test";
import { orderSubmitSchema } from "./order-schema.ts";
import {
  isValidMalaysiaCustomerName,
  isValidMalaysiaDeliveryAddress,
  isValidMalaysiaPhone,
  normalizeMalaysiaCustomerName,
  normalizeMalaysiaDeliveryAddress,
  normalizeMalaysiaPhone,
} from "./validation.ts";

const ORDER = {
  customer_name: "Aisyah Rahman",
  address: "12 Jalan Tun Razak, Kuala Lumpur",
  district: "Kuala Lumpur",
  province: "Wilayah Persekutuan Kuala Lumpur",
  postal_code: "50400",
  payment_method: "cod" as const,
  variant_id: "10001",
  quantity: 1,
  submit_token: "0123456789abcdef0123",
};

test("Malaysia mobile formats normalize to one 60-prefixed value", () => {
  for (const typed of ["0123456789", "+60 12-345 6789", "60123456789", "0060123456789"]) {
    const parsed = orderSubmitSchema.safeParse({ ...ORDER, customer_phone: typed });
    assert.ok(parsed.success, `checkout rejected ${typed}`);
    assert.equal(parsed.data.customer_phone, "60123456789");
  }
});

test("non-Malaysia and malformed phone numbers fail closed", () => {
  for (const typed of ["91234567", "+65 9123 4567", "011", "abcdefgh", "6012345678901"]) {
    assert.equal(orderSubmitSchema.safeParse({ ...ORDER, customer_phone: typed }).success, false);
  }
});

test("manual transfer requires a seller bank account", () => {
  const withoutBank = orderSubmitSchema.safeParse({
    ...ORDER,
    customer_phone: "0123456789",
    payment_method: "manual_transfer",
  });
  assert.equal(withoutBank.success, false);
  const withBank = orderSubmitSchema.safeParse({
    ...ORDER,
    customer_phone: "0123456789",
    payment_method: "manual_transfer",
    seller_bank_account_id: 1,
  });
  assert.equal(withBank.success, true);
});

test("phone helper accepts only normalized Malaysia mobile values", () => {
  assert.equal(normalizeMalaysiaPhone("011-2345 6789"), "601123456789");
  assert.equal(isValidMalaysiaPhone("601123456789"), true);
  assert.equal(isValidMalaysiaPhone("6591234567"), false);
});

test("Malaysia customer names accept human punctuation but reject digits", () => {
  assert.equal(normalizeMalaysiaCustomerName("  Nur   Aisyah  "), "Nur Aisyah");
  for (const name of ["Nur Aisyah binti O'Neill", "Siti Nur-Ain", "Nūr ‘Aisyah’"]) {
    assert.equal(isValidMalaysiaCustomerName(name), true, `name rejected: ${name}`);
  }
  for (const name of ["A", "Nur Aisyah 2", "---", "Aisyah@email"]) {
    assert.equal(isValidMalaysiaCustomerName(name), false, `name accepted: ${name}`);
  }
});

test("delivery address is normalized, bounded, and must contain letters", () => {
  assert.equal(normalizeMalaysiaDeliveryAddress("  No. 12   Jalan Ampang  "), "No. 12 Jalan Ampang");
  assert.equal(isValidMalaysiaDeliveryAddress("No. 12, Jalan Ampang, Kuala Lumpur"), true);
  assert.equal(isValidMalaysiaDeliveryAddress("1234567890"), false);
  assert.equal(isValidMalaysiaDeliveryAddress("Jalan 1"), false);
});
