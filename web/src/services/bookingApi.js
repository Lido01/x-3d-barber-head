import api from "./api";

/**
 * Bookings — /api/bookings/
 *
 * Public (AllowAny):
 *   POST /api/bookings/
 *   POST /api/bookings/lookup/
 *   GET  /api/bookings/availability/
 *
 * Signed in (customer):
 *   GET  /api/bookings/mine/
 *
 * Admin only (IsAuthenticated + IsAdminUser):
 *   GET    /api/bookings/
 *   GET    /api/bookings/{id}/
 *   PUT    /api/bookings/{id}/
 *   PATCH  /api/bookings/{id}/
 *   DELETE /api/bookings/{id}/
 *   POST   /api/bookings/{id}/cancel/
 *   POST   /api/bookings/{id}/confirm/
 *   POST   /api/bookings/{id}/complete/
 *
 * `status` is read-only on the serializer, so the only way to move a
 * booking is one of the three transitions. The server refuses an
 * illegal one: confirm rejects a cancelled booking, complete rejects
 * anything that is not confirmed.
 *
 * Booking response shape (confirmed live against BookingSerializer):
 *
 *   {
 *     id, booking_code: "BK-0025",
 *     customer_name, customer_phone,
 *     service: 4, service_name: "Lidetu's Style",
 *     barber: 1,  barber_name: "Lidetu Tesfaye",
 *     booking_date: "2026-08-29",
 *     start_time: "09:00:00", end_time: "10:00:00",
 *     status: "pending", notes,
 *     created_at, updated_at
 *   }
 */

/**
 * Available start times for a service on a date.
 *
 * Django is the sole authority here - the returned list is rendered
 * as-is and never recomputed or filtered in React.
 *
 * A date with nothing bookable is a 200, not an error. `availability`
 * beside the list says which situation it is - no barber on duty, the
 * service withdrawn, the date gone, the service longer than the opening
 * hours, simply full - along with the next free times when there are any.
 *
 * @returns {Promise<{
 *   service: string,
 *   date: string,
 *   available_times: string[],
 *   barber?: string,
 *   availability: {
 *     status: string,
 *     message: string,
 *     window: string,
 *     next_available: null | { date: string, times: string[] },
 *   },
 * }>}
 */
export function getAvailability(
  { serviceId, bookingDate, barberId },
  { signal } = {}
) {
  const params = {
    service: serviceId,
    booking_date: bookingDate,
  };

  if (barberId) {
    params.barber = barberId;
  }

  return api
    .get("/bookings/availability/", { params, signal })
    .then((response) => response.data);
}

/**
 * Create a public booking. No customer account is involved.
 *
 * `barberId` is optional: when it is empty the key is omitted from
 * the payload entirely and Django's find_available_barber() picks
 * the first free active barber. The frontend never invents one.
 */
export function createBooking({
  customerName,
  customerPhone,
  serviceId,
  barberId,
  bookingDate,
  startTime,
  notes,
}) {
  const payload = {
    customer_name: customerName,
    customer_phone: customerPhone,
    service: serviceId,
    booking_date: bookingDate,
    start_time: startTime,
  };

  if (barberId) {
    payload.barber = barberId;
  }

  if (notes) {
    payload.notes = notes;
  }

  return api.post("/bookings/", payload).then((response) => response.data);
}

export function listBarbers({ signal } = {}) {
  return api.get("/barbers/", { signal }).then((response) => response.data);
}

/**
 * Fetch a customer's booking history.
 *
 * The booking code plus the phone number the booking was made with. Two
 * because the code alone is short and guessable - it is derived from a
 * row id - and each row carries a name, a phone number, an appointment
 * time and a payment receipt.
 *
 * The code proves who is asking; the phone number is then the key to
 * everything else they have booked. That is why this returns a list and
 * not one booking: someone who wants to look over their history should
 * not have to dig out a separate code for every appointment they ever
 * made.
 *
 * POST rather than GET, so the phone number stays out of the URL: query
 * strings end up in access logs, browser history and Referer headers.
 * It also keeps the endpoint out of any cache, which a GET carrying a
 * credential should be.
 *
 * The backend answers an unknown code and a wrong phone identically, so
 * this cannot be used to find out which codes exist.
 *
 * @returns {Promise<{
 *   bookings: Array<{
 *     booking: object,
 *     payment: object | null,
 *     payment_due: boolean,
 *     payment_rejected: boolean,
 *   }>,
 *   matched_code: string,
 *   totals: {
 *     all: number,
 *     upcoming: number,
 *     awaiting_payment: number,
 *     awaiting_response: number,
 *   },
 * }>}
 */
export function lookupBooking({ code, phone }) {
  return api
    .post("/bookings/lookup/", { code, phone })
    .then((response) => response.data);
}

/**
 * The signed-in customer's own bookings, newest first.
 *
 * Only bookings made while signed in are attached to an account - a guest
 * booking has no account to attach to, and that one is found with
 * lookupBooking instead.
 */
export function listMyBookings({ signal } = {}) {
  return api
    .get("/bookings/mine/", {
      requiresAuth: true,
      authScope: "customer",
      signal,
    })
    .then((response) => response.data);
}

// --- admin only ---------------------------------------------------

export function listBookings({ signal } = {}) {
  return api
    .get("/bookings/", { requiresAuth: true, signal })
    .then((response) => response.data);
}

export function getBooking(id, { signal } = {}) {
  return api
    .get(`/bookings/${id}/`, { requiresAuth: true, signal })
    .then((response) => response.data);
}

export function cancelBooking(id) {
  return api
    .post(`/bookings/${id}/cancel/`, null, { requiresAuth: true })
    .then((response) => response.data);
}

/**
 * Staff-only confirmation.
 *
 * Verifying a payment already confirms its booking, so this is for the
 * walk-in or cash customer who has no receipt to verify.
 */
export function confirmBooking(id) {
  return api
    .post(`/bookings/${id}/confirm/`, null, { requiresAuth: true })
    .then((response) => response.data);
}

/** Staff-only completion: the customer has been in the chair. */
export function completeBooking(id) {
  return api
    .post(`/bookings/${id}/complete/`, null, { requiresAuth: true })
    .then((response) => response.data);
}

export function deleteBooking(id) {
  return api
    .delete(`/bookings/${id}/`, { requiresAuth: true })
    .then(() => undefined);
}
