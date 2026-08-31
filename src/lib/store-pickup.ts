import {
  MALAYSIA_CUSTOMER_NAME_REGEX,
  MAX_CUSTOMER_NAME_LENGTH,
  MAX_DELIVERY_ADDRESS_LENGTH,
  MIN_CUSTOMER_NAME_LENGTH,
  MIN_DELIVERY_ADDRESS_LENGTH,
  isValidMalaysiaPhone,
  normalizeMalaysiaCustomerName,
  normalizeMalaysiaPhone,
} from "./validation.ts";

/**
 * The merchant's own pickup address — where a courier collects and where a
 * buyer returns a parcel. Operator reference data only: the product has no
 * logistics integration (REQ-180) and nothing is dispatched from here.
 *
 * The same validators the buyer's address uses are reused deliberately. An
 * address the checkout would refuse is not one a courier can find either.
 */
export type StorePickup = Readonly<{
  name: string;
  phone: string;
  address: string;
  postcode: string;
}>;

export type ResolvedStorePickup = StorePickup & Readonly<{ city: string; state: string }>;

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/**
 * All four fields or none. A half-filled pickup address is worse than an empty
 * one: it reads as configured while being undeliverable.
 */
export function validateStorePickup(input: {
  name: unknown; phone: unknown; address: unknown; postcode: unknown;
}): { ok: true; value: StorePickup | null } | { ok: false; error: string } {
  const name = normalizeMalaysiaCustomerName(text(input.name));
  const phone = normalizeMalaysiaPhone(text(input.phone));
  const address = text(input.address).replace(/\s+/gu, " ");
  const postcode = text(input.postcode);

  const filled = [name, phone, address, postcode].filter(Boolean).length;
  if (filled === 0) return { ok: true, value: null };
  if (filled < 4) {
    return { ok: false, error: "Alamat pickup harus lengkap: nama, telepon, alamat, dan kode pos." };
  }
  if (name.length < MIN_CUSTOMER_NAME_LENGTH || name.length > MAX_CUSTOMER_NAME_LENGTH ||
      !MALAYSIA_CUSTOMER_NAME_REGEX.test(name)) {
    return { ok: false, error: "Nama kontak pickup tidak valid." };
  }
  if (!isValidMalaysiaPhone(phone)) {
    return { ok: false, error: "Nomor telepon pickup harus nomor Malaysia yang sah." };
  }
  if (address.length < MIN_DELIVERY_ADDRESS_LENGTH || address.length > MAX_DELIVERY_ADDRESS_LENGTH) {
    return { ok: false, error: "Alamat pickup terlalu pendek atau terlalu panjang." };
  }
  if (!/^\d{5}$/.test(postcode)) {
    return { ok: false, error: "Kode pos pickup harus lima digit." };
  }
  return { ok: true, value: Object.freeze({ name, phone, address, postcode }) };
}

/**
 * City and state are never stored. Resolving them from the postcode directory
 * on read means a stored city can never disagree with its own postcode.
 */
export async function resolveStorePickup(
  database: D1Database,
  pickup: StorePickup,
): Promise<ResolvedStorePickup | null> {
  const row = await database.prepare(`
    SELECT city, state FROM malaysia_postcodes WHERE postcode = ? ORDER BY id LIMIT 1
  `).bind(pickup.postcode).first<{ city: string; state: string }>();
  if (!row) return null;
  return Object.freeze({ ...pickup, city: row.city, state: row.state });
}
