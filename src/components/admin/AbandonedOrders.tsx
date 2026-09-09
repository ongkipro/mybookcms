import { useEffect, useRef, useState } from 'react';
import { MessageCircle, NotebookPen, ShoppingBag } from 'lucide-react';
import { Button, buttonVariants } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { MalaysiaLocationCombobox, type MalaysiaLocationOption } from './MalaysiaLocationCombobox';
import { buildWaUrl } from '../../lib/crm-template';
import { formatMyr } from '../../lib/storefront-locale';
import { formatAdminDateTime } from '../../lib/admin-date-filter';

type Lead = {id: number; customer_name: string; customer_phone: string; variant_id: number; product_name: string; variant_name: string; follow_up_status: string; follow_up_note: string; followed_up_by: string | null; followed_up_at: string | null; created_at: string};
type Variant = {id: number; product_name: string; variant_name: string; price: number; stock: number | null};
const statuses: Record<string, string> = {new: 'Belum dihubungi', contacted: 'Sudah dihubungi', qualified: 'Berminat', not_interested: 'Tidak berminat'};
const selectClass = 'min-h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm';

async function read(response: Response) {
  const body = await response.json();
  if (!response.ok || !body.success) throw new Error(body.error || 'Permintaan gagal. Coba lagi.');
  return body;
}

export function AbandonedOrders() {
  const [rows, setRows] = useState<Lead[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [cod, setCod] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const previousSearch = useRef(search);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [dialog, setDialog] = useState<{lead: Lead; mode: 'follow' | 'convert'} | null>(null);
  const activeDialog = useRef(dialog);
  activeDialog.current = dialog;
  const [orderNumber, setOrderNumber] = useState('');
  const trigger = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const delay = previousSearch.current === search ? 0 : 250;
    previousSearch.current = search;
    setLoading(true); setError('');
    const timer = window.setTimeout(async () => {
      try {
        const query = new URLSearchParams({search, status, page: String(page)});
        const body = await read(await fetch(`/api/admin/orders/leads?${query}`, {signal: controller.signal}));
        if (controller.signal.aborted) return;
        setRows(body.data); setVariants(body.variants); setCod(body.cod_enabled); setTotal(body.pagination.total_items); setHasLoaded(true);
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Daftar gagal dimuat.'); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, delay);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [search, status, page, version]);

  const filtered = Boolean(search || status !== 'all');
  const resetFilters = () => {setSearch(''); setStatus('all'); setPage(1);};
  const open = (lead: Lead, mode: 'follow' | 'convert', element: HTMLElement) => {trigger.current = element; setDialog({lead, mode});};
  const actions = (lead: Lead) => <div role="group" aria-label={`Aksi LEAD-${lead.id}`} className="flex flex-nowrap gap-2">
    <a className={`${buttonVariants({variant: 'outline', size: 'icon'})} size-11`} href={buildWaUrl(lead.customer_phone, `Hai ${lead.customer_name}, adakah anda memerlukan bantuan untuk menyambung pesanan ${lead.product_name} - ${lead.variant_name}?`)} target="_blank" rel="noopener noreferrer" title="WhatsApp" aria-label={`WhatsApp LEAD-${lead.id} (tab baru)`}><MessageCircle aria-hidden="true" /></a>
    <Button className="size-11" size="icon" variant="outline" title="Ubah status" aria-label={`Ubah status LEAD-${lead.id}`} onClick={e => open(lead, 'follow', e.currentTarget)}><NotebookPen aria-hidden="true" /></Button>
    <Button className="size-11" size="icon" title="Jadikan pesanan" aria-label={`Jadikan pesanan LEAD-${lead.id}`} onClick={e => open(lead, 'convert', e.currentTarget)}><ShoppingBag aria-hidden="true" /></Button>
  </div>;

  return <section className="space-y-4">
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_14rem_auto]">
        <label className="space-y-1.5 text-sm font-medium">Cari lead
          <Input className="min-h-11" type="search" aria-label="Cari pesanan tertinggal" placeholder="Nama, WhatsApp, produk, atau lead" maxLength={120} value={search} onChange={e => {setSearch(e.target.value); setPage(1);}} />
        </label>
        <label className="space-y-1.5 text-sm font-medium">Status lead
          <select aria-label="Status lead" className={selectClass} value={status} onChange={e => {setStatus(e.target.value); setPage(1);}}><option value="all">Semua status</option>{Object.entries(statuses).filter(([value]) => value === 'new' || value === 'contacted' || value === status || rows.some(lead => lead.follow_up_status === value)).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </label>
        <Button className="min-h-11" variant="outline" onClick={() => setVersion(v => v + 1)} disabled={loading}>Muat ulang</Button>
      </div>
      <div className="mt-3 flex min-h-6 flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" role="status">{error ? (hasLoaded ? 'Menampilkan hasil sebelumnya.' : 'Daftar belum tersedia.') : loading ? (hasLoaded ? 'Memperbarui daftar…' : 'Memuat pesanan tertinggal…') : `${total} lead ditemukan`}</p>
        {filtered && <Button className="min-h-11" variant="ghost" onClick={resetFilters}>Atur ulang filter</Button>}
      </div>
      {error && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive" role="alert"><span>{error}</span><Button className="min-h-11" variant="outline" onClick={() => setVersion(v => v + 1)}>Coba lagi</Button></div>}
      {orderNumber && <p className="mt-3 text-sm text-emerald-800" role="status">Sudah jadi pesanan: <a className="underline" href={`/admin/orders/${encodeURIComponent(orderNumber)}`}>{orderNumber}</a></p>}
    </div>
    {loading && !hasLoaded && <div aria-hidden="true" className="divide-y divide-border rounded-xl border border-border bg-background px-4">{[0, 1, 2].map(row => <div key={row} className="grid grid-cols-1 gap-4 py-5 sm:grid-cols-3"><div className="space-y-2"><Skeleton className="h-4 w-36 motion-reduce:animate-none" /><Skeleton className="h-3 w-48 max-w-full motion-reduce:animate-none" /></div><Skeleton className="h-4 w-40 motion-reduce:animate-none" /><Skeleton className="h-11 w-44 motion-reduce:animate-none" /></div>)}</div>}
    {!loading && !error && !rows.length && <div className="rounded-xl border border-border bg-background p-8 text-center"><h2 className="font-semibold">{filtered ? 'Tidak ada lead yang cocok' : 'Belum ada pesanan tertinggal'}</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{filtered ? 'Ubah pencarian atau atur ulang filter untuk melihat lead lainnya.' : 'Lead muncul setelah pembeli mengisi nama, WhatsApp Malaysia, dan varian tanpa menyelesaikan checkout.'}</p></div>}
    <div className="grid grid-cols-1 gap-3 lg:hidden">{rows.map(lead => <article key={lead.id} className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="min-w-0"><h2 className="break-words font-semibold">{lead.customer_name}</h2><p className="mt-1 text-xs text-muted-foreground">LEAD-{lead.id} · {formatAdminDateTime(lead.created_at)}</p></div>
      <p className="text-sm tabular-nums">{lead.customer_phone}</p><div className="min-w-0 text-sm"><p className="break-words font-medium">{lead.product_name}</p><p className="mt-1 break-words text-muted-foreground">{lead.variant_name} · 1 item</p></div>
      <Badge variant="secondary" className="h-auto min-h-6 whitespace-normal">{statuses[lead.follow_up_status]}</Badge>
      {lead.follow_up_note && <p className="whitespace-pre-wrap break-words text-sm text-slate-600">{lead.follow_up_note}</p>}
      {lead.followed_up_at && <p className="break-words text-xs text-muted-foreground">{lead.followed_up_by} · {formatAdminDateTime(lead.followed_up_at)}</p>}
      {actions(lead)}
    </article>)}</div>
    {!!rows.length && <div className="hidden overflow-x-auto rounded-xl border border-border bg-card lg:block"><table className="w-full table-fixed text-left text-sm"><caption className="sr-only">Checkout yang belum selesai dan tindak lanjut customer service</caption><thead className="bg-muted text-xs text-slate-600"><tr>{['Customer', 'Produk & varian', 'Status', 'Aksi'].map(h => <th key={h} scope="col" className="p-4">{h}</th>)}</tr></thead><tbody>{rows.map(lead => <tr key={lead.id} className="border-t border-border align-top">
      <td className="break-words p-4"><strong>{lead.customer_name}</strong><p className="mt-1 tabular-nums">{lead.customer_phone}</p><p className="mt-2 text-xs text-muted-foreground">LEAD-{lead.id}<br />{formatAdminDateTime(lead.created_at)}</p></td>
      <td className="break-words p-4">{lead.product_name}<p className="text-muted-foreground">{lead.variant_name} · 1 item</p></td>
      <td className="max-w-64 p-4"><Badge variant="secondary" className="h-auto min-h-6 whitespace-normal">{statuses[lead.follow_up_status]}</Badge><p className="mt-1 whitespace-pre-wrap break-words text-slate-600">{lead.follow_up_note}</p>{lead.followed_up_at && <p className="mt-1 break-words text-xs text-muted-foreground">{lead.followed_up_by} · {formatAdminDateTime(lead.followed_up_at)}</p>}</td>
      <td className="max-w-80 p-4">{actions(lead)}</td>
    </tr>)}</tbody></table></div>}
    {total > 20 && <nav aria-label="Halaman lead" className="flex items-center justify-between gap-3"><Button className="min-h-11" variant="outline" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>Sebelumnya</Button><span className="text-sm">Halaman {page} / {Math.ceil(total / 20)}</span><Button className="min-h-11" variant="outline" disabled={page * 20 >= total || loading} onClick={() => setPage(p => p + 1)}>Berikutnya</Button></nav>}
    <Dialog open={!!dialog} onOpenChange={next => {if (!next) setDialog(null);}}>
      {dialog && <LeadDialog key={`${dialog.lead.id}-${dialog.mode}`} {...dialog} variants={variants} cod={cod} onClose={() => setDialog(null)} onConvert={() => setDialog({lead: dialog.lead, mode: 'convert'})} onDone={number => {if (number) setOrderNumber(number); setDialog(null); setVersion(v => v + 1);}} onRestoreFocus={() => {if (!activeDialog.current) trigger.current?.focus();}} />}
    </Dialog>
  </section>;
}

function LeadDialog({lead, mode, variants, cod, onDone, onClose, onConvert, onRestoreFocus}: {lead: Lead; mode: 'follow' | 'convert'; variants: Variant[]; cod: boolean; onDone: (orderNumber?: string) => void; onClose: () => void; onConvert: () => void; onRestoreFocus: () => void}) {
  const [name, setName] = useState(lead.customer_name);
  const [phone, setPhone] = useState(lead.customer_phone);
  const [variantId, setVariantId] = useState(String(lead.variant_id));
  const [address, setAddress] = useState('');
  const [locationText, setLocationText] = useState('');
  const [location, setLocation] = useState<MalaysiaLocationOption | null>(null);
  const [quote, setQuote] = useState<{key: string; amount: number} | null>(null);
  const [quoteError, setQuoteError] = useState('');
  const [quoteVersion, setQuoteVersion] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLParagraphElement>(null);
  const variant = variants.find(v => String(v.id) === variantId);
  const quoteKey = `${variantId}:${location?.location_id || ''}`;
  const amount = quote?.key === quoteKey ? quote.amount : null;
  useEffect(() => {if (error) errorRef.current?.focus();}, [error]);
  useEffect(() => {
    setQuote(null); setQuoteError('');
    if (!location || mode !== 'convert') return;
    const controller = new AbortController();
    void (async () => {
      try {
        const body = await read(await fetch(`/api/shipping-rates?postcode=${encodeURIComponent(location.postcode)}&variant_id=${encodeURIComponent(variantId)}`, {signal: controller.signal}));
        const cost = body.rates?.[0]?.shipping_cost;
        if (!Number.isInteger(cost) || cost < 0) throw new Error('Tarif pengiriman belum tersedia.');
        if (!controller.signal.aborted) setQuote({key: quoteKey, amount: cost});
      } catch (cause) {if (!controller.signal.aborted) setQuoteError(cause instanceof Error ? cause.message : 'Tarif gagal dimuat.');}
    })();
    return () => controller.abort();
  }, [location, variantId, quoteKey, mode, quoteVersion]);

  return <DialogContent className="sm:max-w-xl" onEscapeKeyDown={e => {if (pending) e.preventDefault();}} onPointerDownOutside={e => {if (pending) e.preventDefault();}} showCloseButton={!pending} onCloseAutoFocus={e => {e.preventDefault(); onRestoreFocus();}}>
    <DialogHeader><DialogTitle>{mode === 'follow' ? 'Ubah status' : 'Jadikan pesanan'} · LEAD-{lead.id}</DialogTitle><DialogDescription>{mode === 'follow' ? 'Pilih Sudah dihubungi setelah berkomunikasi dengan customer, atau Jadikan pesanan untuk melengkapi order COD.' : 'Lengkapi alamat dan periksa total. Stok diperiksa saat pesanan dibuat. Lead belum mengurangi stok.'}</DialogDescription></DialogHeader>
    <form className="space-y-4" onSubmit={async e => {
      e.preventDefault(); if (pending) return; setPending(true); setError('');
      try {
        const data = mode === 'follow' ? {id: lead.id, follow_up_status: 'contacted'} : {id: lead.id, customer_name: name, customer_phone: phone, variant_id: Number(variantId), address, location_id: Number(location?.location_id), shipping_cost: amount};
        const body = await read(await fetch('/api/admin/orders/leads', {method: mode === 'follow' ? 'PATCH' : 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)}));
        onDone(body.data?.order_number);
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Perubahan gagal disimpan.'); }
      finally {setPending(false);}
    }}>
      <fieldset disabled={pending} className="space-y-4">
        {mode === 'follow' ? <>
          <label className="block text-sm font-semibold">Status<select className={`${selectClass} mt-1`} value="contacted" onChange={e => {if (e.target.value === 'convert') onConvert();}}><option value="contacted">Sudah dihubungi</option><option value="convert">Jadikan pesanan</option></select></label>
          <p className="text-sm text-muted-foreground">Status saat ini: {statuses[lead.follow_up_status]}. Membuka WhatsApp tidak otomatis mengubah status.</p>
          {lead.follow_up_note && <div className="rounded-lg bg-muted p-3 text-sm"><p className="font-medium">Catatan sebelumnya</p><p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{lead.follow_up_note}</p></div>}
        </> : <>
          <h3 className="text-sm font-semibold text-muted-foreground">Customer</h3>
          <label className="block text-sm font-semibold">Nama penerima<Input className="mt-1 min-h-11" required minLength={2} maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label>
          <label className="block text-sm font-semibold">WhatsApp Malaysia<Input className="mt-1 min-h-11" required type="tel" maxLength={40} value={phone} onChange={e => setPhone(e.target.value)} /></label>
          <h3 className="border-t border-border pt-4 text-sm font-semibold text-muted-foreground">Produk</h3>
          <label className="block text-sm font-semibold">Produk & varian<select className={`${selectClass} mt-1`} required value={variantId} onChange={e => setVariantId(e.target.value)}><option value="">Pilih varian aktif</option>{variants.map(v => <option key={v.id} value={v.id}>{v.product_name} — {v.variant_name} · {formatMyr(v.price)}</option>)}</select></label>
          {variant && <p className="break-words text-sm text-muted-foreground">{variant.product_name} — {variant.variant_name}</p>}
          <p className="text-sm text-slate-600">Jumlah: 1 item{variant?.stock != null ? ` · Stok saat dimuat: ${variant.stock}` : ''}</p>
          <h3 className="border-t border-border pt-4 text-sm font-semibold text-muted-foreground">Pengiriman</h3>
          <label className="block text-sm font-semibold">Alamat lengkap<Textarea required minLength={10} maxLength={500} className="mt-1 min-h-24" value={address} onChange={e => setAddress(e.target.value)} /></label>
          <div className="space-y-1"><p className="text-sm font-semibold">Lokasi pengiriman</p><MalaysiaLocationCombobox value={locationText} selectedId={location ? Number(location.location_id) : null} onChange={(value, option) => {setLocationText(value); setLocation(option);}} /></div>
          {location && <p className="break-words text-sm text-slate-600" aria-live="polite">{location.city}, {location.province} · Poskod {location.postcode}</p>}
          {quoteError && <p className="text-sm text-red-700" role="alert">{quoteError} <Button className="min-h-11" type="button" variant="outline" onClick={() => setQuoteVersion(v => v + 1)}>Coba tarif lagi</Button></p>}
          <dl className="space-y-2 rounded-lg bg-muted p-3 text-sm"><div className="flex justify-between"><dt>Produk</dt><dd>{variant ? formatMyr(variant.price) : '—'}</dd></div><div className="flex justify-between"><dt>Pengiriman</dt><dd>{amount !== null ? formatMyr(amount) : quoteError ? 'Tarif belum tersedia' : location ? 'Memuat tarif…' : 'Pilih lokasi'}</dd></div><div className="flex justify-between font-bold"><dt>Total COD</dt><dd>{variant && amount !== null ? formatMyr(variant.price + amount) : '—'}</dd></div></dl>
          {!cod && <p className="text-sm text-amber-800" role="status">COD sedang dinonaktifkan. Lead tetap tersimpan.</p>}
          {variant?.stock === 0 && <p className="text-sm text-amber-800">Stok varian habis. Pilih varian lain.</p>}
        </>}
      </fieldset>
      {error && <p ref={errorRef} tabIndex={-1} role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2"><Button className="min-h-11" type="button" variant="outline" disabled={pending} onClick={onClose}>Batal</Button><Button className="min-h-11" type="submit" disabled={pending || (mode === 'convert' && (!cod || !variant || variant.stock === 0 || amount === null || !location))}>{pending ? 'Menyimpan…' : mode === 'follow' ? 'Simpan status' : 'Buat pesanan COD'}</Button></div>
    </form>
  </DialogContent>;
}
