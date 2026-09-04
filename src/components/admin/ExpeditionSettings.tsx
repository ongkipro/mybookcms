import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Scale,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { Switch } from "../ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
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

/**
 * The three jobs an operator actually comes here to do. They were one long
 * document, so finding the fallback bands meant scrolling past every state
 * tariff. Each is now a panel addressed by `?panel=`, so a link or a reload
 * lands on the same job.
 */
const PANELS = ["states", "zones", "fallback"] as const;
type Panel = (typeof PANELS)[number];

const PANEL_LABEL: Record<Panel, string> = {
  states: "Tarif negeri/WP",
  zones: "Zona & poskod",
  fallback: "Tarif fallback",
};

function isPanel(value: string | null): value is Panel {
  return value !== null && (PANELS as readonly string[]).includes(value);
}

const toSen = (ringgit: string) => Math.round(Number(ringgit) * 100);
const ringgitOf = (amountSen: number) => (amountSen / 100).toFixed(2);
const isRetiredFlatReference = (rate: RateRule) =>
  Boolean(rate.isReference) && !Boolean(rate.isActive) &&
  rate.minWeightGrams === 1 && rate.maxWeightGrams === 5000 &&
  (rate.amountSen === 650 || rate.amountSen === 1300);

const EMPTY_NEW_RULE = {
  zoneId: "",
  minWeightGrams: "1",
  maxWeightGrams: "5000",
  amountRinggit: "6.50",
};

export function ExpeditionSettings() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [ranges, setRanges] = useState<PostcodeRange[]>([]);
  const [rates, setRates] = useState<RateRule[]>([]);
  const [states, setStates] = useState<StateOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  const [panel, setPanel] = useState<Panel>("states");
  const [openZones, setOpenZones] = useState<number[]>([]);
  const [rangeEditor, setRangeEditor] = useState<RangeEditor | null>(null);
  const [rangeEditorError, setRangeEditorError] = useState("");
  const [rangeErrors, setRangeErrors] = useState<Record<number, string>>({});
  const [draftAmounts, setDraftAmounts] = useState<Record<number, string>>({});
  const [newRuleOpen, setNewRuleOpen] = useState(false);
  const [newRule, setNewRule] = useState(EMPTY_NEW_RULE);
  const [newRuleSubmitAttempted, setNewRuleSubmitAttempted] = useState(false);
  const [newRuleServerError, setNewRuleServerError] = useState("");

  // `load` runs after every mutation and must not clobber what the operator is
  // still typing. It reads the previous rates and drafts through refs so it can
  // tell a dirty draft from one that merely mirrored the server, without taking
  // either as a dependency and re-creating itself on every keystroke.
  const ratesRef = useRef<RateRule[]>([]);
  const draftsRef = useRef<Record<number, string>>({});

  /**
   * The control that opened the current sheet.
   *
   * Radix restores focus to whatever was focused when a dialog opened, but both
   * sheets here are controlled by state with no `SheetTrigger`, and closing one
   * unmounts the content before that restore runs — measured, not assumed:
   * focus landed on `<body>` and stayed there. Keyboard and screen-reader users
   * would be dropped at the top of the document after every edit. So the
   * trigger is captured on open and focused again on close.
   */
  const sheetOpenerRef = useRef<HTMLElement | null>(null);
  const rememberOpener = () => {
    const active = document.activeElement;
    sheetOpenerRef.current = active instanceof HTMLElement ? active : null;
  };
  const restoreOpenerFocus = () => {
    const opener = sheetOpenerRef.current;
    sheetOpenerRef.current = null;
    if (!opener) return;
    // After the unmount, and only if the control still exists: a saved postcode
    // re-renders its row, and focusing a detached node would do nothing.
    requestAnimationFrame(() => {
      if (opener.isConnected) opener.focus();
    });
  };
  useEffect(() => { ratesRef.current = rates; }, [rates]);
  useEffect(() => { draftsRef.current = draftAmounts; }, [draftAmounts]);

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

      // Which drafts the operator had actually edited, measured against the
      // server value they were edited from. Saving row B used to discard an
      // unsaved amount typed into row A, because this simply overwrote every
      // draft with the reload.
      const previousDrafts = draftsRef.current;
      const dirty = new Set(
        ratesRef.current
          .filter((rate) => {
            const draft = previousDrafts[rate.id];
            return draft !== undefined && draft !== ringgitOf(rate.amountSen);
          })
          .map((rate) => rate.id),
      );

      setZones(nextZones);
      setRanges(payload.data.postcodeRanges as PostcodeRange[]);
      setRates(nextRates);
      setStates(payload.data.states as StateOption[]);
      setDraftAmounts(
        Object.fromEntries(
          nextRates.map((rate) => [
            rate.id,
            dirty.has(rate.id)
              ? previousDrafts[rate.id] ?? ringgitOf(rate.amountSen)
              : ringgitOf(rate.amountSen),
          ]),
        ),
      );
      setNewRule((current) => ({ ...current, zoneId: current.zoneId || String(nextZones[0]?.id || "") }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Data gagal dimuat.");
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // The panel is part of the address, so a reload, a bookmark, or a link from a
  // runbook all land on the same job.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("panel");
    if (isPanel(requested)) setPanel(requested);
  }, []);

  const selectPanel = useCallback((next: string) => {
    if (!isPanel(next)) return;
    setPanel(next);
    const url = new URL(window.location.href);
    url.searchParams.set("panel", next);
    // Replace, not push: switching jobs is not a navigation the back button
    // should have to walk through.
    window.history.replaceState(null, "", url.toString());
  }, []);

  const toggleZoneOpen = (zoneId: number) => {
    setOpenZones((current) =>
      current.includes(zoneId) ? current.filter((id) => id !== zoneId) : [...current, zoneId],
    );
  };

  const metrics = useMemo(() => ({
    zones: zones.filter((zone) => Boolean(zone.isActive)).length,
    activeStates: new Set(rates.filter((rate) => rate.stateCode && Boolean(rate.isActive)).map((rate) => rate.stateCode)).size,
    coveredRanges: ranges.filter((range) => Boolean(range.isActive)).length,
  }), [zones, ranges, rates]);
  const visibleRates = useMemo(
    () => rates.filter((rate) => !isRetiredFlatReference(rate)),
    [rates],
  );
  const dirtyDraftCount = useMemo(
    () => visibleRates.filter((rate) => (draftAmounts[rate.id] ?? "") !== ringgitOf(rate.amountSen)).length,
    [visibleRates, draftAmounts],
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
  const newRuleIsDirty = useMemo(
    () =>
      newRule.minWeightGrams !== EMPTY_NEW_RULE.minWeightGrams ||
      newRule.maxWeightGrams !== EMPTY_NEW_RULE.maxWeightGrams ||
      newRule.amountRinggit !== EMPTY_NEW_RULE.amountRinggit,
    [newRule],
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
      setNewRule((current) => ({ ...EMPTY_NEW_RULE, zoneId: current.zoneId }));
      setNewRuleOpen(false);
      restoreOpenerFocus();
      await load(false);
    } catch (cause) {
      // Deliberately keeps the sheet open and the values intact: a server
      // refusal is something to correct, not something to retype.
      const message = cause instanceof Error ? cause.message : "Tarif gagal ditambahkan.";
      setNewRuleServerError(message);
      toast.error(message);
    } finally {
      setPending("");
    }
  };

  const editorIsDirty = Boolean(rangeEditor) && (
    rangeEditor!.postcodeStart !== rangeEditor!.initialStart ||
    rangeEditor!.postcodeEnd !== rangeEditor!.initialEnd
  );

  const openRangeEditor = (zoneId: number, range?: PostcodeRange) => {
    rememberOpener();
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

  /**
   * Dirty-close protection. Radix restores focus to the trigger on close, so a
   * refused close leaves the operator exactly where they were.
   */
  const requestRangeEditorClose = (open: boolean) => {
    if (open) return;
    if (editorIsDirty) {
      toast.error("Simpan atau batalkan perubahan rentang poskod terlebih dahulu.");
      return;
    }
    setRangeEditor(null);
    setRangeEditorError("");
    restoreOpenerFocus();
  };

  const discardRangeEditor = () => {
    setRangeEditor(null);
    setRangeEditorError("");
    restoreOpenerFocus();
  };

  const requestNewRuleClose = (open: boolean) => {
    if (open) {
      setNewRuleOpen(true);
      return;
    }
    if (newRuleIsDirty || newRuleServerError) {
      toast.error("Simpan atau batalkan weight band yang sedang disusun.");
      return;
    }
    setNewRuleOpen(false);
    setNewRuleSubmitAttempted(false);
    restoreOpenerFocus();
  };

  const discardNewRule = () => {
    setNewRule((current) => ({ ...EMPTY_NEW_RULE, zoneId: current.zoneId }));
    setNewRuleSubmitAttempted(false);
    setNewRuleServerError("");
    setNewRuleOpen(false);
    restoreOpenerFocus();
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
      restoreOpenerFocus();
      await load(false);
    } catch (cause) {
      // The sheet stays open with the entered values: a rejected postcode is
      // corrected, not retyped.
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

  const zonePostcodeSection = (zone: Zone) => {
    const zoneRanges = ranges.filter((range) => range.zoneId === zone.id);
    return <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-black text-slate-950">
          <MapPin className="size-4" aria-hidden="true" />Cakupan poskod
        </h4>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => openRangeEditor(zone.id)}
          aria-label={`Tambah rentang poskod untuk ${zone.name}`}
        >
          <Plus /> Tambah rentang
        </Button>
      </div>
      {zoneRanges.length === 0
        ? <p className="rounded-lg border border-dashed border-slate-200 p-4 text-xs text-slate-500">
            Belum ada rentang poskod untuk zona ini.
          </p>
        : <ul className="space-y-2">
            {zoneRanges.map((range) => <li key={range.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-mono text-sm font-bold text-slate-950">{range.postcodeStart}–{range.postcodeEnd}</p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="min-h-11 min-w-11"
                    aria-label={`Edit rentang poskod ${range.postcodeStart} sampai ${range.postcodeEnd}`}
                    onClick={() => openRangeEditor(zone.id, range)}
                  ><Pencil /></Button>
                  <Switch
                    checked={Boolean(range.isActive)}
                    disabled={pending === `postcode-${range.id}`}
                    aria-label={`Aktifkan rentang poskod ${range.postcodeStart} sampai ${range.postcodeEnd} untuk ${zone.name}`}
                    onCheckedChange={(checked) => void setRangeActive(range, checked)}
                  />
                </div>
              </div>
              {rangeErrors[range.id] && <p role="alert" className="mt-2 text-xs font-bold text-rose-700">{rangeErrors[range.id]}</p>}
            </li>)}
          </ul>}
    </div>;
  };

  const zoneFallbackSection = (zone: Zone) => {
    const zoneRates = visibleRates.filter((rate) => rate.zoneId === zone.id && !rate.stateCode);
    return <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-black text-slate-950">
          <Scale className="size-4" aria-hidden="true" />Weight band dan tarif fallback
        </h4>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          aria-label={`Tambah weight band fallback untuk ${zone.name}`}
          onClick={() => {
            rememberOpener();
            setNewRule((current) => ({ ...current, zoneId: String(zone.id) }));
            setNewRuleOpen(true);
          }}
        ><Plus /> Tambah weight band</Button>
      </div>
      {zoneRates.length === 0
        ? <p className="rounded-lg border border-dashed border-slate-200 p-4 text-xs text-slate-500">
            Belum ada weight band fallback untuk zona ini.
          </p>
        : <ul className="space-y-2">
            {zoneRates.map((rate) => {
              const amount = draftAmounts[rate.id] ?? ringgitOf(rate.amountSen);
              const amountSen = toSen(amount);
              const changed = amountSen !== rate.amountSen && Number.isSafeInteger(amountSen) && amountSen >= 0;
              return <li key={rate.id} className="rounded-lg border border-slate-200 p-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-950">{rate.minWeightGrams}–{rate.maxWeightGrams} g</p>
                    <p className="text-xs text-slate-500">Tersimpan {formatMyr(rate.amountSen)}</p>
                  </div>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    aria-label={`Tarif fallback ${zone.name} dalam RM untuk ${rate.minWeightGrams} sampai ${rate.maxWeightGrams} gram`}
                    onChange={(event) => setDraftAmounts((current) => ({ ...current, [rate.id]: event.target.value }))}
                  />
                  <Switch
                    checked={Boolean(rate.isActive)}
                    disabled={pending === `rate-${rate.id}`}
                    aria-label={`Aktifkan tarif ${zone.name} ${rate.minWeightGrams} sampai ${rate.maxWeightGrams} gram`}
                    onCheckedChange={(checked) => void patch({ kind: "rate", id: rate.id, amountSen: rate.amountSen, isActive: checked }, `rate-${rate.id}`)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 min-w-11"
                    disabled={!changed || pending === `rate-${rate.id}`}
                    aria-label={`Simpan tarif fallback ${zone.name} ${rate.minWeightGrams} sampai ${rate.maxWeightGrams} gram`}
                    onClick={() => void patch({ kind: "rate", id: rate.id, amountSen, isActive: Boolean(rate.isActive) }, `rate-${rate.id}`)}
                  ><Save /></Button>
                </div>
              </li>;
            })}
          </ul>}
    </div>;
  };

  /** One collapsible per zone. Which zones are open is component state, so it
   *  survives a panel change and a reload triggered by another row's save. */
  const zoneAccordion = (renderBody: (zone: Zone) => React.ReactNode, idPrefix: string) =>
    <ul className="space-y-3">
      {zones.map((zone) => {
        const open = openZones.includes(zone.id);
        const panelId = `${idPrefix}-zone-${zone.id}`;
        return <li key={zone.id} className="rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <button
              type="button"
              onClick={() => toggleZoneOpen(zone.id)}
              aria-expanded={open}
              aria-controls={panelId}
              className="flex min-h-11 flex-1 items-center gap-2 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <ChevronDown className={`size-4 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
              <span className="text-sm font-black text-slate-950">{zone.name}</span>
              <Badge variant={zone.isActive ? "default" : "secondary"}>{zone.isActive ? "Aktif" : "Nonaktif"}</Badge>
            </button>
            <Switch
              checked={Boolean(zone.isActive)}
              disabled={pending === `zone-${zone.id}`}
              aria-label={`Aktifkan zona ${zone.name}`}
              onCheckedChange={(checked) => void patch({ kind: "zone", id: zone.id, isActive: checked }, `zone-${zone.id}`)}
            />
          </div>
          <div id={panelId} hidden={!open} className="border-t border-slate-100 p-4">
            {renderBody(zone)}
          </div>
        </li>;
      })}
    </ul>;

  return <div className="space-y-5">
    <section className="grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-white p-3" aria-label="Ringkasan shipping Malaysia">
      {([
        ["Zona aktif", metrics.zones],
        ["Negeri/WP bertarif", metrics.activeStates],
        ["Rentang poskod", metrics.coveredRanges],
      ] as const).map(([label, value]) => <div key={label} className="min-w-0 px-1">
        <p className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-lg font-black text-slate-950">{value}</p>
      </div>)}
    </section>

    {dirtyDraftCount > 0 && <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-900">
      {dirtyDraftCount} tarif punya perubahan yang belum disimpan. Berpindah panel tidak menghapusnya.
    </p>}

    <Tabs value={panel} onValueChange={selectPanel}>
      <TabsList aria-label="Pilih pekerjaan tarif Malaysia">
        {PANELS.map((key) => <TabsTrigger key={key} value={key}>{PANEL_LABEL[key]}</TabsTrigger>)}
      </TabsList>

      <TabsContent value="states">
        <section className="space-y-4" aria-labelledby="state-rate-title">
          <div>
            <h2 id="state-rate-title" className="text-lg font-black text-slate-950">Tarif per negeri dan Wilayah Persekutuan</h2>
            <p className="mt-1 text-xs text-slate-500">Ubah nilai lalu tekan simpan. Switch berlaku langsung tanpa simpan terpisah.</p>
          </div>
          {zoneAccordion((zone) => {
            const zoneStates = states.filter((state) => state.zoneId === zone.id);
            if (zoneStates.length === 0) {
              return <p className="rounded-lg border border-dashed border-slate-200 p-4 text-xs text-slate-500">Belum ada negeri/WP pada zona ini.</p>;
            }
            return <ul className="space-y-2">
              {zoneStates.map((state) => {
                const stateRates = visibleRates.filter((rate) => rate.stateCode === state.code);
                if (stateRates.length === 0) return null;
                return <li key={state.code} className="rounded-lg border border-slate-200 p-3">
                  <p className="text-sm font-black text-slate-950">{state.name}</p>
                  <ul className="mt-2 space-y-2">
                    {stateRates.map((rate) => {
                      const amount = draftAmounts[rate.id] ?? ringgitOf(rate.amountSen);
                      const amountSen = toSen(amount);
                      const changed = amountSen !== rate.amountSen && Number.isSafeInteger(amountSen) && amountSen >= 0;
                      return <li key={rate.id} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-700">{rate.minWeightGrams}–{rate.maxWeightGrams} g</p>
                          <p className="text-xs text-slate-500">Tersimpan {formatMyr(rate.amountSen)}</p>
                        </div>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={amount}
                          aria-label={`Tarif ${state.name} dalam RM untuk ${rate.minWeightGrams} sampai ${rate.maxWeightGrams} gram`}
                          onChange={(event) => setDraftAmounts((current) => ({ ...current, [rate.id]: event.target.value }))}
                          className="mt-1 md:mt-0"
                        />
                        <Switch
                          checked={Boolean(rate.isActive)}
                          disabled={pending === `rate-${rate.id}`}
                          aria-label={`Aktifkan tarif khusus ${state.name} untuk ${rate.minWeightGrams} sampai ${rate.maxWeightGrams} gram`}
                          onCheckedChange={(checked) => void patch({ kind: "rate", id: rate.id, amountSen: rate.amountSen, isActive: checked }, `rate-${rate.id}`)}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11 min-w-11"
                          disabled={!changed || pending === `rate-${rate.id}`}
                          aria-label={`Simpan tarif ${state.name}`}
                          onClick={() => void patch({ kind: "rate", id: rate.id, amountSen, isActive: Boolean(rate.isActive) }, `rate-${rate.id}`)}
                        ><Save /></Button>
                      </li>;
                    })}
                  </ul>
                </li>;
              })}
            </ul>;
          }, "states")}
        </section>
      </TabsContent>

      <TabsContent value="zones">
        <section className="space-y-4" aria-labelledby="shipping-zone-title">
          <div>
            <h2 id="shipping-zone-title" className="text-lg font-black text-slate-950">Zona dan cakupan poskod</h2>
            <p className="mt-1 text-xs text-slate-500">Aktifkan zona dan atur rentang poskod yang dilayaninya.</p>
          </div>
          {zoneAccordion(zonePostcodeSection, "zones")}
        </section>
      </TabsContent>

      <TabsContent value="fallback">
        <section className="space-y-4" aria-labelledby="fallback-rate-title">
          <div>
            <h2 id="fallback-rate-title" className="text-lg font-black text-slate-950">Tarif fallback per zona</h2>
            <p className="mt-1 text-xs text-slate-500">Dipakai ketika tidak ada tarif negeri/WP yang cocok dengan berat yang diminta.</p>
          </div>
          {zoneAccordion(zoneFallbackSection, "fallback")}
        </section>
      </TabsContent>
    </Tabs>

    <Sheet open={rangeEditor !== null} onOpenChange={requestRangeEditorClose}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <form onSubmit={saveRange} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>{rangeEditor?.mode === "add" ? "Tambah rentang poskod" : "Edit rentang poskod"}</SheetTitle>
            <SheetDescription>
              Lima digit, dan poskod akhir tidak boleh lebih kecil dari poskod awal.
            </SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-1 gap-4 overflow-y-auto px-4">
            <div>
              <label htmlFor="range-start" className="text-xs font-bold text-slate-700">Poskod awal</label>
              <Input
                id="range-start"
                inputMode="numeric"
                value={rangeEditor?.postcodeStart ?? ""}
                onChange={(event) => setRangeEditor((current) => current && { ...current, postcodeStart: event.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor="range-end" className="text-xs font-bold text-slate-700">Poskod akhir</label>
              <Input
                id="range-end"
                inputMode="numeric"
                value={rangeEditor?.postcodeEnd ?? ""}
                onChange={(event) => setRangeEditor((current) => current && { ...current, postcodeEnd: event.target.value })}
                className="mt-1"
              />
            </div>
            {rangeEditorError && <p role="alert" className="text-xs font-bold text-rose-700">{rangeEditorError}</p>}
          </div>
          <SheetFooter>
            <Button type="submit" className="min-h-11" disabled={pending.startsWith("postcode-editor-")}>
              {pending.startsWith("postcode-editor-") ? <LoaderCircle className="animate-spin" /> : <Save />}
              Simpan rentang
            </Button>
            {/* Explicit discard, because closing while dirty is refused. */}
            <Button type="button" variant="outline" className="min-h-11" onClick={discardRangeEditor}>
              <X /> Buang perubahan
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>

    <Sheet open={newRuleOpen} onOpenChange={requestNewRuleClose}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <form onSubmit={addRate} className="flex h-full flex-col" aria-labelledby="new-rate-title">
          <SheetHeader>
            <SheetTitle id="new-rate-title">Tambah weight band fallback</SheetTitle>
            <SheetDescription>
              Disimpan dalam keadaan nonaktif. Aktifkan lewat switch pada zona terkait setelah ditinjau.
            </SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-1 gap-4 overflow-y-auto px-4">
            <div>
              <label htmlFor="new-rule-zone" className="text-xs font-bold text-slate-700">Zona</label>
              <Select value={newRule.zoneId} onValueChange={(value) => setNewRule((current) => ({ ...current, zoneId: value ?? "" }))}>
                <SelectTrigger id="new-rule-zone" className="mt-1 w-full" aria-label="Zona untuk weight band fallback">
                  <SelectValue placeholder="Pilih zona" />
                </SelectTrigger>
                <SelectContent>
                  {zones.map((zone) => <SelectItem key={zone.id} value={String(zone.id)}>{zone.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {newRuleSubmitAttempted && newRuleValidation.errors.zoneId && <p role="alert" className="mt-1 text-xs font-bold text-rose-700">{newRuleValidation.errors.zoneId}</p>}
            </div>
            <div>
              <label htmlFor="new-rule-min" className="text-xs font-bold text-slate-700">Berat minimum (gram)</label>
              <Input
                id="new-rule-min"
                type="number"
                min="1"
                step="1"
                value={newRule.minWeightGrams}
                onChange={(event) => setNewRule((current) => ({ ...current, minWeightGrams: event.target.value }))}
                className="mt-1"
              />
              {newRuleSubmitAttempted && newRuleValidation.errors.minWeightGrams && <p role="alert" className="mt-1 text-xs font-bold text-rose-700">{newRuleValidation.errors.minWeightGrams}</p>}
            </div>
            <div>
              <label htmlFor="new-rule-max" className="text-xs font-bold text-slate-700">Berat maksimum (gram)</label>
              <Input
                id="new-rule-max"
                type="number"
                min="1"
                step="1"
                value={newRule.maxWeightGrams}
                onChange={(event) => setNewRule((current) => ({ ...current, maxWeightGrams: event.target.value }))}
                className="mt-1"
              />
              {newRuleSubmitAttempted && newRuleValidation.errors.maxWeightGrams && <p role="alert" className="mt-1 text-xs font-bold text-rose-700">{newRuleValidation.errors.maxWeightGrams}</p>}
            </div>
            <div>
              <label htmlFor="new-rule-amount" className="text-xs font-bold text-slate-700">Tarif (RM)</label>
              <Input
                id="new-rule-amount"
                type="number"
                min="0"
                step="0.01"
                value={newRule.amountRinggit}
                onChange={(event) => setNewRule((current) => ({ ...current, amountRinggit: event.target.value }))}
                className="mt-1"
              />
              {newRuleSubmitAttempted && newRuleValidation.errors.amountRinggit && <p role="alert" className="mt-1 text-xs font-bold text-rose-700">{newRuleValidation.errors.amountRinggit}</p>}
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600" aria-live="polite">
              <p>
                {selectedNewRuleZone ? selectedNewRuleZone.name : "Zona belum dipilih"} ·{" "}
                {newRule.minWeightGrams || "?"}–{newRule.maxWeightGrams || "?"} g ·{" "}
                {newRuleValidation.isValid ? formatMyr(newRuleValidation.amountSen) : "nilai belum valid"}
              </p>
            </div>
            {newRuleServerError && <p role="alert" className="text-xs font-bold text-rose-700">{newRuleServerError}</p>}
          </div>
          <SheetFooter>
            <Button type="submit" className="min-h-11" disabled={pending === "new-rate"}>
              {pending === "new-rate" ? <LoaderCircle className="animate-spin" /> : <Plus />}
              {pending === "new-rate" ? "Menyimpan sebagai nonaktif…" : "Simpan weight band nonaktif"}
            </Button>
            <Button type="button" variant="outline" className="min-h-11" onClick={discardNewRule}>
              <X /> Buang perubahan
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  </div>;
}
