import { useCallback, useEffect } from "react";

import { useQuery } from "./useQuery";

import { findPaymentForBooking, getPayment } from "../services/paymentApi";

/**
 * Live payment state for a booking, read straight from Django.
 *
 * GET /api/payments/payments/{id}/ is public on this backend, so the
 * customer's result page can show the real, current payment status
 * without logging in. Nothing is inferred locally: if the backend says
 * pending, the UI says pending.
 *
 * Looks the payment up by id when one is known, and otherwise finds it
 * by booking id (useful after a refresh in a fresh tab).
 *
 * This is the one hook that must not be cached: a staff member verifying
 * a receipt has to see the status change. `staleMs: 0` means every read
 * is a real request, so the cache only serves to dedupe the mount fetch
 * and to share it with any other component watching the same booking.
 */
export function usePaymentStatus({ bookingId, paymentId, pollMs = 0 }) {
  const ready = Boolean(bookingId || paymentId);

  const { data, error, loading, refetch } = useQuery(
    paymentId
      ? `/payments/payments/${paymentId}/`
      : `/payments/payments/by-booking/${bookingId}/`,
    (signal) =>
      paymentId
        ? getPayment(paymentId, { signal })
        : findPaymentForBooking(bookingId, { signal }),
    {
      enabled: ready,
      staleMs: 0,
    }
  );

  // A 404 simply means no payment has been submitted yet, which is a
  // normal state on this screen rather than a failure.
  const isMissing = error?.status === 404;

  const refresh = useCallback(() => refetch(), [refetch]);

  // Optional background refresh, e.g. while waiting for an admin to
  // verify the receipt. Only worth running while the answer can still
  // change: a verified or rejected payment is final, so stop asking.
  useEffect(() => {
    if (!pollMs || !ready) {
      return undefined;
    }

    if (data && data.status !== "pending") {
      return undefined;
    }

    const timer = setInterval(() => {
      void refetch();
    }, pollMs);

    return () => {
      clearInterval(timer);
    };
  }, [pollMs, ready, data, refetch]);

  return {
    payment: data || null,
    loading: ready && loading,
    error: isMissing ? null : error,
    refresh,
  };
}
