import { useCallback, useEffect, useState } from "react";

import { lookupBooking } from "../services/bookingApi";
import { rememberBooking } from "../utils/bookingSession";

/**
 * Load one booking by its own code, then keep it up to date.
 *
 * Deliberately not built on the shared GET cache. Two reasons:
 *
 *   1. The lookup is a POST. It carries the phone number the booking was
 *      made with, which is half of the proof that the person asking is
 *      the person who booked - and a proof must not end up in a cache, in
 *      storage, or in a key somebody could read off the screen.
 *   2. It must be answered now. Someone checking their booking to see
 *      whether the shop has confirmed it, or verified their payment, is
 *      asking about the state of the world at this moment, and a stale
 *      answer to that question is worse than a spinner.
 *
 * ## One code, one booking
 *
 * Every booking has its own code, so someone who has booked three times
 * holds three references and each one opens its own appointment. The hook
 * returns that single booking and nothing beside it.
 *
 * That is deliberate. Returning the customer's whole phone history - which
 * is what this used to do - made the code identify the customer rather than
 * the booking, so a customer checking whether *one* appointment was paid
 * opened a list of however many they had and read whichever row they
 * recognised. The code identified nothing. If they walk away satisfied after
 * reading the wrong row's payment status, the answer was never really
 * theirs.
 *
 * What *is* kept is the successful result, in component state so it
 * survives a re-render without another request, and mirrored into the
 * session store for the booking this tab is currently holding, so the
 * confirmation and payment pages have the code and phone to poll with.
 *
 * The status is polled while it can still change - a booking waiting on
 * reception is going to become payable, and a payment pending verification
 * is going to move - and the polling stops as soon as everything is final,
 * because asking again about a verified payment is a request that can only
 * ever return the same answer.
 */

/** How often to ask again while an answer could still change. */
export const POLL_WHILE_PENDING_MS = 20000;

/** Booking statuses that will never move again. */
const SETTLED_BOOKINGS = ["completed", "cancelled", "expired"];

/** Payment statuses that will never move again. */
const SETTLED_PAYMENTS = ["verified", "rejected"];

/**
 * Whether this booking can still change.
 *
 * Both halves matter. A booking waiting on reception is unsettled - it is
 * about to become payable - and a payment pending verification is unsettled
 * even when the appointment is finished with.
 */
function canStillChange(lookup) {
  if (!lookup?.booking) {
    return false;
  }

  if (!SETTLED_BOOKINGS.includes(lookup.booking.status)) {
    return true;
  }

  const payment = lookup.payment;

  return Boolean(payment && !SETTLED_PAYMENTS.includes(payment.status));
}

/**
 * @returns {{
 *   booking: object | null,
 *   payment: object | null,
 *   paymentDue: boolean,
 *   paymentOpen: boolean,
 *   paymentRejected: boolean,
 *   loading: boolean,
 *   error: any,
 *   find: (values: {code: string, phone: string}) => Promise<void>,
 *   refresh: () => Promise<void>,
 *   isFinal: boolean,
 * }}
 */
export function useBookingLookup() {
  const [lookup, setLookup] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const find = useCallback(async ({ code, phone }) => {
    setLoading(true);
    setError(null);

    try {
      const payload = await lookupBooking({ code, phone });

      setLookup(payload);

      // Cached only so the confirmation and payment pages, in this tab,
      // have the code and phone to poll with. It is never presented as a
      // list of past bookings: the status shown always comes from the API
      // for the one code that was asked for.
      if (payload?.booking) {
        rememberBooking(payload.booking);
      }
    } catch (caught) {
      setError(caught);
      setLookup(null);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Ask again now, regardless of how recently the last answer was. */
  const refresh = useCallback(async () => {
    if (!lookup?.booking) {
      return;
    }

    await find({
      code: lookup.booking.booking_code,
      phone: lookup.booking.customer_phone,
    });
  }, [lookup, find]);

  // Ask again on a timer only while the booking can still change, so
  // someone watching reception confirm it sees it happen, and someone
  // looking at a finished booking does not keep generating traffic.
  useEffect(() => {
    if (!lookup || loading || !canStillChange(lookup)) {
      return undefined;
    }

    const timer = setInterval(() => {
      void refresh();
    }, POLL_WHILE_PENDING_MS);

    return () => clearInterval(timer);
  }, [lookup, loading, refresh]);

  return {
    booking: lookup?.booking || null,
    payment: lookup?.payment || null,
    paymentDue: Boolean(lookup?.payment_due),
    paymentOpen: Boolean(lookup?.payment_open),
    paymentRejected: Boolean(lookup?.payment_rejected),
    matchedCode: lookup?.booking?.booking_code || "",
    loading,
    error,
    find,
    refresh,
    isFinal: Boolean(lookup) && !canStillChange(lookup),
  };
}