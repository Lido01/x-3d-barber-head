/**
 * Caches the booking the server returned, per booking id, so the
 * result and payment pages survive a page refresh.
 *
 * Why this exists: GET /api/bookings/{id}/ requires admin credentials
 * (BookingViewSet.get_permissions only opens create + availability to
 * the public), so a customer cannot re-read their own booking. What is
 * stored here is the exact 201 response body from Django - never a
 * locally invented or locally mutated status.
 *
 * Payment status IS re-read live from the public payment endpoint, so
 * that side of the page is always current.
 */

const KEY = "noir.bookings";

function readAll() {
  try {
    const raw = sessionStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};

    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(entries) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // Storage unavailable - the page still works from router state.
  }
}

/** Store the booking exactly as Django returned it. */
export function rememberBooking(booking) {
  if (!booking?.id) {
    return;
  }

  const entries = readAll();

  entries[booking.id] = {
    ...(entries[booking.id] || {}),
    booking,
    savedAt: new Date().toISOString(),
  };

  writeAll(entries);
}

/** Attach the created payment's id to a remembered booking. */
export function rememberPaymentId(bookingId, paymentId) {
  if (!bookingId || !paymentId) {
    return;
  }

  const entries = readAll();

  entries[bookingId] = {
    ...(entries[bookingId] || {}),
    paymentId,
  };

  writeAll(entries);
}

/** @returns {{booking?: object, paymentId?: number}|null} */
export function recallBooking(bookingId) {
  if (!bookingId) {
    return null;
  }

  return readAll()[bookingId] || null;
}
