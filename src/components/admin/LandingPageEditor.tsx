import {useEffect, useRef, useState} from "react";
import {AlignLeft, ArrowDown, ArrowUp, Code2, Copy, ExternalLink, Eye, Image as ImageIcon, List, ListOrdered, Pencil, Plus, Save, ShoppingBag, Trash2, Type} from "lucide-react";
import {Button} from "../ui/button";
import {Input} from "../ui/input";
import {Textarea} from "../ui/textarea";
import {formatMyr} from "../../lib/storefront-locale";
import {LANDING_SECTION_TYPES, normalizeLandingContent, parseShortcodes, renderLandingContent, type LandingSectionType, type LandingContentConfig} from "../../lib/landing-content";
import "../../styles/landing-pages/landing.css";

type Variant = {id: number; title: string; price: number; compare_price?: number | null};
type Product = {id: number | string; title: string; variants?: Variant[]};
type FormConfig = {selected_variant_id?: string; section_title?: string; button_text?: string};
type Section = {id: string; type: LandingSectionType; content_html?: string; content_config?: LandingContentConfig | null; form_config?: FormConfig | null};
type Draft = {title: string; slug: string; product_id: string; is_active: boolean; meta_title: string; meta_description: string; sections: Section[]};
const emptyDraft: Draft = {title: "", slug: "", product_id: "", is_active: false, meta_title: "", meta_description: "", sections: []};
const labels: Record<LandingSectionType, string> = {headline: "Judul", paragraph: "Paragraf", numbered_list: "Daftar bernomor", bullet_list: "Daftar poin", image: "Gambar", html: "HTML", form: "Form checkout"};
function pageDraft(page: Draft): Draft {
  return {title: page.title, slug: page.slug, product_id: String(page.product_id), is_active: Boolean(page.is_active), meta_title: page.meta_title || "", meta_description: page.meta_description || "", sections: page.sections || []};
}
const sectionIcons = {headline: Type, paragraph: AlignLeft, numbered_list: ListOrdered, bullet_list: List, image: ImageIcon, html: Code2, form: ShoppingBag};
const selectClass = "h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm";
const shortcodes = ["product_name", "product_price", "compare_price", "discount_percent", "cs_whatsapp"];
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

export function sanitizePreviewHtml(value: string) {
  if (typeof DOMParser === "undefined") return escapeHtml(value);

  const parsedDocument = new DOMParser().parseFromString(value, "text/html");
  parsedDocument
    .querySelectorAll(
      "script, style, template, iframe, object, embed, link, meta, base, form, input, button, select, textarea",
    )
    .forEach((element) => element.remove());

  const allowedTags: Record<string, true> = {
    a: true,
    abbr: true,
    b: true,
    blockquote: true,
    br: true,
    div: true,
    em: true,
    figcaption: true,
    figure: true,
    h1: true,
    h2: true,
    h3: true,
    h4: true,
    h5: true,
    h6: true,
    hr: true,
    i: true,
    img: true,
    li: true,
    ol: true,
    p: true,
    section: true,
    small: true,
    span: true,
    strong: true,
    sub: true,
    sup: true,
    table: true,
    tbody: true,
    td: true,
    th: true,
    thead: true,
    tr: true,
    u: true,
    ul: true,
  };
  const commonAttributes: Record<string, true> = {
    class: true,
    role: true,
    title: true,
  };
  const attributesByTag: Record<string, Record<string, true>> = {
    a: { href: true },
    img: {
      alt: true,
      decoding: true,
      height: true,
      loading: true,
      src: true,
      width: true,
    },
    td: { colspan: true, rowspan: true },
    th: { colspan: true, rowspan: true, scope: true },
  };

  for (const element of Array.from(parsedDocument.body.querySelectorAll("*"))) {
    const tag = element.tagName.toLowerCase();
    if (!allowedTags[tag]) {
      element.replaceWith(...Array.from(element.childNodes));
      continue;
    }

    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const allowed =
        commonAttributes[name] ||
        name.startsWith("aria-") ||
        attributesByTag[tag]?.[name];
      if (!allowed) element.removeAttribute(attribute.name);
    }

    if (tag === "a" || tag === "img") {
      const urlAttribute = tag === "a" ? "href" : "src";
      const rawUrl = element.getAttribute(urlAttribute);
      if (rawUrl) {
        try {
          const url = new URL(rawUrl, window.location.href);
          if (!["http:", "https:"].includes(url.protocol)) {
            element.removeAttribute(urlAttribute);
          }
        } catch {
          element.removeAttribute(urlAttribute);
        }
      }
    }

    if (tag === "a" && element.hasAttribute("href")) {
      element.setAttribute("target", "_blank");
      element.setAttribute("rel", "noopener noreferrer");
    }
  }

  return parsedDocument.body.innerHTML;
}


export default function LandingPageEditor({landingPageId}: {landingPageId?: string}) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saved, setSaved] = useState(JSON.stringify(emptyDraft));
  const [savedSlug, setSavedSlug] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(!landingPageId);
  const [mobileView, setMobileView] = useState<'content' | 'settings'>(landingPageId ? 'content' : 'settings');
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const slugTouched = useRef(Boolean(landingPageId));
  const sequence = useRef(0);
  const leaveAllowed = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const dirty = JSON.stringify(draft) !== saved;
  const busy = saving || Boolean(uploading);
  const product = products.find(p => String(p.id) === draft.product_id);
  const newId = () => `section-${Date.now()}-${++sequence.current}`;

  useEffect(() => {
    if (window.matchMedia('(min-width: 1280px)').matches) setAddOpen(true);
    const controller = new AbortController();
    setLoading(true); setLoadError("");
    const get = async (url: string) => {
      const res = await fetch(url, {signal: controller.signal});
      const body = await res.json();
      if (!res.ok || !body.data) throw new Error(body.error || "Data belum tersedia. Coba muat ulang.");
      return body.data;
    };
    Promise.all([get("/api/admin/products"), landingPageId ? get(`/api/admin/landing-pages/${landingPageId}`) : Promise.resolve(null)])
      .then(([items, page]) => {
        if (controller.signal.aborted) return;
        setProducts(items);
        if (page) {
          const next = pageDraft(page);
          setDraft(next); setSaved(JSON.stringify(next)); setSavedSlug(next.slug);
        }
        setLoading(false);
      }).catch(e => {if (!controller.signal.aborted) {setLoadError(e.message || "Gagal memuat editor."); setLoading(false);}});
    return () => controller.abort();
  }, [landingPageId, reload]);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {if (dirty && !leaveAllowed.current) {event.preventDefault(); event.returnValue = "";}};
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  useEffect(() => {if (error) errorRef.current?.focus();}, [error]);

  function patch(values: Partial<Draft>) {setDraft(d => ({...d, ...values})); setError("");}
  function patchSection(id: string, values: Partial<Section>) {setDraft(d => ({...d, sections: d.sections.map(s => s.id === id ? {...s, ...values} : s)})); setError("");}
  function focusSection(id: string) {
    setMobileView('content'); setActiveSection(id); setPreview(false); setEditing(id);
    requestAnimationFrame(() => {
      const section = document.getElementById(`builder-${id}`);
      section?.scrollIntoView({block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"});
      section?.querySelector<HTMLElement>("input, textarea, select")?.focus({preventScroll: true});
    });
  }
  function add(type: LandingSectionType) {
    const id = newId();
    patch({sections: [...draft.sections, {id, type, content_html: "", content_config: normalizeLandingContent(type, {}), form_config: {}}]});
    focusSection(id);
  }
  function move(index: number, offset: number) {
    const sections = [...draft.sections];
    [sections[index], sections[index + offset]] = [sections[index + offset], sections[index]];
    patch({sections});
  }
  async function upload(section: Section, file?: File) {
    if (!file) return;
    setUploadErrors(e => ({...e, [section.id]: ""}));
    if (file.size > 2 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"].includes(file.type)) {
      setUploadErrors(e => ({...e, [section.id]: "Pilih JPEG, PNG, WebP, GIF, atau AVIF maksimal 2 MB."})); return;
    }
    setUploading(section.id);
    try {
      const data = new FormData(); data.append("file", file);
      const res = await fetch("/api/admin/media", {method: "POST", body: data});
      const result = await res.json();
      if (!res.ok || !result.url) throw new Error(result.error || "Upload gagal. Pilih ulang gambar untuk mencoba lagi.");
      patchSection(section.id, {content_config: {...section.content_config, src: result.url}});
    } catch (e) {setUploadErrors(errors => ({...errors, [section.id]: e instanceof Error ? e.message : "Upload gagal. Coba lagi."}));}
    finally {setUploading(null);}
  }
  async function save() {
    setError("");
    if (!draft.title.trim() || !draft.slug.trim() || !draft.product_id) {setMobileView("settings"); setError("Isi nama halaman, slug, dan produk terlebih dahulu."); return;}
    try {
      const sections = draft.sections.map(({id: _id, ...s}, index) => ({...s, sort_order: index, content_config: normalizeLandingContent(s.type, s.content_config)}));
      setSaving(true);
      const res = await fetch(`/api/admin/landing-pages${landingPageId ? `/${landingPageId}` : ""}`, {method: landingPageId ? "PUT" : "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({...draft, sections})});
      const result = await res.json();
      if (!res.ok || !result.success || !result.data?.id) throw new Error(result.error || "Gagal menyimpan. Isi editor tetap tersedia; coba lagi.");
      const next = pageDraft(result.data);
      setDraft(next); setSaved(JSON.stringify(next)); setSavedSlug(next.slug); setEditing(null); setActiveSection(null); setMobileView('content');
      if (!landingPageId) {leaveAllowed.current = true; window.location.assign(`/admin/landing-pages/${result.data.id}/edit`);}
    } catch (e) {setError(e instanceof Error ? e.message : "Gagal menyimpan. Coba lagi.");}
    finally {setSaving(false);}
  }
  function sectionPreview(section: Section) {
    if (section.type === "form") {
      const variant = product?.variants?.find(v => String(v.id) === section.form_config?.selected_variant_id) || product?.variants?.[0];
      return <div className="space-y-4 p-5 text-sm text-foreground-subtle"><p className="text-xs text-muted-foreground">Preview form Malaysia · pengiriman dihitung saat checkout</p><h2 className="text-xl font-bold">{section.form_config?.section_title || "Maklumat pesanan"}</h2><p>{product?.title || "Pilih produk terlebih dahulu"}</p><p>{variant?.title} {variant ? formatMyr(variant.price) : ""}</p>{["Nama penuh", "Nombor WhatsApp", "Alamat penghantaran", "Poskod"].map(label => <div key={label} className="rounded-lg border p-3 text-muted-foreground">{label}</div>)}<div className="rounded-lg bg-slate-900 p-3 text-center text-white">{section.form_config?.button_text || "Hantar pesanan"}</div><p className="text-xs text-muted-foreground">Metode pembayaran mengikuti pengaturan toko. Label pembayaran DOKU mengikuti metode yang dipilih.</p></div>;
    }
    try {
      const html = section.type === "html" ? sanitizePreviewHtml(parseShortcodes(section.content_html || "", product || {})) : renderLandingContent(section.type, section.content_config);
      return html ? <div className="lp-section" dangerouslySetInnerHTML={{__html: html}} /> : <p className="p-5 text-sm text-muted-foreground">Belum ada konten. Klik edit untuk mengisi.</p>;
    } catch {return <p className="p-5 text-sm text-muted-foreground">Preview tersedia setelah konten valid.</p>;}
  }

  if (loading) return <div role="status" className="animate-pulse rounded-xl border border-border p-8">Memuat editor dan produk…</div>;
  if (loadError) return <div role="alert" className="space-y-4 rounded-xl border border-border p-6"><p>{loadError}</p><Button className="min-h-11" onClick={() => setReload(r => r + 1)}>Coba muat lagi</Button></div>;
  return <div className="min-w-0 space-y-5" data-landing-builder>
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
      <div><p className="text-sm font-semibold">Editor halaman</p><p role="status" className="mt-1 text-xs text-muted-foreground">{saving ? "Menyimpan…" : uploading ? "Mengunggah gambar…" : dirty ? "Perubahan belum disimpan" : savedSlug ? "Semua perubahan tersimpan" : "Mulai dari pengaturan halaman"}</p></div>
      <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
        <Button variant="outline" className="min-h-11" onClick={() => {setMobileView('content'); setPreview(p => !p);}}><Eye />{preview ? "Kembali ke editor" : "Preview"}</Button>
        <Button className="min-h-11" disabled={busy} onClick={save}><Save />{saving ? "Menyimpan…" : "Simpan halaman"}</Button>
        {savedSlug && <a className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 px-2 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" href={`/${savedSlug}?preview=1`} target="_blank" rel="noopener noreferrer">Lihat versi tersimpan<ExternalLink className="size-3.5" aria-hidden="true" /></a>}
      </div>
    </div>
    <div role="group" aria-label="Tampilan editor" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 xl:hidden">
      {([{value: 'content', label: 'Konten'}, {value: 'settings', label: 'Pengaturan'}] as const).map(view => <Button key={view.value} variant="ghost" data-builder-view={view.value} aria-pressed={mobileView === view.value} className={`min-h-11 ${mobileView === view.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`} onClick={() => setMobileView(view.value)}>{view.label}</Button>)}
    </div>
    {error && <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-lg border border-destructive p-4 text-sm text-destructive">{error}</div>}
    <div className="grid grid-cols-1 min-w-0 items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="min-w-0 space-y-4">
        <fieldset disabled={busy} className={`${mobileView === 'settings' ? '' : 'hidden xl:block'} min-w-0 space-y-4 rounded-xl border border-border bg-card p-4`}>
          <legend className="px-1 text-sm font-semibold">Pengaturan halaman</legend>
          <label className="block space-y-2 text-sm" htmlFor="lp-title"><span>Nama halaman *</span><Input id="lp-title" className="min-h-11" value={draft.title} maxLength={200} onChange={e => {const title = e.target.value; patch({title, ...(!slugTouched.current ? {slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")} : {})});}} /></label>
          <label className="block space-y-2 text-sm" htmlFor="lp-slug"><span>Slug URL *</span><Input id="lp-slug" className="min-h-11" value={draft.slug} maxLength={160} onChange={e => {slugTouched.current = true; patch({slug: e.target.value});}} /><span className="block break-all text-xs text-muted-foreground">/{draft.slug || "nama-halaman"}</span></label>
          <label className="block space-y-2 text-sm" htmlFor="lp-product"><span>Produk *</span><select id="lp-product" className={selectClass} value={draft.product_id} onChange={e => patch({product_id: e.target.value, sections: draft.sections.map(s => s.type === "form" ? {...s, form_config: {...s.form_config, selected_variant_id: ""}} : s)})}><option value="">Pilih produk</option>{products.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
          {!products.length && <p className="text-sm text-muted-foreground">Belum ada produk. Tambahkan produk sebelum menyimpan halaman.</p>}
          <label className="block space-y-2 text-sm" htmlFor="lp-status"><span>Status publikasi</span><select id="lp-status" className={selectClass} value={draft.is_active ? "active" : "draft"} onChange={e => patch({is_active: e.target.value === "active"})}><option value="draft">Draft</option><option value="active">Aktif</option></select><span className="text-xs text-muted-foreground">Perubahan status berlaku setelah disimpan.</span></label>
          <details><summary className="cursor-pointer py-3 text-sm font-semibold">SEO</summary><div className="space-y-3"><label className="block space-y-2 text-sm" htmlFor="lp-meta-title"><span>Judul SEO</span><Input id="lp-meta-title" className="min-h-11" value={draft.meta_title} maxLength={200} onChange={e => patch({meta_title: e.target.value})} /></label><label className="block space-y-2 text-sm" htmlFor="lp-meta-description"><span>Deskripsi SEO</span><Textarea id="lp-meta-description" value={draft.meta_description} maxLength={500} onChange={e => patch({meta_description: e.target.value})} /></label><p className="text-xs text-muted-foreground">Kosongkan untuk memakai informasi halaman.</p></div></details>
        </fieldset>
        <div className={`${mobileView === 'content' ? '' : 'hidden xl:block'} space-y-4`}>
          <details className="rounded-xl border border-border bg-card px-4 py-2" data-add-section open={addOpen} onToggle={event => setAddOpen(event.currentTarget.open)}><summary title="Tambah bagian" className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Tambah bagian <span className="font-normal text-muted-foreground">· {draft.sections.length}/50</span></summary><p className="mb-3 mt-1 text-xs text-muted-foreground">Pilih konten yang ingin ditambahkan ke halaman.</p><div className="grid grid-cols-2 gap-2">{LANDING_SECTION_TYPES.map(type => {const Icon = sectionIcons[type]; return <Button key={type} variant="outline" className="min-h-11 justify-start gap-2 border-border px-2 text-xs" disabled={busy || draft.sections.length >= 50} onClick={() => add(type)}><Icon className="size-4 shrink-0 text-muted-foreground" />{labels[type]}</Button>;})}</div><p className="mt-3 text-xs text-muted-foreground">{draft.sections.length}/50 bagian · checkout otomatis tersedia jika form belum ditambahkan.</p></details>
          {!!draft.sections.length && <details className="rounded-xl border border-border bg-card p-3"><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Susunan halaman <span className="font-normal text-muted-foreground">· {draft.sections.length} bagian</span></summary><nav aria-label="Urutan bagian" className="mt-1 space-y-1">{draft.sections.map((section, index) => <button key={section.id} aria-current={activeSection === section.id ? 'true' : undefined} className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${activeSection === section.id ? 'bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200' : 'hover:bg-muted'}`} onClick={() => focusSection(section.id)}><span className="text-xs tabular-nums text-muted-foreground">{index + 1}</span><span className="min-w-0"><span className="block text-xs font-semibold">{labels[section.type]}</span><span className="block truncate text-xs text-muted-foreground">{section.content_config?.text || section.content_config?.items?.[0] || section.content_config?.alt || section.form_config?.section_title || 'Klik untuk mengedit'}</span></span></button>)}</nav></details>}
        </div>
      </aside>
      <main className={`${mobileView === 'content' ? '' : 'hidden xl:block'} min-w-0 rounded-xl border border-border bg-muted/30 p-2 sm:p-5`} aria-label="Kanvas landing page">
        <div className="mb-4 flex items-center justify-between gap-2 px-1"><h2 className="text-sm font-semibold">{preview ? "Preview konten" : "Kanvas halaman"}</h2><span className="text-xs text-muted-foreground">480 px · responsif</span></div>
        {preview && <p className="mx-auto mb-4 max-w-[480px] text-xs text-muted-foreground">Preview mengikuti isi editor. HTML ditampilkan tanpa script dan CSS kustom; form di sini hanya ilustrasi. Gunakan versi tersimpan untuk memeriksa halaman lengkap.</p>}
        <div className="mx-auto w-full max-w-[480px] min-w-0 space-y-3">
          {!draft.sections.length && <div className="rounded-xl border border-border border-dashed bg-card px-6 py-14 text-center"><h3 className="font-semibold">Mulai susun halaman Anda</h3><p className="mt-2 text-sm text-muted-foreground">Tambahkan judul, penjelasan, gambar produk, lalu form checkout.</p><Button variant="outline" className="mt-5 min-h-11" onClick={() => add("headline")}><Plus />Tambah judul</Button></div>}
          {draft.sections.map((section, index) => {
            const config = section.content_config || {}, form = section.form_config || {};
            const content = (values: Partial<LandingContentConfig>) => patchSection(section.id, {content_config: {...config, ...values}});
            const formChange = (values: Partial<FormConfig>) => patchSection(section.id, {form_config: {...form, ...values}});
            const open = editing === section.id && !preview;
            const field = `field-${section.id}`;
            return <section id={`builder-${section.id}`} key={section.id} data-section-type={section.type} className={`min-w-0 overflow-hidden rounded-xl border bg-card text-foreground ${activeSection === section.id ? 'border-blue-500 ring-1 ring-blue-500/20' : 'border-border'}`}>
              {!preview && <div className="flex flex-wrap items-center justify-between gap-1 border-b border-border bg-card px-2 py-1 text-foreground"><h3 className="px-1 py-2 text-xs font-semibold">{index + 1}. {labels[section.type]}{open && <span className="ml-2 font-normal text-blue-700 dark:text-blue-300">Sedang diedit</span>}</h3><div role="group" aria-label={`Aksi bagian ${index + 1}`} className="flex shrink-0">{[
                {label: open ? "Tutup editor" : "Edit bagian", Icon: open ? Eye : Pencil, disabled: busy, action: () => open ? setEditing(null) : focusSection(section.id)},
                {label: "Naik", Icon: ArrowUp, disabled: busy || index === 0, action: () => move(index, -1)},
                {label: "Turun", Icon: ArrowDown, disabled: busy || index === draft.sections.length - 1, action: () => move(index, 1)},
                {label: "Duplikat", Icon: Copy, disabled: busy || draft.sections.length >= 50, action: () => {const copy = {...structuredClone(section), id: newId()}; const sections = [...draft.sections]; sections.splice(index + 1, 0, copy); patch({sections}); focusSection(copy.id);}},
                {label: "Hapus", Icon: Trash2, disabled: busy, action: () => {if (window.confirm("Hapus bagian ini? Perubahan berlaku setelah disimpan.")) {const next = draft.sections[index + 1] || draft.sections[index - 1]; patch({sections: draft.sections.filter(s => s.id !== section.id)}); setEditing(null); setActiveSection(null); if (next) focusSection(next.id); else {setAddOpen(true); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[data-add-section] button')?.focus());}}}},
              ].map(({label, Icon, disabled, action}) => <Button key={label} variant="ghost" className="size-11 shrink-0 p-0" title={label} aria-label={`${label} ${index + 1}`} disabled={disabled} onClick={action}><Icon className="size-4" /></Button>)}</div></div>}
              {open ? <fieldset disabled={busy} className="min-w-0 space-y-4 p-4 text-sm">
                {(section.type === "headline" || section.type === "paragraph") && <><label className="block space-y-2" htmlFor={field}><span>{section.type === "headline" ? "Teks judul" : "Teks paragraf"}</span><Textarea id={field} rows={section.type === "headline" ? 2 : 5} maxLength={section.type === "headline" ? 500 : 10000} value={config.text || ""} onChange={e => content({text: e.target.value})} /></label><div className="grid grid-cols-2 gap-3"><label className="space-y-2" htmlFor={`${field}-align`}><span>Perataan</span><select id={`${field}-align`} className={selectClass} value={config.align || "left"} onChange={e => content({align: e.target.value as LandingContentConfig['align']})}><option value="left">Kiri</option><option value="center">Tengah</option><option value="right">Kanan</option></select></label>{section.type === "headline" && <label className="space-y-2" htmlFor={`${field}-size`}><span>Ukuran</span><select id={`${field}-size`} className={selectClass} value={config.size || "medium"} onChange={e => content({size: e.target.value as LandingContentConfig['size']})}><option value="small">Kecil</option><option value="medium">Sedang</option><option value="large">Besar</option></select></label>}</div></>}
                {(section.type === "bullet_list" || section.type === "numbered_list") && <label className="block space-y-2" htmlFor={field}><span>Isi daftar · satu item per baris</span><Textarea id={field} rows={6} value={(config.items || []).join("\n")} onChange={e => content({items: e.target.value.split("\n")})} /><span className="text-xs text-muted-foreground">Maksimal 100 item. Baris kosong dibersihkan saat disimpan.</span></label>}
                {section.type === "image" && <><label className="block space-y-2" htmlFor={field}><span>Upload gambar</span><input className="min-h-11 w-full min-w-0 rounded border p-2 text-xs" id={field} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={e => {void upload(section, e.target.files?.[0]); e.target.value = "";}} /><span className="text-xs text-muted-foreground">JPEG, PNG, WebP, GIF, AVIF · maksimal 2 MB</span></label>{uploading === section.id && <p role="status">Mengunggah gambar…</p>}{uploadErrors[section.id] && <p role="alert" className="text-destructive">{uploadErrors[section.id]}</p>}<label className="block space-y-2" htmlFor={`${field}-src`}><span>URL gambar</span><Input id={`${field}-src`} className="min-h-11" maxLength={2000} value={config.src || ""} onChange={e => content({src: e.target.value})} /></label><label className="block space-y-2" htmlFor={`${field}-alt`}><span>Deskripsi gambar (alt)</span><Input id={`${field}-alt`} className="min-h-11" maxLength={500} value={config.alt || ""} onChange={e => content({alt: e.target.value})} /></label></>}
                {section.type === "html" && <><label className="block space-y-2" htmlFor={field}><span>HTML kustom</span><Textarea id={field} rows={10} className="font-mono text-xs" value={section.content_html || ""} maxLength={100000} onChange={e => patchSection(section.id, {content_html: e.target.value})} /></label><div className="flex flex-wrap gap-1">{shortcodes.map(code => <Button key={code} variant="outline" className="min-h-11 px-2 text-xs" onClick={() => {const input = document.getElementById(field) as HTMLTextAreaElement; const value = section.content_html || "", token = `{{${code}}}`; const start = input.selectionStart; patchSection(section.id, {content_html: value.slice(0, start) + token + value.slice(input.selectionEnd)}); requestAnimationFrame(() => {input.focus(); input.setSelectionRange(start + token.length, start + token.length);});}}>{`{{${code}}}`}</Button>)}</div><p className="text-xs text-muted-foreground">Harga memakai MYR dari produk pilihan. Nomor WhatsApp diisi dari pengaturan toko pada halaman tersimpan.</p></>}
                {section.type === "form" && <><label className="block space-y-2" htmlFor={field}><span>Varian awal</span><select id={field} className={selectClass} value={form.selected_variant_id || ""} onChange={e => formChange({selected_variant_id: e.target.value})}><option value="">Otomatis dari produk</option>{product?.variants?.map(v => <option value={v.id} key={v.id}>{v.title} · {formatMyr(v.price)}</option>)}</select></label><label className="block space-y-2" htmlFor={`${field}-title`}><span>Judul form</span><Input id={`${field}-title`} className="min-h-11" maxLength={200} placeholder="Maklumat pesanan" value={form.section_title || ""} onChange={e => formChange({section_title: e.target.value})} /></label><label className="block space-y-2" htmlFor={`${field}-button`}><span>Teks tombol</span><Input id={`${field}-button`} className="min-h-11" maxLength={100} placeholder="Gunakan teks default checkout" value={form.button_text || ""} onChange={e => formChange({button_text: e.target.value})} /></label><p className="text-xs text-muted-foreground">Form lengkap Malaysia dengan postcode, tarif pengiriman, stok, dan metode pembayaran toko. Mengganti produk mereset varian awal.</p></>}
                <Button variant="outline" className="min-h-11" onClick={() => setEditing(null)}><Eye />Selesai mengedit bagian</Button><p className="text-xs text-muted-foreground">Perubahan masuk ke draft. Klik Simpan halaman untuk menyimpannya.</p>
              </fieldset> : sectionPreview(section)}
            </section>;
          })}
        </div>
      </main>
    </div>
  </div>;
}
