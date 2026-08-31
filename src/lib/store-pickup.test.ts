import assert from "node:assert/strict";
import test from "node:test";
import { validateStorePickup } from "./store-pickup.ts";

// Deliberately fictional. A real merchant's pickup address is a named person's
// home address and live mobile number; it belongs in the operator's database,
// never in a fixture that ships with the source.
const complete = {
  name: "Aminah binti Contoh",
  phone: "(+60)1110000000",
  address: "1, Jalan Contoh 1/1, Taman Ujian, Selangor",
  postcode: "47000",
};

test("a complete pickup address normalizes the way a buyer address does", () => {
  const result = validateStorePickup(complete);
  assert.ok(result.ok && result.value);
  assert.equal(result.value.phone, "601110000000", "the phone is stored in one canonical form");
  assert.equal(result.value.postcode, "47000");
  assert.equal(result.value.name, "Aminah binti Contoh");
});

test("an empty pickup address is allowed; a half-filled one is not", () => {
  const empty = validateStorePickup({ name: "", phone: "", address: "", postcode: "" });
  assert.ok(empty.ok && empty.value === null, "clearing every field must stay valid");

  // A partly-filled address reads as configured while being undeliverable,
  // which is worse than none at all.
  for (const missing of ["name", "phone", "address", "postcode"] as const) {
    const result = validateStorePickup({ ...complete, [missing]: "" });
    assert.ok(!result.ok, `a pickup address missing ${missing} must be refused`);
    assert.match(result.error, /lengkap/);
  }
});

test("each field is refused on its own terms, not just on presence", () => {
  const cases: Array<[Partial<typeof complete>, RegExp]> = [
    [{ phone: "081234567890" }, /Malaysia/],        // Indonesian mobile
    [{ phone: "60123" }, /Malaysia/],               // too short
    [{ postcode: "4700" }, /lima digit/],           // four digits
    [{ postcode: "4700a" }, /lima digit/],
    [{ name: "Nur 123" }, /Nama kontak/],           // digits are not a name
    [{ name: "N" }, /Nama kontak/],
    [{ address: "Jln 1" }, /pendek|panjang/],       // below the address floor
  ];
  for (const [override, expected] of cases) {
    const result = validateStorePickup({ ...complete, ...override });
    assert.ok(!result.ok, `${JSON.stringify(override)} must be refused`);
    assert.match(result.error, expected);
  }
});

test("the stored value is frozen so a caller cannot mutate shared config", () => {
  const result = validateStorePickup(complete);
  assert.ok(result.ok && result.value);
  assert.throws(() => { (result.value as { postcode: string }).postcode = "99999"; });
});
