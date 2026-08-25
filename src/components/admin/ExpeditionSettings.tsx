import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, LoaderCircle, MapPin, Pencil, Plus, RefreshCw, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
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
    const amountSen = toSen(newRule.amountRinggit);
    if (!Number.isSafeInteger(amountSen) || amountSen < 0) {
      toast.error("Nilai MYR tidak valid.");
      return;
    }
    setPending("new-rate");
    try {
      const response = await fetch("/api/admin/expeditions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zoneId: Number(newRule.zoneId),
          kind: "rate",
          minWeightGrams: Number(newRule.minWeightGrams),
          maxWeightGrams: Number(newRule.maxWeightGrams),
          amountSen,
          isActive: false,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Tarif gagal ditambahkan.");
      toast.success(payload.message || "Tarif ditambahkan.");
      await load(false);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Tarif gagal ditambahkan.");
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

    <form onSubmit={addRate} className="rounded-xl border border-slate-200 bg-white p-5" aria-labelledby="new-rate-title">
      <h2 id="new-rate-title" className="font-black text-slate-950">Tambah weight band fallback</h2>
      <p className="mt-1 text-xs text-slate-500">Rule fallback baru disimpan nonaktif agar bisa diperiksa sebelum dipublikasikan.</p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-bold text-slate-600">Zona
          <select className="admin-input-flat mt-1 min-h-10 w-full" value={newRule.zoneId} onChange={(event) => setNewRule((current) => ({ ...current, zoneId: event.target.value }))}>
            {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-slate-600">Berat minimum (g)<Input className="mt-1" type="number" min="1" step="1" value={newRule.minWeightGrams} onChange={(event) => setNewRule((current) => ({ ...current, minWeightGrams: event.target.value }))} /></label>
        <label className="text-xs font-bold text-slate-600">Berat maksimum (g)<Input className="mt-1" type="number" min="1" step="1" value={newRule.maxWeightGrams} onChange={(event) => setNewRule((current) => ({ ...current, maxWeightGrams: event.target.value }))} /></label>
        <label className="text-xs font-bold text-slate-600">Nilai (RM)<Input className="mt-1" type="number" min="0" step="0.01" value={newRule.amountRinggit} onChange={(event) => setNewRule((current) => ({ ...current, amountRinggit: event.target.value }))} /></label>
      </div>
      <Button className="mt-4" type="submit" disabled={pending === "new-rate"}>{pending === "new-rate" ? <LoaderCircle className="animate-spin" /> : <Plus />}Tambah tarif</Button>
    </form>
  </div>;
}
