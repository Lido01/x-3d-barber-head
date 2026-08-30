import api from "./api";

/**
 * Gallery — /api/gallery/gallery/
 *
 * Public (AllowAny):
 *   GET /api/gallery/gallery/          active posts only
 *   GET /api/gallery/gallery/{id}/     active post
 *
 * Admin only (IsAdminUser):
 *   POST   /api/gallery/gallery/                  create
 *   PUT    /api/gallery/gallery/{id}/             replace
 *   PATCH  /api/gallery/gallery/{id}/             partial update
 *   DELETE /api/gallery/gallery/{id}/             delete
 *
 * GalleryPostSerializer item shape:
 *
 *   {
 *     id, title, description,
 *     image: "/media/gallery/...",
 *     style_name: "" | "Low Fade",
 *     is_active: true,
 *     created_at, updated_at
 *   }
 */

export function listGalleryPosts({ signal, requiresAuth } = {}) {
  return api
    .get("/gallery/gallery/", { signal, requiresAuth })
    .then((response) => response.data);
}

export function getGalleryPost(id, { signal } = {}) {
  return api
    .get(`/gallery/gallery/${id}/`, { signal })
    .then((response) => response.data);
}

// --- admin only ---------------------------------------------------

export function createGalleryPost(fields) {
  const formData = new FormData();

  if (fields.title) formData.append("title", fields.title);
  if (fields.description) formData.append("description", fields.description);
  if (fields.style_name) formData.append("style_name", fields.style_name);
  if (fields.is_active !== undefined) {
    formData.append("is_active", fields.is_active ? "true" : "false");
  }
  if (fields.image) formData.append("image", fields.image);

  return api
    .post("/gallery/gallery/", formData, { requiresAuth: true })
    .then((response) => response.data);
}

export function updateGalleryPost(id, fields) {
  const formData = new FormData();

  if (fields.title !== undefined) formData.append("title", fields.title);
  if (fields.description !== undefined) {
    formData.append("description", fields.description);
  }
  if (fields.style_name !== undefined) {
    formData.append("style_name", fields.style_name);
  }
  if (fields.is_active !== undefined) {
    formData.append("is_active", fields.is_active ? "true" : "false");
  }
  if (fields.image) formData.append("image", fields.image);

  return api
    .patch(`/gallery/gallery/${id}/`, formData, { requiresAuth: true })
    .then((response) => response.data);
}

export function deleteGalleryPost(id) {
  return api
    .delete(`/gallery/gallery/${id}/`, { requiresAuth: true })
    .then(() => undefined);
}
