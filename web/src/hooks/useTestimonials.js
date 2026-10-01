import { useQuery } from "./useQuery";

import { listApprovedTestimonials } from "../services/testimonialsApi";

/**
 * Approved testimonials from GET /api/testimonials/testimonials/.
 *
 * The backend only returns approved testimonials to the public, so the
 * section never re-filters client side.
 */
export function useTestimonials() {
  const { data, error, loading, refetch } = useQuery(
    "/testimonials/testimonials/",
    listApprovedTestimonials,
    {
      select: (payload) => (Array.isArray(payload) ? payload : payload?.results || []),
    }
  );

  return { testimonials: data || [], loading, error, reload: refetch };
}
