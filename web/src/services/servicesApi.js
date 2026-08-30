import api from "./api";

/**
 * Services — GET /api/services/
 *
 * The backend only ever returns is_active services from list()
 * (ServiceService.list_active), so the frontend does not re-filter.
 *
 * Response item shape (confirmed against ServiceSerializer):
 *
 *   {
 *     id, name, description,
 *     price: "300.00",        // DecimalField -> string
 *     duration: 60,           // minutes
 *     image: "/media/..."|null,
 *     is_active: true,
 *     created_at, updated_at
 *   }
 */

export function listServices({ signal } = {}) {
  return api.get("/services/", { signal }).then((response) => response.data);
}

export function getService(id, { signal } = {}) {
  return api
    .get(`/services/${id}/`, { signal })
    .then((response) => response.data);
}

// --- admin only ---------------------------------------------------

export function listAllServices({ signal } = {}) {
  // Admin listing: the public list endpoint is filtered to active
  // services, so use the authenticated list which returns everything.
  return api
    .get("/services/", { requiresAuth: true, signal })
    .then((response) => response.data);
}

export function createService(fields) {
  const formData = new FormData();

  if (fields.name) formData.append("name", fields.name);
  if (fields.description) formData.append("description", fields.description);
  if (fields.price !== undefined) formData.append("price", fields.price);
  if (fields.duration !== undefined) {
    formData.append("duration", fields.duration);
  }
  if (fields.image) formData.append("image", fields.image);

  return api
    .post("/services/", formData, { requiresAuth: true })
    .then((response) => response.data);
}

export function updateService(id, fields) {
  const formData = new FormData();

  if (fields.name !== undefined) formData.append("name", fields.name);
  if (fields.description !== undefined) {
    formData.append("description", fields.description);
  }
  if (fields.price !== undefined) formData.append("price", fields.price);
  if (fields.duration !== undefined) {
    formData.append("duration", fields.duration);
  }
  if (fields.image) formData.append("image", fields.image);

  return api
    .patch(`/services/${id}/`, formData, { requiresAuth: true })
    .then((response) => response.data);
}

export function deleteService(id) {
  return api
    .delete(`/services/${id}/`, { requiresAuth: true })
    .then(() => undefined);
}

export function createHaircutStyle(serviceId, fields) {
  const formData = new FormData();

  if (fields.name) formData.append("name", fields.name);
  if (fields.description) formData.append("description", fields.description);
  if (fields.image) formData.append("image", fields.image);

  return api
    .post(`/services/${serviceId}/styles/create/`, formData, {
      requiresAuth: true,
    })
    .then((response) => response.data);
}

export function deleteHaircutStyle(serviceId, styleId) {
  return api
    .delete(`/services/${serviceId}/styles/${styleId}/`, {
      requiresAuth: true,
    })
    .then(() => undefined);
}
