import api from "./api";

/**
 * Testimonials — /api/testimonials/testimonials/
 *
 * Public (AllowAny):
 *   GET  /api/testimonials/testimonials/         approved only
 *   GET  /api/testimonials/testimonials/{id}/    approved
 *   POST /api/testimonials/testimonials/         submit (created pending)
 *
 * Admin only (IsAdminUser):
 *   POST   /api/testimonials/testimonials/{id}/approve/
 *   POST   /api/testimonials/testimonials/{id}/reject/
 *   DELETE /api/testimonials/testimonials/{id}/
 *
 * TestimonialSerializer item shape:
 *
 *   {
 *     id, customer_name, customer_phone,
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
 * Submit a new customer testimonial. It is created with `pending`
 * status and only appears publicly once an admin approves it.
 */
export function submitTestimonial({ customerName, message, rating }) {
  const payload = {
    customer_name: customerName,
    message,
    rating,
  };

  return api
    .post("/testimonials/testimonials/", payload)
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
