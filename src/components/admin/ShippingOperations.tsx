import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, ListMinus, LoaderCircle, PackageCheck, RefreshCw, Search, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "../ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { formatMyr } from "../../lib/storefront-locale";
import { MalaysiaLocationCombobox } from "./MalaysiaLocationCombobox";
import { formatAdminDateTime } from "../../lib/admin-date-filter";

type Shipment = {
  id: number;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  address: string;
  district: string;
  city: string;
  province: string;
  postcode: string | null;
  shippingStatus: string;
  paymentMethod: string;
  paymentStatus: string;
  totalAmount: number;
  shippingCost: number;
  shippingZoneCode: string | null;
  locationId: number | null;
  items: string;
  totalQuantity: number;
  totalWeightGrams: number;
  createdAt: string;
  queuedAt: string;
};

type Draft = { status: string; address: string; locationId: number | null; locationLabel: string; shippingCostMyr: string };

const statuses = ["pending", "processing", "shipped", "delivered", "returned", "cancelled"] as const;
const labels: Record<string, string> = {
  pending: "Menunggu", processing: "Diproses", shipped: "Dikirim",
  delivered: "Selesai", returned: "Dikembalikan", cancelled: "Dibatalkan",
};
const paymentLabels: Record<string, string> = {
  unpaid: "Belum dibayar", pending: "Menunggu pembayaran", paid: "Lunas",
  failed: "Gagal", refunded: "Dikembalikan", cancelled: "Batal",
};
const paymentMethods: Record<string, string> = { cod: "COD", manual_transfer: "Transfer bank manual" };
const stockReleasing = new Set(["returned", "cancelled"]);


function StatusBadge({ status, payment = false }: { status: string; payment?: boolean }) {
  const success = payment ? status === "paid" : status === "delivered";
  const failed = ["failed", "refunded", "cancelled", "returned"].includes(status);
  const classes = success
    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
    : failed ? "border-rose-200 bg-rose-50 text-rose-900" : "border-amber-200 bg-amber-50 text-amber-900";
  const dot = success ? "bg-emerald-500" : failed ? "bg-rose-500" : "bg-amber-500";
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${classes}`}>
    <span className={`size-1.5 rounded-full ${dot}`} aria-hidden="true" />
    {payment ? paymentLabels[status] || status : labels[status] || status}
  </span>;
}

function shipmentDraft(shipment: Shipment): Draft {
  return {
    status: shipment.shippingStatus,
    address: shipment.address || "",
    locationId: shipment.locationId ? Number(shipment.locationId) : null,
    locationLabel: [shipment.city, shipment.province, shipment.postcode].filter(Boolean).join(", "),
    shippingCostMyr: (Number(shipment.shippingCost || 0) / 100).toFixed(2),
  };
}

export function ShippingOperations() {
  const loadedOnce = useRef(false);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<Shipment | null>(null);
  const [draft, setDraft] = useState<Draft>({ status: "pending", address: "", locationId: null, locationLabel: "", shippingCostMyr: "0.00" });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState("");
  const [releasingIds, setReleasingIds] = useState<number[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const params = useMemo(() => {
    const value = new URLSearchParams();
    if (filter !== "all") value.set("status", filter);
    if (debouncedQuery) value.set("q", debouncedQuery);
    return value;
  }, [debouncedQuery, filter]);

  const load = useCallback(async () => {
    if (loadedOnce.current) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/shipping?${params}`, { headers: { Accept: "application/json" } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Pengiriman gagal dimuat.");
      setShipments(payload.data.shipments || []);
      setTotal(Number(payload.data.total || 0));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pengiriman gagal dimuat.");
    } finally {
      loadedOnce.current = true;
      setLoading(false);
      setRefreshing(false);
    }
  }, [params]);

  useEffect(() => { void load(); }, [load]);

  const openEditor = (shipment: Shipment) => {
    setEditing(shipment);
    setDraft(shipmentDraft(shipment));
    setFormError("");
  };

  const dirty = editing ? JSON.stringify(draft) !== JSON.stringify(shipmentDraft(editing)) : false;

  const save = async () => {
    if (!editing || !dirty) return;
    const locationChanged = draft.locationId !== (editing.locationId ? Number(editing.locationId) : null);
    if (locationChanged && !draft.locationId) {
      setFormError("Pilih bandar, negeri, dan poskod dari hasil pencarian.");
      return;
    }
    if (!/^\d+(?:\.\d{1,2})?$/.test(draft.shippingCostMyr.trim())) {
      setFormError("Biaya pengiriman harus berupa nominal RM dengan maksimal dua desimal.");
      return;
    }
    if (stockReleasing.has(draft.status) && !window.confirm(`Ubah ${editing.orderNumber} menjadi “${labels[draft.status]}”? Stok yang masih dicadangkan akan dikembalikan.`)) return;
    setSaving(true);
    setFormError("");
    try {
      const response = await fetch("/api/admin/shipping", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: editing.id,
          shippingStatus: draft.status,
          address: draft.address,
          ...(locationChanged ? { locationId: draft.locationId } : {}),
          shippingCost: Math.round(Number(draft.shippingCostMyr) * 100),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Pengiriman gagal disimpan.");
      toast.success(payload.message || "Pengiriman diperbarui.");
      setEditing(null);
      await load();
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Pengiriman gagal disimpan.");
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = async () => {
    if (!total || exporting) return;
    setExporting(true);
    setExportNotice("");
    setError("");
    try {
      const exportParams = new URLSearchParams(params);
      exportParams.set("format", "csv");
      const response = await fetch(`/api/admin/shipping?${exportParams}`, { headers: { Accept: "text/csv" } });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "CSV pengiriman gagal dibuat.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] || "mybookcms-pengiriman.csv";
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
      const count = Number(response.headers.get("x-export-count") || total);
      setExportNotice(`${count} pengiriman diekspor sesuai filter.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "CSV pengiriman gagal dibuat.");
    } finally {
      setExporting(false);
    }
  };

  const release = async (shipment: Shipment) => {
    if (releasingIds.includes(shipment.id)) return;
    setReleasingIds((current) => [...current, shipment.id]);
    try {
      const response = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_ids: [shipment.id], queued: false }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success || Number(payload.updated_count) !== 1) {
        throw new Error(payload.failures?.[0]?.reason || payload.error || "Pesanan gagal dikeluarkan.");
      }
      setShipments((current) => current.filter((row) => row.id !== shipment.id));
      setTotal((current) => Math.max(0, current - 1));
      toast.success("Pesanan dikeluarkan dari Pengiriman.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Pesanan gagal dikeluarkan.");
    } finally {
      setReleasingIds((current) => current.filter((id) => id !== shipment.id));
    }
  };

  const filtered = filter !== "all" || Boolean(debouncedQuery);

  return <div className="space-y-5">
    <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Antrean operasional</p>
        <h1 className="mt-1 text-2xl font-black text-slate-950">Pengiriman</h1>
        <p className="mt-1 text-sm text-slate-600">Hanya pesanan yang dimasukkan dari Manajemen Pesanan. Status adalah penanda; resi dikirim manual melalui WhatsApp.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <Button variant="outline" className="min-h-11" onClick={() => void exportCsv()} disabled={!total || exporting}>
          {exporting ? <LoaderCircle className="animate-spin" /> : <Download />}{exporting ? "Mengekspor…" : "Ekspor CSV"}
        </Button>
        <Button variant="outline" className="min-h-11" onClick={() => void load()} disabled={refreshing || loading}><RefreshCw className={refreshing || loading ? "animate-spin" : ""} />Perbarui</Button>
      </div>
    </header>

    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Filter pengiriman">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(14rem,1fr)_13rem_auto]">
        <label className="relative"><span className="sr-only">Cari pengiriman</span><Search className="absolute left-3 top-3.5 size-4 text-slate-400" /><Input className="h-11 pl-9" placeholder="Cari nomor pesanan, pelanggan, telepon, atau kota" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <select className="admin-input-flat min-h-11" value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter status pengiriman">
          <option value="all">Semua status</option>{statuses.map((status) => <option key={status} value={status}>{labels[status]}</option>)}
        </select>
        <Button variant="secondary" disabled={!filtered} onClick={() => { setQuery(""); setFilter("all"); }}>Reset</Button>
      </div>
      <p className="mt-3 text-xs font-bold text-slate-500" aria-live="polite">{refreshing ? "Memperbarui antrean…" : `${total} pesanan dalam antrean sesuai filter${total > 200 ? " · menampilkan 200 terbaru" : ""}`}</p>
      {exportNotice ? <p className="mt-2 text-xs font-bold text-emerald-700" role="status">{exportNotice}</p> : null}
      {error ? <div className="mt-3 flex flex-col gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800 sm:flex-row sm:items-center sm:justify-between" role="alert"><span>{error}</span><Button variant="outline" size="sm" onClick={() => void load()}>Coba lagi</Button></div> : null}
    </section>

    {loading ? <div className="space-y-3" aria-label="Memuat antrean pengiriman" aria-busy="true"><div className="hidden h-80 animate-pulse rounded-xl bg-slate-100 lg:block" />{[0, 1, 2].map((id) => <div key={id} className="h-64 animate-pulse rounded-xl bg-slate-100 lg:hidden" />)}</div> : null}

    {!loading && !error && shipments.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center"><Truck className="mx-auto size-8 text-slate-400" /><p className="mt-3 font-black text-slate-900">{filtered ? "Tidak ada pengiriman yang sesuai filter" : "Belum ada pesanan di Pengiriman"}</p><p className="mt-1 text-sm text-slate-500">{filtered ? "Atur ulang filter atau gunakan pencarian lain." : "Gunakan aksi “Masukkan ke Pengiriman” dari Manajemen Pesanan."}</p><div className="mt-5">{filtered ? <Button variant="outline" onClick={() => { setQuery(""); setFilter("all"); }}>Atur ulang filter</Button> : <a href="/admin/orders" className={buttonVariants({ variant: "default" })}>Buka Manajemen Pesanan</a>}</div></div> : null}

    {!loading && shipments.length > 0 ? <>
      <section className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:block" aria-label="Tabel pengiriman desktop">
        <div className="overflow-x-auto"><Table className="min-w-[920px] table-fixed">
          <TableHeader><TableRow className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500"><TableHead className="w-[140px] px-4">Pesanan</TableHead><TableHead className="w-[250px] px-4">Penerima & alamat</TableHead><TableHead className="w-[155px] px-4">Pembayaran</TableHead><TableHead className="w-[145px] px-4">Status & ongkir</TableHead><TableHead className="w-[230px] px-4 text-right">Aksi</TableHead></TableRow></TableHeader>
          <TableBody>{shipments.map((shipment) => <TableRow key={shipment.id} className="align-top hover:bg-slate-50"><TableCell className="px-4 py-4"><a className="font-black text-slate-950 hover:text-blue-700 hover:underline" href={`/admin/orders/${encodeURIComponent(shipment.orderNumber)}`}>{shipment.orderNumber}</a><p className="mt-1 text-[10px] text-slate-500">{formatAdminDateTime(shipment.createdAt)}</p></TableCell><TableCell className="px-4 py-4"><p className="font-black text-slate-900">{shipment.customerName}</p><p className="mt-1 font-mono text-[11px] text-slate-500">{shipment.customerPhone}</p><p className="mt-1 text-[11px] leading-relaxed text-slate-500">{[shipment.address, shipment.city, shipment.province, shipment.postcode].filter(Boolean).join(", ")}</p></TableCell><TableCell className="px-4 py-4"><StatusBadge status={shipment.paymentStatus} payment /><p className="mt-2 text-xs font-bold text-slate-700">{paymentMethods[shipment.paymentMethod] || shipment.paymentMethod}</p>{shipment.paymentMethod === "cod" ? <p className="mt-1 text-xs font-black text-slate-950">COD {formatMyr(shipment.totalAmount)}</p> : null}</TableCell><TableCell className="px-4 py-4"><StatusBadge status={shipment.shippingStatus} /><p className="mt-2 text-xs font-black text-slate-900">{formatMyr(shipment.shippingCost)}</p><p className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">{shipment.shippingZoneCode || "Zona belum tersedia"}</p></TableCell><TableCell className="px-4 py-4"><div className="flex flex-wrap justify-end gap-1"><a href={`/admin/orders/${encodeURIComponent(shipment.orderNumber)}`} className={buttonVariants({ variant: "ghost", size: "sm" })}><Eye />Lihat</a><Button size="sm" onClick={() => openEditor(shipment)}><PackageCheck />Perbarui</Button><Button variant="outline" size="sm" onClick={() => void release(shipment)} disabled={releasingIds.includes(shipment.id)}>{releasingIds.includes(shipment.id) ? <LoaderCircle className="animate-spin" /> : <ListMinus />}{releasingIds.includes(shipment.id) ? "Mengeluarkan…" : "Keluarkan"}</Button></div></TableCell></TableRow>)}</TableBody>
        </Table></div>
      </section>

      <section className="grid grid-cols-1 gap-3 lg:hidden" aria-label="Daftar pengiriman mobile">
        {shipments.map((shipment) => <article key={shipment.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-label={`Pengiriman ${shipment.orderNumber}`}>
          <div className="flex items-start justify-between gap-3"><div><a className="font-black text-blue-700 hover:underline" href={`/admin/orders/${encodeURIComponent(shipment.orderNumber)}`}>{shipment.orderNumber}</a><p className="mt-1 text-[10px] text-slate-500">{formatAdminDateTime(shipment.createdAt)}</p></div><StatusBadge status={shipment.shippingStatus} /></div>
          <div className="mt-4 border-t border-slate-100 pt-4"><p className="font-black text-slate-900">{shipment.customerName}</p><p className="mt-1 font-mono text-xs text-slate-500">{shipment.customerPhone}</p><p className="mt-1 text-xs leading-relaxed text-slate-500">{[shipment.address, shipment.city, shipment.province, shipment.postcode].filter(Boolean).join(", ")}</p></div>
          <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs"><div><p className="text-slate-500">Pembayaran</p><p className="mt-1 font-black text-slate-900">{paymentMethods[shipment.paymentMethod] || shipment.paymentMethod}</p><p className="mt-1">{paymentLabels[shipment.paymentStatus] || shipment.paymentStatus}</p></div><div><p className="text-slate-500">Ongkir</p><p className="mt-1 font-black text-slate-900">{formatMyr(shipment.shippingCost)}</p><p className="mt-1 uppercase">{shipment.shippingZoneCode || "-"}</p></div></div>
          <div className="mt-4 grid grid-cols-2 gap-2"><Button className="min-h-11" onClick={() => openEditor(shipment)}><PackageCheck />Perbarui</Button><Button variant="outline" className="min-h-11" onClick={() => void release(shipment)} disabled={releasingIds.includes(shipment.id)}>{releasingIds.includes(shipment.id) ? <LoaderCircle className="animate-spin" /> : <ListMinus />}{releasingIds.includes(shipment.id) ? "Mengeluarkan…" : "Keluarkan"}</Button></div>
        </article>)}
      </section>
    </> : null}

    <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open && !saving) setEditing(null); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Perbarui pengiriman {editing?.orderNumber}</DialogTitle><DialogDescription>Edit penanda status, alamat Malaysia, dan biaya pengiriman. Resi dikirim manual melalui WhatsApp.</DialogDescription></DialogHeader>
        {formError ? <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800" role="alert">{formError}</p> : null}
        <div className="grid grid-cols-1 gap-4">
          <label className="grid grid-cols-1 gap-1.5 text-xs font-bold text-slate-600">Status pengiriman<select className="admin-input-flat min-h-11" value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))} disabled={saving}>{statuses.map((status) => <option key={status} value={status}>{labels[status]}</option>)}</select></label>
          <label className="grid grid-cols-1 gap-1.5 text-xs font-bold text-slate-600">Alamat jalan<Input value={draft.address} maxLength={500} onChange={(event) => setDraft((current) => ({ ...current, address: event.target.value }))} disabled={saving} /></label>
          <label className="grid grid-cols-1 gap-1.5 text-xs font-bold text-slate-600">Bandar, negeri, atau poskod<MalaysiaLocationCombobox value={draft.locationLabel} selectedId={draft.locationId} disabled={saving} onChange={(value, option) => setDraft((current) => ({ ...current, locationLabel: value, locationId: option ? Number(option.location_id) : null }))} /></label>
          <label className="grid grid-cols-1 gap-1.5 text-xs font-bold text-slate-600">Biaya pengiriman (RM)<Input value={draft.shippingCostMyr} inputMode="decimal" onChange={(event) => setDraft((current) => ({ ...current, shippingCostMyr: event.target.value }))} disabled={saving} /></label>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Batal</Button><Button onClick={() => void save()} disabled={saving || !dirty}>{saving ? <LoaderCircle className="animate-spin" /> : <PackageCheck />}{saving ? "Menyimpan…" : dirty ? "Simpan pengiriman" : "Tidak ada perubahan"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
