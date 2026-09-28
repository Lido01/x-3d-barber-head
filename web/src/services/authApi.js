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
