import { useCallback, useEffect, useState } from "react";

import { getAvailability } from "../services/bookingApi";

/**
 * Available start times from GET /api/bookings/availability/.
 *
 * Django decides what is bookable. This hook fetches and hands the
 * list over untouched - no slot is added, removed, sorted or filtered
 * on the client.
 *
 * Refetches whenever the service, date or barber changes, and cancels
 * the in-flight request so a slow earlier response cannot overwrite a
 * newer one.
 */
export function useAvailability({ serviceId, bookingDate, barberId }) {
  const [times, setTimes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  const ready = Boolean(serviceId && bookingDate);

  useEffect(() => {
    if (!ready) {
      setTimes([]);
      setError(null);
      setLoading(false);

      return undefined;
    }

    const controller = new AbortController();

    setLoading(true);
    setError(null);

    getAvailability(
      { serviceId, bookingDate, barberId },
      { signal: controller.signal }
    )
      .then((data) => {
        setTimes(
          Array.isArray(data?.available_times) ? data.available_times : []
        );
        setLoading(false);
      })
      .catch((apiError) => {
        if (apiError?.isCancelled) {
          return;
        }

        setError(apiError);
        setTimes([]);
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [ready, serviceId, bookingDate, barberId, reloadKey]);

  return {
    times,
    loading,
    error,
    reload,
    /** Backend answered, and answered with nothing bookable. */
    isEmpty: ready && !loading && !error && times.length === 0,
  };
}
