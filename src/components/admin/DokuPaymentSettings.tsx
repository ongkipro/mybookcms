import { useEffect, useRef, useState, type SubmitEvent } from "react";
import { Check, Clipboard, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";

const CHANNELS = [
  ["INTERNET_BANKING_FPX", "FPX Online Banking"],
  ["EWALLET_TNG", "Touch 'n Go eWallet"],
  ["EWALLET_GRABPAY", "GrabPay"],
  ["EWALLET_SHOPEEPAY", "ShopeePay"],
  ["CREDIT_CARD", "Kartu kredit/debit"],
] as const;

type Environment = "sandbox" | "production";
type Channel = (typeof CHANNELS)[number][0];
type ConfigStatus = {
  source: "none" | "database";
  health: "missing" | "ready" | "invalid";
  environment: Environment | null;
  configured: boolean;
  enabled: boolean;
  clientIdMasked: string;
  apiKeyMasked: string;
  secretKeyMasked: string;
  enabledChannels: Channel[];
  configRevision: number | null;
  notificationUrl: string | null;
};
type FormErrors = Partial<Record<"clientId" | "apiKey" | "secretKey" | "channels", string>>;
type ConfirmAction = "replace" | "enable" | "disable" | "delete" | null;

const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,255}$/;
const CREDENTIAL_PATTERN = /^[\x21-\x7E]{8,512}$/;

const emptyStatus: ConfigStatus = {
  source: "none",
  health: "missing",
  environment: null,
  configured: false,
  enabled: false,
  clientIdMasked: "",
  apiKeyMasked: "",
  secretKeyMasked: "",
  enabledChannels: [],
  configRevision: null,
  notificationUrl: null,
};

function statusPresentation(status: ConfigStatus) {
  if (status.health === "invalid") {
    return {
      label: "Konfigurasi tidak valid",
      detail: "Ganti seluruh kredensial atau hapus konfigurasi sebelum mengaktifkan DOKU.",
      tone: "border-rose-200 bg-rose-50 text-rose-900",
    };
  }
  if (status.health === "missing") {
    return {
      label: "Belum dikonfigurasi",
      detail: "Simpan satu draft lengkap. Draft baru selalu nonaktif dan tidak menghubungi DOKU.",
      tone: "border-slate-200 bg-slate-50 text-slate-800",
    };
  }
  if (status.enabled) {
    return {
      label: status.environment === "production" ? "Production aktif" : "Sandbox aktif",
      detail: "DOKU tersedia untuk checkout baru sesuai channel yang dipilih.",
      tone: status.environment === "production"
        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
        : "border-blue-200 bg-blue-50 text-blue-900",
    };
  }
  return {
    label: status.environment === "production"
      ? "Draft production tersimpan"
      : "Draft sandbox tersimpan",
    detail: "Periksa environment dan channel, lalu aktifkan secara eksplisit bila instalasi sudah disetujui.",
    tone: "border-amber-200 bg-amber-50 text-amber-950",
  };
}

export default function DokuPaymentSettings() {
  const [status, setStatus] = useState<ConfigStatus>(emptyStatus);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"load" | "save" | "state" | "delete" | "copy" | null>("load");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [environment, setEnvironment] = useState<Environment>("sandbox");
  const [clientId, setClientId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [channels, setChannels] = useState<Channel[]>(["INTERNET_BANKING_FPX"]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [dirty, setDirty] = useState(false);
  const errorSummary = useRef<HTMLDivElement>(null);

  const applyStatus = (next: ConfigStatus) => {
    setStatus(next);
    setEnvironment(next.environment ?? "sandbox");
    setChannels(next.enabledChannels.length ? next.enabledChannels : ["INTERNET_BANKING_FPX"]);
  };

  const request = async (method: "GET" | "PUT" | "PATCH" | "DELETE", body?: unknown) => {
    const response = await fetch("/api/admin/payments", {
      method,
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Sesi atau akses tidak valid. Muat ulang halaman untuk masuk kembali.");
      }
      throw new Error(payload.error || "Konfigurasi DOKU gagal diproses.");
    }
    if (payload.data) applyStatus(payload.data as ConfigStatus);
    return String(payload.message || "");
  };

  const load = async () => {
    setBusy("load");
    setLoadError("");
    try {
      await request("GET");
    } catch (caught) {
      setLoadError(caught instanceof Error ? caught.message : "Status DOKU tidak dapat dimuat.");
    } finally {
      setLoading(false);
      setBusy(null);
    }
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (error) errorSummary.current?.focus();
  }, [error]);

  const clearSecrets = () => {
    setClientId("");
    setApiKey("");
    setSecretKey("");
    setDirty(false);
    setErrors({});
  };

  const validate = () => {
    const next: FormErrors = {};
    if (!CLIENT_ID_PATTERN.test(clientId.trim())) {
      next.clientId = "Gunakan 1–255 huruf, angka, garis bawah, atau tanda hubung.";
    }
    if (!CREDENTIAL_PATTERN.test(apiKey.trim()) || apiKey.includes(":")) {
      next.apiKey = "Gunakan 8–512 karakter tanpa spasi atau titik dua.";
    }
    if (!CREDENTIAL_PATTERN.test(secretKey.trim()) || secretKey.includes(":")) {
      next.secretKey = "Gunakan 8–512 karakter tanpa spasi atau titik dua.";
    }
    if (channels.length === 0) next.channels = "Pilih minimal satu channel pembayaran.";
    setErrors(next);
    if (Object.keys(next).length) {
      setError("Periksa kembali field konfigurasi yang ditandai.");
      requestAnimationFrame(() => errorSummary.current?.focus());
      return false;
    }
    return true;
  };

  const save = async () => {
    setBusy("save");
    setError("");
    setMessage("");
    try {
      const success = await request("PUT", {
        environment,
        client_id: clientId.trim(),
        api_key: apiKey.trim(),
        secret_key: secretKey.trim(),
        enabled_channels: channels,
        expected_revision: status.configRevision,
      });
      clearSecrets();
      setMessage(success || "Draft DOKU tersimpan dalam keadaan nonaktif.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Draft DOKU gagal disimpan.");
      requestAnimationFrame(() => errorSummary.current?.focus());
    } finally {
      setBusy(null);
      setConfirmAction(null);
    }
  };

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setError("");
    if (!validate()) return;
    if (status.configured) setConfirmAction("replace");
    else void save();
  };

  const changeState = async (enabled: boolean) => {
    if (!status.configRevision) return;
    setBusy("state");
    setError("");
    setMessage("");
    try {
      const success = await request("PATCH", {
        action: enabled ? "enable" : "disable",
        expected_revision: status.configRevision,
      });
      setMessage(success);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Status DOKU gagal diperbarui.");
      requestAnimationFrame(() => errorSummary.current?.focus());
    } finally {
      setBusy(null);
      setConfirmAction(null);
    }
  };

  const remove = async () => {
    if (!status.configRevision) return;
    setBusy("delete");
    setError("");
    setMessage("");
    try {
      const success = await request("DELETE", { expected_revision: status.configRevision });
      clearSecrets();
      setMessage(success);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Kredensial DOKU gagal dihapus.");
      requestAnimationFrame(() => errorSummary.current?.focus());
    } finally {
      setBusy(null);
      setConfirmAction(null);
    }
  };

  const copyNotificationUrl = async () => {
    if (!status.notificationUrl) return;
    setBusy("copy");
    try {
      await navigator.clipboard.writeText(status.notificationUrl);
      setMessage("URL webhook disalin.");
      setError("");
    } catch {
      setError("URL webhook gagal disalin. Salin nilai secara manual.");
    } finally {
      setBusy(null);
    }
  };

  const toggleChannel = (channel: Channel, checked: boolean) => {
    setDirty(true);
    setChannels((current) => checked
      ? [...new Set([...current, channel])]
      : current.filter((item) => item !== channel));
    setErrors((current) => ({ ...current, channels: undefined }));
  };

  const presentation = statusPresentation(status);
  const conflictsDisabled = busy !== null;
  const channelNames = status.enabledChannels
    .map((value) => CHANNELS.find(([key]) => key === value)?.[1] ?? value)
    .join(", ");

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" aria-labelledby="doku-settings-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="doku-settings-heading" className="text-lg font-bold text-slate-950">DOKU Malaysia</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">Hosted payment untuk FPX, eWallet, dan kartu. Konfigurasi ini berlaku untuk satu store.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-bold" aria-label="Status konfigurasi">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{status.environment === "production" ? "Production" : "Sandbox"}</span>
          <span className={`rounded-full px-2.5 py-1 ${status.enabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>{status.enabled ? "Aktif" : "Nonaktif"}</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">Revisi {status.configRevision ?? "—"}</span>
        </div>
      </div>

      {loading ? (
        <div className="mt-5 grid grid-cols-1 gap-3" aria-label="Memuat konfigurasi DOKU">
          <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-11 animate-pulse rounded-lg bg-slate-100" />
        </div>
      ) : loadError ? (
        <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900" role="alert" tabIndex={-1}>
          <p className="font-bold">Status DOKU tidak dapat dimuat</p>
          <p className="mt-1">{loadError}</p>
          <Button type="button" variant="outline" size="xl" className="mt-3 w-full sm:w-auto" onClick={() => void load()}>Coba lagi</Button>
        </div>
      ) : (
        <>
          <div className={`mt-5 rounded-lg border p-4 text-sm ${presentation.tone}`}>
            <p className="font-bold">{presentation.label}</p>
            <p className="mt-1 leading-5">{presentation.detail}</p>
          </div>

          {(error || message) && (
            <div
              ref={errorSummary}
              className={`mt-4 rounded-lg border p-3 text-sm ${error ? "border-rose-200 bg-rose-50 text-rose-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}
              role={error ? "alert" : "status"}
              tabIndex={error ? -1 : undefined}
            >
              {error || message}
              {error && Object.entries(errors).map(([field, text]) => text && (
                <a key={field} className="mt-1 block font-semibold underline" href={`#doku-${field}`}>{text}</a>
              ))}
            </div>
          )}

          <div className="mt-5 space-y-2">
            <label htmlFor="doku-notification-url" className="block text-sm font-bold text-slate-800">URL notifikasi DOKU</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <Input id="doku-notification-url" className="h-11 min-w-0 font-mono text-xs" readOnly value={status.notificationUrl ?? "URL situs HTTPS diperlukan sebelum webhook dapat digunakan"} />
              <Button type="button" variant="outline" size="xl" className="w-full sm:w-auto" disabled={!status.notificationUrl || conflictsDisabled} onClick={() => void copyNotificationUrl()}>
                {busy === "copy" ? <Check /> : <Clipboard />} {busy === "copy" ? "Disalin" : "Salin URL webhook"}
              </Button>
            </div>
            <p className="text-xs leading-5 text-slate-500">Daftarkan URL ini secara manual di DOKU Back Office. MyBookCMS tidak mendaftarkannya secara otomatis.</p>
          </div>

          {status.configured && (
            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-bold text-slate-900">Kredensial tersimpan</h3>
              <dl className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
                <div><dt className="text-slate-500">Client ID</dt><dd className="mt-1 break-all font-mono font-bold text-slate-800">{status.clientIdMasked}</dd></div>
                <div><dt className="text-slate-500">API Key</dt><dd className="mt-1 break-all font-mono font-bold text-slate-800">{status.apiKeyMasked}</dd></div>
                <div><dt className="text-slate-500">Secret Key</dt><dd className="mt-1 break-all font-mono font-bold text-slate-800">{status.secretKeyMasked}</dd></div>
              </dl>
            </div>
          )}

          <form className="mt-6 space-y-5" onSubmit={submit} noValidate>
            <fieldset disabled={conflictsDisabled}>
              <legend className="text-sm font-bold text-slate-800">Environment</legend>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(["sandbox", "production"] as const).map((value) => (
                  <label key={value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-800 focus-within:ring-2 focus-within:ring-blue-500">
                    <input type="radio" name="doku-environment" value={value} checked={environment === value} onChange={() => { setEnvironment(value); setDirty(true); }} />
                    {value === "sandbox" ? "Sandbox" : "Production"}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                ["clientId", "Client ID", clientId, setClientId, "doku-clientId"],
                ["apiKey", "API Key", apiKey, setApiKey, "doku-apiKey"],
                ["secretKey", "Secret Key", secretKey, setSecretKey, "doku-secretKey"],
              ].map(([field, label, value, setter, id]) => {
                const fieldName = field as keyof FormErrors;
                return (
                  <div key={String(field)} className="space-y-1.5">
                    <label htmlFor={String(id)} className="block text-sm font-bold text-slate-800">{String(label)}</label>
                    <Input
                      id={String(id)}
                      type="password"
                      className="h-11"
                      value={String(value)}
                      autoComplete="new-password"
                      aria-invalid={Boolean(errors[fieldName])}
                      aria-describedby={`${String(id)}-help`}
                      onChange={(event) => {
                        (setter as (next: string) => void)(event.target.value);
                        setDirty(true);
                        setErrors((current) => ({ ...current, [fieldName]: undefined }));
                      }}
                      disabled={conflictsDisabled}
                    />
                    <p id={`${String(id)}-help`} className={`text-xs leading-5 ${errors[fieldName] ? "font-semibold text-rose-700" : "text-slate-500"}`}>
                      {errors[fieldName] || (status.configured ? "Masukkan nilai lengkap untuk mengganti; nilai tersimpan tidak pernah ditampilkan." : "Nilai disimpan terenkripsi dan tidak dapat ditampilkan kembali.")}
                    </p>
                  </div>
                );
              })}
            </div>

            <fieldset id="doku-channels" aria-invalid={Boolean(errors.channels)} disabled={conflictsDisabled}>
              <legend className="text-sm font-bold text-slate-800">Channel pembayaran</legend>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {CHANNELS.map(([value, label]) => (
                  <label key={value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 text-sm text-slate-800">
                    <Checkbox checked={channels.includes(value)} onCheckedChange={(checked) => toggleChannel(value, checked === true)} />
                    {label}
                  </label>
                ))}
              </div>
              {errors.channels && <p className="mt-2 text-xs font-semibold text-rose-700">{errors.channels}</p>}
            </fieldset>

            <Button type="submit" size="xl" className="w-full sm:w-auto" disabled={conflictsDisabled}>
              {busy === "save" ? "Menyimpan…" : status.configured ? "Ganti kredensial & nonaktifkan" : "Simpan draft nonaktif"}
            </Button>
          </form>

          {status.source === "database" && status.health !== "missing" && (
            <div className="mt-6 border-t border-slate-200 pt-5">
              <h3 className="text-sm font-bold text-slate-900">Aktivasi dan penghapusan</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">Perubahan di sini tidak memulai pembayaran dan tidak menghubungi DOKU.</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button type="button" size="xl" className="w-full sm:w-auto" disabled={conflictsDisabled || status.health !== "ready"} onClick={() => setConfirmAction(status.enabled ? "disable" : "enable")}>
                  {status.enabled ? "Nonaktifkan DOKU" : `Aktifkan ${status.environment ?? "sandbox"}`}
                </Button>
                <Button type="button" variant="destructive" size="xl" className="w-full sm:w-auto" disabled={conflictsDisabled} onClick={() => setConfirmAction("delete")}>
                  <Trash2 /> Hapus kredensial DOKU
                </Button>
              </div>
            </div>
          )}

          <details className="mt-6 rounded-lg border border-slate-200 p-4 text-sm text-slate-700">
            <summary className="min-h-11 cursor-pointer py-2 font-bold text-slate-900">Memahami status health</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5">
              <li><strong>Konfigurasi:</strong> data tidak lengkap, tidak dapat dibaca, atau revision tidak sesuai.</li>
              <li><strong>Autentikasi:</strong> DOKU menolak Client ID atau API Key.</li>
              <li><strong>Signature:</strong> response tidak dapat diverifikasi.</li>
              <li><strong>Timeout:</strong> DOKU tidak menjawab dalam batas waktu.</li>
              <li><strong>Provider:</strong> DOKU mengembalikan response yang tidak dapat diproses.</li>
              <li><strong>Transisi lokal:</strong> status terverifikasi belum dapat diterapkan ke lifecycle lokal.</li>
            </ul>
          </details>
        </>
      )}

      <Dialog open={confirmAction !== null} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmAction === "replace" ? "Ganti seluruh kredensial?" : confirmAction === "delete" ? "Hapus kredensial DOKU?" : confirmAction === "disable" ? "Nonaktifkan DOKU?" : `Aktifkan ${status.environment ?? "sandbox"}?`}</DialogTitle>
            <DialogDescription>
              {confirmAction === "replace" && "Konfigurasi aktif akan dinonaktifkan. Replacement ditolak bila payment attempt revisi saat ini belum terminal."}
              {confirmAction === "delete" && `Kredensial ${status.environment ?? "DOKU"} akan dihapus. Selesaikan rekonsiliasi pembayaran nonterminal terlebih dahulu.`}
              {confirmAction === "disable" && "Checkout baru berhenti menawarkan DOKU; payment record yang sudah ada tetap disimpan dan direkonsiliasi."}
              {confirmAction === "enable" && status.environment === "production" && "Aktivasi production dapat membuat DOKU tersedia di checkout setelah release terkait aktif. Lanjutkan hanya untuk instalasi yang telah disetujui."}
              {confirmAction === "enable" && status.environment !== "production" && `Aktifkan sandbox untuk channel: ${channelNames || "belum dipilih"}. Tidak ada request yang dikirim ke DOKU.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline" size="xl" disabled={conflictsDisabled}>Batal</Button></DialogClose>
            <Button
              type="button"
              size="xl"
              variant={confirmAction === "delete" ? "destructive" : "default"}
              disabled={conflictsDisabled}
              onClick={() => {
                if (confirmAction === "replace") void save();
                else if (confirmAction === "delete") void remove();
                else void changeState(confirmAction === "enable");
              }}
            >
              {confirmAction === "replace" ? "Ganti & nonaktifkan" : confirmAction === "delete" ? "Hapus kredensial" : confirmAction === "disable" ? "Nonaktifkan DOKU" : `Aktifkan ${status.environment ?? "sandbox"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
