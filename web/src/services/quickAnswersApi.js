import api from "./api";

/**
 * Quick answers �?" /api/quick-answers/
 *
 * Public:
 *   GET /api/quick-answers/   active answers only
 *
 * Staff with the ai.manage capability (Authorization: Bearer <access>):
 *   POST   /api/quick-answers/
 *   PATCH  /api/quick-answers/{id}/
 *   DELETE /api/quick-answers/{id}/
 */

export function listQuickAnswers({ signal } = {}) {
  return api
    .get("/quick-answers/", { signal })
    .then((response) => response.data);
}

export function listAllQuickAnswers({ signal } = {}) {
  return api
    .get("/quick-answers/", { requiresAuth: true, signal })
    .then((response) => response.data);
}

export function createQuickAnswer(payload) {
  return api
    .post("/quick-answers/", payload, { requiresAuth: true })
    .then((response) => response.data);
}

export function updateQuickAnswer(id, payload) {
  return api
    .patch(`/quick-answers/${id}/`, payload, { requiresAuth: true })
    .then((response) => response.data);
}

export function deleteQuickAnswer(id) {
  return api
    .delete(`/quick-answers/${id}/`, { requiresAuth: true })
    .then(() => undefined);
}
