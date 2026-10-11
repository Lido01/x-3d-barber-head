import { useQuery } from "./useQuery";

import { getAvailability } from "../services/bookingApi";

/**
 * Available start times from GET /api/bookings/availability/.
 *
 * Django decides what is bookable. This hook fetches and hands the list
 * over untouched - no slot is added, removed, sorted or filtered on the
 * client.
 *
 * It also hands back the *reason* when there is nothing to show. The
 * booking form has four quite different dead ends - no barber on duty,
 * the service withdrawn, the date already passed, the service longer than
 * the opening hours - and a plain "fully booked" for all of them tells
 * the customer nothing about which of them they have hit or what to do
 * next. `reason` carries the backend's own sentence and, where there is a
 * way forward, the slots to move to.
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
      select: (payload) => ({
        times: Array.isArray(payload?.available_times)
          ? payload.available_times
          : [],
        reason: payload?.availability || null,
      }),
    }
  );

  const times = ready ? data?.times || [] : [];
  const reason = ready ? data?.reason || null : null;

  return {
    times,
    loading: ready && loading,
    error: ready ? error : null,
    reload: refetch,
    /** Backend answered, and answered with nothing bookable. */
    isEmpty: ready && !loading && !error && times.length === 0,
    /**
     * Why there is nothing bookable, or null when there is something.
     *
     * `{ status, message, window, next_available }`. `next_available`
     * is `{ date, times }` for the soonest later date with room, or
     * null when the whole window is full.
     */
    reason,
    /** The booking window the shop answers within, e.g. "09:00-21:00". */
    window: reason?.window || null,
    /** The next date with times on it, for a one-click move. */
    nextAvailable: reason?.next_available || null,
    /** True while the reason is one that no date change will fix. */
    needsDifferentService:
      reason?.status === "service_unavailable" ||
      reason?.status === "service_too_long" ||
      reason?.status === "no_barber_on_duty",
  };
}