import { useCallback, useEffect, useState } from "react";

import { listBarbers } from "../services/bookingApi";

/**
 * Active barbers from GET /api/barbers/ for display pages.
 *
 * The backend returns only active barbers to the public.
 */
export function useBarberList() {
  const [barbers, setBarbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  useEffect(() => {
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

        setError(apiError);
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [reloadKey]);

  return { barbers, loading, error, reload };
}
