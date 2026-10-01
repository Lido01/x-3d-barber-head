import { useEffect, useState } from "react";
import { CheckCircle2, Hourglass, RefreshCw, XCircle } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";

import BookingSummary from "../components/BookingSummary";
import CopyCodeButton from "../components/CopyCodeButton";
import Alert from "../components/ui/Alert";
import Spinner from "../components/ui/Spinner";
import { PaymentPrompt } from "../components/booking/BookingProgress";
import { usePaymentStatus } from "../hooks/usePaymentStatus";
import { mediaUrl } from "../services/api";
import { recallBooking, rememberBooking } from "../utils/bookingSession";
import { formatPrice } from "../utils/format";

/**
 * Customer result page.
 *
 * The booking code leads, because it is the one thing the customer needs
 * to keep. They will need it to check on this booking from another
 * device, it is what staff ask for on the phone, and it is what appears
 * in a screenshot of this page. Burying it under the recap meant people
 * screenshotting the appointment instead and arriving unable to quote a
 * reference.
 *
 * Payment state is re-read from Django on every visit and while the page
 * is open, so it is always the server's answer. The booking recap is the
 * exact 201 body Django returned at creation - the frontend never advances
 * a status on its own. The same wording, timeline and pay prompt live in
 * components/booking/BookingProgress, so this page and "my bookings"
 * cannot drift apart.
 */

const POLL_WHILE_PENDING_MS = 20000;

export default function BookingSuccess() {
  const { bookingId } = useParams();
  const location = useLocation();

  const cached = recallBooking(bookingId);

  const [booking, setBooking] = useState(
    () => location.state?.booking || cached?.booking || null
  );

  useEffect(() => {
    if (location.state?.booking) {
      rememberBooking(location.state.booking);
      setBooking(location.state.booking);
    }
  }, [location.state]);

  const initialPayment = location.state?.payment || null;

  /**
   * Did the customer just send this, on this page load?
   *
   * Worth knowing, because "sent" and "sent again after the shop could not
   * read the first one" are different events and the second one deserves
   * to be acknowledged - a customer who has already tried once is not
   * reassured by the same screen they saw last time. Read from router
   * state, so it survives exactly one navigation and does not greet
   * someone who came back a week later as though they had just paid.
   */
  const justSubmitted = Boolean(location.state?.justSubmitted);
  const wasResubmission = Boolean(location.state?.resubmitted);

  const { payment, loading, error, refresh } = usePaymentStatus({
    bookingId,
    bookingCode: booking?.booking_code || cached?.booking?.booking_code,
    bookingPhone: booking?.customer_phone || cached?.booking?.customer_phone,
    pollMs: POLL_WHILE_PENDING_MS,
  });

  const current = payment || initialPayment;
  const settled =
    current?.status === "verified" || current?.status === "rejected";

  return (
    <div className="min-h-screen bg-[#090909] px-5 pb-24 pt-32 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[900px]">
        <div className="flex items-start gap-4">
          <span className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d6a85f]/30 bg-[#d6a85f]/10">
            {current?.status === "verified" ? (
              <CheckCircle2 size={20} className="text-[#7fcfa4]" />
            ) : current?.status === "rejected" ? (
              <XCircle size={20} className="text-[#e0776b]" />
            ) : (
              <Hourglass size={19} className="text-[#d6a85f]" />
            )}
          </span>

          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] text-[#d6a85f]">
              {justSubmitted
                ? wasResubmission
                  ? "Second attempt received"
                  : "Payment received"
                : "Booking confirmed by the shop"}
            </p>

            <h1 className="mt-4 font-serif text-4xl leading-[0.95] sm:text-5xl">
              {current?.status === "verified"
                ? "You're confirmed."
                : justSubmitted
                  ? "We've got it."
                  : "Your chair is held."}
            </h1>

            <p className="mt-4 max-w-lg text-sm leading-7 text-white/45">
              {current?.status === "verified"
                ? "Payment checked and your appointment is locked in."
                : justSubmitted
                  ? wasResubmission
                    ? "Thank you for sending it again — the shop has your payment and will check it against the bank. You do not need to do anything else."
                    : "Your payment is with the shop and your appointment is held. Nothing else is needed from you — this page updates on its own."
                  : current?.status === "rejected"
                    ? "The shop could not match the payment. Your appointment is still held — send a clearer one, or call them to sort it out."
                    : current
                      ? "Send your payment below and the shop will confirm the appointment."
                      : "The appointment is held for you. Send your payment to lock it in."}
            </p>
          </div>
        </div>

        {/* --- what just happened ------------------------------ */}
        {justSubmitted && (
          <Alert
            tone="success"
            title={
              wasResubmission
                ? "Your new payment was sent"
                : "Your payment was sent"
            }
            className="mt-8"
          >
            {formatPrice(current?.amount)} recorded for booking{" "}
            <strong className="font-semibold tracking-[0.08em] text-white/80">
              {booking?.booking_code || `#${bookingId}`}
            </strong>
            . The shop will match it against the bank and confirm your chair
            — usually within a few hours. You can close this page; we will
            still have your booking against that code.
          </Alert>
        )}

        {/* The code, above everything else on the page. */}
        <CopyCodeButton
          value={booking?.booking_code || `#${bookingId}`}
          hint="Write this down or screenshot it. You need it, plus the phone number you booked with, to check this booking from any device at any time."
          className="mt-10 rounded-2xl border border-[#d6a85f]/25 bg-[#d6a85f]/[0.05] p-5 sm:p-6"
        />

        {/* --- appointment ------------------------------------- */}
        {booking ? (
          <BookingSummary booking={booking} className="mt-6 border" />
        ) : (
          <Alert tone="info" title="Appointment details" className="mt-6">
            Your appointment details are not available in this tab. The shop
            has your booking on file — quote booking code{" "}
            <strong className="text-white/75">
              {cached?.booking?.booking_code || `#${bookingId}`}
            </strong>{" "}
            when you contact them.
          </Alert>
        )}

        {/* --- payment ---------------------------------------- */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-[#111] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">
              Payment
            </p>

            <div className="flex items-center gap-3">
              {loading && <Spinner size={13} />}

              <button
                type="button"
                onClick={refresh}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/60 transition hover:border-[#d6a85f]/50 hover:text-white"
              >
                <RefreshCw size={11} />
                Refresh
              </button>
            </div>
          </div>

          {error && (
            <Alert
              tone="error"
              title="Could not read the payment status"
              onRetry={refresh}
              className="mt-4"
            >
              {error.message}
            </Alert>
          )}

          {!error && !loading && !current && (
            <p className="mt-4 text-xs leading-6 text-white/45">
              Nothing has been sent yet. The shop needs either a screenshot
              of your transfer or the transaction reference (TIN) from it
              before it can confirm the appointment.
            </p>
          )}

          {current && (
            <dl className="mt-5 grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-3">
              <div>
                <dt className="text-[10px] uppercase tracking-[0.2em] text-white/30">
                  Amount
                </dt>

                <dd className="mt-1 text-sm text-white/80">
                  {formatPrice(current.amount)}
                </dd>
              </div>

              <div>
                <dt className="text-[10px] uppercase tracking-[0.2em] text-white/30">
                  Method
                </dt>

                <dd className="mt-1 text-sm capitalize text-white/80">
                  {String(current.method || "").replace(/_/g, " ") || "—"}
                </dd>
              </div>

              {current.transaction_reference && (
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.2em] text-white/30">
                    Reference (TIN)
                  </dt>

                  <dd className="mt-1 break-all text-sm text-white/80">
                    {current.transaction_reference}
                  </dd>
                </div>
              )}

              {mediaUrl(current.receipt) && (
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.2em] text-white/30">
                    Receipt
                  </dt>

                  <dd className="mt-2">
                    <a
                      href={mediaUrl(current.receipt)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block"
                    >
                      <img
                        src={mediaUrl(current.receipt)}
                        alt="Your uploaded receipt"
                        className="h-16 w-16 rounded-lg border border-white/10 object-cover transition hover:border-[#d6a85f]/50"
                      />
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          )}
        </div>

        {/* --- what happens next ------------------------------ */}
        {booking && (
          <div className="mt-6">
            <PaymentPrompt booking={booking} payment={current} />
          </div>
        )}

        {!settled && (
          <p className="mt-6 text-[11px] leading-5 text-white/30">
            This page checks the shop&apos;s answer for you. You do not need
            to come back or refresh it.
          </p>
        )}

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            to="/bookings"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white/70 transition hover:border-[#d6a85f]/50 hover:text-white"
          >
            My bookings
          </Link>

          <Link
            to="/services"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white/70 transition hover:border-[#d6a85f]/50 hover:text-white"
          >
            Book another service
          </Link>
        </div>
      </div>
    </div>
  );
}