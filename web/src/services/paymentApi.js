import api from "./api";

/**
 * Payments — /api/payments/payments/
 *
 * Public (AllowAny):
 *   POST /api/payments/payments/          submit payment + receipt
 *   GET  /api/payments/payments/          list
 *   GET  /api/payments/payments/{id}/     retrieve
 *
 * Admin only (IsAuthenticated + IsAdminUser):
 *   POST /api/payments/payments/{id}/verify/
 *   POST /api/payments/payments/{id}/reject/   body: { reason }
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
  { bookingId, amount, method, transactionReference, receiptFile },
  { onProgress } = {}
) {
  const formData = new FormData();

  formData.append("booking", bookingId);
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

export function listPayments({ signal } = {}) {
  return api
    .get("/payments/payments/", { signal })
    .then((response) => response.data);
}

/**
 * Find the payment attached to a booking.
 *
 * Used when a customer refreshes the result page in a new tab and the
 * cached payment id is gone. The list endpoint is public on this
 * backend, so no credentials are involved.
 */
export function findPaymentForBooking(bookingId, { signal } = {}) {
  return listPayments({ signal }).then((payments) => {
    const rows = Array.isArray(payments) ? payments : payments?.results || [];

    return (
      rows.find((payment) => String(payment.booking) === String(bookingId)) ||
      null
    );
  });
}

// --- admin only ---------------------------------------------------

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
