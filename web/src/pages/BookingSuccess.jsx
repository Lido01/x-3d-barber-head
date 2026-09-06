import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  CreditCard,
  Hourglass,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";

import BookingSummary from "../components/BookingSummary";
import StatusBadge from "../components/StatusBadge";
import Alert from "../components/ui/Alert";
import Spinner from "../components/ui/Spinner";
import { usePaymentStatus } from "../hooks/usePaymentStatus";
import { mediaUrl } from "../services/api";
import { recallBooking, rememberBooking } from "../utils/bookingSession";
import { formatDate, formatPrice, formatTime } from "../utils/format";

/**
 * Customer result page.
 *
 * Payment state is re-read from Django on every visit and while the
 * page is open, so it is always the server's answer. The booking recap
 * is the exact 201 body Django returned at creation - the frontend
 * never advances a status on its own.
 */

const POLL_WHILE_PENDING_MS = 20000;

function PaymentNarrative({ payment }) {
  if (!payment) {
    return null;
  }

  if (payment.status === "verified") {
    return (
      <Alert tone="success" title="Payment verified">
        The shop has verified your payment and confirmed your appointment. See
        you in the chair.
      </Alert>
    );
  }

  if (payment.status === "rejected") {
    return (
      <Alert tone="error" title="Payment rejected">
        {payment.rejection_reason
          ? payment.rejection_reason
          : "The shop could not verify this payment."}{" "}
        Your appointment is still being held — please contact the shop to sort
        the payment out.
      </Alert>
    );
  }

  return (
    <Alert tone="info" title="Payment submitted successfully">
      Your payment is pending verification. The shop will check your receipt
      and confirm your appointment shortly. You do not need to do anything
      else.
    </Alert>
  );
}

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

  const { payment, loading, error, refresh } = usePaymentStatus({
    bookingId,
    paymentId: initialPayment?.id || cached?.paymentId,
    pollMs: POLL_WHILE_PENDING_MS,
  });

  const current = payment || initialPayment;

  const receipt = mediaUrl(current?.receipt);

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
              Booking #{bookingId}
            </p>

            <h1 className="mt-4 font-serif text-4xl leading-[0.95] sm:text-5xl">
              {current?.status === "verified"
                ? "You're confirmed."
                : "You're on the list."}
            </h1>
          </div>
        </div>

        {/* --- appointment ------------------------------------- */}
        {booking ? (
          <BookingSummary booking={booking} className="mt-10" />
        ) : (
          <Alert tone="info" title="Appointment details" className="mt-10">
            Your appointment details are not available in this tab. The shop
            has your booking on file — quote booking&nbsp;#{bookingId} when you
            contact them.
          </Alert>
        )}

        {/* --- payment ---------------------------------------- */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CreditCard size={16} className="text-[#d6a85f]" />

              <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">
                Payment
              </p>
            </div>

            <div className="flex items-center gap-3">
              {loading && <Spinner size={13} />}

              <StatusBadge status={current?.status} kind="payment" />

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
            <div className="mt-4">
              <p className="text-xs leading-6 text-white/45">
                No payment has been submitted for this booking yet. Your
                appointment stays pending until the shop receives and verifies
                a payment.
              </p>

              <Link
                to={`/payment/${bookingId}`}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#d6a85f] px-5 py-2.5 text-xs font-semibold text-black transition hover:bg-[#e5bd7a]"
              >
                Submit payment
                <span>→</span>
              </Link>
            </div>
          )}

          {current && (
            <dl className="mt-5 grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-3">
              <div>
                <dt className="text-[10px] uppercase tracking-[0.2em] text-white/30">
                  Payment ID
                </dt>

                <dd className="mt-1 text-sm text-white/80">#{current.id}</dd>
              </div>

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
                    Reference
                  </dt>

                  <dd className="mt-1 break-all text-sm text-white/80">
                    {current.transaction_reference}
                  </dd>
                </div>
              )}

              {receipt && (
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.2em] text-white/30">
                    Receipt
                  </dt>

                  <dd className="mt-2">
                    <a
                      href={receipt}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block"
                    >
                      <img
                        src={receipt}
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
        <div className="mt-6 space-y-4">
          <PaymentNarrative payment={current} />

          {current?.status === "pending" && (
            <div className="rounded-2xl border border-white/10 bg-[#111] p-5 sm:p-6">
              <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">
                What happens next
              </p>

              <ol className="mt-4 space-y-3">
                {[
                  "The shop reviews your receipt and verifies the payment.",
                  "Once verified, your booking moves from pending to confirmed.",
                  booking
                    ? `Arrive a few minutes before ${formatTime(
                        booking.start_time
                      )} on ${formatDate(booking.booking_date)}.`
                    : "Arrive a few minutes before your appointment time.",
                ].map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/15 text-[10px] text-white/50">
                      {index + 1}
                    </span>

                    <span className="text-xs leading-6 text-white/50">
                      {step}
                    </span>
                  </li>
                ))}
              </ol>

              <p className="mt-5 flex items-center gap-2 border-t border-white/10 pt-4 text-[11px] text-white/30">
                <Clock3 size={12} />
                This page checks for updates automatically.
              </p>
            </div>
          )}
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
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
