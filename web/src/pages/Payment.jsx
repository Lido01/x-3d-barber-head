import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import BookingSummary from "../components/BookingSummary";
import ReceiptUpload from "../components/ReceiptUpload";
import Alert from "../components/ui/Alert";
import FieldError from "../components/ui/FieldError";
import Spinner from "../components/ui/Spinner";
import { usePaymentStatus } from "../hooks/usePaymentStatus";
import { useServices } from "../hooks/useServices";
import { PAYMENT_METHODS, createPayment } from "../services/paymentApi";
import { invalidateQuery } from "../hooks/useQuery";
import {
  recallBooking,
  rememberBooking,
  rememberPaymentId,
} from "../utils/bookingSession";
import { formatPrice } from "../utils/format";

/**
 * Payment submission for a booking. Still no customer account.
 *
 * The booking recap is the exact object Django returned when the
 * booking was created (passed through router state, cached in
 * sessionStorage so a refresh survives). Whether a payment already
 * exists is answered by the server, not by local state.
 */

const LABEL = "text-[10px] uppercase tracking-[0.25em] text-white/35";

const INPUT =
  "w-full  border border-white/10 bg-[#181818] px-4 py-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#d6a85f]/50";

function validate({ amount, method, reference, receiptFile }) {
  const errors = {};
  const value = Number(amount);

  if (!String(amount).trim()) {
    errors.amount = "Please enter the amount you paid.";
  } else if (Number.isNaN(value) || value <= 0) {
    errors.amount = "Amount must be greater than zero.";
  }

  if (!method) {
    errors.method = "Please choose how you paid.";
  }

  /*
   * The gate that decides whether this payment can be verified at all.
   *
   * Staff match a payment against the bank by its reference, or read the
   * amount off the screenshot. With neither, the only thing they have is
   * the customer's word - so a payment with neither is refused by
   * PaymentSerializer.validate, and saying so here means the customer is
   * told before they have typed a screenshot into a file picker rather
   * than after a failed upload.
   *
   * One of the two is enough; both together are better, which is what the
   * copy below asks for.
   */
  if (!receiptFile && !String(reference).trim()) {
    errors.evidence =
      "Add a screenshot of the transfer or the transaction reference (TIN) from it - the shop needs one of the two to check your payment against the bank.";
  }

  return errors;
}

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
  const existing = usePaymentStatus({ bookingId });

  const { services } = useServices();

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(PAYMENT_METHODS[0].value);
  const [reference, setReference] = useState("");
  const [receiptFile, setReceiptFile] = useState(null);

  const [localErrors, setLocalErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(null);

  const inFlight = useRef(false);
  const prefilled = useRef(false);

  const bookedService = useMemo(() => {
    if (!booking?.service) {
      return null;
    }

    return (
      services.find((item) => String(item.id) === String(booking.service)) ||
      null
    );
  }, [services, booking]);

  // Suggest the service's price once. The customer can change it, and
  // Django validates the final value.
  useEffect(() => {
    if (prefilled.current || !bookedService?.price) {
      return;
    }

    prefilled.current = true;
    setAmount(String(Number(bookedService.price)));
  }, [bookedService]);

  // A payment already on file means this step is done - show the result
  // page instead of letting a second one be attempted.
  useEffect(() => {
    if (existing.payment?.id) {
      rememberPaymentId(bookingId, existing.payment.id);

      navigate(`/booking/success/${bookingId}`, {
        replace: true,
        state: { booking, payment: existing.payment },
      });
    }
  }, [existing.payment, bookingId, booking, navigate]);

  const fieldError = (field) =>
    localErrors[field] || apiError?.fieldErrors?.[field] || null;

  const unmappedErrors = useMemo(() => {
    if (!apiError?.fieldErrors) {
      return null;
    }

    const known = [
      "amount",
      "method",
      "transaction_reference",
      "receipt",
      "booking",
      "evidence",
    ];

    const rest = Object.entries(apiError.fieldErrors).filter(
      ([key]) => !known.includes(key)
    );

    return rest.length > 0 ? Object.fromEntries(rest) : null;
  }, [apiError]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (inFlight.current) {
      return;
    }

    const errors = validate({ amount, method, reference, receiptFile });

    setLocalErrors(errors);
    setApiError(null);

    if (Object.keys(errors).length > 0) {
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    setProgress(receiptFile ? 0 : null);

    try {
      const payment = await createPayment(
        {
          bookingId,
          amount,
          method,
          transactionReference: reference.trim(),
          receiptFile,
        },
        {
          onProgress: receiptFile ? setProgress : undefined,
        }
      );

      rememberPaymentId(bookingId, payment.id);

      // The result page reads this same payment, and staff see it in
      // their queue. Both are already cached from earlier reads, so the
      // new row has to replace them rather than wait out a TTL.
      invalidateQuery("payments");

      navigate(`/booking/success/${bookingId}`, {
        replace: true,
        state: { booking, payment },
      });
    } catch (error) {
      setApiError(error);
      setProgress(null);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
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
            . Send the payment, then add either a screenshot of the transfer
            or its transaction reference so the shop can verify it.
          </p>
        </div>

        {existing.loading && (
          <div className="mt-10 flex justify-center rounded-2xl border border-white/10 bg-[#111] py-12">
            <Spinner label="Checking this booking..." />
          </div>
        )}

        {!existing.loading && (
          <>
            {booking ? (
              <BookingSummary booking={booking} className="mt-10" />
            ) : (
              <Alert
                tone="info"
                title={`Booking #${bookingId}`}
                className="mt-10"
              >
                Your booking details are not available in this tab, but you can
                still submit the payment below. The shop has your appointment
                on file.
              </Alert>
            )}

            <form
              onSubmit={handleSubmit}
              noValidate
              className="mt-6 border border-white/10 bg-[#111] p-6 sm:p-8"
            >
              <div className="grid gap-7">
                {/* amount */}
                <div>
                  <label className={LABEL} htmlFor="payment-amount">
                    01 · Amount paid
                  </label>

                  <input
                    id="payment-amount"
                    type="number"
                    min="1"
                    step="0.01"
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0.00"
                    disabled={submitting}
                    aria-invalid={Boolean(fieldError("amount"))}
                    className={`${INPUT} mt-4`}
                  />

                  {bookedService && (
                    <p className="mt-2 text-[11px] text-white/30">
                      {bookedService.name} is{" "}
                      {formatPrice(bookedService.price)}.
                    </p>
                  )}

                  <FieldError message={fieldError("amount")} />
                </div>

                {/* method */}
                <div>
                  <label className={LABEL} htmlFor="payment-method">
                    02 · Payment method
                  </label>

                  <select
                    id="payment-method"
                    value={method}
                    onChange={(event) => setMethod(event.target.value)}
                    disabled={submitting}
                    className={`${INPUT} mt-4 appearance-none`}
                  >
                    {PAYMENT_METHODS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  <FieldError message={fieldError("method")} />
                </div>

                {/* reference */}
                <div>
                  <label className={LABEL} htmlFor="payment-reference">
                    03 · Transaction reference (TIN)
                  </label>

                  <input
                    id="payment-reference"
                    value={reference}
                    onChange={(event) => {
                      setReference(event.target.value);
                      setLocalErrors((errors) => ({
                        ...errors,
                        evidence: undefined,
                        transaction_reference: undefined,
                      }));
                    }}
                    placeholder="e.g. TIN0987"
                    maxLength={255}
                    disabled={submitting}
                    aria-invalid={Boolean(
                      fieldError("transaction_reference")
                    )}
                    className={`${INPUT} mt-4`}
                  />

                  <p className="mt-2 text-[11px] text-white/30">
                    The reference from your transfer confirmation. Helps the
                    shop match your payment faster.
                  </p>

                  <FieldError message={fieldError("transaction_reference")} />
                </div>

                {/* receipt */}
                <div>
                  <label className={LABEL}>04 · Receipt screenshot</label>

                  <div className="mt-4">
                    <ReceiptUpload
                      value={receiptFile}
                      onChange={(file) => {
                        setReceiptFile(file);
                        setLocalErrors((errors) => ({
                          ...errors,
                          evidence: undefined,
                          receipt: undefined,
                        }));
                      }}
                      error={fieldError("receipt")}
                      progress={progress}
                      disabled={submitting}
                    />
                  </div>
                </div>

                {/* Why one of the two above is required, said once, in
                    the place where the customer decides what to send. */}
                {!receiptFile && !reference.trim() && (
                  <div className="rounded-xl border border-[#d6a85f]/25 bg-[#d6a85f]/[0.06] p-4">
                    <div className="flex gap-3">
                      <ShieldCheck
                        size={16}
                        className="mt-0.5 shrink-0 text-[#d6a85f]"
                      />

                      <div>
                        <p className="text-xs font-semibold text-white">
                          Send one of these two, so your payment can be
                          checked
                        </p>

                        <ul className="mt-2 space-y-1 text-[11px] leading-5 text-white/50">
                          <li>
                            · A screenshot of the transfer confirmation
                          </li>
                          <li>
                            · The transaction reference (TIN) from it
                          </li>
                        </ul>

                        <p className="mt-2 text-[11px] leading-5 text-white/35">
                          The shop matches your payment against the bank
                          before confirming, and with neither of these there
                          is nothing to match. Sending both is fastest.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <FieldError message={fieldError("evidence")} />

                {apiError && (
                  <Alert
                    tone="error"
                    title={
                      apiError.isNetwork
                        ? "Cannot reach the shop"
                        : "We could not submit your payment"
                    }
                    details={unmappedErrors}
                  >
                    {apiError.message}

                    {apiError.isServer && (
                      <span className="mt-2 block text-white/45">
                        The payment endpoint returned a server error. Nothing
                        was charged and your booking is still held — please
                        contact the shop so they can record your payment.
                      </span>
                    )}
                  </Alert>
                )}

                <div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="group flex w-full items-center justify-center gap-3 rounded-full bg-[#d6a85f] px-6 py-4 text-sm font-semibold text-black transition hover:bg-[#e5bd7a] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/25 border-t-black" />
                        {receiptFile && progress !== null && progress < 100
                          ? `Uploading receipt... ${progress}%`
                          : "Submitting payment..."}
                      </>
                    ) : (
                      <>
                        Submit payment
                        <span className="transition-transform group-hover:translate-x-1">
                          →
                        </span>
                      </>
                    )}
                  </button>

                  <p className="mt-4 flex items-center justify-center gap-2 text-center text-[10px] leading-5 text-white/25">
                    <ShieldCheck size={12} />
                    Submitted payments start as pending until the shop verifies
                    them.
                  </p>
                </div>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
