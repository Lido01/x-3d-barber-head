import { useCallback, useEffect } from "react";

import { useQuery } from "./useQuery";

import { findPaymentForBooking } from "../services/paymentApi";

/**
 * Live payment state for a booking, read straight from Django.
 *
 * GET /api/payments/payments/{id}/ is public on this backend, so the
 * customer's result page can show the real, current payment status
 * without logging in. Nothing is inferred locally: if the backend says
 * pending, the UI says pending.
 *
 * Always reads through the booking-scoped endpoint when a booking id is
 * available. The payment page and the result page then share one cache key
 * across their redirect instead of reading the same payment once by id and
 * once by booking.
 *
 * This is the one hook that must not be cached: a staff member verifying
 * a receipt has to see the status change. `staleMs: 0` means every read
 * is a real request, so the cache only serves to dedupe the mount fetch
 * and to share it with any other component watching the same booking.
 */
export function usePaymentStatus({ bookingId, bookingCode, bookingPhone, pollMs = 0 }) {
  const ready = Boolean(bookingId && bookingCode && bookingPhone);

  const { data, error, loading, refetch } = useQuery(
    `/payments/payments/by-booking/${bookingId}/`,
    (signal) =>
      findPaymentForBooking(bookingId, {
        signal,
        bookingCode,
        bookingPhone,
      }),
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
