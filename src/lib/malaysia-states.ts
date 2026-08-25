export const MALAYSIA_STATES = [
  { code: "johor", name: "Johor", sourceName: "Johor", zoneCode: "peninsular" },
  { code: "kedah", name: "Kedah", sourceName: "Kedah", zoneCode: "peninsular" },
  { code: "kelantan", name: "Kelantan", sourceName: "Kelantan", zoneCode: "peninsular" },
  { code: "melaka", name: "Melaka", sourceName: "Melaka", zoneCode: "peninsular" },
  { code: "negeri_sembilan", name: "Negeri Sembilan", sourceName: "Negeri Sembilan", zoneCode: "peninsular" },
  { code: "pahang", name: "Pahang", sourceName: "Pahang", zoneCode: "peninsular" },
  { code: "perak", name: "Perak", sourceName: "Perak", zoneCode: "peninsular" },
  { code: "perlis", name: "Perlis", sourceName: "Perlis", zoneCode: "peninsular" },
  { code: "pulau_pinang", name: "Pulau Pinang", sourceName: "Pulau Pinang", zoneCode: "peninsular" },
  { code: "sabah", name: "Sabah", sourceName: "Sabah", zoneCode: "sabah" },
  { code: "sarawak", name: "Sarawak", sourceName: "Sarawak", zoneCode: "sarawak" },
  { code: "selangor", name: "Selangor", sourceName: "Selangor", zoneCode: "peninsular" },
  { code: "terengganu", name: "Terengganu", sourceName: "Terengganu", zoneCode: "peninsular" },
  { code: "kuala_lumpur", name: "W.P. Kuala Lumpur", sourceName: "W.P. Kuala Lumpur", zoneCode: "peninsular" },
  { code: "putrajaya", name: "W.P. Putrajaya", sourceName: "W.P. Putrajaya", zoneCode: "peninsular" },
  { code: "labuan", name: "W.P. Labuan", sourceName: "W.P. Labuan", zoneCode: "labuan" },
] as const;

export type MalaysiaStateCode = typeof MALAYSIA_STATES[number]["code"];

export function malaysiaStateCode(sourceName: string): MalaysiaStateCode | null {
  const normalized = sourceName.trim();
  return MALAYSIA_STATES.find((state) => state.sourceName === normalized)?.code ?? null;
}
