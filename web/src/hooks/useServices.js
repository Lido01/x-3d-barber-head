import { useQuery } from "./useQuery";

import { listServices } from "../services/servicesApi";
import { toArray } from "../utils/toArray";

/**
 * Active services from GET /api/services/.
 *
 * The backend's list() already returns only active services, so there
 * is no client-side filtering here.
 *
 * Served from the shared cache: the six components that need this list
 * share one request, and the second one to mount renders immediately
 * from cache instead of showing a spinner. `reload()` still forces a
 * fresh read, so the retry button on an error screen keeps working.
 */
export function useServices() {
  const { data, error, loading, refetch } = useQuery("/services/", listServices, {
    select: toArray,
  });

  return { services: data || [], loading, error, reload: refetch };
}
