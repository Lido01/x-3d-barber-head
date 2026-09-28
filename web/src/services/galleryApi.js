import api from "./api";

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