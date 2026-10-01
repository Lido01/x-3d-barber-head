import { useQuery } from "./useQuery";

import { getAvailability } from "../services/bookingApi";

/**
 * Available start times from GET /api/bookings/availability/.
 *
 * Django decides what is bookable. This hook fetches and hands the
 * list over untouched - no slot is added, removed, sorted or filtered
 * on the client.
 *
 * The service, date and barber are part of the cache key, so moving
 * between dates fetches once per date and going back to a date already
 * seen is instant. The TTL is deliberately short: a slot list is only
 * as true as the bookings behind it, so it must not be trusted for long.
 * Booking the slot invalidates the key, so the list is corrected the
 * moment it goes out of date.
 */
export function useAvailability({ serviceId, bookingDate, barberId }) {
  const ready = Boolean(serviceId && bookingDate);

  const { data, error, loading, refetch } = useQuery(
    "/bookings/availability/",
    (signal) =>
      getAvailability({ serviceId, bookingDate, barberId }, { signal }),
    {
      params: { service: serviceId, booking_date: bookingDate, barber: barberId },
      enabled: ready,
      staleMs: 60 * 1000,
      select: (payload) =>
        Array.isArray(payload?.available_times) ? payload.available_times : [],
    }
  );

  const times = ready ? data || [] : [];

  return {
    times,
    loading: ready && loading,
    error: ready ? error : null,
    reload: refetch,
    /** Backend answered, and answered with nothing bookable. */
    isEmpty: ready && !loading && !error && times.length === 0,
  };
}
