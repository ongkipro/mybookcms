import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Check, Clipboard, CreditCard, Edit3, LoaderCircle, MapPin,
  MessageCircle, MessageSquare, Package, RefreshCw, Save, Settings, Trash2, Truck,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { MalaysiaLocationCombobox } from "./MalaysiaLocationCombobox";
import { CrmActionGroup } from "./CrmActionGroup";
import { CRM_STEPS, type CrmStepKey } from "./CrmActionButton";
import { buildWaUrl, defaultCrmTemplates, renderCrmMessage } from "../../lib/crm-template";
import { formatMyr } from "../../lib/storefront-locale";
import type { AdminRole } from "../../lib/auth";
import { formatAdminDateTime } from "../../lib/admin-date-filter";

type Item = {
  id: number;
  product_title: string;
  variant_title: string;
  variant_sku: string;
  quantity: number;
  unit_price: number;
};

type PaymentEvent = {
  id: number;
  source: "checkout" | "return" | "notification" | "status" | "reconciliation" | "retry";
  provider_status: string | null;
  provider_state: string | null;
  resulting_status: string;
  received_at: string;
};

type PaymentAttempt = {
  correlation_id: string;
  environment: "sandbox" | "production";
  config_revision: number;
  provider_reference_masked: string | null;
  amount_sen: number;
  channel: string | null;
  provider_status: string | null;
  provider_state: string | null;
  local_status: string;
  error_class: string | null;
  reconcile_attempts: number;
  created_at: string;
  initiated_at: string | null;
  expires_at: string | null;
  updated_at: string;
  paid_at: string | null;
  terminal_at: string | null;
  stock_released_at: string | null;
  last_automatic_check_at: string | null;
  last_manual_check_at: string | null;
  next_reconcile_at: string | null;
  automatic_check_running_until: string | null;
  events: PaymentEvent[];
};

type PaymentOperations = {
  provider: "DOKU";
  config_health: "ready" | "disabled" | "changed" | "problem";
  environment: "sandbox" | "production" | null;
  can_view_payment_operations: boolean;
  reconcile_action_visible: boolean;
  can_reconcile: boolean;
  reconcile_block_reason: string | null;
  attempts: PaymentAttempt[];
};

type Order = {
  id: number;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  address: string;
  district: string;
  city: string;
  province: string;
  postal_code: string | null;
  location_id: number | null;
  total_amount: number;
  shipping_cost: number;
  shipping_zone: string | null;
  payment_method: "cod" | "manual_transfer" | "doku";
  payment_status: string;
  shipping_status: string;
  stock_restored_at: string | null;
  seller_name: string;
  seller_bank_name: string | null;
  seller_account_holder: string | null;
  seller_account_number: string | null;
  crm_templates: Record<string, string>;
  created_at: string;
  items: Item[];
  payment_operations: PaymentOperations | null;
};

type CustomerDraft = { customer_name: string; customer_phone: string; address: string; location_id: number | null; location_label: string };
type FulfilmentDraft = { shipping_status: string; shipping_cost_myr: string };

const shippingStatuses = ["pending", "processing", "shipped", "delivered", "returned", "cancelled"];
const paymentStatuses = ["unpaid", "pending", "paid", "failed", "refunded", "cancelled"];
const shippingLabels: Record<string, string> = {
  pending: "Menunggu", processing: "Diproses", shipped: "Dikirim",
  delivered: "Selesai", returned: "Dikembalikan", cancelled: "Dibatalkan",
};
const paymentLabels: Record<string, string> = {
  unpaid: "Belum dibayar", pending: "Menunggu pembayaran", paid: "Lunas",
  failed: "Gagal", refunded: "Dikembalikan", cancelled: "Batal",
};
const stockReleasingPaymentStatuses = new Set(["failed", "refunded", "cancelled"]);
const stockReleasingShippingStatuses = new Set(["returned", "cancelled"]);
const dokuStatusLabels: Record<string, string> = {
  created: "Dibuat", pending: "Menunggu konfirmasi", paid: "Lunas",
  failed: "Gagal", expired: "Kedaluwarsa", attention_required: "Perlu diperiksa",
};
const dokuSourceLabels: Record<PaymentEvent["source"], string> = {
  checkout: "Checkout dibuat", return: "Buyer kembali", notification: "Notifikasi DOKU",
  status: "Pemeriksaan manual", reconciliation: "Pemeriksaan otomatis", retry: "Percobaan pembayaran baru",
};
const dokuHealthLabels: Record<PaymentOperations["config_health"], string> = {
  ready: "Siap", disabled: "Dinonaktifkan", changed: "Konfigurasi berubah", problem: "Bermasalah",
};
const dokuErrorLabels: Record<string, string> = {
  configuration: "Konfigurasi DOKU", authentication: "Autentikasi DOKU",
  signature: "Verifikasi signature", timeout: "Batas waktu DOKU",
  provider: "Respons DOKU", local_transition: "Transisi pembayaran lokal",
};

function DokuPaymentOperations({
  order,
  onUpdated,
  copy,
  copied,
}: {
  order: Order;
  onUpdated: (order: Order) => void;
  copy: (key: string, value: string, label: string) => Promise<void>;
  copied: string;
}) {
  const operations = order.payment_operations;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);
  if (!operations) return null;
  const latest = operations.attempts[0];

  const reconcile = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(order.order_number)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reconcile_doku" }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || "Status DOKU belum dapat diperiksa.");
      }
      onUpdated(payload.data as Order);
      setConfirmOpen(false);
      toast.success(payload.message || "Status pembayaran DOKU telah diperiksa.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Status DOKU belum dapat diperiksa.");
      window.setTimeout(() => errorRef.current?.focus(), 0);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="gap-0 rounded-2xl py-0 shadow-xs" aria-busy={busy}>
      <CardHeader className="border-b bg-slate-50/50 p-4 sm:px-6">
        <CardTitle as="h2" className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500"><CreditCard className="size-4" />Operasional pembayaran DOKU</CardTitle>
        <CardDescription>Riwayat terverifikasi dan tindakan pemeriksaan yang tidak menampilkan kredensial atau payload provider.</CardDescription>
        <CardAction className="flex gap-2">
          <Badge variant="outline">{operations.environment === "production" ? "Production" : operations.environment === "sandbox" ? "Sandbox" : "Belum tersedia"}</Badge>
          <Badge variant="outline">{dokuHealthLabels[operations.config_health]}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-5 p-5 sm:p-6">
        {latest ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Info label="Status lokal" value={dokuStatusLabels[latest.local_status] || latest.local_status} />
              <Info label="Referensi provider" value={latest.provider_reference_masked || "Belum tersedia"} mono />
              <Info label="Channel" value={latest.channel || "Belum tersedia"} />
              <Info label="Jumlah" value={formatMyr(latest.amount_sen)} />
              <Info label="Terakhir dicek otomatis" value={latest.last_automatic_check_at ? formatAdminDateTime(latest.last_automatic_check_at) : "Belum pernah"} />
              <Info label="Terakhir dicek manual" value={latest.last_manual_check_at ? formatAdminDateTime(latest.last_manual_check_at) : "Belum pernah"} />
              <Info
                label="Pemeriksaan berikutnya"
                value={latest.next_reconcile_at
                  ? `${Date.parse(latest.next_reconcile_at) <= Date.now() ? "Lewat jadwal · " : ""}${formatAdminDateTime(latest.next_reconcile_at)}`
                  : "Tidak dijadwalkan lagi"}
              />
              <Info label="Klasifikasi kendala" value={latest.error_class ? dokuErrorLabels[latest.error_class] || "Respons DOKU" : "Tidak ada"} />
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">ID korelasi</p>
                  <p className="mt-1 break-all font-mono text-sm font-bold text-slate-900">{latest.correlation_id}</p>
                </div>
                <Button variant="outline" size="sm" className="min-h-11" onClick={() => void copy("doku-attempt", latest.correlation_id, "ID korelasi")}>
                  {copied === "doku-attempt" ? <Check /> : <Clipboard />}{copied === "doku-attempt" ? "Tersalin" : "Salin ID korelasi"}
                </Button>
              </div>
              {latest.automatic_check_running_until && <p className="mt-3 text-xs font-bold text-amber-800">Pemeriksaan otomatis sedang berjalan hingga {formatAdminDateTime(latest.automatic_check_running_until)}.</p>}
            </div>
            <div aria-live="polite">
              <p className="text-sm font-semibold text-slate-600">{operations.reconcile_block_reason || "Pemeriksaan manual tersedia untuk memastikan status terbaru dari DOKU."}</p>
              {operations.reconcile_action_visible && !operations.can_reconcile && (
                <Button className="mt-3 min-h-11 w-full sm:w-auto" disabled><RefreshCw />Cek status ke DOKU</Button>
              )}
              {operations.reconcile_action_visible && operations.can_reconcile && (
                <Dialog open={confirmOpen} onOpenChange={(open) => !busy && setConfirmOpen(open)}>
                  <DialogTrigger asChild><Button className="mt-3 min-h-11 w-full sm:w-auto"><RefreshCw />Cek status ke DOKU</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Cek status pembayaran ke DOKU?</DialogTitle>
                      <DialogDescription>Hasil terverifikasi dapat menandai pesanan sebagai lunas atau gagal dan dapat mengembalikan stok sesuai lifecycle pembayaran.</DialogDescription>
                    </DialogHeader>
                    {error && <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800">{error}</div>}
                    <DialogFooter>
                      <Button variant="outline" className="min-h-11" onClick={() => setConfirmOpen(false)} disabled={busy}>Batal</Button>
                      <Button className="min-h-11" onClick={() => void reconcile()} disabled={busy}>{busy ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}{busy ? "Memeriksa…" : "Cek status sekarang"}</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
            <details className="border-t border-slate-100 pt-4">
              <summary className="min-h-11 cursor-pointer py-3 text-sm font-black text-slate-900">Riwayat percobaan & peristiwa ({operations.attempts.length})</summary>
              <div className="space-y-5 pt-2">
                {operations.attempts.map((attempt, index) => (
                  <section key={attempt.correlation_id} aria-labelledby={`attempt-${index}`} className="rounded-xl border border-slate-200 p-4">
                    <h3 id={`attempt-${index}`} className="break-all font-mono text-sm font-black text-slate-950">{attempt.correlation_id}</h3>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{dokuStatusLabels[attempt.local_status] || attempt.local_status} · dibuat {formatAdminDateTime(attempt.created_at)} · {attempt.reconcile_attempts} pemeriksaan</p>
                    <ol className="mt-4 space-y-3 border-l border-slate-200 pl-4">
                      {attempt.events.map((event) => (
                        <li key={event.id} className="text-sm">
                          <p className="font-bold text-slate-900">{dokuSourceLabels[event.source]} · {dokuStatusLabels[event.resulting_status] || event.resulting_status}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{formatAdminDateTime(event.received_at)}{event.provider_status ? ` · ${event.provider_status}` : ""}</p>
                        </li>
                      ))}
                      {attempt.events.length === 0 && <li className="text-sm text-slate-500">Belum ada peristiwa tercatat.</li>}
                    </ol>
                  </section>
                ))}
              </div>
            </details>
          </>
        ) : <p className="text-sm font-semibold text-slate-500">Belum ada percobaan pembayaran DOKU.</p>}
      </CardContent>
    </Card>
  );
}


function customerDraft(order: Order): CustomerDraft {
  return {
    customer_name: order.customer_name || "",
    customer_phone: order.customer_phone || "",
    address: order.address || "",
    location_id: order.location_id ? Number(order.location_id) : null,
    location_label: [order.city, order.province, order.postal_code].filter(Boolean).join(", "),
  };
}

function fulfilmentDraft(order: Order): FulfilmentDraft {
  return {
    shipping_status: order.shipping_status || "pending",
    shipping_cost_myr: (Number(order.shipping_cost || 0) / 100).toFixed(2),
  };
}

function StatusBadge({ status, kind }: { status: string; kind: "payment" | "shipping" }) {
  const success = kind === "payment" ? status === "paid" : status === "delivered";
  const failed = ["failed", "cancelled", "returned", "refunded"].includes(status);
  const classes = success
    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
    : failed
      ? "border-rose-200 bg-rose-50 text-rose-900"
      : "border-amber-200 bg-amber-50 text-amber-900";
  const label = kind === "payment" ? paymentLabels[status] || status : shippingLabels[status] || status;
  return (
    <Badge variant="outline" className={`h-auto gap-1.5 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${classes}`}>
      <span className={`size-1.5 rounded-full ${success ? "bg-emerald-500" : failed ? "bg-rose-500" : "bg-amber-500"}`} aria-hidden="true" />
      {kind === "payment" ? "Bayar" : "Kirim"} · {label}
    </Badge>
  );
}

function LoadingState() {
  return (
    <div className="mx-auto max-w-7xl space-y-6" aria-busy="true" aria-label="Memuat detail order">
      <div className="h-44 animate-pulse rounded-2xl bg-slate-100" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />
        </div>
        <div className="space-y-6">
          <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-80 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

export function OrderDetail({
  invoice,
  adminRole = "customer_service",
}: { invoice: string; adminRole?: AdminRole }) {
  // The server refuses these to anyone but owner and admin. Hiding them here is
  // not the boundary — it is so an operator is never offered a control that
  // will fail, which reads as a broken page rather than a permission.
  const mayWriteOrderMoney = adminRole === "owner" || adminRole === "admin";
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerForm, setCustomerForm] = useState<CustomerDraft>({ customer_name: "", customer_phone: "", address: "", location_id: null, location_label: "" });
  const [customerError, setCustomerError] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [paymentDraft, setPaymentDraft] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);
  const [fulfilment, setFulfilment] = useState<FulfilmentDraft>({ shipping_status: "pending", shipping_cost_myr: "0.00" });
  const [fulfilmentError, setFulfilmentError] = useState("");
  const [savingFulfilment, setSavingFulfilment] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [clickedSteps, setClickedSteps] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState("");
  const customerErrorRef = useRef<HTMLDivElement>(null);

  const syncOrder = useCallback((data: Order) => {
    setOrder(data);
    setCustomerForm(customerDraft(data));
    setPaymentDraft(data.payment_status || "unpaid");
    setFulfilment(fulfilmentDraft(data));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(invoice)}`, { headers: { Accept: "application/json" } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Order tidak ditemukan.");
      syncOrder(payload.data as Order);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Order gagal dimuat.");
    } finally {
      setLoading(false);
    }
  }, [invoice, syncOrder]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("mybookcms:crm-clicks");
      if (stored) setClickedSteps(JSON.parse(stored));
    } catch {}
  }, []);

  const patchOrder = async (changes: Record<string, unknown>, fallbackMessage: string) => {
    const response = await fetch(`/api/admin/orders/${encodeURIComponent(invoice)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.success) throw new Error(payload.error || fallbackMessage);
    if (payload.data) syncOrder(payload.data as Order);
    toast.success(payload.message || fallbackMessage);
    return payload.data as Order | undefined;
  };

  const copy = async (key: string, value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      toast.success(`${label} disalin.`);
      window.setTimeout(() => setCopied(""), 1500);
    } catch {
      toast.error(`${label} gagal disalin.`);
    }
  };

  const customerDirty = order
    ? JSON.stringify(customerForm) !== JSON.stringify(customerDraft(order))
    : false;
  useEffect(() => {
    if (!customerOpen || !customerDirty) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [customerDirty, customerOpen]);
  useEffect(() => {
    if (customerError) customerErrorRef.current?.focus();
  }, [customerError]);

  const changeCustomerOpen = (next: boolean) => {
    if (!next && customerDirty && !savingCustomer && !window.confirm("Batalkan perubahan data pelanggan yang belum disimpan?")) return;
    if (next && order) setCustomerForm(customerDraft(order));
    setCustomerError("");
    setCustomerOpen(next);
  };

  const saveCustomer = async () => {
    if (!order || !customerDirty) return;
    const locationChanged = customerForm.location_id !== (order.location_id ? Number(order.location_id) : null);
    if (locationChanged && !customerForm.location_id) {
      setCustomerError("Pilih bandar, negeri, dan poskod dari hasil pencarian.");
      return;
    }
    setSavingCustomer(true);
    setCustomerError("");
    try {
      const updated = await patchOrder({
        customer_name: customerForm.customer_name,
        customer_phone: customerForm.customer_phone,
        address: customerForm.address,
        ...(locationChanged ? { location_id: customerForm.location_id } : {}),
      }, "Data pelanggan dan alamat diperbarui.");
      if (updated) setCustomerForm(customerDraft(updated));
      setCustomerOpen(false);
    } catch (cause) {
      setCustomerError(cause instanceof Error ? cause.message : "Data pelanggan gagal disimpan.");
    } finally {
      setSavingCustomer(false);
    }
  };

  const savePayment = async () => {
    if (!order || paymentDraft === order.payment_status) return;
    if (stockReleasingPaymentStatuses.has(paymentDraft) && !window.confirm(`Ubah status pembayaran ${order.order_number} menjadi “${paymentLabels[paymentDraft]}”? Stok yang masih dipesan akan dikembalikan.`)) return;
    setSavingPayment(true);
    setPaymentError("");
    try {
      await patchOrder({ payment_status: paymentDraft }, "Status pembayaran diperbarui.");
    } catch (cause) {
      setPaymentError(cause instanceof Error ? cause.message : "Status pembayaran gagal disimpan.");
    } finally {
      setSavingPayment(false);
    }
  };

  const fulfilmentDirty = order
    ? JSON.stringify(fulfilment) !== JSON.stringify(fulfilmentDraft(order))
    : false;
  const saveFulfilment = async () => {
    if (!order || !fulfilmentDirty) return;
    if (!/^\d+(?:\.\d{1,2})?$/.test(fulfilment.shipping_cost_myr.trim())) {
      setFulfilmentError("Biaya pengiriman harus berupa nominal RM dengan maksimal dua desimal.");
      return;
    }
    if (stockReleasingShippingStatuses.has(fulfilment.shipping_status) && !window.confirm(`Ubah status pengiriman ${order.order_number} menjadi “${shippingLabels[fulfilment.shipping_status]}”? Stok yang masih dipesan akan dikembalikan.`)) return;
    setSavingFulfilment(true);
    setFulfilmentError("");
    try {
      await patchOrder({
        shipping_status: fulfilment.shipping_status,
        ...(mayWriteOrderMoney
          ? { shipping_cost: Math.round(Number(fulfilment.shipping_cost_myr) * 100) }
          : {}),
      }, "Pengiriman diperbarui.");
    } catch (cause) {
      setFulfilmentError(cause instanceof Error ? cause.message : "Pengiriman gagal disimpan.");
    } finally {
      setSavingFulfilment(false);
    }
  };

  const deleteOrder = async () => {
    if (!order || !window.confirm(`Hapus ${order.order_number}? Item order akan dihapus dan stok yang masih dipesan akan dikembalikan. Tindakan ini tidak dapat dibatalkan.`)) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(invoice)}`, { method: "DELETE", headers: { Accept: "application/json" } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Order gagal dihapus.");
      toast.success(payload.message || "Order dihapus.");
      window.location.assign("/admin/orders");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Order gagal dihapus.");
      setDeleting(false);
    }
  };

  const crmMessages = useMemo(() => {
    if (!order) return {} as Record<string, string>;
    const productName = order.items.map((item) => [item.product_title, item.variant_title].filter(Boolean).join(" - ")).join(", ");
    const productPrice = order.items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
    const bankAccounts = [order.seller_bank_name, order.seller_account_number, order.seller_account_holder ? `a.n. ${order.seller_account_holder}` : ""].filter(Boolean).join(" ");
    return Object.fromEntries(CRM_STEPS.map((step) => [step.key, renderCrmMessage(order.crm_templates?.[step.key] || defaultCrmTemplates[step.key], {
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      address: order.address,
      district: order.district,
      city: order.city,
      province: order.province,
      postalCode: order.postal_code || "",
      orderNumber: order.order_number,
      productName,
      variantName: order.items.map((item) => item.variant_title).filter(Boolean).join(', '),
      productPrice,
      shippingCost: order.shipping_cost,
      totalAmount: order.total_amount,
      sellerName: order.seller_name,
      bankAccounts,
      orderDetailsLink: `${window.location.origin}/admin/orders/${encodeURIComponent(order.order_number)}`,
    })]));
  }, [order]);

  const crmUrls = useMemo(() => order
    ? Object.fromEntries(CRM_STEPS.map((step) => [step.key, buildWaUrl(order.customer_phone, crmMessages[step.key] || "")]))
    : {}, [crmMessages, order]);

  const markClicked = (step: CrmStepKey) => {
    if (!order) return;
    const key = `${order.id}_${step}`;
    setClickedSteps((current) => {
      const next = { ...current, [key]: true };
      try { window.localStorage.setItem("mybookcms:crm-clicks", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  if (loading) return <LoadingState />;
  if (error || !order) return (
    <div className="mx-auto max-w-xl rounded-2xl border border-rose-200 bg-rose-50 p-6" role="alert">
      <p className="font-black text-rose-900">Detail order gagal dimuat</p>
      <p className="mt-1 text-sm text-rose-800">{error || "Order tidak ditemukan."}</p>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" onClick={() => void load()}><RefreshCw />Coba lagi</Button>
        <Button variant="ghost" onClick={() => window.location.assign("/admin/orders")}><ArrowLeft />Kembali ke daftar</Button>
      </div>
    </div>
  );

  const fullAddress = [order.address, order.city, order.province, order.postal_code].filter(Boolean).join(", ");
  const productSubtotal = order.items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const directMessage = crmMessages.welcome || "";
  const stockReleased = Boolean(order.stock_restored_at)
    || stockReleasingPaymentStatuses.has(order.payment_status)
    || stockReleasingShippingStatuses.has(order.shipping_status);

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-4">
      <Card className="gap-0 rounded-2xl py-0 shadow-xs">
        <CardHeader className="border-b border-slate-100 p-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <a href="/admin/orders" className="inline-flex min-h-10 items-center gap-1.5 text-xs font-extrabold text-slate-600 transition-colors hover:text-slate-950">
              <ArrowLeft className="size-4" />Kembali ke daftar order
            </a>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Dialog open={customerOpen} onOpenChange={changeCustomerOpen}>
                <DialogTrigger asChild><Button variant="outline" size="lg"><Edit3 />Edit pelanggan</Button></DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Edit pelanggan & alamat pengiriman</DialogTitle>
                    <DialogDescription>Pilih lokasi Malaysia dari hasil pencarian. Ongkir dihitung ulang dari tarif D1 dan masih dapat disesuaikan.</DialogDescription>
                  </DialogHeader>
                  {customerError && <div ref={customerErrorRef} tabIndex={-1} role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800">{customerError}</div>}
                  <div className="grid grid-cols-1 gap-4">
                    <Field label="Nama pelanggan"><Input value={customerForm.customer_name} onChange={(event) => setCustomerForm((current) => ({ ...current, customer_name: event.target.value }))} disabled={savingCustomer} /></Field>
                    <Field label="Nomor WhatsApp Malaysia"><Input value={customerForm.customer_phone} onChange={(event) => setCustomerForm((current) => ({ ...current, customer_phone: event.target.value }))} inputMode="tel" disabled={savingCustomer} /></Field>
                    <Field label="Alamat jalan"><Textarea value={customerForm.address} onChange={(event) => setCustomerForm((current) => ({ ...current, address: event.target.value }))} className="min-h-28" disabled={savingCustomer} /></Field>
                    <Field label="Bandar, negeri, atau poskod"><MalaysiaLocationCombobox value={customerForm.location_label} selectedId={customerForm.location_id} disabled={savingCustomer} onChange={(value, option) => setCustomerForm((current) => ({ ...current, location_label: value, location_id: option ? Number(option.location_id) : null }))} /></Field>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => changeCustomerOpen(false)} disabled={savingCustomer}>Batal</Button>
                    <Button onClick={() => void saveCustomer()} disabled={savingCustomer || !customerDirty}>
                      {savingCustomer ? <LoaderCircle className="animate-spin" /> : <Save />}{savingCustomer ? "Menyimpan…" : "Simpan pelanggan"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              {mayWriteOrderMoney && (
                <Button variant="destructive" size="lg" onClick={() => void deleteOrder()} disabled={deleting}>
                  {deleting ? <LoaderCircle className="animate-spin" /> : <Trash2 />}{deleting ? "Menghapus…" : "Hapus"}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={order.payment_status} kind="payment" />
                <StatusBadge status={order.shipping_status} kind="shipping" />
                {stockReleased && <Badge variant="destructive" className="h-auto px-2.5 py-1 text-[10px] font-black uppercase tracking-wider">Stok dikembalikan</Badge>}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <h1 className="font-mono text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{order.order_number}</h1>
                <button type="button" onClick={() => void copy("invoice", order.order_number, "Nomor invoice")} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200 hover:text-slate-950" title="Salin nomor invoice">
                  {copied === "invoice" ? <Check className="size-3.5 text-emerald-600" /> : <Clipboard className="size-3.5" />}{copied === "invoice" ? "Tersalin" : "Salin"}
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500">Dibuat {formatAdminDateTime(order.created_at)} · ID internal <span className="font-mono font-bold">{order.id}</span></p>
            </div>
            <a href={buildWaUrl(order.customer_phone, directMessage)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-black text-white transition-colors hover:bg-emerald-800 lg:w-auto">
              <MessageCircle className="size-4" />Chat WhatsApp
            </a>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <main className="space-y-6 lg:col-span-2">
          <Card className="gap-0 rounded-2xl py-0 shadow-xs">
            <CardHeader className="border-b bg-slate-50/50 p-4 sm:px-6">
              <CardTitle as="h2" className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500"><MapPin className="size-4" />Pelanggan & alamat pengiriman</CardTitle>
              <CardAction><Button variant="outline" size="sm" onClick={() => void copy("address", fullAddress, "Alamat pelanggan")} disabled={!fullAddress}>{copied === "address" ? <Check /> : <Clipboard />}{copied === "address" ? "Tersalin" : "Salin alamat"}</Button></CardAction>
            </CardHeader>
            <CardContent className="space-y-5 p-5 sm:p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Info label="Nama pelanggan" value={order.customer_name || "—"} />
                <Info label="Nomor WhatsApp" value={order.customer_phone || "—"} mono />
              </div>
              <div className="border-t border-slate-100 pt-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Alamat jalan</p>
                <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-800">{order.address || "Alamat jalan belum diisi"}</p>
                <p className="mt-1 text-xs font-medium text-slate-500">{[order.city, order.province, order.postal_code].filter(Boolean).join(", ") || "Tujuan belum tersedia"}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0 rounded-2xl py-0 shadow-xs">
            <CardHeader className="border-b bg-slate-50/50 p-4 sm:px-6">
              <CardTitle as="h2" className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500"><Package className="size-4" />Rincian produk dipesan</CardTitle>
              <CardAction><Badge variant="secondary">{order.items.length} item</Badge></CardAction>
            </CardHeader>
            <CardContent className="divide-y divide-slate-100 p-0">
              {order.items.length === 0 ? <p className="p-6 text-center text-sm font-semibold text-slate-500">Rincian item belum tersedia.</p> : order.items.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-4 p-4 sm:p-5">
                  <div className="min-w-0"><h3 className="font-black text-slate-950">{item.product_title || "Produk"}</h3><p className="mt-1 text-xs font-medium text-slate-500">{item.variant_title || "Standard"}{item.variant_sku ? ` · SKU ${item.variant_sku}` : ""}</p></div>
                  <div className="shrink-0 text-right"><p className="font-black tabular-nums text-slate-950">{formatMyr(item.unit_price * item.quantity)}</p><p className="mt-1 text-[11px] font-bold text-slate-500">{item.quantity} × {formatMyr(item.unit_price)}</p></div>
                </div>
              ))}
            </CardContent>
          </Card>

          {order.payment_method === "doku" && (
            <DokuPaymentOperations order={order} onUpdated={syncOrder} copy={copy} copied={copied} />
          )}

          <Card className="gap-0 rounded-2xl py-0 shadow-xs">
            <CardHeader className="border-b bg-slate-50/50 p-4 sm:px-6">
              <CardTitle as="h2" className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500"><Truck className="size-4" />Pengiriman</CardTitle>
              <CardDescription>Status dicatat manual. Informasi resi dikirim langsung melalui WhatsApp dan tidak disimpan di sistem.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 p-5 sm:p-6">
              {fulfilmentError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800">{fulfilmentError}</div>}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Status pengiriman"><select className="admin-input-flat" value={fulfilment.shipping_status} onChange={(event) => setFulfilment((current) => ({ ...current, shipping_status: event.target.value }))} disabled={savingFulfilment}>{shippingStatuses.map((status) => <option key={status} value={status} disabled={(status === "pending" && order.shipping_status !== "pending") || (stockReleased && !stockReleasingShippingStatuses.has(status)) || (status === "delivered" && order.payment_method !== "cod" && order.payment_status !== "paid")}>{shippingLabels[status]}</option>)}</select></Field>
                {mayWriteOrderMoney ? (
                  <Field label="Biaya pengiriman (RM)"><Input value={fulfilment.shipping_cost_myr} onChange={(event) => setFulfilment((current) => ({ ...current, shipping_cost_myr: event.target.value }))} inputMode="decimal" disabled={savingFulfilment} /></Field>
                ) : (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Biaya pengiriman</p>
                    <p className="mt-1 font-black text-slate-950">{formatMyr(order.shipping_cost)}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">Dihitung ulang otomatis ketika alamat diubah. Nilai manual hanya dapat diatur oleh owner atau admin.</p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
                <Info label="Zona pengiriman" value={order.shipping_zone || "Belum ditentukan"} />
                <Info label="Biaya tersimpan" value={formatMyr(order.shipping_cost)} />
              </div>
              <div className="flex justify-end border-t border-slate-100 pt-4">
                <Button size="lg" onClick={() => void saveFulfilment()} disabled={savingFulfilment || !fulfilmentDirty}>
                  {savingFulfilment ? <LoaderCircle className="animate-spin" /> : <Save />}{savingFulfilment ? "Menyimpan…" : fulfilmentDirty ? "Simpan pengiriman" : "Tidak ada perubahan"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>

        <aside className="space-y-6">
          <Card className="gap-0 rounded-2xl py-0 shadow-xs">
            <CardHeader className="border-b bg-slate-50/50 p-4 sm:px-6">
              <CardTitle as="h2" className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500"><CreditCard className="size-4" />Ringkasan pembayaran</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5 sm:p-6">
              {paymentError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800">{paymentError}</div>}
              <div className="flex items-center justify-between gap-3 text-sm"><span className="text-slate-500">Metode</span><strong>{order.payment_method === "cod" ? "COD" : order.payment_method === "doku" ? "DOKU" : "Transfer bank manual"}</strong></div>
              {order.payment_method === "doku" ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Status pembayaran</p>
                  <p className="mt-1 font-black text-slate-950">{paymentLabels[order.payment_status] || order.payment_status}</p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">Status DOKU hanya berubah dari notifikasi atau pemeriksaan provider yang terverifikasi.</p>
                </div>
              ) : (
                mayWriteOrderMoney ? (
                  <Field label="Status pembayaran"><select className="admin-input-flat" value={paymentDraft} onChange={(event) => setPaymentDraft(event.target.value)} disabled={savingPayment}>{paymentStatuses.map((status) => <option key={status} value={status} disabled={stockReleased && !stockReleasingPaymentStatuses.has(status)}>{paymentLabels[status]}</option>)}</select></Field>
                ) : (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Status pembayaran</p>
                    <p className="mt-1 font-black text-slate-950">{paymentLabels[order.payment_status] || order.payment_status}</p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-600">Menandai pesanan lunas adalah keputusan owner atau admin.</p>
                  </div>
                )
              )}
              {order.payment_method === "manual_transfer" && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600"><p className="font-black text-slate-900">{order.seller_bank_name || "Bank"}</p><p className="mt-1 font-mono">{order.seller_account_number || "Nomor rekening belum tersimpan"}</p><p className="mt-1">a.n. {order.seller_account_holder || "-"}</p></div>}
              <dl className="space-y-2 border-t border-slate-100 pt-4 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-slate-500">Subtotal produk</dt><dd className="font-bold tabular-nums">{formatMyr(productSubtotal)}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-slate-500">Biaya pengiriman</dt><dd className="font-bold tabular-nums">{formatMyr(order.shipping_cost)}</dd></div>
                <div className="flex items-end justify-between gap-4 border-t-2 border-slate-900 pt-3"><dt className="font-black text-slate-950">Total tagihan</dt><dd className="text-xl font-black tabular-nums text-emerald-700">{formatMyr(order.total_amount)}</dd></div>
              </dl>
              {order.payment_method !== "doku" && mayWriteOrderMoney && (
                <Button className="w-full" size="lg" onClick={() => void savePayment()} disabled={savingPayment || paymentDraft === order.payment_status}>
                  {savingPayment ? <LoaderCircle className="animate-spin" /> : <Save />}{savingPayment ? "Menyimpan…" : paymentDraft === order.payment_status ? "Tidak ada perubahan" : "Simpan pembayaran"}
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="gap-0 rounded-2xl py-0 shadow-xs">
            <CardHeader className="border-b bg-slate-50/50 p-4 sm:px-6">
              <CardTitle as="h2" className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500"><MessageSquare className="size-4" />CRM Follow-up WhatsApp</CardTitle>
              <CardDescription>Sepuluh template Malaysia dari pengaturan CRM.</CardDescription>
              <CardAction><a href="/admin/settings/crm" className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Buka pengaturan CRM"><Settings className="size-4" /></a></CardAction>
            </CardHeader>
            <CardContent className="p-4 sm:p-5">
              <CrmActionGroup crmUrls={crmUrls} clickedSteps={Object.fromEntries(CRM_STEPS.map((step) => [step.key, Boolean(clickedSteps[`${order.id}_${step.key}`])]))} onStepClick={markClicked} collapsible defaultExpanded />
              <div className="mt-4 border-t border-slate-100 pt-4">
                <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Salin template</p>
                <div className="grid grid-cols-2 gap-2">{CRM_STEPS.map((step) => <button key={step.key} type="button" title={`Salin ${step.title}`} onClick={() => void copy(`crm-${step.key}`, crmMessages[step.key] || "", `Template ${step.label}`)} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2 text-xs font-bold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 sm:min-h-9">{copied === `crm-${step.key}` ? <Check className="size-3.5 text-emerald-600" /> : <Clipboard className="size-3.5" />}{copied === `crm-${step.key}` ? "Tersalin" : step.label}</button>)}</div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid grid-cols-1 gap-1.5 text-xs font-bold text-slate-600"><span>{label}</span>{children}</label>;
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className={`mt-1 break-words font-black text-slate-950 ${mono ? "font-mono text-sm" : ""}`}>{value}</p></div>;
}
