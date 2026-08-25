import { useEffect, useId, useRef, useState } from "react";
import { LoaderCircle, MapPin, Search } from "lucide-react";
import { Input } from "../ui/input";

export type MalaysiaLocationOption = {
  location_id: string;
  label: string;
  district: string;
  city: string;
  province: string;
  postcode: string;
  zone_code: string;
};

export function MalaysiaLocationCombobox({
  value,
  selectedId,
  disabled = false,
  onChange,
}: {
  value: string;
  selectedId: number | null;
  disabled?: boolean;
  onChange: (value: string, option: MalaysiaLocationOption | null) => void;
}) {
  const listId = useId();
  const timer = useRef<number | undefined>(undefined);
  const [options, setOptions] = useState<MalaysiaLocationOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const search = (query: string) => {
    window.clearTimeout(timer.current);
    setOptions([]);
    if ((/^\d+$/.test(query) && query.length !== 5) || (!/^\d+$/.test(query) && query.trim().length < 3)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/locations?search=${encodeURIComponent(query.trim())}`, { headers: { Accept: "application/json" } });
        const payload = await response.json().catch(() => ({}));
        const next = response.ok && payload.success ? (payload.items || []) as MalaysiaLocationOption[] : [];
        setOptions(next);
        setOpen(true);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 250);
  };

  return <div className="relative">
    <Search className="pointer-events-none absolute left-3 top-3.5 z-10 size-4 text-slate-400" aria-hidden="true" />
    <Input
      className="pl-9 pr-10"
      type="search"
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={open && options.length > 0}
      aria-controls={listId}
      aria-invalid={!selectedId && value.trim().length > 0}
      placeholder="Cari bandar, negeri, atau poskod"
      value={value}
      disabled={disabled}
      onFocus={() => setOpen(true)}
      onBlur={() => window.setTimeout(() => setOpen(false), 120)}
      onChange={(event) => {
        const query = event.target.value;
        onChange(query, null);
        search(query);
      }}
    />
    {loading ? <LoaderCircle className="pointer-events-none absolute right-3 top-3.5 size-4 animate-spin text-slate-400" aria-label="Mencari lokasi" /> : null}
    {open && options.length > 0 ? <div id={listId} role="listbox" className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
      {options.map((option) => <button
        key={option.location_id}
        type="button"
        role="option"
        aria-selected={Number(option.location_id) === selectedId}
        className="flex min-h-11 w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          onChange(option.label, option);
          setOpen(false);
        }}
      >
        <MapPin className="mt-0.5 size-4 shrink-0 text-blue-600" aria-hidden="true" />
        <span><strong className="block text-slate-900">{option.city}, {option.province}</strong><span className="text-xs text-slate-500">Poskod {option.postcode}</span></span>
      </button>)}
    </div> : null}
    {!selectedId && value.trim().length > 0 && !loading ? <p className="mt-1.5 text-[11px] font-semibold text-amber-700">Pilih lokasi dari hasil pencarian.</p> : null}
  </div>;
}
