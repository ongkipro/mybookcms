export const SELLER_BANK_OPTIONS = [
  { code: "MAYBANK", label: "Maybank", asset: "" },
  { code: "CIMB", label: "CIMB Bank", asset: "" },
  { code: "PUBLIC_BANK", label: "Public Bank", asset: "" },
  { code: "RHB", label: "RHB Bank", asset: "" },
  { code: "HONG_LEONG", label: "Hong Leong Bank", asset: "" },
  { code: "AMBANK", label: "AmBank", asset: "" },
  { code: "BANK_ISLAM", label: "Bank Islam", asset: "" },
  { code: "BSN", label: "Bank Simpanan Nasional", asset: "" },
  { code: "ALLIANCE", label: "Alliance Bank", asset: "" },
] as const;

export type SellerBankCode = (typeof SELLER_BANK_OPTIONS)[number]["code"];

const PAYMENT_ASSETS: Record<string, string> = Object.fromEntries([
  ...SELLER_BANK_OPTIONS.map(({ code, asset }) => [code, asset]),
  ["COD", "/images/payment/cod.webp"],
]);

export function normalizePaymentBrandCode(channel: string) {
  const normalized = String(channel || "").trim().toUpperCase();
  return normalized;
}

export function paymentBrandAsset(channel: string) {
  return PAYMENT_ASSETS[normalizePaymentBrandCode(channel)] || "";
}

export function paymentBrandLabel(channel: string) {
  const code = normalizePaymentBrandCode(channel);
  return SELLER_BANK_OPTIONS.find((bank) => bank.code === code)?.label || code;
}

export function isSellerBankCode(value: unknown): value is SellerBankCode {
  return SELLER_BANK_OPTIONS.some((bank) => bank.code === value);
}
