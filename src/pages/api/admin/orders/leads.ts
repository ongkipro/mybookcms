import type { APIRoute } from 'astro';
import { jsonError, jsonOk, methodNotAllowed } from '../../../../lib/api.ts';
import { getRuntimeEnv } from '../../../../lib/env.ts';
import { CheckoutLeadError, convertCheckoutLead, convertLeadSchema, followUpSchema, LEAD_STATUSES } from '../../../../lib/checkout-lead.ts';
import { OrderInputError } from '../../../../lib/order-persistence.ts';
import { MalaysiaLocationError } from '../../../../lib/malaysia-locations.ts';
import { MalaysiaShippingError } from '../../../../lib/malaysia-shipping.ts';
import { resolveAcceptedOrderMetaContext } from '../../../../lib/accepted-order-meta.ts';

export const prerender = false;
const allowed = (locals: App.Locals) => ['owner', 'admin', 'customer_service'].includes(locals.admin?.role || '');
const databaseFor = (locals: App.Locals) => getRuntimeEnv(locals)?.OMS_DB as D1Database | undefined;

export const GET: APIRoute = async ({locals, url}) => {
  if (!allowed(locals)) return jsonError('Akses ditolak.', 403);
  const db = databaseFor(locals); if (!db) return jsonError('Database belum tersedia.', 503);
  const page = Number(url.searchParams.get('page') || 1);
  const search = (url.searchParams.get('search') || '').trim();
  const status = url.searchParams.get('status') || 'all';
  if (!Number.isInteger(page) || page < 1 || page > 100000 || search.length > 120 || (status !== 'all' && !LEAD_STATUSES.includes(status as typeof LEAD_STATUSES[number]))) return jsonError('Filter tidak valid.', 422);
  const clauses = ['l.converted_at IS NULL']; const values: unknown[] = [];
  if (status !== 'all') { clauses.push('l.follow_up_status = ?'); values.push(status); }
  if (search) {
    clauses.push("(l.customer_name LIKE ? OR l.customer_phone LIKE ? OR p.title LIKE ? OR pv.title LIKE ? OR ('LEAD-' || l.id) LIKE ?)");
    values.push(...Array(5).fill(`%${search}%`));
  }
  const from = `FROM checkout_leads l JOIN product_variants pv ON pv.id = l.variant_id JOIN products p ON p.id = pv.product_id WHERE ${clauses.join(' AND ')}`;
  try {
    const [rows, count, options, store] = await db.batch([
      db.prepare(`SELECT l.id, l.customer_name, l.customer_phone, l.variant_id, l.follow_up_status, l.follow_up_note, l.followed_up_by, l.followed_up_at, l.created_at, p.title AS product_name, pv.title AS variant_name ${from} ORDER BY l.id DESC LIMIT 20 OFFSET ?`).bind(...values, (page - 1) * 20),
      db.prepare(`SELECT COUNT(*) AS total ${from}`).bind(...values),
      db.prepare('SELECT pv.id, p.title AS product_name, pv.title AS variant_name, pv.price, pv.stock FROM product_variants pv JOIN products p ON p.id = pv.product_id WHERE p.is_active = 1 ORDER BY p.title, pv.id'),
      db.prepare('SELECT is_cod_enabled FROM stores ORDER BY id LIMIT 1'),
    ]);
    const total = Number((count.results?.[0] as {total?: number})?.total || 0);
    return jsonOk({data: rows.results, variants: options.results, cod_enabled: (store.results?.[0] as {is_cod_enabled?: number})?.is_cod_enabled === 1, pagination: {page, total_items: total, total_pages: Math.ceil(total / 20)}});
  } catch { return jsonError('Pesanan tertinggal gagal dimuat.', 500); }
};

export const PATCH: APIRoute = async ({locals, request}) => {
  if (!allowed(locals)) return jsonError('Akses ditolak.', 403);
  const db = databaseFor(locals); if (!db) return jsonError('Database belum tersedia.', 503);
  const parsed = followUpSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError('Status atau catatan tidak valid (maksimum 1000 karakter).', 422);
  try {
    const data = parsed.data;
    const result = await db.prepare(`UPDATE checkout_leads SET follow_up_status = ?, follow_up_note = COALESCE(?, follow_up_note), followed_up_by = ?, followed_up_at = ?, updated_at = ? WHERE id = ? AND converted_at IS NULL`)
      .bind(data.follow_up_status, data.follow_up_note ?? null, locals.admin!.username, new Date().toISOString(), new Date().toISOString(), data.id).run();
    return result.meta.changes ? jsonOk({message: 'Status disimpan.'}) : jsonError('Lead sudah dikonversi atau tidak ditemukan. Muat ulang daftar.', 409);
  } catch { return jsonError('Status gagal disimpan.', 500); }
};

export const POST: APIRoute = async ({locals, request}) => {
  if (!allowed(locals)) return jsonError('Akses ditolak.', 403);
  const db = databaseFor(locals); if (!db) return jsonError('Database belum tersedia.', 503);
  const parsed = convertLeadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Data konversi tidak valid.', 422);
  try {
    const configured = await resolveAcceptedOrderMetaContext(request, locals);
    // A CS browser is not buyer attribution. Send only actual receiver data
    // from persistence; never attach the operator's IP, cookies or user agent.
    const meta = configured ? {eventSourceUrl: new URL(request.url).origin} : undefined;
    return jsonOk({data: await convertCheckoutLead(db, parsed.data, meta)});
  }
  catch (error) {
    if (error instanceof CheckoutLeadError) return jsonError(error.message, error.status);
    if (error instanceof OrderInputError || error instanceof MalaysiaLocationError || error instanceof MalaysiaShippingError) return jsonError(error.message, 422);
    return jsonError('Konversi gagal. Lead tetap tersimpan; coba lagi.', 500);
  }
};
export const ALL: APIRoute = () => methodNotAllowed('GET', 'PATCH', 'POST');
