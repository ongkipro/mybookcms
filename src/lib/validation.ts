export function sanitize(value: unknown) {
  return String(value || "").trim();
}

export function toPositiveInt(value: unknown, fallback = 0) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : fallback;
}

export function inEnum<T extends string>(value: string, allowed: T[], fallback: T): T {
  return (allowed.includes(value as T) ? value : fallback) as T;
}

export function requireNonEmptyString(value: string, min = 1, max = 255) {
  return value.trim().length >= min && value.trim().length <= max;
}

/** Malaysian mobile numbers normalized to country-code digits: 60 + 1 + 8–9 digits. */
export const MALAYSIA_MOBILE_REGEX = /^601\d{8,9}$/;
export const MIN_CUSTOMER_NAME_LENGTH = 2;
export const MAX_CUSTOMER_NAME_LENGTH = 100;
export const MIN_DELIVERY_ADDRESS_LENGTH = 10;
export const MAX_DELIVERY_ADDRESS_LENGTH = 500;
export const MALAYSIA_CUSTOMER_NAME_REGEX =
  /^[\p{L}\p{M}][\p{L}\p{M}\s.'‘’-]*$/u;

export function isValidMalaysiaPhone(value: string) {
  return MALAYSIA_MOBILE_REGEX.test(value);
}

export function normalizeMalaysiaPhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("600")) return `60${digits.slice(3)}`;
  if (digits.startsWith("0")) return `60${digits.slice(1)}`;
  if (digits.startsWith("1")) return `60${digits}`;
  return digits;
}

export function normalizeMalaysiaCustomerName(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

export function isValidMalaysiaCustomerName(value: string) {
  const normalized = normalizeMalaysiaCustomerName(value);
  return normalized.length >= MIN_CUSTOMER_NAME_LENGTH &&
    normalized.length <= MAX_CUSTOMER_NAME_LENGTH &&
    MALAYSIA_CUSTOMER_NAME_REGEX.test(normalized);
}

export function normalizeMalaysiaDeliveryAddress(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

export function isValidMalaysiaDeliveryAddress(value: string) {
  const normalized = normalizeMalaysiaDeliveryAddress(value);
  return normalized.length >= MIN_DELIVERY_ADDRESS_LENGTH &&
    normalized.length <= MAX_DELIVERY_ADDRESS_LENGTH &&
    /\p{L}/u.test(normalized);
}
