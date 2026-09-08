import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, LoaderCircle, MoreHorizontal, RefreshCw, Search, Trash2, Truck } from "lucide-react";
import { AdminDateRangeFilter, type AdminDateSelection } from "./AdminDateRangeFilter";
import { CrmActionGroup } from "./CrmActionGroup";
import type { CrmStepKey } from "./CrmActionButton";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Input } from "../ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { buildWaUrl, defaultCrmTemplates, renderCrmMessage } from "../../lib/crm-template";
import {
  resolveAdminOrderStatus,
  type AdminOrderStatus,
} from "../../lib/admin-order-status";
import { formatMyr } from "../../lib/storefront-locale";
import type { AdminRole } from "../../lib/auth";
import { formatAdminDateTime } from "../../lib/admin-date-filter";

type OrderRow = {
  id: number;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  address: string;
  district: string;
  city: string;
  province: string;
  postal_code: string | null;
  total_amount: number;
  product_price: number;
  shipping_cost: number;
  shipping_amount_sen: number | null;
  shipping_zone_code: string | null;
  payment_method: string;
  payment_status: string;
  shipping_status: string;
  shipping_queued_at: string | null;
  created_at: string;
  product_name: string;
  variant_name: string;
  seller_name: string;
  seller_bank_name: string | null;
  seller_account_holder: string | null;
  seller_account_number: string | null;
};

type PaginationState = { page: number; limit: number; totalItems: number; totalPages: number };
type SummaryState = { totalOrders: number; unpaidCount: number; fulfilmentCount: number; totalValue: number };

const quickStatusFilters: ReadonlyArray<readonly ["all" | AdminOrderStatus, string]> = [
  ["all", "Semua"],
  ["new", "Baru"],
  ["waiting", "Menunggu"],
  ["queued", "Masuk Pengiriman"],
  ["in_transit", "Dalam Pengiriman"],
  ["delivered", "Selesai"],
  ["returned", "Dikembalikan"],
  ["cancelled", "Dibatalkan"],
];

const orderStatusLabels: Record<AdminOrderStatus, string> = {
  new: "Baru",
  waiting: "Menunggu",
  queued: "Masuk Pengiriman",
  in_transit: "Dalam Pengiriman",
  delivered: "Selesai",
  returned: "Dikembalikan",
  cancelled: "Dibatalkan",
};

const statusDots: Record<AdminOrderStatus, string> = {
  new: "bg-slate-500",
  waiting: "bg-amber-500",
  queued: "bg-sky-500",
  in_transit: "bg-blue-600",
  delivered: "bg-emerald-600",
  returned: "bg-rose-600",
  cancelled: "bg-rose-700",
};

const statusClasses: Record<AdminOrderStatus, string> = {
  new: "border-slate-200 bg-slate-50 text-slate-800",
  waiting: "border-amber-200 bg-amber-50 text-amber-900",
  queued: "border-sky-200 bg-sky-50 text-sky-900",
  in_transit: "border-blue-200 bg-blue-50 text-blue-900",
  delivered: "border-emerald-200 bg-emerald-50 text-emerald-900",
  returned: "border-rose-200 bg-rose-50 text-rose-900",
  cancelled: "border-rose-200 bg-rose-50 text-rose-900",
};

const bulkStatusActions = [
  ["processing", "Tandai diproses"],
  ["shipped", "Tandai dalam pengiriman"],
  ["delivered", "Tandai selesai"],
  ["returned", "Tandai dikembalikan"],
  ["cancelled", "Batalkan pesanan"],
] as const;

const paymentLabels: Record<string, string> = {
  unpaid: "Belum dibayar",
  pending: "Menunggu pembayaran",
  paid: "Lunas",
  failed: "Gagal",
  refunded: "Dikembalikan",
  cancelled: "Batal",
};

const paymentMethodLabels: Record<string, string> = {
  cod: "COD",
  manual_transfer: "Transfer bank manual",
};

const crmSteps = ["welcome", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;


function PaymentBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const paid = normalized === "paid";
  const failed = ["failed", "cancelled"].includes(normalized);
  const classes = paid
    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
    : failed
      ? "border-rose-200 bg-rose-50 text-rose-900"
      : "border-amber-200 bg-amber-50 text-amber-900";
  const dot = paid ? "bg-emerald-500" : failed ? "bg-rose-500" : "bg-amber-500";
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${classes}`}>
    <span className={`size-1.5 rounded-full ${dot}`} aria-hidden="true" />
    {paymentLabels[normalized] || status}
  </span>;
}

function OrderStatusBadge({ order }: { order: OrderRow }) {
  const status = resolveAdminOrderStatus(order);
  const detail = status === "waiting"
    ? "Menunggu pembayaran"
    : status === "queued"
      ? "Menunggu diproses di Pengiriman"
      : "";
  return <div>
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${statusClasses[status]}`}>
      <span className={`size-1.5 rounded-full ${statusDots[status]}`} aria-hidden="true" />
      {orderStatusLabels[status]}
    </span>
    {detail ? <p className="mt-1 text-[10px] font-medium text-slate-500">{detail}</p> : null}
  </div>;
}

export function OrdersTable({ adminRole = "customer_service" }: { adminRole?: AdminRole } = {}) {
  // Mirrors the server rule. Deleting an order is permanent and restores stock,
  // so it stays with the roles that answer for the store's books.
  const mayDeleteOrders = adminRole === "owner" || adminRole === "admin";
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [dateSelection, setDateSelection] = useState<AdminDateSelection>({ filter: "all", start: "", end: "" });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationState>({ page: 1, limit: 20, totalItems: 0, totalPages: 0 });
  const [summary, setSummary] = useState<SummaryState>({ totalOrders: 0, unpaidCount: 0, fulfilmentCount: 0, totalValue: 0 });
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({ all: 0 });
  const [crmTemplates, setCrmTemplates] = useState<Record<string, string>>({ ...defaultCrmTemplates });
  const [clickedSteps, setClickedSteps] = useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [queuePendingIds, setQueuePendingIds] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("mybookcms:crm-clicks");
      if (stored) setClickedSteps(JSON.parse(stored));
    } catch {}
  }, []);

  const load = useCallback(async () => {
    setError("");
    setRefreshing(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: "20",
      order_status: orderStatusFilter,
      payment_status: paymentFilter,
      date_filter: dateSelection.filter,
    });
    if (debouncedQuery) params.set("search", debouncedQuery);
    if (dateSelection.start) params.set("date_start", dateSelection.start);
    if (dateSelection.end) params.set("date_end", dateSelection.end);
    try {
      const response = await fetch(`/api/admin/orders?${params}`, { headers: { Accept: "application/json" } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Pesanan gagal dimuat.");
      setOrders(payload.data || []);
      setPagination({
        page: Number(payload.pagination?.page || page),
        limit: Number(payload.pagination?.limit || 20),
        totalItems: Number(payload.pagination?.total_items || 0),
        totalPages: Number(payload.pagination?.total_pages || 0),
      });
      setSummary({
        totalOrders: Number(payload.summary?.total_orders || 0),
        unpaidCount: Number(payload.summary?.unpaid_count || 0),
        fulfilmentCount: Number(payload.summary?.fulfilment_count || 0),
        totalValue: Number(payload.summary?.total_value || 0),
      });
      setStatusCounts(payload.status_counts || { all: 0 });
      setCrmTemplates(payload.crm_templates || { ...defaultCrmTemplates });
      setSelectedIds((current) => current.filter((id) => (payload.data || []).some((row: OrderRow) => row.id === id)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pesanan gagal dimuat.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateSelection, debouncedQuery, orderStatusFilter, page, paymentFilter, requestVersion]);

  useEffect(() => { void load(); }, [load]);

  const markStepClicked = (orderId: number, step: CrmStepKey) => {
    const key = `${orderId}_${step}`;
    setClickedSteps((current) => {
      const next = { ...current, [key]: true };
      try { window.localStorage.setItem("mybookcms:crm-clicks", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const crmUrls = useMemo(() => new Map(orders.map((order) => {
    const bankAccounts = [order.seller_bank_name, order.seller_account_number, order.seller_account_holder ? `a.n. ${order.seller_account_holder}` : ""].filter(Boolean).join(" ");
    const urls = Object.fromEntries(crmSteps.map((step) => [step, buildWaUrl(order.customer_phone, renderCrmMessage(crmTemplates[step] || defaultCrmTemplates[step], {
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      address: order.address,
      district: order.district,
      city: order.city,
      province: order.province,
      postalCode: order.postal_code || "",
      orderNumber: order.order_number,
      productName: [order.product_name, order.variant_name].filter(Boolean).join(" - "),
      variantName: order.variant_name,
      productPrice: Number(order.product_price),
      shippingCost: Number(order.shipping_cost),
      totalAmount: Number(order.total_amount),
      sellerName: order.seller_name,
      bankAccounts,
      orderDetailsLink: `${window.location.origin}/admin/orders/${encodeURIComponent(order.order_number)}`,
    }))]));
    return [order.id, urls] as const;
  })), [crmTemplates, orders]);

  const renderCrmActions = (order: OrderRow, expanded = false) => <CrmActionGroup
    crmUrls={crmUrls.get(order.id) || {}}
    clickedSteps={Object.fromEntries(crmSteps.map((step) => [step, Boolean(clickedSteps[`${order.id}_${step}`])]))}
    onStepClick={(step) => markStepClicked(order.id, step)}
    size="sm"
    collapsible
    defaultExpanded={expanded}
  />;

  const updateStatuses = async (ids: number[], status: string) => {
    if (!ids.length) return;
    setMutating(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_ids: ids, status }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Status gagal diperbarui.");
      setNotice(payload.message || "Status pesanan diperbarui.");
      setSelectedIds([]);
      setRequestVersion((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Status pesanan gagal diperbarui.");
    } finally { setMutating(false); }
  };

  const setShippingQueue = async (ids: number[], queued: boolean) => {
    if (!ids.length) return;
    setNotice("");
    setError("");
    setQueuePendingIds((current) => [...new Set([...current, ...ids])]);
    try {
      const response = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_ids: ids, queued }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Antrean Pengiriman gagal diperbarui.");
      const failures = Array.isArray(payload.failures) ? payload.failures as Array<{ id: number; order_number: string; reason: string }> : [];
      const failedIds = new Set(failures.map((failure) => Number(failure.id)));
      const successfulIds = ids.filter((id) => !failedIds.has(id));
      if (successfulIds.length) {
        const now = new Date().toISOString();
        setOrders((current) => current.map((order) => successfulIds.includes(order.id)
          ? { ...order, shipping_queued_at: queued ? order.shipping_queued_at || now : null }
          : order));
        const changed = Number(payload.updated_count || 0);
        if (changed) setSummary((current) => ({ ...current, fulfilmentCount: Math.max(0, current.fulfilmentCount + (queued ? changed : -changed)) }));
      }
      if (failures.length) {
        const detail = failures.slice(0, 3).map((failure) => `${failure.order_number}: ${failure.reason}`).join(" ");
        if (ids.length === 1) throw new Error(detail);
        setError(detail);
      } else if (ids.length > 1) {
        setSelectedIds([]);
      }
      setNotice(payload.message || (queued ? "Pesanan masuk Pengiriman." : "Pesanan dikeluarkan dari Pengiriman."));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Antrean Pengiriman gagal diperbarui.");
    } finally {
      setQueuePendingIds((current) => current.filter((id) => !ids.includes(id)));
    }
  };

  const deleteOrders = async (ids: number[]) => {
    if (!ids.length || !window.confirm(`Hapus ${ids.length} pesanan terpilih? Stok akan dipulihkan.`)) return;
    setMutating(true);
    try {
      const response = await fetch("/api/admin/orders", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Pesanan gagal dihapus.");
      setNotice(payload.message || "Pesanan dihapus.");
      setSelectedIds([]);
      setRequestVersion((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pesanan gagal dihapus.");
    } finally { setMutating(false); }
  };

  const allVisibleSelected = orders.length > 0 && orders.every((order) => selectedIds.includes(order.id));
  const firstVisible = pagination.totalItems ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const lastVisible = Math.min(pagination.page * pagination.limit, pagination.totalItems);

  if (loading) return <div className="h-96 animate-pulse rounded-xl bg-slate-100" aria-label="Memuat daftar pesanan" aria-busy="true" />;

  return <div className="space-y-5">
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Ringkasan pesanan">
      {[
        ["Total pesanan", String(summary.totalOrders), "Semua pesanan masuk"],
        ["Belum dibayar", String(summary.unpaidCount), "Perlu follow-up pembayaran"],
        ["Antrean pengiriman", String(summary.fulfilmentCount), "Pesanan yang masuk Pengiriman"],
        ["Nilai pesanan", formatMyr(summary.totalValue), "Nilai bruto semua status"],
      ].map(([label, value, help]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">{label}</p>
        <p className="mt-2 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">{value}</p>
        <p className="mt-1 hidden text-xs text-slate-500 sm:block">{help}</p>
      </div>)}
    </section>

    <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Filter cepat status pesanan">
      {quickStatusFilters.map(([value, label]) => {
        const active = orderStatusFilter === value;
        return <button key={value} type="button" aria-pressed={active} onClick={() => { setOrderStatusFilter(value); setPage(1); }} className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-xs font-black ${active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
          {value !== "all" ? <span className={`size-2 rounded-full ${statusDots[value]}`} aria-hidden="true" /> : null}
          {label}<span className={`min-w-5 rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-white/20" : "bg-slate-100"}`}>{statusCounts[value] || 0}</span>
        </button>;
      })}
    </nav>

    {selectedIds.length ? <section className="sticky top-3 z-20 flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between" aria-label="Aksi massal pesanan">
      <div><p className="text-sm font-black text-slate-950">{selectedIds.length} pesanan dipilih</p><button type="button" className="mt-1 text-xs font-bold text-blue-700 hover:underline" onClick={() => setSelectedIds([])}>Batalkan pilihan</button></div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={mutating || selectedIds.some((id) => queuePendingIds.includes(id))} onClick={() => void setShippingQueue(selectedIds, true)}>
          {selectedIds.some((id) => queuePendingIds.includes(id)) ? <LoaderCircle className="animate-spin" /> : <Truck />}Masukkan ke Pengiriman
        </Button>
        <select className="admin-input-flat min-h-10" disabled={mutating} defaultValue="" onChange={(event) => {
          const value = event.target.value;
          const action = bulkStatusActions.find(([status]) => status === value);
          const confirmed = !["returned", "cancelled"].includes(value) || window.confirm(`${action?.[1] || "Ubah status"} untuk ${selectedIds.length} pesanan?`);
          if (value && confirmed) void updateStatuses(selectedIds, value);
          event.target.value = "";
        }} aria-label="Ubah status pesanan terpilih">
          <option value="">Ubah status</option>{bulkStatusActions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {mayDeleteOrders && <Button variant="destructive" disabled={mutating} onClick={() => void deleteOrders(selectedIds)}><Trash2 />Hapus</Button>}
      </div>
    </section> : null}

    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(14rem,1fr)_13rem_13rem_auto_auto]">
          <label className="relative"><span className="sr-only">Cari pesanan</span><Search className="absolute left-3 top-3.5 size-4 text-slate-400" /><Input className="h-11 pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nomor pesanan, pelanggan, produk, kota" /></label>
          <select className="admin-input-flat min-h-11" value={paymentFilter} onChange={(event) => { setPaymentFilter(event.target.value); setPage(1); }} aria-label="Filter status pembayaran">
            <option value="all">Semua pembayaran</option><option value="unpaid">Belum dibayar</option><option value="pending">Menunggu pembayaran</option><option value="paid">Lunas</option><option value="failed">Gagal</option><option value="refunded">Dikembalikan</option><option value="cancelled">Batal</option>
          </select>
          <AdminDateRangeFilter value={dateSelection} onChange={(value) => { setDateSelection(value); setPage(1); }} />
          <Button variant="outline" disabled={refreshing} onClick={() => setRequestVersion((value) => value + 1)}><RefreshCw className={refreshing ? "animate-spin" : ""} />Perbarui</Button>
          <Button variant="secondary" disabled={!query && orderStatusFilter === "all" && paymentFilter === "all" && dateSelection.filter === "all"} onClick={() => { setQuery(""); setOrderStatusFilter("all"); setPaymentFilter("all"); setDateSelection({ filter: "all", start: "", end: "" }); setPage(1); }}>Atur ulang</Button>
        </div>
        <p className="mt-3 text-xs font-bold text-slate-500" aria-live="polite">{refreshing ? "Memperbarui…" : `Menampilkan ${firstVisible}-${lastVisible} dari ${pagination.totalItems} pesanan`}</p>
        {notice ? <p className="mt-2 text-xs font-bold text-emerald-700" role="status">{notice}</p> : null}
        {error ? <p className="mt-2 text-xs font-bold text-rose-700" role="alert">{error}</p> : null}
      </div>

      <div className="grid grid-cols-1 gap-3 p-3 lg:hidden" aria-label="Daftar pesanan mobile">
        {orders.map((order) => <article key={order.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><a className="break-all font-black text-slate-950 hover:text-blue-600 hover:underline" href={`/admin/orders/${encodeURIComponent(order.order_number)}`}>{order.order_number}</a><p className="mt-1 text-[11px] text-slate-400">{formatAdminDateTime(order.created_at)}</p></div><PaymentBadge status={order.payment_status} /></div>
          <div className="mt-4 border-t border-slate-100 pt-4"><p className="font-black text-slate-900">{order.customer_name}</p><p className="mt-1 font-mono text-xs text-slate-500">{order.customer_phone}</p><p className="mt-1 text-xs text-slate-500">{[order.city, order.province, order.postal_code].filter(Boolean).join(", ")}</p></div>
          <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs"><div><p className="text-slate-500">Produk & total</p><p className="mt-1 truncate font-semibold text-slate-900">{order.product_name}</p><p className="truncate text-[11px] text-slate-500">{order.variant_name}</p><p className="mt-1 text-sm font-black text-slate-950">{formatMyr(order.total_amount)}</p></div><div><p className="mb-1 text-slate-500">Status</p><OrderStatusBadge order={order} /></div></div>
          <div className="mt-4"><p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Tindak lanjut WhatsApp</p>{renderCrmActions(order)}</div>
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3"><label className="flex min-h-11 items-center gap-2 text-xs font-bold text-slate-700"><Checkbox checked={selectedIds.includes(order.id)} onCheckedChange={(checked) => setSelectedIds((current) => checked ? [...new Set([...current, order.id])] : current.filter((id) => id !== order.id))} aria-label={`Pilih pesanan ${order.order_number}`} />Pilih</label><OrderMenu order={order} disabled={mutating} queuePending={queuePendingIds.includes(order.id)} canDelete={mayDeleteOrders} onQueue={(queued) => void setShippingQueue([order.id], queued)} onStatus={(status) => void updateStatuses([order.id], status)} onDelete={() => void deleteOrders([order.id])} /></div>
        </article>)}
      </div>

      <div className="hidden overflow-x-auto pb-16 lg:block" aria-label="Tabel pesanan desktop">
        <Table className="min-w-[1180px]">
          <TableHeader><TableRow className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500"><TableHead className="w-12 px-4"><Checkbox checked={allVisibleSelected ? true : selectedIds.some((id) => orders.some((order) => order.id === id)) ? "indeterminate" : false} onCheckedChange={(checked) => setSelectedIds((current) => checked ? [...new Set([...current, ...orders.map((order) => order.id)])] : current.filter((id) => !orders.some((order) => order.id === id)))} aria-label="Pilih semua pesanan di halaman ini" /></TableHead><TableHead className="w-44 border-r border-slate-200 px-5">Nomor pesanan</TableHead><TableHead className="w-52 px-4">Pemesan</TableHead><TableHead className="w-44 px-4">Status</TableHead><TableHead className="w-48 px-4">Pembayaran</TableHead><TableHead className="w-48 px-4 text-right">Produk & total</TableHead><TableHead className="w-56 px-4">Tindak lanjut WhatsApp</TableHead><TableHead className="w-24 px-4 text-right">Aksi</TableHead></TableRow></TableHeader>
          <TableBody>{orders.map((order) => <TableRow key={order.id} className="align-top hover:bg-slate-50"><TableCell className="px-4 py-4"><Checkbox checked={selectedIds.includes(order.id)} onCheckedChange={(checked) => setSelectedIds((current) => checked ? [...new Set([...current, order.id])] : current.filter((id) => id !== order.id))} aria-label={`Pilih pesanan ${order.order_number}`} /></TableCell><TableCell className="border-r border-slate-200 px-5 py-4"><a className="whitespace-nowrap font-black text-slate-950 hover:text-blue-600 hover:underline" href={`/admin/orders/${encodeURIComponent(order.order_number)}`}>{order.order_number}</a><p className="mt-1 text-[11px] text-slate-400">{formatAdminDateTime(order.created_at)}</p></TableCell><TableCell className="max-w-[210px] px-4 py-4"><a className="block truncate font-black text-slate-900 hover:underline" href={`/admin/orders/${encodeURIComponent(order.order_number)}`}>{order.customer_name}</a><p className="mt-1 font-mono text-[11px] text-slate-500">{order.customer_phone}</p><p className="mt-1 truncate text-[11px] text-slate-400">{[order.city, order.province, order.postal_code].filter(Boolean).join(", ") || "Alamat belum lengkap"}</p></TableCell><TableCell className="px-4 py-4"><OrderStatusBadge order={order} /></TableCell><TableCell className="px-4 py-4"><PaymentBadge status={order.payment_status} /><p className="mt-2 text-[10px] font-bold text-slate-500">{paymentMethodLabels[order.payment_method] || order.payment_method}</p></TableCell><TableCell className="px-4 py-4 text-right"><p className="ml-auto max-w-[180px] truncate text-xs font-semibold text-slate-900">{order.product_name}</p><p className="ml-auto mt-0.5 max-w-[180px] truncate text-[11px] text-slate-500">{order.variant_name}</p><p className="mt-1 text-sm font-black text-slate-950">{formatMyr(order.total_amount)}</p><p className="mt-1 text-[10px] text-slate-500">Ongkir {formatMyr(order.shipping_cost)}</p></TableCell><TableCell className="px-4 py-4">{renderCrmActions(order)}</TableCell><TableCell className="px-4 py-4 text-right"><OrderMenu order={order} disabled={mutating} queuePending={queuePendingIds.includes(order.id)} canDelete={mayDeleteOrders} onQueue={(queued) => void setShippingQueue([order.id], queued)} onStatus={(status) => void updateStatuses([order.id], status)} onDelete={() => void deleteOrders([order.id])} /></TableCell></TableRow>)}</TableBody>
        </Table>
      </div>

      {!orders.length ? <div className="border-t border-slate-200 p-10 text-center"><p className="text-sm font-black text-slate-950">Pesanan tidak ditemukan</p><p className="mt-1 text-xs text-slate-500">Ubah pencarian atau atur ulang filter.</p></div> : null}
      {pagination.totalPages > 1 ? <div className="border-t border-slate-200 px-4 py-3"><Pagination><PaginationContent className="w-full justify-between"><PaginationItem><PaginationPrevious href="#" onClick={(event) => { event.preventDefault(); if (page > 1) setPage(page - 1); }} className={page <= 1 ? "pointer-events-none opacity-50" : ""} /></PaginationItem><PaginationItem><PaginationLink href="#" isActive onClick={(event) => event.preventDefault()}>Halaman {page} dari {pagination.totalPages}</PaginationLink></PaginationItem><PaginationItem><PaginationNext href="#" onClick={(event) => { event.preventDefault(); if (page < pagination.totalPages) setPage(page + 1); }} className={page >= pagination.totalPages ? "pointer-events-none opacity-50" : ""} /></PaginationItem></PaginationContent></Pagination></div> : null}
    </section>
  </div>;
}

type StoredStatusAction = {
  value: string;
  label: string;
};

function storedStatusActions(order: OrderRow): StoredStatusAction[] {
  if (["delivered", "returned", "cancelled"].includes(order.shipping_status)) return [];
  const actions: StoredStatusAction[] = [];
  if (order.shipping_status === "pending") {
    actions.push({ value: "processing", label: "Tandai diproses" });
  }
  if (order.shipping_status === "processing") {
    actions.push({ value: "shipped", label: "Tandai dikirim" });
  }
  if (order.shipping_status === "shipped") {
    actions.push({ value: "delivered", label: "Tandai selesai" });
    actions.push({ value: "returned", label: "Tandai dikembalikan" });
  }
  if (["pending", "processing", "shipped"].includes(order.shipping_status)) {
    actions.push({ value: "cancelled", label: "Batalkan pesanan" });
  }
  return actions;
}

function OrderMenu({ order, disabled, queuePending, canDelete, onQueue, onStatus, onDelete }: {
  canDelete: boolean;
  order: OrderRow;
  disabled: boolean;
  queuePending: boolean;
  onQueue: (queued: boolean) => void;
  onStatus: (status: string) => void;
  onDelete: () => void;
}) {
  const queued = Boolean(order.shipping_queued_at);
  const queueLabel = queuePending
    ? queued ? "Mengeluarkan…" : "Memasukkan…"
    : queued ? "Keluarkan dari Pengiriman" : "Masukkan ke Pengiriman";
  const statusActions = storedStatusActions(order);
  const runStatusAction = (action: StoredStatusAction) => {
    if (["returned", "cancelled"].includes(action.value) && !window.confirm(`${action.label} untuk ${order.order_number}?`)) return;
    onStatus(action.value);
  };

  return <DropdownMenu>
    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-11 lg:size-8" disabled={disabled} aria-label={`Aksi pesanan ${order.order_number}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-72">
      <DropdownMenuLabel>Aksi pesanan</DropdownMenuLabel>
      <DropdownMenuItem asChild><a href={`/admin/orders/${encodeURIComponent(order.order_number)}`}><Eye />Lihat detail pesanan</a></DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>Pengiriman</DropdownMenuLabel>
      <DropdownMenuItem disabled={queuePending} onClick={() => onQueue(!queued)}>
        {queuePending ? <LoaderCircle className="animate-spin" /> : <Truck />}{queueLabel}
      </DropdownMenuItem>
      {queued ? <DropdownMenuItem asChild><a href={`/admin/shipping?q=${encodeURIComponent(order.order_number)}`}><Truck />Buka Pengiriman</a></DropdownMenuItem> : null}
      {statusActions.length ? <>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Ubah status pengiriman</DropdownMenuLabel>
        {statusActions.map((action) => <DropdownMenuItem key={action.value} onClick={() => runStatusAction(action)}>{action.label}</DropdownMenuItem>)}
      </> : null}
      <DropdownMenuSeparator />
      {canDelete && <DropdownMenuItem variant="destructive" onClick={onDelete}><Trash2 />Hapus pesanan</DropdownMenuItem>}
    </DropdownMenuContent>
  </DropdownMenu>;
}
