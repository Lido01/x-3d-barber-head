import { useEffect, useState } from "react";
import { ArrowLeft, KeyRound } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import BookingSummary from "../components/BookingSummary";
import PaymentForm from "../components/booking/PaymentForm";
import Alert from "../components/ui/Alert";
import FieldError from "../components/ui/FieldError";
import Spinner from "../components/ui/Spinner";
import { usePaymentStatus } from "../hooks/usePaymentStatus";
import { lookupBooking } from "../services/bookingApi";
import { normaliseBookingCode } from "../utils/bookingCode";
import { recallBooking, rememberBooking } from "../utils/bookingSession";

/**
 * Payment submission for a booking. Still no customer account.
 *
 * The backend matches every payment against the booking it belongs to,
 * using the booking code and the phone number the booking was made with -
 * so those two are what this page needs before anything can be sent.
 *
 * They normally come for free: the booking was just made, and Django's
 * response and this tab's session storage both hold them. They do not
 * come for free when the customer is paying on a different device, in a
 * tab that has been closed, or from a link somebody sent them. In that
 * case the page asks for them rather than presenting a form that would
 * be refused on submit - which is what it used to do, and the reason a
 * screenshot could reach "waiting" and then go nowhere.
 *
 * The form itself is components/booking/PaymentForm, shared with the
 * confirmation page and the customer's history, so what a customer sends
 * here is the same form they would find on the booking that needs paying.
 *
 * This page does not wait for the "is there already a payment?" check
 * before rendering the form. That check used to gate the whole screen,
 * and a booking with no payment yet is answered by the backend with a
 * 404 - which is the normal case, so the screen sat on "Checking this
 * booking..." and the customer who came to pay was never shown the form.
 * The answer now arrives as a line under the heading and a redirect if
 * there is genuinely nothing left to send.
 */

const LABEL = "text-[10px] uppercase tracking-[0.25em] text-white/35";

const INPUT =
  "w-full min-w-0 border border-white/10 bg-[#181818] px-4 py-4 text-base text-white outline-none transition placeholder:text-white/25 focus:border-[#d6a85f]/50 sm:text-sm";

export default function Payment() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Booking details: fresh from the previous step, or from this tab's
  // cache after a refresh.
  const [booking, setBooking] = useState(
    () => location.state?.booking || recallBooking(bookingId)?.booking || null
  );

  useEffect(() => {
    if (location.state?.booking) {
      rememberBooking(location.state.booking);
      setBooking(location.state.booking);
    }
  }, [location.state]);

  // Ask the server whether this booking already has a payment. The
  // backend's booking field is OneToOne, so it accepts exactly one.
  const existing = usePaymentStatus({
    bookingId,
    bookingCode: booking?.booking_code,
    bookingPhone: booking?.customer_phone,
  });

  // The proof of ownership, asked for explicitly when this tab cannot
  // supply it on its own. See "Confirm this is your booking" below.
  const [proofCode, setProofCode] = useState("");
  const [proofPhone, setProofPhone] = useState("");
  const [proofErrors, setProofErrors] = useState({});
  const [proofBusy, setProofBusy] = useState(false);
  const [proofError, setProofError] = useState(null);

  // True when this tab has no way to prove which booking this is - a
  // different device, a cleared session, a link shared in a chat. The
  // backend needs the code and the phone number on every payment call,
  // so without them the form below would submit and be refused.
  const needsProof = !booking;

  // A payment already on file means this step is done - show the result
  // page instead of letting a second one be attempted.
  //
  // Except a *rejected* one. That is the one state where the customer
  // still has something to do, and bouncing them to the confirmation page
  // - which then tells them to telephone the shop - is exactly how a
  // screenshot that was too blurry to read becomes a booking the customer
  // paid for and can never resolve. The backend now accepts a corrected
  // resubmission against the same payment, so the form stays reachable.
  useEffect(() => {
    const payment = existing.payment;

    if (!payment?.id || payment.status === "rejected") {
      return;
    }

    navigate(`/booking/success/${bookingId}`, {
      replace: true,
      state: { booking, payment },
    });
  }, [existing.payment, bookingId, booking, navigate]);

  /**
   * Resolve this booking from the code and phone the customer types.
   *
   * Same two fields as "my bookings", doing the same job: the code proves
   * the number is theirs, and the lookup answers with the whole booking.
   * Without this, a customer who did not book on this device could not pay
   * at all.
   */
  const handleProveBooking = async (event) => {
    event.preventDefault();

    const errors = {};

    if (!proofCode.trim()) {
      errors.code = "Please enter your booking code, e.g. BK-3274.";
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
      const history = await lookupBooking({
        code: proofCode.trim(),
        phone: proofPhone.trim(),
      });

      // The code may name a different booking in the same history, so
      // take the row this page is about rather than whichever came first.
      const match =
        (history.bookings || []).find(
          (row) => String(row.booking.id) === String(bookingId)
        ) || history.bookings?.[0];

      if (!match?.booking) {
        setProofError(
          "We could not find a booking with that code and phone number."
        );

        return;
      }

      if (String(match.booking.id) !== String(bookingId)) {
        // The proof identifies the customer, not this particular page.
        // Carry them to the booking it actually named rather than paying
        // against the wrong appointment.
        rememberBooking(match.booking);

        navigate(`/payment/${match.booking.id}`, { replace: true });

        return;
      }

      rememberBooking(match.booking);
      setBooking(match.booking);
    } catch (error) {
      setProofError(error.message);
    } finally {
      setProofBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090909] px-5 pb-24 pt-32 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[900px]">
        <Link
          to="/booking"
          className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/40 hover:text-white"
        >
          <ArrowLeft size={14} />
          Booking
        </Link>

        <div className="mt-10">
          <p className="text-[10px] uppercase tracking-[0.35em] text-[#d6a85f]">
            Step 2 of 2
          </p>

          <h1 className="mt-5 font-serif text-5xl leading-[0.9] sm:text-6xl">
            Confirm your
            <br />
            <span className="italic text-[#d6a85f]">payment.</span>
          </h1>

          <p className="mt-6 max-w-lg text-sm leading-7 text-white/45">
            Your chair is held under booking code{" "}
            <strong className="font-semibold tracking-[0.1em] text-white/80">
              {booking?.booking_code || `#${bookingId}`}
            </strong>
            . Choose a screenshot of your transfer or the TIN number on it —
            either one lets the shop verify the payment.
          </p>

          {/* The check is a status line, not a gate. It was a spinner that
              covered the entire form, on a screen whose whole job is to be
              filled in. */}
          <div className="mt-5 min-h-[20px]">
            {existing.loading && (
              <Spinner size={13} label="Checking this booking..." />
            )}

            {existing.ready && existing.missing && !needsProof && (
              <p className="text-[11px] text-white/30">
                No payment on this booking yet — you are in the right place.
              </p>
            )}

            {existing.error && (
              <p className="text-[11px] leading-5 text-[#e0776b]">
                We could not check whether this booking was already paid, so
                this form may let you send a second payment.{" "}
                <button
                  type="button"
                  onClick={existing.refresh}
                  className="font-semibold underline underline-offset-2"
                >
                  Try again
                </button>
              </p>
            )}
          </div>
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
                  used, and we will check your payment against the right
                  appointment.
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

        {/* The shop could not read what was sent last time. Say so plainly,
            and make it obvious that sending again is the fix rather than a
            phone call. */}
        {existing.payment?.status === "rejected" && (
          <Alert
            tone="error"
            title="The shop could not match the payment you sent"
            className="mt-8"
          >
            {existing.payment.rejection_reason ||
              "The screenshot or reference did not match anything."}{" "}
            <strong className="font-semibold text-white/80">
              Send it again below
            </strong>{" "}
            — a clearer screenshot of the transfer confirmation, or the TIN
            number on its own. Your appointment is still held.
          </Alert>
        )}

        {booking && (
          <BookingSummary booking={booking} className="mt-8" />
        )}

        <PaymentForm
          booking={booking}
          payment={existing.payment}
          className="mt-6"
          submitLabel="Send my payment"
          onSubmitted={(payment, { resubmitting }) =>
            navigate(`/booking/success/${bookingId}`, {
              replace: true,
              state: {
                booking,
                payment,
                // So the confirmation page can say what just happened
                // rather than leaving the customer to infer it from a
                // status badge.
                justSubmitted: true,
                // A resubmission is worth distinguishing: the customer has
                // been here before, and this time it worked.
                resubmitted: resubmitting,
              },
            })
          }
        />
      </div>
    </div>
  );
}
