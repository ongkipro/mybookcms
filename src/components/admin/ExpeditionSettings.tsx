import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, LoaderCircle, MapPin, Pencil, Plus, RefreshCw, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { formatMyr } from "../../lib/storefront-locale";

type Zone = { id: number; code: string; name: string; isActive: number };
type StateOption = { code: string; name: string; zoneCode: string; zoneId: number | null };
type PostcodeRange = {
  id: number;
  zoneId: number;
  postcodeStart: string;
  postcodeEnd: string;
  isActive: number;
};
type RateRule = {
  id: number;
  zoneId: number;
  minWeightGrams: number;
  maxWeightGrams: number;
  amountSen: number;
  isActive: number;
  isReference: number;
  stateCode: string | null;
};
type RangeEditor = {
  mode: "add" | "edit";
  zoneId: number;
  id?: number;
  postcodeStart: string;
  postcodeEnd: string;
  initialStart: string;
  initialEnd: string;
};

const toSen = (ringgit: string) => Math.round(Number(ringgit) * 100);
const isRetiredFlatReference = (rate: RateRule) =>
  Boolean(rate.isReference) && !Boolean(rate.isActive) &&
  rate.minWeightGrams === 1 && rate.maxWeightGrams === 5000 &&
  (rate.amountSen === 650 || rate.amountSen === 1300);

export function ExpeditionSettings() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [ranges, setRanges] = useState<PostcodeRange[]>([]);
  const [rates, setRates] = useState<RateRule[]>([]);
  const [states, setStates] = useState<StateOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  const [rangeEditor, setRangeEditor] = useState<RangeEditor | null>(null);
  const [rangeEditorError, setRangeEditorError] = useState("");
  const [rangeErrors, setRangeErrors] = useState<Record<number, string>>({});
  const [draftAmounts, setDraftAmounts] = useState<Record<number, string>>({});
  const [newRule, setNewRule] = useState({
    zoneId: "",
    minWeightGrams: "1",
    maxWeightGrams: "5000",
    amountRinggit: "6.50",
  });
  const [newRuleSubmitAttempted, setNewRuleSubmitAttempted] = useState(false);
  const [newRuleServerError, setNewRuleServerError] = useState("");

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/expeditions", {
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Data gagal dimuat.");
      const nextZones = payload.data.zones as Zone[];
      const nextRates = payload.data.rateRules as RateRule[];
      setZones(nextZones);
      setRanges(payload.data.postcodeRanges as PostcodeRange[]);
      setRates(nextRates);
      setStates(payload.data.states as StateOption[]);
      setDraftAmounts(Object.fromEntries(nextRates.map((rate) => [rate.id, (rate.amountSen / 100).toFixed(2)])));
      setNewRule((current) => ({ ...current, zoneId: current.zoneId || String(nextZones[0]?.id || "") }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Data gagal dimuat.");
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const metrics = useMemo(() => ({
    zones: zones.filter((zone) => Boolean(zone.isActive)).length,
    activeStates: new Set(rates.filter((rate) => rate.stateCode && Boolean(rate.isActive)).map((rate) => rate.stateCode)).size,
    coveredRanges: ranges.filter((range) => Boolean(range.isActive)).length,
  }), [zones, ranges, rates]);
  const visibleRates = useMemo(
    () => rates.filter((rate) => !isRetiredFlatReference(rate)),
    [rates],
  );
  const newRuleValidation = useMemo(() => {
    const errors: Partial<Record<keyof typeof newRule, string>> = {};
    const zoneId = Number(newRule.zoneId);
    const minWeightGrams = Number(newRule.minWeightGrams);
    const maxWeightGrams = Number(newRule.maxWeightGrams);
    const amountRinggit = Number(newRule.amountRinggit);
    const amountSen = toSen(newRule.amountRinggit);

    if (!newRule.zoneId.trim() || !Number.isInteger(zoneId) || zoneId < 1) {
      errors.zoneId = "Pilih zona fallback.";
    }
    if (!newRule.minWeightGrams.trim() || !Number.isInteger(minWeightGrams) || minWeightGrams < 1) {
      errors.minWeightGrams = "Berat minimum harus berupa bilangan bulat minimal 1 gram.";
    }
    if (!newRule.maxWeightGrams.trim() || !Number.isInteger(maxWeightGrams) || maxWeightGrams < 1) {
      errors.maxWeightGrams = "Berat maksimum harus berupa bilangan bulat minimal 1 gram.";
    } else if (!errors.minWeightGrams && maxWeightGrams < minWeightGrams) {
      errors.maxWeightGrams = "Berat maksimum tidak boleh lebih kecil dari berat minimum.";
    }
    if (
      !newRule.amountRinggit.trim() ||
      !Number.isFinite(amountRinggit) ||
      amountRinggit < 0 ||
      !Number.isSafeInteger(amountSen) ||
      amountSen < 0
    ) {
      errors.amountRinggit = "Nilai MYR harus non-negatif dan dapat disimpan sebagai integer sen.";
    }

    return {
      errors,
      zoneId,
      minWeightGrams,
      maxWeightGrams,
      amountSen,
      isValid: Object.keys(errors).length === 0,
    };
  }, [newRule]);
  const selectedNewRuleZone = useMemo(
    () => zones.find((zone) => String(zone.id) === newRule.zoneId),
    [newRule.zoneId, zones],
  );

  const patch = async (body: Record<string, unknown>, key: string) => {
    setPending(key);
    try {
      const response = await fetch("/api/admin/expeditions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Perubahan gagal disimpan.");
      toast.success(payload.message || "Pengaturan disimpan.");
      await load(false);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Perubahan gagal disimpan.");
    } finally {
      setPending("");
    }
  };

  const addRate = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNewRuleSubmitAttempted(true);
    setNewRuleServerError("");
    if (!newRuleValidation.isValid) return;

    setPending("new-rate");
    try {
      const response = await fetch("/api/admin/expeditions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zoneId: newRuleValidation.zoneId,
          kind: "rate",
          minWeightGrams: newRuleValidation.minWeightGrams,
          maxWeightGrams: newRuleValidation.maxWeightGrams,
          amountSen: newRuleValidation.amountSen,
          isActive: false,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Tarif gagal ditambahkan.");
      toast.success(payload.message || "Tarif ditambahkan.");
      setNewRuleSubmitAttempted(false);
      await load(false);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Tarif gagal ditambahkan.";
      setNewRuleServerError(message);
      toast.error(message);
    } finally {
      setPending("");
    }
  };

  const editorIsDirty = rangeEditor && (
    rangeEditor.postcodeStart !== rangeEditor.initialStart ||
    rangeEditor.postcodeEnd !== rangeEditor.initialEnd
  );

  const openRangeEditor = (zoneId: number, range?: PostcodeRange) => {
    const nextKey = `${range ? "edit" : "add"}-${range?.id || zoneId}`;
    const currentKey = rangeEditor
      ? `${rangeEditor.mode}-${rangeEditor.id || rangeEditor.zoneId}`
      : "";
    if (editorIsDirty && currentKey !== nextKey) {
      toast.error("Simpan atau batalkan perubahan rentang poskod terlebih dahulu.");
      return;
    }
    setRangeEditor({
      mode: range ? "edit" : "add",
      zoneId,
      id: range?.id,
      postcodeStart: range?.postcodeStart || "",
      postcodeEnd: range?.postcodeEnd || "",
      initialStart: range?.postcodeStart || "",
      initialEnd: range?.postcodeEnd || "",
    });
    setRangeEditorError("");
  };

  const saveRange = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!rangeEditor) return;
    if (!/^\d{5}$/.test(rangeEditor.postcodeStart) || !/^\d{5}$/.test(rangeEditor.postcodeEnd)) {
      setRangeEditorError("Poskod awal dan akhir mesti mengandungi lima digit.");
      return;
    }
    if (rangeEditor.postcodeEnd < rangeEditor.postcodeStart) {
      setRangeEditorError("Poskod akhir tidak boleh lebih kecil dari poskod awal.");
      return;
    }
    const key = `postcode-editor-${rangeEditor.id || rangeEditor.zoneId}`;
    setPending(key);
    setRangeEditorError("");
    const existing = rangeEditor.id
      ? ranges.find((range) => range.id === rangeEditor.id)
      : null;
    try {
      const response = await fetch("/api/admin/expeditions", {
        method: rangeEditor.mode === "add" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "postcode",
          ...(rangeEditor.id ? { id: rangeEditor.id } : {}),
          zoneId: rangeEditor.zoneId,
          postcodeStart: rangeEditor.postcodeStart,
          postcodeEnd: rangeEditor.postcodeEnd,
          ...(rangeEditor.mode === "edit" ? { isActive: Boolean(existing?.isActive) } : {}),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Rentang poskod gagal disimpan.");
      toast.success(payload.message || "Rentang poskod disimpan.");
      setRangeEditor(null);
      await load(false);
    } catch (cause) {
      setRangeEditorError(cause instanceof Error ? cause.message : "Rentang poskod gagal disimpan.");
    } finally {
      setPending("");
    }
  };

  const setRangeActive = async (range: PostcodeRange, isActive: boolean) => {
    const key = `postcode-${range.id}`;
    setPending(key);
    setRangeErrors((current) => ({ ...current, [range.id]: "" }));
    try {
      const response = await fetch("/api/admin/expeditions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "postcode",
          id: range.id,
          zoneId: range.zoneId,
          postcodeStart: range.postcodeStart,
          postcodeEnd: range.postcodeEnd,
          isActive,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Status rentang poskod gagal disimpan.");
      toast.success(payload.message || "Status rentang poskod disimpan.");
      await load(false);
    } catch (cause) {
      setRangeErrors((current) => ({
        ...current,
        [range.id]: cause instanceof Error ? cause.message : "Status rentang poskod gagal disimpan.",
      }));
    } finally {
      setPending("");
    }
  };

  if (loading) {
    return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" aria-label="Memuat tarif pengiriman" aria-busy="true">
      {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-52 animate-pulse rounded-xl bg-slate-100" />)}
    </div>;
  }

  if (error) {
    return <section className="rounded-xl border border-rose-200 bg-white p-8 text-center" role="alert">
      <AlertTriangle className="mx-auto size-8 text-rose-600" aria-hidden="true" />
      <h2 className="mt-3 font-black text-slate-950">Tarif Malaysia gagal dimuat</h2>
      <p className="mt-2 text-sm text-slate-600">{error}</p>
      <Button className="mt-5" onClick={() => void load()}><RefreshCw /> Coba lagi</Button>
    </section>;
  }

  return <div className="space-y-6">
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Ringkasan shipping Malaysia">
      {[
        ["Zona aktif", metrics.zones],
        ["Negeri/WP bertarif", metrics.activeStates],
        ["Rentang poskod", metrics.coveredRanges],
      ].map(([label, value]) => <article key={String(label)} className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
      </article>)}
    </section>

    <section className="space-y-4" aria-labelledby="state-rate-title">
      <div>
        <h2 id="state-rate-title" className="text-lg font-black text-slate-950">Tarif per negeri dan Wilayah Persekutuan</h2>
        <p className="mt-1 text-sm text-slate-600">Tarif negeri aktif dipakai lebih dahulu. Jika tidak tersedia untuk weight band tersebut, checkout memakai tarif fallback zona.</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {zones.map((zone) => {
          const zoneStates = states.filter((state) => state.zoneCode === zone.code);
          if (!zoneStates.length) return null;
          const fallbackRates = visibleRates.filter((rate) => rate.zoneId === zone.id && !rate.stateCode && Boolean(rate.isActive));
          return <div key={zone.id} className="border-b border-slate-200 last:border-b-0">
            <div className="bg-slate-50 px-4 py-3 sm:px-5">
              <h3 className="text-sm font-black text-slate-950">{zone.name}</h3>
              <p className="mt-0.5 text-xs text-slate-500">{zoneStates.length} negeri/WP · {zone.isActive ? "zona aktif" : "zona nonaktif"}</p>
            </div>
            <div className="divide-y divide-slate-100">
              {zoneStates.map((state) => {
                const stateRules = visibleRates.filter((rate) => rate.stateCode === state.code);
                if (!stateRules.length) return <div key={state.code} className="px-4 py-4 sm:px-5"><p className="font-bold text-slate-950">{state.name}</p><p className="mt-1 text-xs font-medium text-amber-800">Tarif negeri belum dikonfigurasi.</p></div>;
                return stateRules.map((rate) => {
                  const amount = draftAmounts[rate.id] ?? (rate.amountSen / 100).toFixed(2);
                  const amountSen = toSen(amount);
                  const changed = Number.isSafeInteger(amountSen) && amountSen !== rate.amountSen;
                  const fallback = fallbackRates.find((item) => item.minWeightGrams <= rate.minWeightGrams && item.maxWeightGrams >= rate.maxWeightGrams);
                  const status = !zone.isActive
                    ? "Siap · zona nonaktif"
                    : rate.isActive
                      ? "Tarif khusus aktif"
                      : fallback
                        ? `Fallback ${zone.name} · ${formatMyr(fallback.amountSen)}`
                        : "Nonaktif · fallback tidak tersedia";
                  return <div key={rate.id} className="grid grid-cols-1 gap-3 px-4 py-4 sm:px-5 md:grid-cols-[minmax(11rem,1.5fr)_minmax(9rem,1fr)_10rem_auto_auto] md:items-center">
                    <div className="min-w-0">
                      <p className="font-black text-slate-950">{state.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{zone.name} · {rate.minWeightGrams.toLocaleString("id-ID")}–{rate.maxWeightGrams.toLocaleString("id-ID")} gram</p>
                    </div>
                    <p className="text-xs font-medium text-slate-600">{status}</p>
                    <label className="text-xs font-bold text-slate-600">Nilai (RM)
                      <Input type="number" min="0" step="0.01" value={amount} aria-label={`Tarif ${state.name} dalam RM untuk ${rate.minWeightGrams} sampai ${rate.maxWeightGrams} gram`} onChange={(event) => setDraftAmounts((current) => ({ ...current, [rate.id]: event.target.value }))} className="mt-1 md:mt-0" />
                    </label>
                    <div className="flex min-h-11 min-w-11 items-center justify-start md:justify-center"><Switch
                        checked={Boolean(rate.isActive)}
                        disabled={pending === `rate-${rate.id}`}
                        aria-label={`Aktifkan tarif khusus ${state.name} untuk ${rate.minWeightGrams} sampai ${rate.maxWeightGrams} gram`}
                        onCheckedChange={(value) => void patch({ kind: "rate", id: rate.id, amountSen: rate.amountSen, isActive: Boolean(value) }, `rate-${rate.id}`)}
                      /></div>
                    <Button type="button" variant="outline" className="min-h-11 min-w-11" disabled={!changed || pending === `rate-${rate.id}`} aria-label={`Simpan tarif ${state.name}`} onClick={() => void patch({ kind: "rate", id: rate.id, amountSen, isActive: Boolean(rate.isActive) }, `rate-${rate.id}`)}>
                      {pending === `rate-${rate.id}` ? <LoaderCircle className="animate-spin" /> : <Save />}
                    </Button>
                  </div>;
                });
              })}
            </div>
          </div>;
        })}
      </div>
    </section>

    <section className="space-y-4" aria-labelledby="shipping-zone-title">
      <div>
        <h2 id="shipping-zone-title" className="text-lg font-black text-slate-950">Zona, cakupan poskod, dan tarif fallback</h2>
        <p className="mt-1 text-sm text-slate-600">Nominal tersimpan sebagai integer sen. Checkout hanya memakai rule aktif yang cocok dengan poskod dan berat.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {zones.map((zone) => {
          const zoneRanges = ranges.filter((range) => range.zoneId === zone.id);
          const zoneRates = visibleRates.filter((rate) => rate.zoneId === zone.id && !rate.stateCode);
          return <article key={zone.id} className="rounded-xl border border-slate-200 bg-white p-5">
            <header className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="font-black text-slate-950">{zone.name}</p>
                <p className="mt-1 font-mono text-xs text-slate-500">{zone.code}</p>
              </div>
              <div className="flex min-h-11 min-w-11 items-center justify-center"><Switch
                  checked={Boolean(zone.isActive)}
                  disabled={pending === `zone-${zone.id}`}
                  aria-label={`Aktifkan zona ${zone.name}`}
                  onCheckedChange={(value) => void patch({ kind: "zone", id: zone.id, isActive: Boolean(value) }, `zone-${zone.id}`)}
                /></div>
            </header>
            <div className="mt-4 border-b border-slate-100 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-black text-slate-950"><MapPin className="size-4" aria-hidden="true" />Cakupan poskod</h3>
                <Button type="button" size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => openRangeEditor(zone.id)}><Plus />Tambah rentang</Button>
              </div>
              <div className="mt-3 space-y-2">
                {zoneRanges.length ? zoneRanges.map((range) => {
                  const status = range.isActive
                    ? zone.isActive ? "Aktif di checkout" : "Siap · zona nonaktif"
                    : "Nonaktif";
                  return <div key={range.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-bold text-slate-900">{range.postcodeStart}–{range.postcodeEnd}</p>
                        <p className="mt-1 text-xs text-slate-500">{status}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button type="button" size="icon" variant="ghost" className="min-h-11 min-w-11" aria-label={`Edit rentang poskod ${range.postcodeStart} sampai ${range.postcodeEnd}`} onClick={() => openRangeEditor(zone.id, range)}><Pencil /></Button>
                        <div className="flex min-h-11 min-w-11 items-center justify-center"><Switch
                            checked={Boolean(range.isActive)}
                            disabled={pending === `postcode-${range.id}`}
                            aria-label={`Aktifkan rentang poskod ${range.postcodeStart} sampai ${range.postcodeEnd} untuk ${zone.name}`}
                            onCheckedChange={(value) => void setRangeActive(range, Boolean(value))}
                          /></div>
                      </div>
                    </div>
                    {rangeErrors[range.id] && <p className="mt-2 text-xs text-rose-700" role="alert">{rangeErrors[range.id]}</p>}
                  </div>;
                }) : <p className="rounded-lg bg-amber-50 p-3 text-xs font-medium text-amber-900">Belum ada rentang poskod. Checkout tidak dapat memetakan poskod ke zona ini.</p>}
              </div>
              {rangeEditor?.zoneId === zone.id && <form onSubmit={saveRange} className="mt-3 rounded-lg border border-slate-300 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3"><p className="text-xs font-black text-slate-900">{rangeEditor.mode === "add" ? "Tambah rentang poskod" : "Edit rentang poskod"}</p><Button type="button" size="icon" variant="ghost" className="min-h-11 min-w-11" aria-label="Batalkan editor rentang poskod" onClick={() => { setRangeEditor(null); setRangeEditorError(""); }}><X /></Button></div>
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-xs font-bold text-slate-600">Poskod awal<Input required inputMode="numeric" pattern="[0-9]{5}" maxLength={5} className="mt-1 font-mono" value={rangeEditor.postcodeStart} onChange={(event) => setRangeEditor((current) => current ? { ...current, postcodeStart: event.target.value.replace(/\D/g, "").slice(0, 5) } : current)} /></label>
                  <label className="text-xs font-bold text-slate-600">Poskod akhir<Input required inputMode="numeric" pattern="[0-9]{5}" maxLength={5} className="mt-1 font-mono" value={rangeEditor.postcodeEnd} onChange={(event) => setRangeEditor((current) => current ? { ...current, postcodeEnd: event.target.value.replace(/\D/g, "").slice(0, 5) } : current)} /></label>
                </div>
                {rangeEditorError && <p className="mt-2 text-xs text-rose-700" role="alert">{rangeEditorError}</p>}
                <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => { setRangeEditor(null); setRangeEditorError(""); }}>Batal</Button><Button type="submit" disabled={pending.startsWith("postcode-editor-")}>{pending.startsWith("postcode-editor-") ? <LoaderCircle className="animate-spin" /> : <Save />}{rangeEditor.mode === "add" ? "Tambah rentang" : "Simpan perubahan"}</Button></div>
              </form>}
            </div>
            <div className="mt-4 space-y-3">
              <h3 className="text-sm font-black text-slate-950">Weight band dan tarif fallback</h3>
              {zoneRates.length ? zoneRates.map((rate) => {
                const amount = draftAmounts[rate.id] ?? (rate.amountSen / 100).toFixed(2);
                const amountSen = toSen(amount);
                const changed = Number.isSafeInteger(amountSen) && amountSen !== rate.amountSen;
                return <div key={rate.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-slate-800">{rate.minWeightGrams.toLocaleString("id-ID")}–{rate.maxWeightGrams.toLocaleString("id-ID")} gram</p>
                      <p className="mt-1 text-xs text-slate-500">{formatMyr(rate.amountSen)}{rate.isReference ? " · reference" : ""}</p>
                    </div>
                    <div className="flex min-h-11 min-w-11 items-center justify-center"><Switch
                        checked={Boolean(rate.isActive)}
                        disabled={pending === `rate-${rate.id}`}
                        aria-label={`Aktifkan tarif ${zone.name} ${rate.minWeightGrams} sampai ${rate.maxWeightGrams} gram`}
                        onCheckedChange={(value) => void patch({ kind: "rate", id: rate.id, amountSen: rate.amountSen, isActive: Boolean(value) }, `rate-${rate.id}`)}
                      /></div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <label className="flex-1 text-xs font-bold text-slate-600">Nilai (RM)
                      <Input type="number" min="0" step="0.01" value={amount} onChange={(event) => setDraftAmounts((current) => ({ ...current, [rate.id]: event.target.value }))} className="mt-1" />
                    </label>
                    <Button type="button" variant="outline" className="mt-5" disabled={!changed || pending === `rate-${rate.id}`} onClick={() => void patch({ kind: "rate", id: rate.id, amountSen, isActive: Boolean(rate.isActive) }, `rate-${rate.id}`)}>
                      {pending === `rate-${rate.id}` ? <LoaderCircle className="animate-spin" /> : <Save />}<span className="sr-only">Simpan tarif</span>
                    </Button>
                  </div>
                </div>;
              }) : <p className="rounded-lg bg-amber-50 p-3 text-xs font-medium text-amber-900">Belum ada tarif. Zona ini tidak dapat dipakai checkout.</p>}
            </div>
          </article>;
        })}
      </div>
    </section>

    <form
      className="scroll-mt-24"
      onSubmit={addRate}
      aria-labelledby="new-rate-title"
      aria-busy={pending === "new-rate"}
      noValidate
    >
      <Card size="sm">
        <CardHeader className="border-b">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle id="new-rate-title" as="h2">Tambah weight band fallback</CardTitle>
              <CardDescription className="mt-1 max-w-2xl">
                Tambahkan tarif cadangan zona untuk rentang berat tertentu. Rule disimpan nonaktif dan baru dipakai setelah operator mengaktifkannya.
              </CardDescription>
            </div>
            <Badge variant="secondary">Nonaktif · perlu tinjauan</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(12rem,1fr)_minmax(22rem,2fr)_minmax(10rem,1fr)]">
            <div className="space-y-1.5">
              <label htmlFor="new-rate-zone" className="block text-xs font-bold text-foreground">
                Zona
              </label>
              <Select
                value={newRule.zoneId || null}
                onValueChange={(value) => {
                  setNewRule((current) => ({ ...current, zoneId: value || "" }));
                  setNewRuleServerError("");
                }}
                disabled={pending === "new-rate"}
                required
              >
                <SelectTrigger
                  id="new-rate-zone"
                  className="h-11 w-full"
                  aria-invalid={Boolean(newRuleValidation.errors.zoneId)}
                  aria-describedby="new-rate-zone-description"
                >
                  <SelectValue>{selectedNewRuleZone?.name || "Pilih zona"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {zones.map((zone) => (
                    <SelectItem key={zone.id} value={String(zone.id)}>{zone.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p
                id="new-rate-zone-description"
                className={`text-xs ${newRuleValidation.errors.zoneId ? "font-medium text-destructive" : "text-muted-foreground"}`}
              >
                {newRuleValidation.errors.zoneId || "Zona yang menerima rule fallback ini."}
              </p>
            </div>

            <fieldset className="space-y-1.5">
              <legend className="text-xs font-bold text-foreground">Weight band</legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="new-rate-min-weight" className="block text-xs font-medium text-foreground">
                    Berat minimum (gram)
                  </label>
                  <Input
                    id="new-rate-min-weight"
                    className="h-11"
                    type="number"
                    min="1"
                    step="1"
                    required
                    disabled={pending === "new-rate"}
                    value={newRule.minWeightGrams}
                    aria-invalid={Boolean(newRuleValidation.errors.minWeightGrams)}
                    aria-describedby="new-rate-min-weight-description"
                    onChange={(event) => {
                      setNewRule((current) => ({ ...current, minWeightGrams: event.target.value }));
                      setNewRuleServerError("");
                    }}
                  />
                  <p
                    id="new-rate-min-weight-description"
                    className={`text-xs ${newRuleValidation.errors.minWeightGrams ? "font-medium text-destructive" : "text-muted-foreground"}`}
                  >
                    {newRuleValidation.errors.minWeightGrams || "Bilangan bulat mulai dari 1 gram."}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="new-rate-max-weight" className="block text-xs font-medium text-foreground">
                    Berat maksimum (gram)
                  </label>
                  <Input
                    id="new-rate-max-weight"
                    className="h-11"
                    type="number"
                    min="1"
                    step="1"
                    required
                    disabled={pending === "new-rate"}
                    value={newRule.maxWeightGrams}
                    aria-invalid={Boolean(newRuleValidation.errors.maxWeightGrams)}
                    aria-describedby="new-rate-max-weight-description"
                    onChange={(event) => {
                      setNewRule((current) => ({ ...current, maxWeightGrams: event.target.value }));
                      setNewRuleServerError("");
                    }}
                  />
                  <p
                    id="new-rate-max-weight-description"
                    className={`text-xs ${newRuleValidation.errors.maxWeightGrams ? "font-medium text-destructive" : "text-muted-foreground"}`}
                  >
                    {newRuleValidation.errors.maxWeightGrams || "Harus sama dengan atau lebih besar dari minimum."}
                  </p>
                </div>
              </div>
            </fieldset>

            <div className="space-y-1.5">
              <label htmlFor="new-rate-amount" className="block text-xs font-bold text-foreground">
                Tarif fallback (MYR)
              </label>
              <Input
                id="new-rate-amount"
                className="h-11"
                type="number"
                min="0"
                step="0.01"
                required
                disabled={pending === "new-rate"}
                value={newRule.amountRinggit}
                aria-invalid={Boolean(newRuleValidation.errors.amountRinggit)}
                aria-describedby="new-rate-amount-description"
                onChange={(event) => {
                  setNewRule((current) => ({ ...current, amountRinggit: event.target.value }));
                  setNewRuleServerError("");
                }}
              />
              <p
                id="new-rate-amount-description"
                className={`text-xs ${newRuleValidation.errors.amountRinggit ? "font-medium text-destructive" : "text-muted-foreground"}`}
              >
                {newRuleValidation.errors.amountRinggit || "Dikonversi dan disimpan sebagai integer sen."}
              </p>
            </div>
          </div>

          <section className="rounded-lg bg-muted/60 p-4" aria-labelledby="new-rate-summary-title">
            <p id="new-rate-summary-title" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Ringkasan sebelum simpan
            </p>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">Zona</dt>
                <dd className="mt-1 font-medium text-foreground">{selectedNewRuleZone?.name || "Belum dipilih"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Weight band</dt>
                <dd className="mt-1 font-medium text-foreground">
                  {!newRuleValidation.errors.minWeightGrams && !newRuleValidation.errors.maxWeightGrams
                    ? `${newRuleValidation.minWeightGrams.toLocaleString("id-ID")}–${newRuleValidation.maxWeightGrams.toLocaleString("id-ID")} gram`
                    : "Belum valid"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Tarif fallback</dt>
                <dd className="mt-1 font-medium text-foreground">
                  {!newRuleValidation.errors.amountRinggit ? formatMyr(newRuleValidation.amountSen) : "Belum valid"}
                </dd>
              </div>
            </dl>
          </section>

          {newRuleSubmitAttempted && !newRuleValidation.isValid && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-destructive" role="alert">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="size-4" aria-hidden="true" />
                Periksa isian berikut sebelum menyimpan:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                {Object.values(newRuleValidation.errors).map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          )}

          {newRuleServerError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
              <p className="font-semibold">Weight band belum tersimpan.</p>
              <p className="mt-1 text-xs">{newRuleServerError} Draft tetap tersedia untuk diperbaiki atau dicoba kembali.</p>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex-col items-stretch gap-3 sm:flex-row sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Setelah tersimpan, tinjau rule lalu aktifkan melalui switch pada zona terkait.
          </p>
          <Button
            className="w-full sm:w-auto"
            size="xl"
            type="submit"
            disabled={pending === "new-rate"}
          >
            {pending === "new-rate" ? <LoaderCircle className="animate-spin" /> : <Plus />}
            {pending === "new-rate" ? "Menyimpan sebagai nonaktif…" : "Simpan weight band nonaktif"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  </div>;
}
