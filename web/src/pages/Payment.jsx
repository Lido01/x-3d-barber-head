import { useEffect, useState } from "react";
import { ArrowLeft, KeyRound } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import BookingLookupPanel from "../components/booking/BookingLookupPanel";
import BookingSheet from "../components/booking/BookingSheet";
import BookingSummary from "../components/BookingSummary";
import Alert from "../components/ui/Alert";
import FieldError from "../components/ui/FieldError";
import { PaymentPrompt } from "../components/booking/BookingProgress";
import { useBookingLookup } from "../hooks/useBookingLookup";
import {
  POLL_WHILE_UNSETTLED_MS,
  useBookingStatus,
} from "../hooks/useBookingStatus";
import { normaliseBookingCode } from "../utils/bookingCode";
import { recallBooking, rememberBooking } from "../utils/bookingSession";

/**
 * Payment for one booking. Still no customer account.
 *
 * ## The order this page exists to enforce
 *
 *     requested -> confirmed -> paid -> checked
 *
 * Reception confirms the appointment first. Payment opens second, and only
 * then - which is why this page has a real job before it has a form: it asks
 * the server whether the booking is payable yet, and when it is not it says
 * so and offers no form at all. A disabled button on the one screen whose
 * purpose is taking money reads as broken; an honest waiting notice reads as
 * "not yet", which is what it is.
 *
 * `PaymentPrompt` owns that decision and reads `paymentOpen` from the server
 * rather than working it out from the booking status, so the rule on this
 * screen and the rule the endpoint enforces are the same answer.
 *
 * ## Why the booking arrives in a sheet
 *
 * The customer gets here from a link, a shared booking, or a tab that has
 * been closed - so this device may hold no proof of which booking this is.
 * The booking ID and phone prompt below resolves it, and the answer opens in
 * a sheet over the form rather than replacing the page: the two things they
 * just typed stay visible behind it, and there is nothing to navigate back
 * to.
 *
 * What it opens is *that* booking - their ID, their appointment. One record
 * and nothing beside it, because a list here would mean the wrong
 * appointment being as plausible as the right one.
 *
 * The sheet stays open until the customer closes it. Once closed the page
 * takes over and shows this booking with its own pay form, so the sheet is
 * the arrival moment and the page is where they stay.
 *
 * When this tab *does* hold the booking - the normal case, straight after
 * booking it - there is no proof to ask for, no sheet, and the pay form is
 * simply on the page. The sheet is the fallback shape, not the default one.
 */

const LABEL = "text-[10px] uppercase tracking-[0.25em] text-white/35";

const INPUT =
  "w-full min-w-0 border border-white/10 bg-[#181818] px-4 py-4 text-base text-white outline-none transition placeholder:text-white/25 focus:border-[#d6a85f]/50 sm:text-sm";

export default function Payment() {
  const { bookingId } = useParams();
  const navigate = useNavigate();

  // Booking details: this tab's cache from the step before, if there was one.
  const [booking, setBooking] = useState(
    () => recallBooking(bookingId)?.booking || null
  );

  /**
   * The live answer to "can this be paid yet", polled while it can still
   * move. This is the same request the confirmation page makes, so a
   * customer who lands here from a link and a customer who booked here get
   * the same read - and a shop that confirms at 11:00 shows up on both
   * without anyone pressing anything.
   */
  const live = useBookingStatus({
    bookingId,
    bookingCode: booking?.booking_code,
    bookingPhone: booking?.customer_phone,
    pollMs: POLL_WHILE_UNSETTLED_MS,
  });

  // The server's row wins as soon as it lands. The cached recap is only
  // what this tab happens to know, and a stale "pending" here is exactly
  // what would keep a pay form closed after reception had confirmed it.
  const current = live.booking || booking;

  // True when this tab cannot prove which booking this is - a different
  // device, a cleared session, a link shared in a chat. Every customer read
  // needs the code and the phone number, so without them the form below
  // would submit and be refused.
  const needsProof = !current;

  // The proof of ownership, asked for explicitly only in that case.
  const [proofCode, setProofCode] = useState("");
  const [proofPhone, setProofPhone] = useState("");
  const [proofErrors, setProofErrors] = useState({});
  const [proofBusy, setProofBusy] = useState(false);
  const [proofError, setProofError] = useState(null);

  const {
    booking: lookedUp,
    payment: lookedUpPayment,
    paymentDue,
    paymentOpen,
    paymentRejected,
    matchedCode,
    loading,
    find: lookup,
    refresh: refreshLookup,
  } = useBookingLookup();

  /**
   * The sheet opens once the proof has been accepted, and closes on the
   * matched booking ID so a later lookup for a different one reopens it.
   *
   * Deliberately not derived from `needsProof`: the booking is adopted as
   * soon as the lookup resolves, which would close the sheet in the same
   * render that opened it.
   */
  const [proofAccepted, setProofAccepted] = useState(false);
  const [dismissedCode, setDismissedCode] = useState(null);

  const sheetOpen =
    Boolean(lookedUp) && proofAccepted && matchedCode !== dismissedCode;

  /**
   * Resolve this booking from the booking ID and phone the customer types.
   *
   * The same two fields as "my booking", doing the same job: the booking ID
   * names the appointment, the phone number proves the person asking owns
   * it. Without this, a customer who did not book on this device could not
   * pay at all.
   *
   * A booking ID for a *different* booking is not an error - the person has
   * proved who they are, they have simply quoted the wrong reference. So
   * they are carried to the booking their own ID named, with a plain note
   * saying so, rather than being left on a page for an appointment that is
   * not theirs.
   */
  const handleProveBooking = async (event) => {
    event.preventDefault();

    const errors = {};

    if (!proofCode.trim()) {
      errors.code = "Please enter your booking ID, e.g. BK-3274.";
    }

    if (proofPhone.replace(/\D/g, "").length < 9) {
      errors.phone =
        "Please enter the phone number you booked with, so we can match it to your booking.";
    }

    setProofErrors(errors);
    setProofError(null);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setProofBusy(true);

    try {
      const found = await lookup({
        code: proofCode.trim(),
        phone: proofPhone.trim(),
      });

      if (!found?.booking) {
        setProofError(
          "We could not find a booking with that booking ID and phone number."
        );

        return;
      }

      setProofAccepted(true);
      setDismissedCode(null);

      // This page is about one booking. If the ID they quoted names a
      // different one, take them to it rather than paying against the
      // appointment in the URL - which may not be theirs at all.
      if (String(found.booking.id) !== String(bookingId)) {
        rememberBooking(found.booking);

        navigate(`/payment/${found.booking.id}`, { replace: true });

        return;
      }

      // Adopt it, so the page can take over once the sheet is closed.
      rememberBooking(found.booking);
      setBooking(found.booking);
    } catch (error) {
      setProofError(error.message);
    } finally {
      setProofBusy(false);
    }
  };

  /**
   * A payment already on file means this step is done - show the result page
   * instead of letting a second one be attempted.
   *
   * Except a *rejected* one, which is the one state where the customer
   * still has something to do. The backend accepts a corrected
   * resubmission against the same payment, so the form stays reachable.
   */
  useEffect(() => {
    const payment = live.payment;

    if (!payment?.id || payment.status === "rejected") {
      return;
    }

    navigate(`/booking/success/${bookingId}`, {
      replace: true,
      state: { booking: live.booking || booking, payment },
    });
  }, [live.payment, live.booking, bookingId, booking, navigate]);

  return (
    <div className="min-h-screen bg-[#090909] px-5 pb-24 pt-32 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[900px]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex min-h-[44px] items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/40 transition hover:text-white"
        >
          <ArrowLeft size={14} />
          Back
        </button>

        <div className="mt-6">
          <p className="text-[10px] uppercase tracking-[0.35em] text-[#d6a85f]">
            Payment
          </p>

          <h1 className="mt-5 font-serif text-5xl leading-[0.9] sm:text-6xl">
            Pay for your
            <br />
            <span className="italic text-[#d6a85f]">appointment.</span>
          </h1>

          <p className="mt-6 max-w-lg text-sm leading-7 text-white/45">
            Booking{" "}
            <strong className="font-semibold tracking-[0.1em] text-white/80">
              {current?.booking_code || `#${bookingId}`}
            </strong>
            . Payment opens once the shop has confirmed this appointment —
            then a screenshot of your transfer or the TIN number on it is
            enough for them to check it.
          </p>
        </div>

        {/* The booking could not be read from this tab. Rather than leaving
            the customer with a form that would be refused, ask for the two
            things that identify it. */}
        {needsProof && (
          <form
            onSubmit={handleProveBooking}
            noValidate
            className="mt-8 rounded-2xl border border-[#d6a85f]/25 bg-[#d6a85f]/[0.04] p-5 sm:p-6"
          >
            <div className="flex gap-3">
              <KeyRound size={17} className="mt-0.5 shrink-0 text-[#d6a85f]" />

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">
                  Confirm this is your booking
                </p>

                <p className="mt-1 text-xs leading-6 text-white/55">
                  You are not on the device you booked on, so we do not know
                  your booking code yet. Enter it with the phone number you
                  used and we will open your bookings — the payment form for
                  this appointment is inside.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={LABEL} htmlFor="proof-code">
                  Booking code
                </label>

                <input
                  id="proof-code"
                  value={proofCode}
                  onChange={(event) =>
                    setProofCode(normaliseBookingCode(event.target.value))
                  }
                  placeholder="BK-3274"
                  inputMode="numeric"
                  autoComplete="off"
                  disabled={proofBusy}
                  aria-invalid={Boolean(proofErrors.code)}
                  className={`${INPUT} mt-2 font-serif tracking-[0.15em]`}
                />

                <FieldError message={proofErrors.code} />
              </div>

              <div>
                <label className={LABEL} htmlFor="proof-phone">
                  Phone number you booked with
                </label>

                <input
                  id="proof-phone"
                  value={proofPhone}
                  onChange={(event) => setProofPhone(event.target.value)}
                  placeholder="0911 234 567"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  disabled={proofBusy}
                  aria-invalid={Boolean(proofErrors.phone)}
                  className={`${INPUT} mt-2`}
                />

                <FieldError message={proofErrors.phone} />
              </div>
            </div>

            {proofError && (
              <Alert tone="error" className="mt-4">
                {proofError}
              </Alert>
            )}

            <button
              type="submit"
              disabled={proofBusy}
              className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#d6a85f]/40 px-5 py-2.5 text-xs font-semibold text-[#e5bd7a] transition hover:bg-[#d6a85f]/10 disabled:opacity-50"
            >
              {proofBusy ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#d6a85f]/30 border-t-[#d6a85f]" />
                  Checking...
                </>
              ) : (
                <>
                  Find my booking
                  <span>→</span>
                </>
              )}
            </button>
          </form>
        )}

        {live.booking && (
              <>
                {live.booking.status === "pending" && !live.error && (
                  <Alert
                    tone="info"
                    title="Waiting for the shop to confirm"
                    className="mt-8"
                  >
                    Reception has your request and will confirm it shortly.
                    Payment opens as soon as they have — this page checks on
                    its own, so there is nothing to do until then.
                  </Alert>
                )}

                <BookingSummary
                  booking={live.booking}
                  className="mt-8 border"
                />

                <div className="mt-6">
                  <PaymentPrompt
                    booking={live.booking}
                    payment={live.payment}
                    paymentOpen={live.paymentOpen}
                    autoOpen
                    // Go to the result page the moment the payment lands,
                    // rather than waiting for the status read behind it to
                    // catch up. The customer handed over money and should be
                    // told what happened to it in the same tap.
                    onPaid={(created) =>
                      navigate(`/booking/success/${bookingId}`, {
                        replace: true,
                        state: {
                          booking: live.booking,
                          payment: created,
                          justSubmitted: true,
                        },
                      })
                    }
                  />
                </div>
              </>
            )}

        {/* The proof, and the one booking it named. */}
        <BookingSheet
          open={sheetOpen}
          onClose={() => setDismissedCode(matchedCode)}
          eyebrow="Your booking"
          title={matchedCode}
          description="The appointment this booking ID names."
        >
          <BookingLookupPanel
            booking={lookedUp}
            payment={lookedUpPayment}
            paymentDue={paymentDue}
            paymentOpen={paymentOpen}
            paymentRejected={paymentRejected}
            loading={loading}
            onRefresh={refreshLookup}
            onPaid={refreshLookup}
          />
        </BookingSheet>
      </div>
    </div>
  );
}