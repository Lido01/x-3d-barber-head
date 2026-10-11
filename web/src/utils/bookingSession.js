/**
 * Holds the booking this tab is currently on, so the result and payment
 * pages survive a refresh.
 *
 * Why this exists: GET /api/bookings/{id}/ requires staff credentials, and
 * the customer-facing read needs the booking code and phone number as proof -
 * so a customer cannot re-read their own booking by id without them. What is
 * stored here is the exact body Django returned, never a locally invented or
 * locally mutated status.
 *
 * ## One booking, not a list
 *
 * This is a memo for the single booking being looked at, so the result page
 * and the payment page can poll on a refresh. It is deliberately **not** a
 * history: nothing here is ever presented as a list of past bookings, and
 * there is no way to enumerate it. A customer who has booked three times has
 * three booking IDs and each one opens its own appointment; a browser-local
 * list would be a fourth, weaker way to find them, and it would be wrong the
 * moment the booking was made on another device.
 *
 * Payment status is never cached here. It is always re-read live from the
 * booking status endpoint, so that side of the page is current even though
 * the recap is a snapshot.
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

/**
 * Forget everything held for this tab.
 *
 * Only used on a failed lookup, so a mistyped booking ID does not leave the
 * previous booking's details on screen behind an error. Without it the
 * customer is reading a name, a time and a payment status for an
 * appointment they did not ask for.
 */
export function forgetBookings() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Storage unavailable - nothing was held anyway.
  }
}