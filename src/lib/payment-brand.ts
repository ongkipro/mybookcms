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
  { code: "BANK_RAKYAT", label: "Bank Rakyat", asset: "" },
  { code: "AFFIN", label: "Affin Bank", asset: "" },
  { code: "BANK_MUAMALAT", label: "Bank Muamalat", asset: "" },
  { code: "AGROBANK", label: "Agrobank", asset: "" },
  { code: "MBSB", label: "MBSB Bank", asset: "" },
] as const;

export type SellerBankCode = (typeof SELLER_BANK_OPTIONS)[number]["code"];

export const DOKU_CHANNEL_LABELS = {
  INTERNET_BANKING_FPX: "FPX",
  EWALLET_TNG: "Touch 'n Go",
  EWALLET_GRABPAY: "GrabPay",
  EWALLET_SHOPEEPAY: "ShopeePay",
  CREDIT_CARD: "Kad kredit/debit",
} as const;

export function dokuChannelLabel(channel: string) {
  return DOKU_CHANNEL_LABELS[channel as keyof typeof DOKU_CHANNEL_LABELS] || "";
}

export function buildDokuPaymentMethod(channels: readonly string[]) {
  const publicChannels = channels
    .map((code) => ({ code, label: dokuChannelLabel(code) }))
    .filter((channel) => channel.label);
  if (!publicChannels.length) return null;
  return {
    code: "DOKU",
    payment_method: "doku",
    name: "Bayaran dalam talian",
    logo_url: "",
    description: "Bayar pada halaman selamat.",
    is_active: true,
    requires_email: true,
    hosted_redirect: true,
    channels: publicChannels,
  } as const;
}

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
