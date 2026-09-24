import api from "./api";

/**
 * Bookings — /api/bookings/
 *
 * Public (AllowAny):
 *   POST /api/bookings/
 *   GET  /api/bookings/availability/
 *
 * Admin only (IsAuthenticated + IsAdminUser):
 *   GET    /api/bookings/
 *   GET    /api/bookings/{id}/
 *   PUT    /api/bookings/{id}/
 *   PATCH  /api/bookings/{id}/
 *   DELETE /api/bookings/{id}/
 *   POST   /api/bookings/{id}/cancel/
 *
 * Booking response shape (confirmed live against BookingSerializer):
 *
 *   {
 *     id, customer_name, customer_phone,
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
 * @returns {Promise<{service: string, date: string, available_times: string[], barber?: string}>}
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
