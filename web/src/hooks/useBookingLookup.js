import { useCallback, useEffect, useState } from "react";

import { lookupBooking } from "../services/bookingApi";
import { rememberBooking } from "../utils/bookingSession";

/**
 * Load a customer's booking history, then keep it up to date.
 *
 * Deliberately not built on the shared GET cache. Two reasons:
 *
 *   1. The lookup is a POST. It carries the phone number the booking was
 *      made with, which is half of the proof that the person asking is
 *      the person who booked - and a proof must not end up in a cache,
 *      in storage, or in a key somebody could read off the screen.
 *   2. It must be answered now. Someone opening "my bookings" to see
 *      whether the shop has checked their payment is asking about the
 *      state of the world at this moment, and a stale answer to that
 *      question is worse than a spinner.
 *
 * What *is* kept is the successful result, in component state so the
 * history survives a re-render without another request, and mirrored into
 * the session store so a booking made in this browser is still listed
 * next time.
 *
 * The status is polled while it can still change - a payment pending
 * verification is going to move - and the polling stops as soon as
 * everything is final, because asking again about a verified payment is a
 * request that can only ever return the same answer.
 */

/** How often to ask again while an answer could still change. */
export const POLL_WHILE_PENDING_MS = 20000;

/** Statuses that will never move again. */
const SETTLED_BOOKINGS = ["completed", "cancelled"];
const SETTLED_PAYMENTS = ["verified", "rejected"];

/**
 * Whether any row in the history can still change.
 *
 * Per row rather than for the whole history: one old verified booking
 * would otherwise stop the polling for a new one that has not been
 * checked yet, which is the row the customer is actually watching.
 */
function hasUnsettled(history) {
  return (history?.bookings || []).some(
    (row) =>
      !SETTLED_BOOKINGS.includes(row.booking.status) ||
      (row.payment && !SETTLED_PAYMENTS.includes(row.payment.status))
  );
}

/** @returns {{
 *   history: object | null,
 *   bookings: Array<object>,
 *   totals: object | null,
 *   loading: boolean,
 *   error: any,
 *   find: (values: {code: string, phone: string}) => Promise<void>,
 *   refresh: () => Promise<void>,
 * }} */
export function useBookingLookup() {
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const find = useCallback(async ({ code, phone }) => {
    setLoading(true);
    setError(null);

    try {
      const payload = await lookupBooking({ code, phone });

      setHistory(payload);

      // Cached only so the confirmation page and the payment page have
      // something to show on a refresh, and so the codes booked in this
      // browser are listed here next time. The status itself always comes
      // from the API.
      (payload?.bookings || []).forEach((row) => {
        if (row?.booking) {
          rememberBooking(row.booking);
        }
      });
    } catch (caught) {
      setError(caught);
      setHistory(null);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Ask again now, regardless of how recently the last answer was. */
  const refresh = useCallback(async () => {
    if (!history?.bookings?.length) {
      return;
    }

    await find({
      code: history.matched_code,
      phone: history.bookings[0].booking.customer_phone,
    });
  }, [history, find]);

  // Ask again on a timer only while a row can still change, so someone
  // watching a receipt get verified sees it happen, and someone looking
  // at settled bookings does not keep generating traffic.
  useEffect(() => {
    if (!history || loading || !hasUnsettled(history)) {
      return undefined;
    }

    const timer = setInterval(() => {
      void refresh();
    }, POLL_WHILE_PENDING_MS);

    return () => clearInterval(timer);
  }, [history, loading, refresh]);

  return {
    history,
    bookings: history?.bookings || [],
    totals: history?.totals || null,
    matchedCode: history?.matched_code || "",
    loading,
    error,
    find,
    refresh,
    isFinal: Boolean(history) && !hasUnsettled(history),
  };
}