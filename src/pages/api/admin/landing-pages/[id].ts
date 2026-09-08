import type { APIRoute } from "astro";
import { LandingContentError } from "../../../../lib/landing-content";
import { jsonError, jsonOk } from "../../../../lib/api";
import {
  deleteLandingPage,
  getLandingPageById,
  NativeLandingReadOnlyError,
  updateLandingPage,
} from "../../../../lib/landing-pages";

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
  if (!locals.admin) return jsonError("Unauthorized", 401);
  const { id } = params;
  if (!id) return jsonError("ID is required", 400);

  try {
    const result = await getLandingPageById(locals, id);
    if (!result) return jsonError("Landing page not found", 404);
    return jsonOk({ data: result });
  } catch (error) {
    console.error("GET landing-pages/[id]", error);
    return jsonError("Failed to fetch landing page", 500);
  }
};

export const PUT: APIRoute = async ({ request, params, locals }) => {
  if (!locals.admin) return jsonError("Unauthorized", 401);
  const { id } = params;
  if (!id) return jsonError("ID is required", 400);

  try {
    const body = await request.json();
    const result = await updateLandingPage(locals, id, body);
    if (!result) return jsonError("Halaman tidak ditemukan. Perubahan belum disimpan.", 404);
    return jsonOk({ data: result });
  } catch (error: unknown) {
    if (error instanceof LandingContentError) return jsonError(error.message, 422);
    if (error instanceof NativeLandingReadOnlyError) {
      return jsonError(error.message, 409, { code: "NATIVE_LANDING_READ_ONLY" });
    }
    console.error("PUT landing-pages/[id]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonError("Failed to update landing page: " + message, 500);
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!locals.admin) return jsonError("Unauthorized", 401);
  const { id } = params;
  if (!id) return jsonError("ID is required", 400);

  try {
    await deleteLandingPage(locals, id);
    return jsonOk({ message: "Deleted successfully" });
  } catch (error: unknown) {
    if (error instanceof LandingContentError) return jsonError(error.message, 422);
    if (error instanceof NativeLandingReadOnlyError) {
      return jsonError(error.message, 409, { code: "NATIVE_LANDING_READ_ONLY" });
    }
    console.error("DELETE landing-pages/[id]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonError("Failed to delete landing page: " + message, 500);
  }
};
