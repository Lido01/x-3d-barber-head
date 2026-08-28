import api from "./api";

/**
 * Admin / staff authentication — /api/accounts/
 *
 *   POST /api/accounts/login/          { username, password }
 *   POST /api/accounts/token/refresh/  { refresh }
 *   GET  /api/accounts/me/             Bearer access
 *
 * Customers never call any of this. The public booking and payment
 * flow is entirely unauthenticated.
 */

export function login({ username, password }) {
  return api
    .post("/accounts/login/", { username, password })
    .then((response) => response.data);
}

export function getCurrentAccount({ signal } = {}) {
  return api
    .get("/accounts/me/", { requiresAuth: true, signal })
    .then((response) => response.data);
}
