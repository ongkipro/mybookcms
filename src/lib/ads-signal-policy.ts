export function myrMajorFromSen(value: number) {
  return Math.round(Number(value || 0)) / 100;
}

// Owner-approved advertising rate; commerce and catalog prices remain MYR.
export const ADS_CURRENCY = "IDR";
export const ADS_IDR_PER_MYR = 4100;

export function adsValueFromMyr(value: number) {
  return Math.round(value * 100) * (ADS_IDR_PER_MYR / 100);
}
