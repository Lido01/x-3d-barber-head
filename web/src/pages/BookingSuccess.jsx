import { useEffect, useState } from "react";
import { BellRing, CheckCircle2, Hourglass, RefreshCw, XCircle } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";

import CopyCodeButton from "../components/CopyCodeButton";
import BookingSummary from "../components/BookingSummary";
import Alert from "../components/ui/Alert";
import { PaymentPrompt } from "../components/booking/BookingProgress";
import {
  POLL_WHILE_UNSETTLED_MS,
  useBookingStatus,
} from "../hooks/useBookingStatus";
import { recallBooking, rememberBooking } from "../utils/bookingSession";
import {
  formatEthiopianDate,
  formatEthiopianTime,
} from "../utils/ethiopianDate";
import { formatPrice } from "../utils/format";

/**
 * The customer's landing page after a booking, and the screen they are sent
 * back to after paying.
 *
 * ## Why this page exists rather than the payment form
 *
 * Because payment is not open yet. The order is
 *
 *     requested -> confirmed -> paid -> checked
 *
 * so the moment a booking is made the only true statement is "reception has
 * your request". Sending the customer straight to a pay form said something
 * false - it implied the chair was theirs and the money was due - and then
 * left them on a page that refused the payment they had just been asked to
 * make. This page says the true thing, waits, and opens the payment form
 * itself the instant the shop confirms.
 *
 * ## What it does while it waits
 *
 * Polls one endpoint that answers both halves - has reception confirmed,
 * and has the shop checked the money - so the transition from "waiting" to
 * "pay here" happens on screen without the customer touching anything. The
 * booking code leads, because it is the one thing they need to keep: to
 * check on this booking from another device, and because it is what staff
 * ask for on the phone.
 *
 * Nothing on this page advances a status. `useBookingStatus` is the server's
 * answer, read live, and `paymentOpen` is the server's answer to "may this
 * be paid for right now". The frontend never decides that a booking became
 * payable.
 */

export default function BookingSuccess() {
  const { bookingId } = useParams();
  const location = useLocation();

  const remembered = recallBooking(bookingId);

  // What the step before this one handed over, if anything. Used only to
  // seed the first paint so a customer who has just paid is not shown a
  // spinner while the live read catches up with the payment they have
  // already sent - every answer after this comes from the server.
  const seed = location.state || null;

  const [justPaid, setJustPaid] = useState(() =>
    seed?.payment
      ? { payment: seed.payment, submitted: Boolean(seed.justSubmitted) }
      : null
  );

  const code =
    seed?.booking?.booking_code ||
    remembered?.booking?.booking_code ||
    justPaid?.payment?.booking_code ||
    "";

  const phone =
    seed?.booking?.customer_phone ||
    remembered?.booking?.customer_phone ||
    "";

  const live = useBookingStatus({
    bookingId,
    bookingCode: code,
    bookingPhone: phone,
    pollMs: POLL_WHILE_UNSETTLED_MS,
  });

  const booking = live.booking || seed?.booking || remembered?.booking || null;
  const payment = live.payment || justPaid?.payment || null;

  // Keep this tab's copy of the booking current, so a refresh from here
  // still has the code and phone to poll with. Only ever the server's
  // booking - never a locally edited one.
  useEffect(() => {
    if (live.booking) {
      rememberBooking(live.booking);
    }
  }, [live.booking]);

  // The appointment behind the money, for the case where this tab cannot
  // load the booking itself but the payment row names it.
  const appointment =
    booking ||
    (payment
      ? {
          booking_date: payment.booking_date,
          start_time: payment.booking_start_time,
        }
      : null);

  /**
   * Did the customer just send this?
   *
   * Worth knowing, because "sent" and "sent again after the shop could not
   * read the first one" are different events and the second one deserves to
   * be acknowledged - a customer who has already tried once is not
   * reassured by the same screen they saw last time.
   */
  const justSubmitted = Boolean(justPaid?.submitted);

  const confirmed = booking?.status === "confirmed";
  const verified = payment?.status === "verified";
  const rejected = payment?.status === "rejected";

  const headline = verified
    ? "You're paid and confirmed."
    : justSubmitted
      ? "We've got it."
      : confirmed
        ? "You're confirmed — pay here."
        : "Your request is with the shop.";

  const Icon = verified ? CheckCircle2 : rejected ? XCircle : Hourglass;

  const IconTone = verified
    ? "text-[#7fcfa4]"
    : rejected
      ? "text-[#e0776b]"
      : "text-[#d6a85f]";

  return (
    <div className="min-h-screen bg-[#090909] px-5 pb-24 pt-32 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[900px]">
        <div className="flex items-start gap-4">
          <span className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d6a85f]/30 bg-[#d6a85f]/10">
            <Icon size={20} className={IconTone} />
          </span>

          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.35em] text-[#d6a85f]">
              {verified
                ? "Payment checked by the shop"
                : justSubmitted
                  ? "Payment received"
                  : confirmed
                    ? "Confirmed by the shop"
                    : "Requested — waiting on the shop"}
            </p>

            <h1 className="mt-4 font-serif text-4xl leading-[0.95] sm:text-5xl">
              {headline}
            </h1>

            <p className="mt-4 max-w-lg text-sm leading-7 text-white/45">
              {verified
                ? "Your payment is checked and your appointment is locked in. Nothing else is needed."
                : rejected
                  ? "The shop could not match what was sent. Your appointment is still held — a clearer screenshot of the transfer, or the TIN number on its own, usually settles it."
                  : justSubmitted
                    ? "Your payment is with the shop and will be matched against the bank. You do not need to do anything else — this page updates on its own."
                    : confirmed
                      ? "The shop has confirmed your appointment, so the chair is yours. The payment form is open below — a screenshot of your transfer or the TIN number on it is enough."
                      : "Reception confirms every booking by hand. Payment opens the moment they have — this page checks on its own, so there is nothing to do until then."}
            </p>
          </div>
        </div>

        {/* --- what just happened ------------------------------ */}
        {justSubmitted && (
          <Alert tone="success" title="Your payment was sent" className="mt-8">
            {formatPrice(payment?.amount)} recorded for booking{" "}
            <strong className="font-semibold tracking-[0.08em] text-white/80">
              {booking?.booking_code || `#${bookingId}`}
            </strong>
            . The shop will match it against the bank. You can close this page;
            we will still have your booking against that code.
          </Alert>
        )}

        {/* The code, above everything else on the page. */}
        <CopyCodeButton
          value={booking?.booking_code || code || `#${bookingId}`}
          hint="Write this down or screenshot it. You need it, plus the phone number you booked with, to check this booking from any device at any time."
          className="mt-10 rounded-2xl border border-[#d6a85f]/25 bg-[#d6a85f]/[0.05] p-5 sm:p-6"
        />

        {/* --- the appointment --------------------------------- */}
        {booking ? (
          <BookingSummary booking={booking} className="mt-6 border" />
        ) : appointment ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-[#111] p-5 sm:p-6">
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">
              Appointment
            </p>

            <p className="mt-2 text-sm text-white/75">
              {formatEthiopianDate(appointment.booking_date)} at{" "}
              {formatEthiopianTime(appointment.start_time)} ·{" "}
              {payment?.booking_service || "the shop"}
            </p>

            <p className="mt-3 text-[11px] leading-5 text-white/35">
              The full details are not in this tab. The shop has your booking on
              file — quote booking code{" "}
              <strong className="text-white/60">
                {booking?.booking_code || code || `#${bookingId}`}
              </strong>{" "}
              when you contact them.
            </p>
          </div>
        ) : (
          <Alert tone="info" title="Appointment details" className="mt-6">
            We could not load this booking in this tab. Open{" "}
            <Link to="/bookings" className="font-semibold text-[#d6a85f]">
              my bookings
            </Link>{" "}
            with your code and the phone number you booked with to see it.
          </Alert>
        )}

        {/* --- live read ---------------------------------------- */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111] px-5 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            {live.loading ? (
              <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-[#d6a85f]/30 border-t-[#d6a85f]" />
            ) : (
              <BellRing size={14} className="shrink-0 text-[#d6a85f]" />
            )}

            <p className="text-[11px] leading-5 text-white/45">
              {live.loading
                ? "Checking with the shop..."
                : live.ready
                  ? live.settled
                    ? "Nothing further is waiting on the shop."
                    : "This page checks the shop's answer for you."
                  : "We need your booking code to check on this."}
            </p>
          </div>

          <button
            type="button"
            onClick={live.refresh}
            disabled={!code || !phone}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/60 transition hover:border-[#d6a85f]/50 hover:text-white disabled:opacity-50"
          >
            <RefreshCw size={11} className={live.loading ? "animate-spin" : undefined} />
            Refresh
          </button>
        </div>

        {/* --- what to do next ---------------------------------- */}
          {/*
            Rendered only from the server's answer, never from the cached
            booking. `paymentOpen` is false until the live read lands, so
            painting the prompt from the cached row would flash "waiting for
            the shop to confirm" on a booking reception confirmed an hour ago
            - and, worse, could show a pay form before the customer has been
            told the chair is theirs.
          */}
          {live.booking && (
            <div className="mt-6">
              <PaymentPrompt
                booking={live.booking}
                payment={payment}
                paymentOpen={live.paymentOpen}
                autoOpen
                onPaid={(created) =>
                  setJustPaid({ payment: created, submitted: true })
                }
              />
            </div>
          )}

        {live.error && (
          <Alert
            tone="error"
            title="We could not check this booking"
            onRetry={live.refresh}
            className="mt-6"
          >
            {live.error.message}
          </Alert>
        )}

        <div className="mt-10 grid gap-3 sm:flex sm:flex-wrap">
          <Link
            to="/bookings"
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white/70 transition hover:border-[#d6a85f]/50 hover:text-white"
          >
            My bookings
          </Link>

          <Link
            to="/services"
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white/70 transition hover:border-[#d6a85f]/50 hover:text-white"
          >
            Book another service
          </Link>
        </div>
      </div>
    </div>
  );
}