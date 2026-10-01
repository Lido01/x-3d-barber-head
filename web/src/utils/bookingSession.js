/**
 * Caches the booking the server returned, per booking id, so the
 * result and payment pages survive a page refresh.
 *
 * Why this exists: GET /api/bookings/{id}/ requires admin credentials
 * (BookingViewSet.get_permissions only opens create + availability to
 * the public), so a customer cannot re-read their own booking by id.
 * What is stored here is the exact 201 response body from Django -
 * never a locally invented or locally mutated status.
 *
 * Two ways a customer can get back to a booking, and both work:
 *
 *   1. This tab. The code is listed on "my bookings" straight from here,
 *      with the phone number it was made with, so the lookup can be
 *      filled in without remembering anything.
 *   2. Any device. The code and the phone number, entered by hand into
 *      POST /api/bookings/lookup/. The server is the authority; this is
 *      only a shortcut to it.
 *
 * Payment status is never cached here. It is always re-read live from
 * the public payment endpoint, so that side of the page is current even
 * though the recap is a snapshot.
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
 * Every booking made in this browser, most recent first.
 *
 * A shortcut, not a record of truth: the status shown alongside is a
 * snapshot from the moment of creation, so anything listed here is
 * resolved against the server before the customer is shown a status. It
 * exists so "my bookings" can offer one tap instead of asking someone to
 * find a code in a confirmation email.
 *
 * @returns {Array<{id: number, code: string, phone: string, booking: object}>}
 */
export function rememberedBookings() {
  return Object.values(readAll())
    .filter((entry) => entry?.booking?.id)
    .map((entry) => ({
      id: entry.booking.id,
      code: entry.booking.booking_code || "",
      phone: entry.booking.customer_phone || "",
      name: entry.booking.customer_name || "",
      booking: entry.booking,
      savedAt: entry.savedAt,
    }))
    .sort((a, b) => String(b.savedAt || "").localeCompare(String(a.savedAt || "")));
}