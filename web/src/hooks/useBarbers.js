import { useEffect, useState } from "react";

import { listBarbers } from "../services/bookingApi";

/**
 * Barbers for the optional "choose your barber" step.
 *
 * The backend has no barber endpoint yet, so this is gated behind
 * VITE_ENABLE_BARBER_SELECTION and makes no request while the flag is
 * off - the booking flow then relies on Django's automatic barber
 * assignment, which already works and returns barber_name.
 *
 * Flip the flag to true once GET /api/barbers/ exists.
 */
export function useBarbers() {
  const enabled =
    String(import.meta.env.VITE_ENABLE_BARBER_SELECTION).toLowerCase() ===
    "true";

  const [barbers, setBarbers] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const controller = new AbortController();

    setLoading(true);
    setError(null);

    listBarbers({ signal: controller.signal })
      .then((data) => {
        setBarbers(Array.isArray(data) ? data : data?.results || []);
        setLoading(false);
      })
      .catch((apiError) => {
        if (apiError?.isCancelled) {
          return;
        }

        // Never block booking on this: the customer falls back to
        // automatic assignment.
        setError(apiError);
        setBarbers([]);
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [enabled]);

  return {
    barbers,
    loading,
    error,
    /** Only offer the picker when the backend actually returned barbers. */
    available: enabled && !error && barbers.length > 0,
  };
}
