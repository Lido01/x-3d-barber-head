import { useCallback, useEffect, useState } from "react";

import { listServices } from "../services/servicesApi";

/**
 * Active services from GET /api/services/.
 *
 * The backend's list() already returns only active services, so there
 * is no client-side filtering here.
 */
export function useServices() {
  const [services, setServices] = useState([]);
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

    listServices({ signal: controller.signal })
      .then((data) => {
        setServices(Array.isArray(data) ? data : data?.results || []);
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

  return { services, loading, error, reload };
}
