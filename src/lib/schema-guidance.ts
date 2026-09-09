import type { SchemaVersionState } from "./schema-version.ts";

/**
 * A-271. `getSchemaVersionStatus` computes what is wrong; this says what an
 * operator should do about it. Kept out of the page so it can be asserted, and
 * out of `schema-version.ts` so operator copy does not sit inside the upgrade
 * logic.
 *
 * The guidance is deliberately narrow. The admin exposes no migration controls
 * and A-271 does not add any, so every action below is either "carry on" or
 * "this needs a deployment or a person with database access". Telling an
 * operator to do something the admin cannot do is the failure this surface
 * exists to prevent — it is why the log entry pointed nowhere until now.
 */
export type SchemaGuidance = {
  /** One line naming the condition, for the page heading. */
  headline: string;
  /** What it means, in the operator's terms rather than the migrator's. */
  meaning: string;
  /** The next action. Never an action the admin cannot perform. */
  action: string;
  /** Whether orders and payments can be trusted while this holds. */
  safeToOperate: boolean;
};

const GUIDANCE: Readonly<Record<SchemaVersionState, SchemaGuidance>> = {
  match: {
    headline: "Skema database sepadan",
    meaning: "Versi yang dijangka kod dan versi yang terpasang di database adalah sama.",
    action: "Tiada tindakan diperlukan.",
    safeToOperate: true,
  },
  "database-behind": {
    headline: "Database ketinggalan daripada kod",
    meaning:
      "Kod menjangka versi skema yang lebih baharu daripada yang terpasang. Migrasi belum dijalankan pada install ini.",
    action:
      "Jalankan migrasi ke hadapan pada install ini, kemudian muat semula halaman ini. Admin tidak menjalankan migrasi — ini perlu akses deployment.",
    safeToOperate: false,
  },
  "database-ahead": {
    headline: "Database lebih baharu daripada kod",
    meaning:
      "Database membawa versi skema yang lebih tinggi daripada kod yang sedang berjalan. Biasanya bermakna revisi lama telah di-deploy semula selepas migrasi.",
    action:
      "Deploy semula revisi kod yang sepadan dengan database. Jangan turunkan versi database — migrasi ke hadapan sahaja.",
    safeToOperate: false,
  },
  "history-invalid": {
    headline: "Rantaian migrasi tidak sah",
    meaning:
      "Rekod migrasi dalam database tidak sepadan dengan rantaian yang dibawa kod. Satu migrasi mungkin telah dipadam, dinamakan semula, atau dijalankan di luar urutan.",
    action:
      "Jangan jalankan migrasi lagi sehingga rekod diperiksa oleh seseorang yang mempunyai akses database. Menjalankan lagi boleh menggandakan perubahan yang sudah dipakai.",
    safeToOperate: false,
  },
  "upgrade-failed": {
    headline: "Migrasi gagal dijalankan",
    meaning:
      "Percubaan menaik taraf skema bermula tetapi tidak selesai. Sebahagian perubahan mungkin sudah dipakai.",
    action:
      "Semak log deployment untuk kegagalan sebenar sebelum mencuba lagi. Kod pada halaman ini menamakan kelas ralatnya; punca penuh ada pada log deployment.",
    safeToOperate: false,
  },
  unknown: {
    headline: "Keadaan skema tidak dapat dibaca",
    meaning:
      "Versi terpasang tidak dapat dibaca — biasanya kerana binding database tiada atau bacaan gagal.",
    action:
      "Sahkan install ini terikat pada database yang betul. Sehingga bacaan berjaya, tiada dakwaan boleh dibuat tentang keadaan skema.",
    safeToOperate: false,
  },
};

export function schemaGuidance(state: SchemaVersionState): SchemaGuidance {
  return GUIDANCE[state] ?? GUIDANCE.unknown;
}

/** Where the `schema` system-log entry sends an operator. */
export const SCHEMA_STATUS_HREF = "/admin/settings/schema";
