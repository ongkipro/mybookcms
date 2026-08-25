export function normalizeMetaText(value?: string) {
  const clean = String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return clean || undefined;
}

export function malaysiaPhoneDigits(value?: string) {
  let digits = String(value || "").replace(/\D/g, "");
  if (!digits) return undefined;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("600")) digits = `60${digits.slice(3)}`;
  else if (digits.startsWith("0")) digits = `60${digits.slice(1)}`;
  else if (digits.startsWith("1")) digits = `60${digits}`;
  return digits.startsWith("60") && digits.length >= 10 && digits.length <= 12
    ? digits
    : undefined;
}

export function metaNameParts(value?: string) {
  const parts = String(value || "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: normalizeMetaText(parts[0]),
    lastName: parts.length > 1 ? normalizeMetaText(parts.slice(1).join("")) : undefined,
  };
}
