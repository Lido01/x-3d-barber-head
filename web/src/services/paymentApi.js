import api from "./api";

/**
 * Payments — /api/payments/payments/
 *
 * Public (AllowAny):
 *   POST /api/payments/payments/              submit payment + receipt
 *   GET  /api/payments/payments/{id}/         retrieve one
 *   GET  /api/payments/payments/by-booking/{bookingId}/
 *                                            the one payment for a booking
 *                                            (X-Booking-Code + X-Booking-Phone)
 *
 * Staff only (bearer token + capability):
 *   GET    /api/payments/payments/            list every payment
 *   POST   /api/payments/payments/{id}/verify/
 *   POST   /api/payments/payments/{id}/reject/   body: { reason }
 *
 * Payment response shape (PaymentSerializer):
 *
 *   {
 *     id, booking: 25,
 *     booking_customer: "Adonay",
 *     booking_service: "Fade Haircut",
 *     amount: "5000.00", method: "telebirr",
 *     transaction_reference: "TIN0987",
 *     receipt: "/media/payment_receipts/...png" | null,
 *     status: "pending" | "verified" | "rejected",
 *     verified_by, verified_at, rejection_reason,
 *     created_at, updated_at
 *   }
 *
 * Backend rules that matter to the UI:
 *   - status always starts as "pending"; the customer can never set it
 *   - booking is a OneToOneField, so a booking accepts ONE payment
 *   - verifying a payment also confirms its booking (confirm_booking)
 */

export const PAYMENT_METHODS = [
  { value: "telebirr", label: "Telebirr" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cbe", label: "CBE" },
  { value: "other", label: "Other" },
];

/**
 * Submit a payment for a booking.
 *
 * Sent as multipart/form-data because of the optional receipt image.
 * Content-Type is intentionally left unset so the browser generates
 * the multipart boundary itself.
 *
 * @param {(percent: number) => void} [onProgress]
 */
export function createPayment(
  {
    bookingId,
    bookingCode,
    bookingPhone,
    amount,
    method,
    transactionReference,
    receiptFile,
  },
  { onProgress } = {}
) {
  const formData = new FormData();

  formData.append("booking", bookingId);
  formData.append("booking_reference", bookingCode || "");
  formData.append("booking_phone", bookingPhone || "");
  formData.append("amount", amount);
  formData.append("method", method);

  if (transactionReference) {
    formData.append("transaction_reference", transactionReference);
  }

  if (receiptFile) {
    formData.append("receipt", receiptFile);
  }

  return api
    .post("/payments/payments/", formData, {
      onUploadProgress: (event) => {
        if (!onProgress || !event.total) {
          return;
        }

        onProgress(Math.round((event.loaded * 100) / event.total));
      },
    })
    .then((response) => response.data);
}

export function getPayment(id, { signal } = {}) {
  return api
    .get(`/payments/payments/${id}/`, { signal })
    .then((response) => response.data);
}

/**
 * Find the payment attached to a booking.
 *
 * Used when a customer refreshes the result page in a new tab and the
 * cached payment id is gone. Retrieval by id is public on this backend,
 * so no credentials are involved and the customer flow stays
 * unauthenticated.
 *
 * Scoped to the one booking by using the detail route. The list route
 * is staff-only, so a customer calling it gets 401 - which is correct,
 * since that list is every customer's payment in the shop.
 */
export function findPaymentForBooking(
  bookingId,
  { signal, bookingCode, bookingPhone } = {}
) {
  return api
    .get(`/payments/payments/by-booking/${bookingId}/`, {
      signal,
      headers: {
        "X-Booking-Code": bookingCode,
        "X-Booking-Phone": bookingPhone,
      },
    })
    .then((response) => response.data);
}

// --- staff only ---------------------------------------------------
//
// Every call below opts in with `requiresAuth: true`, which is what
// makes the request interceptor attach the staff bearer token. Without
// it the header is absent and the API answers 401 "Authentication
// credentials were not provided" - which is not a permissions problem
// but a missing header, and the two are easy to confuse when the
// account is in fact allowed to do the thing.

export function listPayments({ signal } = {}) {
  return api
    .get("/payments/payments/", { requiresAuth: true, signal })
    .then((response) => response.data);
}

export function verifyPayment(id) {
  return api
    .post(`/payments/payments/${id}/verify/`, null, { requiresAuth: true })
    .then((response) => response.data);
}

export function rejectPayment(id, reason) {
  return api
    .post(`/payments/payments/${id}/reject/`, { reason }, { requiresAuth: true })
    .then((response) => response.data);
}
