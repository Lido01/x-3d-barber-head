import { useCallback, useEffect, useRef, useState } from "react";

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
 */
export function usePaymentStatus({ bookingId, paymentId, pollMs = 0 }) {
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(Boolean(bookingId || paymentId));
  const [error, setError] = useState(null);

  const controllerRef = useRef(null);

  const load = useCallback(
    ({ quiet = false } = {}) => {
      if (!bookingId && !paymentId) {
        return Promise.resolve(null);
      }

      controllerRef.current?.abort();

      const controller = new AbortController();
      controllerRef.current = controller;

      if (!quiet) {
        setLoading(true);
      }

      const request = paymentId
        ? getPayment(paymentId, { signal: controller.signal })
        : findPaymentForBooking(bookingId, { signal: controller.signal });

      return request
        .then((data) => {
          setPayment(data);
          setError(null);
          setLoading(false);

          return data;
        })
        .catch((apiError) => {
          if (apiError?.isCancelled) {
            return null;
          }

          // A 404 simply means no payment has been submitted yet.
          if (apiError?.status === 404) {
            setPayment(null);
            setError(null);
          } else {
            setError(apiError);
          }

          setLoading(false);

          return null;
        });
    },
    [bookingId, paymentId]
  );

  useEffect(() => {
    load();

    return () => {
      controllerRef.current?.abort();
    };
  }, [load]);

  // Optional background refresh, e.g. while waiting for an admin to
  // verify the receipt.
  useEffect(() => {
    if (!pollMs) {
      return undefined;
    }

    const timer = setInterval(() => {
      load({ quiet: true });
    }, pollMs);

    return () => {
      clearInterval(timer);
    };
  }, [pollMs, load]);

  return {
    payment,
    loading,
    error,
    refresh: () => load({ quiet: true }),
  };
}
