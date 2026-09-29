import api from "./api";

/**
 * Accounts — /api/accounts/
 *
 *   POST /api/accounts/register/       create a customer account
 *   POST /api/accounts/login/          { username, password }
 *   POST /api/accounts/token/refresh/  { refresh }
 *   GET  /api/accounts/me/             Bearer access
 *
 * One endpoint serves both audiences. What differs is which token the
 * caller is holding, so every authenticated call passes
 * `authScope: "customer"` to read the customer session rather than the
 * staff one:
 *
 *   customerTokens - the storefront account area
 *   adminTokens    - the staff console, which uses the default scope
 *
 * The public booking and payment flow stays entirely unauthenticated;
 * an account is only needed to leave a review.
 */

export function register({
  username,
  email,
  password,
  passwordConfirm,
  firstName = "",
  lastName = "",
  phone = "",
}) {
  const payload = {
    username: username.trim(),
    email: email.trim(),
    password,
    password_confirm: passwordConfirm,
  };

  // The API treats these as optional, and sending empty strings would
  // fail the "not blank" check on email rather than being ignored.
  if (firstName.trim()) {
    payload.first_name = firstName.trim();
  }

  if (lastName.trim()) {
    payload.last_name = lastName.trim();
  }

  if (phone.trim()) {
    payload.phone = phone.trim();
  }

  return api
    .post("/accounts/register/", payload)
    .then((response) => response.data);
}

export function login({ username, password }) {
  return api
    .post("/accounts/login/", { username, password })
    .then((response) => response.data);
}

/**
 * The signed-in account.
 *
 * Beyond the profile fields this carries `staff_role`, the *effective*
 * `permissions` list and `is_unlimited`. The server resolves the list
 * rather than echoing what is stored, so an administrator — whose
 * record may tick nothing — still reports every capability, and the
 * console never has to reimplement the owner's and admin's bypass
 * rules. `staff_role` is null for a plain customer, which is how the
 * staff console recognises an account that must not enter it.
 */
export function getCurrentAccount({ signal, authScope } = {}) {
  return api
    .get("/accounts/me/", {
      requiresAuth: true,
      // Omitted for the staff console, which is the default scope.
      authScope,
      signal,
    })
    .then((response) => response.data);
}

export function updateCurrentAccount(patch, { signal } = {}) {
  return api
    .patch("/accounts/me/", patch, {
      requiresAuth: true,
      authScope: "customer",
      signal,
    })
    .then((response) => response.data);
}

/** Staff-only customer directory. A query is handled server-side. */
export function listRegisteredCustomers({ query = "", signal } = {}) {
  return api
    .get("/accounts/customers/", {
      requiresAuth: true,
      params: query.trim() ? { q: query.trim() } : undefined,
      signal,
    })
    .then((response) => response.data);
}

/** Owner and administrator only. Staff access records. */
export function listStaffAccess() {
  return api.get("/accounts/staff/", { requiresAuth: true }).then((response) => response.data);
}

export function createStaffAccess(payload) {
  return api.post("/accounts/staff/", payload, { requiresAuth: true }).then((response) => response.data);
}

export function updateStaffAccess(id, payload) {
  return api.patch(`/accounts/staff/${id}/`, payload, { requiresAuth: true }).then((response) => response.data);
}

/**
 * The activity trail.
 *
 * Filtering and paging happen server-side, so the console's "last 50
 * actions" view and a full review of one person's history are the same
 * call with different arguments.
 *
 *   filters.action  prefix match, e.g. "payment" for payment decisions
 *   filters.actor   one user's actions
 *   filters.target  every action against one record
 *   filters.since   ISO date, lower bound on when it happened
 *   filters.q       free text over action, target type and actor
 *   limit/offset    paging
 *
 * @returns {Promise<{count, limit, offset, has_more, results}>}
 */
export function listAuditLogs({ filters = {}, limit = 50, offset = 0, signal } = {}) {
  const params = { limit, offset };

  for (const [key, value] of Object.entries(filters)) {
    if (value !== "" && value !== null && value !== undefined) {
      params[key] = value;
    }
  }

  return api
    .get("/accounts/audit-logs/", { requiresAuth: true, params, signal })
    .then((response) => response.data);
}

/**
 * The dashboard payload.
 *
 * One request instead of six list endpoints that the console would
 * then count in the browser. The response is scoped to what the signed
 * in account may see, so a receptionist gets the schedule and the
 * queues they can act on and nothing else.
 */
export function getDashboard({ signal } = {}) {
  return api
    .get("/accounts/reports/dashboard/", { requiresAuth: true, signal })
    .then((response) => response.data);
}

/**
 * The full account directory - customers, staff and disabled accounts.
 *
 * `role` narrows server-side so the console's filter does not have to
 * download every account to find the administrators.
 */
export function listManagedUsers({ query = "", role = "", signal } = {}) {
  const params = {};

  if (query.trim()) {
    params.q = query.trim();
  }

  if (role) {
    params.role = role;
  }

  return api
    .get("/accounts/users/", { requiresAuth: true, params, signal })
    .then((response) => response.data);
}

/**
 * Edit one account. `payload` may carry any of the managed fields:
 * name, email, phone, is_active, role, permissions.
 *
 * Writing `role` creates, changes or removes the account's staff
 * access server-side, so there is no second call to keep the two in
 * step. The response is the account as it now stands, which is what
 * the console renders - never an optimistic local guess.
 */
export function updateManagedUser(id, payload) {
  return api
    .patch(`/accounts/users/${id}/`, payload, { requiresAuth: true })
    .then((response) => response.data);
}

export function resetManagedUserPassword(id, password = "") {
  return api.post(`/accounts/users/${id}/password/`, password ? { password } : {}, { requiresAuth: true }).then((response) => response.data);
}

export function getOperationsReport() {
  return api.get("/accounts/reports/operations/", { requiresAuth: true }).then((response) => response.data);
}
