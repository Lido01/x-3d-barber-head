import { useCallback, useEffect, useState } from "react";

import { listApprovedTestimonials } from "../services/testimonialsApi";

/**
 * Approved testimonials from GET /api/testimonials/testimonials/.
 *
 * The backend only returns approved testimonials to the public, so the
 * section never re-filters client side.
 */
export function useTestimonials() {
  const [testimonials, setTestimonials] = useState([]);
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

    listApprovedTestimonials({ signal: controller.signal })
      .then((data) => {
        setTestimonials(Array.isArray(data) ? data : data?.results || []);
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

  return { testimonials, loading, error, reload };
}
