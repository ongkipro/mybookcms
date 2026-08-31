import type { APIRoute } from "astro";
import { jsonError, jsonOk } from "../../../lib/api.ts";
import { defaultCrmTemplates, parseCrmTemplates } from "../../../lib/crm-template.ts";
import { parseEmbedAllowedOrigins, resolveEmbedAllowedOrigins } from "../../../lib/embed-security.ts";
import { getEnvValue, getRuntimeEnv } from "../../../lib/env.ts";
import { parseHeadlessAllowedOrigins } from "../../../lib/headless-api.ts";
import { resolveStorePickup, validateStorePickup } from "../../../lib/store-pickup.ts";
import {
  addStorefrontTemplate,
  listStorefrontTemplates,
  resolveStorefrontTemplate,
  validateStorefrontTemplateDefinition,
  type StorefrontTemplateDefinition,
} from "../../../lib/storefront-template.ts";

export const prerender = false;
const MALAYSIA_PHONE = /^\+?60\d{8,10}$/;
const CRM_KEYS = ["welcome", "1", "2", "3", "4", "5", "6", "7", "8", "9", "redirect"] as const;

type Payload = {
  action?: "save-store" | "add-storefront-template" | "save-embed-origins" | "save-headless-origins" | "save-crm";
  store_name?: unknown;
  site_url?: unknown;
  store_description?: unknown;
  store_tagline?: unknown;
  pickup_name?: unknown;
  pickup_phone?: unknown;
  pickup_address?: unknown;
  pickup_postcode?: unknown;
  store_logo?: unknown;
  storefront_template?: unknown;
  storefront_template_definition?: unknown;
  support_whatsapp?: unknown;
  embed_allowed_origins?: unknown;
  headless_allowed_origins?: unknown;
  crm_templates?: Record<string, string>;
};

type StoreRow = {
  id: number;
  name: string;
  support_whatsapp: string | null;
  site_url: string | null;
  description: string | null;
  tagline: string | null;
  logo: string | null;
  locale: string | null;
  storefront_template: string | null;
  crm_templates: string | null;
  embed_allowed_origins: string | null;
  headless_allowed_origins: string | null;
  pickup_name: string | null;
  pickup_phone: string | null;
  pickup_address: string | null;
  pickup_postcode: string | null;
};

const clean = (value: unknown, limit: number) =>
  typeof value === "string" ? value.trim().slice(0, limit) : "";

const normalizeMalaysiaPhone = (value: unknown) => {
  let digits = clean(value, 20).replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `60${digits.slice(1)}`;
  if (digits.startsWith("1")) digits = `60${digits}`;
  return digits ? `+${digits}` : "";
};

const getDatabase = (locals: App.Locals) => {
  const database = getRuntimeEnv(locals)?.OMS_DB as D1Database | undefined;
  return database?.prepare ? database : null;
};

const getStore = (database: D1Database) => database.prepare(`
  SELECT id, name, support_whatsapp, site_url, description, tagline, logo, locale,
         storefront_template, crm_templates, embed_allowed_origins,
         headless_allowed_origins, pickup_name, pickup_phone, pickup_address,
         pickup_postcode
  FROM stores ORDER BY id LIMIT 1
`).first<StoreRow>();

const normalizeTemplates = (value: Record<string, string> | undefined) =>
  Object.fromEntries(CRM_KEYS.map((key) => [
    key,
    clean(value?.[key], 1200) || defaultCrmTemplates[key],
  ]));

export const GET: APIRoute = async ({ locals }) => {
  const database = getDatabase(locals);
  if (!database) return jsonError("Database pengaturan belum tersedia.", 503);
  try {
    const row = await getStore(database);
    if (!row) return jsonError("Store belum tersedia.", 404);
    const runtime = getRuntimeEnv(locals);
    const embedPolicy = resolveEmbedAllowedOrigins(
      row.embed_allowed_origins,
      getEnvValue("PUBLIC_EMBED_ALLOWED_ORIGINS", runtime),
    );
    const templates = await listStorefrontTemplates(database, row.id);
    // Resolved, not stored: the city/state shown always belong to the postcode.
    const storedPickup = validateStorePickup({
      name: row.pickup_name, phone: row.pickup_phone,
      address: row.pickup_address, postcode: row.pickup_postcode,
    });
    const pickup = storedPickup.ok && storedPickup.value
      ? await resolveStorePickup(database, storedPickup.value)
      : null;
    return jsonOk({
      data: {
        pickup: pickup ?? null,
        store: {
          name: row.name,
          support_whatsapp: row.support_whatsapp ?? "",
          site_url: row.site_url ?? "",
          description: row.description ?? "",
          tagline: row.tagline ?? "",
          logo: row.logo ?? "",
          storefront_template: row.storefront_template ?? "compact-market",
          storefront_templates: templates.templates,
          storefront_templates_available: templates.state === "ready",
          embed_allowed_origins: embedPolicy.valid ? embedPolicy.origins : [],
          headless_allowed_origins: parseHeadlessAllowedOrigins(row.headless_allowed_origins ?? []).patterns,
        },
        crm_templates: parseCrmTemplates(row.crm_templates),
      },
    });
  } catch (error) {
    console.error("settings-get", error);
    return jsonError("Gagal mengambil pengaturan store.", 500);
  }
};

export const PUT: APIRoute = async ({ request, locals }) => {
  const database = getDatabase(locals);
  if (!database) return jsonError("Database pengaturan belum tersedia.", 503);
  const body = await request.json().catch(() => null) as Payload | null;
  if (!body) return jsonError("Payload tidak valid.", 400);
  try {
    const current = await getStore(database);
    if (!current) return jsonError("Store belum tersedia.", 404);

    if (body.action === "save-embed-origins") {
      const policy = parseEmbedAllowedOrigins(body.embed_allowed_origins);
      if (!policy.valid) return jsonError("Origin embed HTTPS tidak valid.", 400);
      await database.prepare("UPDATE stores SET embed_allowed_origins = ? WHERE id = ?")
        .bind(policy.origins.join(","), current.id).run();
      return jsonOk({ message: "Daftar origin embed disimpan.", data: { embed_allowed_origins: policy.origins } });
    }

    if (body.action === "save-headless-origins") {
      const policy = parseHeadlessAllowedOrigins(body.headless_allowed_origins);
      if (!policy.valid) return jsonError("Origin Headless API tidak valid.", 400);
      await database.prepare("UPDATE stores SET headless_allowed_origins = ? WHERE id = ?")
        .bind(policy.patterns.join(","), current.id).run();
      return jsonOk({ message: "Allowlist Headless API disimpan.", data: { headless_allowed_origins: policy.patterns } });
    }

    if (body.action === "add-storefront-template") {
      let definition: StorefrontTemplateDefinition;
      try {
        definition = validateStorefrontTemplateDefinition(body.storefront_template_definition);
      } catch {
        return jsonError("Definisi template tidak valid.", 400);
      }
      try {
        await addStorefrontTemplate(database, current.id, definition);
      } catch (error) {
        if (error instanceof Error && /unique constraint failed/i.test(error.message)) {
          return jsonError("ID template sudah digunakan.", 409);
        }
        throw error;
      }
      const templates = await listStorefrontTemplates(database, current.id);
      return jsonOk({ message: "Template storefront ditambahkan.", data: { storefront_templates: templates.templates } });
    }

    if (body.action === "save-store") {
      const name = clean(body.store_name, 120);
      const phone = normalizeMalaysiaPhone(body.support_whatsapp);
      if (!name) return jsonError("Nama store wajib diisi.", 400);
      if (!MALAYSIA_PHONE.test(phone)) return jsonError("Nomor WhatsApp Malaysia tidak valid.", 400);
      const rawSiteUrl = clean(body.site_url, 200);
      let siteUrl = "";
      if (rawSiteUrl) {
        try {
          const parsed = new URL(rawSiteUrl);
          if (parsed.protocol !== "https:") return jsonError("Alamat toko harus memakai https.", 400);
          siteUrl = parsed.origin;
        } catch {
          return jsonError("Alamat toko tidak valid.", 400);
        }
      }
      const templateId = clean(body.storefront_template, 40) || "compact-market";
      const resolution = await resolveStorefrontTemplate(database, templateId);
      if (resolution.state !== "ready") return jsonError("Template storefront tidak tersedia.", resolution.state === "unavailable" ? 503 : 400);
      // The pickup address is all-or-nothing: a half-filled one would print a
      // parcel label that cannot be delivered or collected.
      const pickup = validateStorePickup({
        name: body.pickup_name,
        phone: body.pickup_phone,
        address: body.pickup_address,
        postcode: body.pickup_postcode,
      });
      if (!pickup.ok) return jsonError(pickup.error, 400);
      if (pickup.value && !(await resolveStorePickup(database, pickup.value))) {
        return jsonError("Poskod alamat pickup tidak dikenali.", 400);
      }
      await database.prepare(`
        UPDATE stores SET name = ?, support_whatsapp = ?, site_url = ?,
          description = ?, tagline = ?, logo = ?, storefront_template = ?,
          pickup_name = ?, pickup_phone = ?, pickup_address = ?, pickup_postcode = ?
        WHERE id = ?
      `).bind(
        name,
        phone,
        siteUrl || null,
        clean(body.store_description, 300) || null,
        clean(body.store_tagline, 120) || null,
        clean(body.store_logo, 300) || null,
        templateId,
        pickup.value?.name ?? null,
        pickup.value?.phone ?? null,
        pickup.value?.address ?? null,
        pickup.value?.postcode ?? null,
        current.id,
      ).run();
      return jsonOk({ message: "Profil store disimpan." });
    }

    if (body.action === "save-crm") {
      const templates = normalizeTemplates(body.crm_templates);
      await database.prepare("UPDATE stores SET crm_templates = ? WHERE id = ?")
        .bind(JSON.stringify(templates), current.id).run();
      return jsonOk({ message: "Template CRM disimpan." });
    }

    return jsonError("Action tidak dikenal.", 400);
  } catch (error) {
    console.error("settings-put", error);
    return jsonError("Gagal memperbarui pengaturan store.", 500);
  }
};

export const POST = PUT;
