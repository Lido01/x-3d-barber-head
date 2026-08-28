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
