import api from "./api";

/**
 * Testimonials — /api/testimonials/testimonials/
 *
 * Public (AllowAny):
 *   GET  /api/testimonials/testimonials/         approved only
 *   GET  /api/testimonials/testimonials/{id}/    approved
 *
 * Signed-in customer (IsAuthenticated):
 *   POST /api/testimonials/testimonials/         submit (created pending)
 *   GET  /api/testimonials/testimonials/mine/    own reviews, every state
 *
 * Admin only (IsAdminUser):
 *   POST   /api/testimonials/testimonials/{id}/approve/
 *   POST   /api/testimonials/testimonials/{id}/reject/
 *   DELETE /api/testimonials/testimonials/{id}/
 *
 * A review is written by an account, not by a name typed into a form:
 * `customer_name` and `user` are read-only on the server, so
 * `submitTestimonial` sends neither and the published name comes from
 * the token.
 *
 * TestimonialSerializer item shape:
 *
 *   {
 *     id, user: 4 | null,
 *     customer_name, customer_phone,
 *     message, rating: 5,
 *     photo: "/media/testimonials/..." | null,
 *     status: "pending" | "approved" | "rejected",
 *     created_at, updated_at
 *   }
 */

export function listApprovedTestimonials({ signal } = {}) {
  return api
    .get("/testimonials/testimonials/", { signal })
    .then((response) => response.data);
}

/**
 * Submit a new customer review.
 *
 * `photo` is an optional File sent as multipart/form-data so a customer
 * can attach a picture of their cut with the review.
 *
 * The request carries the customer session's token: the server 401s
 * without it, which is what stops a review appearing on the wall from
 * an account nobody can trace.
 */
export function submitTestimonial({
  message,
  rating,
  photo = null,
}) {
  const payload = new FormData();

  payload.append("message", message);
  payload.append("rating", String(rating));

  if (photo) {
    payload.append("photo", photo);
  }

  return api
    .post("/testimonials/testimonials/", payload, {
      requiresAuth: true,
      authScope: "customer",
    })
    .then((response) => response.data);
}

/** The signed-in customer's own reviews, in every state. */
export function listMyTestimonials({ signal } = {}) {
  return api
    .get("/testimonials/testimonials/mine/", {
      requiresAuth: true,
      authScope: "customer",
      signal,
    })
    .then((response) => response.data);
}

// --- admin only ---------------------------------------------------

export function listAllTestimonials({ signal } = {}) {
  return api
    .get("/testimonials/testimonials/", { requiresAuth: true, signal })
    .then((response) => response.data);
}

export function approveTestimonial(id) {
  return api
    .post(`/testimonials/testimonials/${id}/approve/`, null, {
      requiresAuth: true,
    })
    .then((response) => response.data);
}

export function rejectTestimonial(id) {
  return api
    .post(`/testimonials/testimonials/${id}/reject/`, null, {
      requiresAuth: true,
    })
    .then((response) => response.data);
}

export function deleteTestimonial(id) {
  return api
    .delete(`/testimonials/testimonials/${id}/`, { requiresAuth: true })
    .then(() => undefined);
}
