import { useQuery } from "./useQuery";

import { listBarbers } from "../services/bookingApi";
import { toArray } from "../utils/toArray";

/**
 * Active barbers from GET /api/barbers/ for display pages.
 *
 * The backend returns only active barbers to the public.
 *
 * Shared with the booking flow through the same cache key, so the
 * /barbers page and the booking page's picker cost one request, not two.
 */
export function useBarberList() {
  const { data, error, loading, refetch } = useQuery("/barbers/", listBarbers, {
    select: toArray,
  });

  return { barbers: data || [], loading, error, reload: refetch };
}
