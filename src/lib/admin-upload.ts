const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

const GENERATED_IMAGE_KEY =
  /^uploads\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]+\.(?:jpg|png|webp|gif|avif)$/i;

export const MAX_ADMIN_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_ADMIN_UPLOAD_REQUEST_BYTES = MAX_ADMIN_IMAGE_BYTES + 64 * 1024;
export const MAX_ADMIN_UPLOADS_PER_HOUR = 20;

export class AdminUploadError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminUploadError";
    this.status = status;
  }
}

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function matchesImageSignature(type: string, bytes: Uint8Array) {
  if (type === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (type === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return signature.every((value, index) => bytes[index] === value);
  }
  if (type === "image/gif") {
    return ["GIF87a", "GIF89a"].includes(ascii(bytes, 0, 6));
  }
  if (type === "image/webp") {
    return ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP";
  }
  if (type === "image/avif") {
    return (
      ascii(bytes, 4, 4) === "ftyp" &&
      ["avif", "avis"].includes(ascii(bytes, 8, 4))
    );
  }
  return false;
}

export function validateAdminImage(file: File, bytes: Uint8Array) {
  const normalizedType = file.type.toLowerCase();
  const extension = EXTENSION_BY_TYPE[normalizedType];
  if (!extension) {
    throw new AdminUploadError(
      "Tipe file tidak didukung. Gunakan JPG, PNG, WEBP, GIF, atau AVIF.",
      415,
    );
  }
  if (file.size < 1 || bytes.byteLength < 1) {
    throw new AdminUploadError("File upload tidak boleh kosong.", 400);
  }
  if (file.size > MAX_ADMIN_IMAGE_BYTES || bytes.byteLength > MAX_ADMIN_IMAGE_BYTES) {
    throw new AdminUploadError("Ukuran file maksimal 2 MB.", 413);
  }
  if (!matchesImageSignature(normalizedType, bytes)) {
    throw new AdminUploadError(
      "Isi file tidak sesuai dengan tipe gambar yang dipilih.",
      415,
    );
  }
  return { extension, contentType: normalizedType };
}

export function buildAdminImageKey(
  extension: string,
  derivativeOf = "",
  id = crypto.randomUUID(),
  date = new Date(),
) {
  const parentKey = derivativeOf.trim();
  if (parentKey) {
    if (!GENERATED_IMAGE_KEY.test(parentKey)) {
      throw new AdminUploadError("Kunci gambar induk tidak valid.", 400);
    }
    const parentExtension = parentKey.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
    if (parentExtension !== extension) {
      throw new AdminUploadError("Format gambar turunan harus sama dengan gambar induk.", 400);
    }
    return parentKey.replace(/(\.[a-z0-9]+)$/i, `-sm.${extension}`);
  }
  return `uploads/${date.toISOString().slice(0, 10)}/${id}.${extension}`;
}

export async function readBoundedUploadForm(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    throw new AdminUploadError("Form upload tidak valid.", 415);
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_ADMIN_UPLOAD_REQUEST_BYTES) {
    throw new AdminUploadError("Ukuran file maksimal 2 MB.", 413);
  }
  if (!request.body) {
    throw new AdminUploadError("File gambar wajib dipilih.", 400);
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_ADMIN_UPLOAD_REQUEST_BYTES) {
      await reader.cancel();
      throw new AdminUploadError("Ukuran file maksimal 2 MB.", 413);
    }
    chunks.push(value);
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return await new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body,
    }).formData();
  } catch {
    throw new AdminUploadError("Form upload tidak valid.", 400);
  }
}
