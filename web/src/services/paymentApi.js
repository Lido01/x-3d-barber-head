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
 *     booking_code: "BK-0025",
 *     booking_status: "confirmed",
 *     booking_date: "2026-08-29", booking_start_time: "09:00:00",
 *     booking_barber: "Lidetu Tesfaye",
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
 * The `booking_*` fields are what let a verifier decide a payment from the
 * queue alone - "is this the right money for this appointment" needs the
 * appointment, and it used to need a second screen to answer.
 *
 * Backend rules that matter to the UI:
 *   - the booking must already be CONFIRMED; reception confirms first and
 *     payment opens second, so the pay form is only offered once the
 *     booking's `payment_open` is true
 *   - status always starts as "pending"; the customer can never set it
 *   - booking is a OneToOneField, so a booking accepts ONE payment
 *   - verifying a payment also confirms its booking, which is a no-op for
 *     anything created under the rule above and covers payments that
 *     predate it
 *
 * To read one customer's live payment, use `getBookingStatus` in
 * bookingApi instead: it returns the booking and its payment together, so
 * a page waiting on a confirmation never has to ask about both.
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
