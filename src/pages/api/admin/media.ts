import type { APIRoute } from "astro";
import {
  AdminUploadError,
  buildAdminImageKey,
  MAX_ADMIN_UPLOADS_PER_HOUR,
  readBoundedUploadForm,
  validateAdminImage,
} from "../../../lib/admin-upload.ts";
import { jsonError, jsonOk } from "../../../lib/api.ts";
import { getRuntimeEnv } from "../../../lib/env.ts";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = getRuntimeEnv(locals);
  const bucket = env?.ASSET_BUCKET as R2Bucket | undefined;
  const sessions = env?.SESSION as KVNamespace | undefined;
  if (!bucket || !sessions) {
    return jsonError("Asset storage belum tersedia.", 503);
  }

  try {
    const clientIp = request.headers.get("cf-connecting-ip")?.trim() || "local";
    const rateLimitKey = `admin-upload-count:${clientIp}:${Math.floor(Date.now() / 3_600_000)}`;
    const uploadCount = Number(await sessions.get(rateLimitKey)) || 0;
    if (uploadCount >= MAX_ADMIN_UPLOADS_PER_HOUR) {
      return jsonError("Batas 20 upload per jam telah tercapai.", 429);
    }

    const form = await readBoundedUploadForm(request);
    const input = form.get("file");
    if (!(input instanceof File)) {
      return jsonError("File gambar wajib dipilih.", 400);
    }

    const bytes = new Uint8Array(await input.arrayBuffer());
    const image = validateAdminImage(input, bytes);
    const key = buildAdminImageKey(
      image.extension,
      String(form.get("derivative_of") || ""),
    );
    await bucket.put(key, bytes, {
      httpMetadata: {
        contentType: image.contentType,
        cacheControl: "public, max-age=31536000, immutable",
        contentDisposition: "inline",
      },
      customMetadata: {
        uploadedBy: locals.admin?.username || "unknown",
      },
    });
    await sessions.put(rateLimitKey, String(uploadCount + 1), {
      expirationTtl: 60 * 60,
    });

    return jsonOk({ url: `/assets/${key}`, fileName: key }, 201);
  } catch (error) {
    if (error instanceof AdminUploadError) {
      return jsonError(error.message, error.status);
    }
    console.error("admin-media-post", error);
    return jsonError("Gagal mengunggah berkas.", 500);
  }
};
