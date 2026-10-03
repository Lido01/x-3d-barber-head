import { useCallback, useEffect } from "react";

import { useQuery } from "./useQuery";

import { getBookingStatus } from "../services/bookingApi";

/**
 * The live state of one booking, read straight from Django.
 *
 * GET /api/bookings/{id}/status/, proved by the booking code and the phone
 * number the booking was made with, and it answers both halves of the
 * question at once:
 *
 *   - has reception confirmed the appointment?  `booking.status`
 *   - has the shop checked the money?           `payment`
 *
 * One request rather than two. That matters because both halves are moving
 * at the same time on the one screen where a customer is watching them, and
 * two requests leave a window in which the page shows a booking that has
 * just been confirmed beside a payment that has just been verified - or,
 * worse, a pay form that has not closed yet.
 *
 * It replaces the narrower hook that read only the payment. That one had a
 * 404 to interpret - "no payment has been sent yet", which is the state
 * every first-time visitor is in and which once left the payment page on a
 * spinner for exactly the people who had come to pay. This endpoint answers
 * 200 with `payment: null` instead, so there is no missing state to
 * distinguish from a failure and no ambiguity about what to render.
 *
 * Nothing here is inferred locally. `payment_open` is the server's answer to
 * "may this be paid right now", and it is what the pay form is opened from -
 * a pay form derived locally from the booking status would be one reception
 * action away from taking money for a chair nobody has agreed to.
 *
 * `staleMs: 0`: this is the one hook that must not be cached. A staff member
 * confirming a booking or verifying a receipt has to show up here without a
 * refresh, and the customer watching it has to see it happen.
 */

/** Booking statuses that will never move again. */
const SETTLED_BOOKINGS = ["completed", "cancelled"];

/** Payment statuses that will never move again. */
const SETTLED_PAYMENTS = ["verified", "rejected"];

/** How often to ask again while an answer could still change. */
export const POLL_WHILE_UNSETTLED_MS = 20000;

/**
 * Whether this row can still change.
 *
 * Both halves matter. A booking waiting on reception is unsettled - it is
 * about to become payable - and a payment pending verification is unsettled
 * even when the booking is finished with.
 */
export function canStillChange(row) {
  if (!row?.booking) {
    return false;
  }

  if (!SETTLED_BOOKINGS.includes(row.booking.status)) {
    return true;
  }

  const payment = row.payment;

  return Boolean(payment && !SETTLED_PAYMENTS.includes(payment.status));
}

/**
 * @param {object} options
 * @param {string|number} options.bookingId
 * @param {string} options.bookingCode  the booking's own code
 * @param {string} options.bookingPhone the number it was made with
 * @param {number} [options.pollMs]      0 disables background polling
 * @returns {{
 *   booking: object | null,
 *   payment: object | null,
 *   paymentDue: boolean,
 *   paymentOpen: boolean,
 *   paymentRejected: boolean,
 *   loading: boolean,
 *   error: any,
 *   ready: boolean,
 *   settled: boolean,
 *   refresh: () => Promise<any>,
 * }}
 */
export function useBookingStatus({
  bookingId,
  bookingCode,
  bookingPhone,
  pollMs = 0,
}) {
  // Without both halves of the proof the endpoint would refuse, so there is
  // nothing to ask for and the caller is left with whatever it already had.
  const ready = Boolean(bookingId && bookingCode && bookingPhone);

  const { data, error, loading, refetch } = useQuery(
    `/bookings/${bookingId}/status/`,
    (signal) =>
      getBookingStatus(bookingId, {
        signal,
        bookingCode,
        bookingPhone,
      }),
    {
      enabled: ready,
      staleMs: 0,
    }
  );

  const refresh = useCallback(() => refetch(), [refetch]);

  const settled = data ? !canStillChange(data) : false;

  // Background refresh, only while the answer can still move. A confirmed
  // and verified booking is finished; asking again about it is a request
  // that can only ever return the same answer.
  useEffect(() => {
    if (!pollMs || !ready || (data && !canStillChange(data))) {
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
    booking: data?.booking || null,
    payment: data?.payment || null,
    paymentDue: Boolean(data?.payment_due),
    /** The customer may send money right now. False until confirmed. */
    paymentOpen: Boolean(data?.payment_open),
    paymentRejected: Boolean(data?.payment_rejected),
    loading: ready && loading,
    error: ready ? error : null,
    /** The request has finished, one way or another. */
    ready: ready && !loading,
    settled,
    refresh,
  };
}