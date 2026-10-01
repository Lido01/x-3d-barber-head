/**
 * Helpers for the customer's booking code, e.g. BK-3274.
 *
 * The backend owns the format and does the matching; these are the
 * display and input conveniences around it. `normaliseBookingCode` here
 * deliberately mirrors bookings.services.normalise_booking_code so the
 * field can be formatted as the customer types - the server still has
 * the final say on whether it matches anything.
 */

/** Kept in step with BOOKING_CODE_PREFIX in apps/bookings/models.py. */
export const BOOKING_CODE_PREFIX = "BK";

/** How wide a code is zero-padded, so BK-0007 and BK-3274 match. */
export const BOOKING_CODE_DIGITS = 4;

/** Where the backend put the code, and the shape to fall back on. */
export function bookingCodeOf(booking) {
  if (!booking) {
    return "";
  }

  return booking.booking_code || (booking.id ? `#${booking.id}` : "");
}

/**
 * "3274" -> "BK-3274", for display and for pasting somewhere legible.
 *
 * Returns "" for anything with no digits in it rather than a plausible
 * looking guess, so a missing code never renders as a wrong one.
 */
export function formatBookingCode(value) {
  const digits = String(value ?? "").replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  return `${BOOKING_CODE_PREFIX}-${digits.padStart(
    BOOKING_CODE_DIGITS,
    "0"
  )}`;
}

/**
 * "bk 3274" -> "BK-3274". The shape the customer is typing is cleaned up
 * as they go: the prefix is uppercased and the digits padded, so the
 * field always looks like the thing it wants.
 */
export function normaliseBookingCode(value) {
  const raw = String(value ?? "")
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "");

  const digits = raw.replace(/^BK/, "");

  if (!digits) {
    return raw === "BK" ? "BK-" : "";
  }

  return `BK-${digits.replace(/^0+(?=\d)/, "").padStart(
    BOOKING_CODE_DIGITS,
    "0"
  )}`;
}

/** Whether a typed code has enough in it to be worth sending. */
export function isCompleteBookingCode(value) {
  return /\d{3,}/.test(String(value ?? "").replace(/\D/g, ""));
}