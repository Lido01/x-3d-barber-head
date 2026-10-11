import { useBarberList } from "./useBarberList";

/**
 * Barbers for the booking picker.
 *
 * A thin wrapper over the same cached `/barbers/` read the display pages
 * use, so arriving at the booking form does not re-download a list the
 * visitor (or the home page they came from) already has.
 */
export function useBarbers() {
  const enabled =
    String(import.meta.env.VITE_ENABLE_BARBER_SELECTION ?? "true")
      .toLowerCase() !== "false";

  const { barbers, loading, error } = useBarberList();

  return {
    barbers: enabled ? barbers : [],
    loading: enabled && loading,
    // Never block booking on this: the customer falls back to automatic
    // assignment when the list cannot be read.
    error: enabled ? error : null,
    /** Only offer the picker when the backend actually returned barbers. */
    available: enabled && !error && barbers.length > 0,
  };
}
