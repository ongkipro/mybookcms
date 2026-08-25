import assert from "node:assert/strict";
import test from "node:test";
import {
  AdminUploadError,
  buildAdminImageKey,
  MAX_ADMIN_UPLOAD_REQUEST_BYTES,
} from "./admin-upload.ts";
import { POST } from "../pages/api/admin/media.ts";

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function uploadContext(
  request: Request,
  uploadCount = 0,
  stored: Array<{ key: string; value: unknown; options: unknown }> = [],
) {
  const bucket = {
    async put(key: string, value: unknown, options: unknown) {
      stored.push({ key, value, options });
    },
  };
  const session = {
    async get() {
      return String(uploadCount);
    },
    async put() {},
  };
  return {
    context: {
      request,
      locals: {
        admin: { username: "operator" },
        runtimeEnv: { ASSET_BUCKET: bucket, SESSION: session },
      },
    } as never,
    stored,
  };
}

function imageRequest(file: File, derivativeOf = "") {
  const form = new FormData();
  form.set("file", file);
  if (derivativeOf) form.set("derivative_of", derivativeOf);
  return new Request("https://store.example/api/admin/media", {
    method: "POST",
    headers: { "cf-connecting-ip": "203.0.113.10" },
    body: form,
  });
}

test("the shared admin upload accepts a signed image and generates its R2 key", async () => {
  const stored: Array<{ key: string; value: unknown; options: unknown }> = [];
  const { context } = uploadContext(
    imageRequest(new File([PNG_BYTES], "merchant.png", { type: "image/png" })),
    0,
    stored,
  );

  const response = await POST(context);
  const payload = await response.json() as {
    success: boolean;
    url: string;
    fileName: string;
  };
  assert.equal(response.status, 201);
  assert.equal(payload.success, true);
  assert.match(payload.fileName, /^uploads\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]+\.png$/);
  assert.equal(payload.url, `/assets/${payload.fileName}`);
  assert.equal(stored.length, 1);
  assert.equal(stored[0]?.key, payload.fileName);
});

test("the shared admin upload rejects MIME spoofing before R2 persistence", async () => {
  const stored: Array<{ key: string; value: unknown; options: unknown }> = [];
  const { context } = uploadContext(
    imageRequest(new File(["not a png"], "merchant.png", { type: "image/png" })),
    0,
    stored,
  );

  const response = await POST(context);
  assert.equal(response.status, 415);
  assert.equal(stored.length, 0);
});

test("the shared admin upload caps a body even without Content-Length", async () => {
  const request = new Request("https://store.example/api/admin/media", {
    method: "POST",
    headers: { "content-type": "multipart/form-data; boundary=bounded-test" },
    body: new Uint8Array(MAX_ADMIN_UPLOAD_REQUEST_BYTES + 1),
  });
  assert.equal(request.headers.has("content-length"), false);

  const response = await POST(uploadContext(request).context);
  assert.equal(response.status, 413);
});

test("the shared abuse policy rejects the twenty-first hourly upload", async () => {
  const { context, stored } = uploadContext(
    imageRequest(new File([PNG_BYTES], "merchant.png", { type: "image/png" })),
    20,
  );

  const response = await POST(context);
  assert.equal(response.status, 429);
  assert.equal(stored.length, 0);
});

test("derivative keys stay generated, sibling-scoped, and format-consistent", () => {
  assert.equal(
    buildAdminImageKey(
      "webp",
      "uploads/2026-08-25/11111111-1111-4111-8111-111111111111.webp",
    ),
    "uploads/2026-08-25/11111111-1111-4111-8111-111111111111-sm.webp",
  );
  assert.throws(
    () => buildAdminImageKey("png", "uploads/2026-08-25/parent.webp"),
    (error) => error instanceof AdminUploadError && error.status === 400,
  );
  assert.throws(
    () => buildAdminImageKey("webp", "content/../../merchant.webp"),
    (error) => error instanceof AdminUploadError && error.status === 400,
  );
});
