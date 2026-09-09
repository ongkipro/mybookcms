import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CircleAlert,
  CreditCard,
  Database,
  Info,
  History,
  Megaphone,
  RefreshCw,
  ShoppingBag,
  CodeXml,
} from "lucide-react";

/**
 * Read-only view of what the install did between two orders.
 *
 * Everything shown here is already in D1 and already redacted server-side by
 * `src/lib/system-log.ts`. This component adds no interpretation: it groups,
 * filters, and links. It deliberately offers no clear, delete, or export
 * control, because the record is evidence and an operator editing it from the
 * browser would defeat the point.
 */

type Severity = "info" | "warning" | "error";
type Source = "schema" | "ads" | "payment" | "order" | "api" | "audit";

type Entry = {
  source: Source;
  severity: Severity;
  label: string;
  occurred_at: string;
  correlation: string;
  href: string | null;
  actor?: string;
};

type Meta = {
  window_days: number;
  max_entries: number;
  truncated: boolean;
  database_available: boolean;
};

const SOURCE_LABEL: Record<Source, string> = {
  schema: "Database",
  ads: "Ads & Tracking",
  payment: "Pembayaran",
  order: "Pesanan",
  api: "Headless API",
  audit: "Aktivitas sistem",
};

const SOURCE_ICON: Record<Source, typeof Database> = {
  schema: Database,
  ads: Megaphone,
  payment: CreditCard,
  order: ShoppingBag,
  api: CodeXml,
  audit: History,
};

const SEVERITY_ICON: Record<Severity, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  error: CircleAlert,
};

/** Border and text only. Colour never carries the meaning on its own. */
const SEVERITY_STYLE: Record<Severity, string> = {
  info: "border-border text-muted-foreground",
  warning: "border-amber-300 text-amber-700",
  error: "border-rose-300 text-rose-700",
};

const SEVERITY_LABEL: Record<Severity, string> = {
  info: "Info",
  warning: "Perlu diperhatikan",
  error: "Perlu tindakan",
};

const SOURCE_ORDER: Source[] = ["schema", "payment", "order", "ads", "api", "audit"];

function formatWhen(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

export function SystemLogPanel() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [source, setSource] = useState<Source | "all">("all");
  const [onlyAttention, setOnlyAttention] = useState(false);
  const liveRef = useRef<HTMLParagraphElement>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const response = await fetch("/api/admin/system-log", {
        headers: { accept: "application/json" },
      });
      const data = (await response.json()) as {
        success?: boolean;
        error?: string;
        entries?: Entry[];
        meta?: Meta;
      };
      if (!response.ok || !data.success) {
        setState("error");
        setMessage(data.error || "Gagal memuat log sistem.");
        return;
      }
      setEntries(Array.isArray(data.entries) ? data.entries : []);
      setMeta(data.meta ?? null);
      setState("ready");
      setMessage("");
    } catch {
      setState("error");
      setMessage("Tidak dapat menghubungi server. Periksa koneksi lalu muat ulang.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = entries.filter((entry) => {
    if (source !== "all" && entry.source !== source) return false;
    if (onlyAttention && entry.severity === "info") return false;
    return true;
  });

  const counts = entries.reduce<Record<string, number>>((totals, entry) => {
    totals[entry.source] = (totals[entry.source] ?? 0) + 1;
    return totals;
  }, {});
  const attentionCount = entries.filter((entry) => entry.severity !== "info").length;

  return (
    <section className="space-y-4" aria-label="Log sistem">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">
            {state === "ready"
              ? `${entries.length} peristiwa terekam`
              : "Memuat peristiwa sistem"}
          </p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            {meta
              ? `Rentang ${meta.window_days} hari terakhir, maksimum ${meta.max_entries} baris.${
                  meta.truncated ? " Daftar dipotong pada batas tersebut." : ""
                }${meta.database_available ? "" : " Database tidak tersedia, hanya status skema yang dapat dibaca."}`
              : "Hanya baca. Tidak ada peristiwa yang dapat diubah atau dihapus dari sini."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={state === "loading"}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-xs font-bold text-foreground-subtle transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60"
        >
          <RefreshCw
            className={`size-4 ${state === "loading" ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          Muat ulang
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Saring peristiwa">
        <button
          type="button"
          onClick={() => setSource("all")}
          aria-pressed={source === "all"}
          className={`min-h-11 rounded-xl border px-3 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
            source === "all"
              ? "border-blue-600 bg-blue-50 text-blue-700"
              : "border-border bg-card text-slate-600 hover:bg-muted"
          }`}
        >
          Semua ({entries.length})
        </button>
        {SOURCE_ORDER.filter((key) => counts[key]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSource(key)}
            aria-pressed={source === key}
            className={`min-h-11 rounded-xl border px-3 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
              source === key
                ? "border-blue-600 bg-blue-50 text-blue-700"
                : "border-border bg-card text-slate-600 hover:bg-muted"
            }`}
          >
            {SOURCE_LABEL[key]} ({counts[key]})
          </button>
        ))}
        <label className="ml-auto inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-bold text-slate-600 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-600">
          <input
            type="checkbox"
            checked={onlyAttention}
            onChange={(event) => setOnlyAttention(event.target.checked)}
            className="size-4 accent-blue-600 focus-visible:outline-none"
          />
          Hanya yang perlu perhatian ({attentionCount})
        </label>
      </div>

      <p ref={liveRef} role="status" aria-live="polite" className="sr-only">
        {state === "loading"
          ? "Memuat log sistem."
          : state === "error"
            ? message
            : `${visible.length} peristiwa ditampilkan.`}
      </p>

      {state === "loading" && (
        <div className="space-y-2" aria-hidden="true">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      )}

      {state === "error" && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800"
        >
          <p>{message}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-rose-300 bg-card px-4 text-xs font-bold text-rose-800 transition hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
          >
            Coba lagi
          </button>
        </div>
      )}

      {state === "ready" && visible.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm font-bold text-foreground">Tidak ada peristiwa</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
            {entries.length === 0
              ? "Belum ada peristiwa sistem dalam rentang waktu ini. Ini normal untuk instalasi yang baru dijalankan."
              : "Tidak ada peristiwa yang cocok dengan saringan aktif."}
          </p>
        </div>
      )}

      {state === "ready" && visible.length > 0 && (
        <ol className="space-y-2">
          {visible.map((entry, index) => {
            const SourceIcon = SOURCE_ICON[entry.source];
            const SeverityIcon = SEVERITY_ICON[entry.severity];
            return (
              <li
                key={`${entry.source}-${entry.correlation}-${entry.occurred_at}-${index}`}
                className={`rounded-xl border bg-card p-4 ${SEVERITY_STYLE[entry.severity]}`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <SourceIcon
                      className="mt-0.5 size-4 shrink-0 text-slate-400"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-6 text-foreground">
                        {entry.label}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-muted-foreground">
                        <span>{SOURCE_LABEL[entry.source]}</span>
                        <span aria-hidden="true">·</span>
                        <time dateTime={entry.occurred_at}>{formatWhen(entry.occurred_at)}</time>
                        {entry.source === "audit" && entry.actor && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="break-all">Oleh: {entry.actor}</span>
                          </>
                        )}
                        {entry.correlation && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="break-all font-mono">{entry.correlation}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold">
                      <SeverityIcon className="size-3.5" aria-hidden="true" />
                      {SEVERITY_LABEL[entry.severity]}
                    </span>
                    {entry.href && (
                      <a
                        href={entry.href}
                        className="inline-flex min-h-11 items-center rounded-xl px-2 text-xs font-bold text-blue-700 underline underline-offset-2 transition hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:min-h-0 sm:py-1"
                      >
                        Buka
                      </a>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
