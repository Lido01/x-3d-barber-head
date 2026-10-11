import api from "./api";

/**
 * Bookings — /api/bookings/
 *
 * Public (AllowAny):
 *   POST /api/bookings/
 *   POST /api/bookings/lookup/
 *   GET  /api/bookings/availability/
 *   GET  /api/bookings/{id}/status/    one booking, live, proved by
 *                                       code + phone in the headers
 *
 * Signed in (customer):
 *   GET  /api/bookings/mine/
 *
 * Admin only (IsAuthenticated + capability):
 *   GET    /api/bookings/          each row carries its payment
 *   GET    /api/bookings/{id}/     the same, for one booking
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
 *     payment_status: null | "pending" | "verified" | "rejected",
 *     payment_due: true,      money is still owed on a live appointment
 *     payment_open: false,    money may be sent this minute
 *     already_booked: false,
 *     created_at, updated_at
 *   }
 *
 * The two money flags are not the same question and must not be collapsed:
 *
 *   payment_due   the shop is still owed money for this appointment.
 *                 True for a booking nobody has confirmed *yet* - it is
 *                 already money the shop intends to collect.
 *   payment_open  the customer may send it right now. False until
 *                 reception confirms, which is the order the whole
 *                 booking flow runs in: requested, confirmed, paid,
 *                 checked. Showing a pay form off `payment_due` offers
 *                 money for a chair nobody has agreed to.
 *
 * On the staff `list` and `retrieve` actions there is one more key,
 * `payment`: the whole attached payment - amount, method, reference,
 * receipt image, verifier, or the reason it was rejected. So a booking
 * and its money are read in one request and cannot disagree on screen.
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
 * One booking, named by its own code, proved by the phone it was made with.
 *
 * The code identifies the booking; the phone number is the second factor
 * that proves the person asking owns it. Two because the code alone is short
 * and guessable - it is derived from a row id - and a booking carries a
 * name, a phone number, an appointment time and a payment receipt.
 *
 * Every booking has its own code, so someone who has booked three times
 * quotes the one they mean and gets that appointment. This does **not**
 * return everything on the phone number: that made the code identify the
 * customer rather than the booking, and put the appointment being asked
 * about in a list where the wrong row was as plausible as the right one.
 *
 * The other bookings on that number come back as `other_bookings` - a code,
 * a date, a service and the state of the money, with no payment detail.
 * Enough to see there are three and pick another; reading any of them
 * properly still takes that booking's own code.
 *
 * POST rather than GET, so the phone number stays out of the URL: query
 * strings end up in access logs, browser history and Referer headers. It
 * also keeps the endpoint out of any cache, which a GET carrying a
 * credential should be.
 *
 * The backend answers an unknown code and a wrong phone identically, so this
 * cannot be used to find out which codes exist.
 *
 * @returns {Promise<{
 *   booking: object,
 *   payment: object | null,
 *   payment_due: boolean,
 *   payment_open: boolean,
 *   payment_rejected: boolean,
 *   other_bookings: Array<{
 *     id: number,
 *     booking_code: string,
 *     booking_date: string,
 *     start_time: string,
 *     service_name: string,
 *     status: string,
 *     payment_status: string | null,
 *   }>,
 * }>}
 */
export function lookupBooking({ code, phone }) {
  return api
    .post("/bookings/lookup/", { code, phone })
    .then((response) => response.data);
}

/**
 * One booking, live, for the customer who made it.
 *
 * The endpoint the booking result page polls, because it answers both of
 * the questions a waiting customer is watching in one request: has
 * reception confirmed the appointment yet, and has the shop checked the
 * payment. Two endpoints meant two round trips and a window between them
 * in which the page could show a booking that had just been confirmed
 * beside a payment that had just been verified.
 *
 * The code and the phone travel in headers rather than the query string.
 * This is a GET, and a GET carrying a credential must not end up in an
 * access log, a browser history or a Referer header.
 *
 * Always a 200 once the proof passes - including when nothing has been
 * paid, because "not paid yet" is a state the page has to render rather
 * than a failure. Answering it with a 404 is what once left the payment
 * page on a spinner for exactly the customers who had come to pay.
 *
 * @returns {Promise<{
 *   booking: object,
 *   payment: object | null,
 *   payment_due: boolean,
 *   payment_open: boolean,
 *   payment_rejected: boolean,
 * }>}
 */
export function getBookingStatus(
  bookingId,
  { signal, bookingCode, bookingPhone } = {}
) {
  return api
    .get(`/bookings/${bookingId}/status/`, {
      signal,
      headers: {
        "X-Booking-Code": bookingCode,
        "X-Booking-Phone": bookingPhone,
      },
    })
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
