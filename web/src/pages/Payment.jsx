import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, KeyRound, ShieldCheck } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import BookingSummary from "../components/BookingSummary";
import ReceiptUpload from "../components/ReceiptUpload";
import Alert from "../components/ui/Alert";
import FieldError from "../components/ui/FieldError";
import Spinner from "../components/ui/Spinner";
import { usePaymentStatus } from "../hooks/usePaymentStatus";
import { useServices } from "../hooks/useServices";
import { PAYMENT_METHODS, createPayment } from "../services/paymentApi";
import { lookupBooking } from "../services/bookingApi";
import { invalidateQuery } from "../hooks/useQuery";
import { normaliseBookingCode } from "../utils/bookingCode";
import {
  recallBooking,
  rememberBooking,
  rememberPaymentId,
} from "../utils/bookingSession";
import { formatPrice } from "../utils/format";

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
  const existing = usePaymentStatus({
    bookingId,
    bookingCode: booking?.booking_code,
    bookingPhone: booking?.customer_phone,
  });

  const { services } = useServices();

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(PAYMENT_METHODS[0].value);
  const [reference, setReference] = useState("");
  const [receiptFile, setReceiptFile] = useState(null);

  // The proof of ownership, asked for explicitly when this tab cannot
  // supply it on its own. See "Cannot find your booking" below.
  const [proofCode, setProofCode] = useState("");
  const [proofPhone, setProofPhone] = useState("");
  const [proofErrors, setProofErrors] = useState({});
  const [proofBusy, setProofBusy] = useState(false);
  const [proofError, setProofError] = useState(null);

  const [localErrors, setLocalErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(null);

  const inFlight = useRef(false);
  const prefilled = useRef(false);

  // True when this tab has no way to prove which booking this is - a
  // different device, a cleared session, a link shared in a chat. The
  // backend needs the code and the phone number on every payment call,
  // so without them the form below would submit and be refused.
  const needsProof = !booking;

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

    rememberPaymentId(bookingId, payment.id);

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

    // The same check the backend makes on every call, so a customer who
    // arrived without their booking code is told what is missing before
    // an upload they have already chosen is refused.
    if (needsProof) {
      errors.evidence =
        "Confirm the booking code and phone number above before sending your payment - the shop matches every payment against the booking it belongs to.";
    }

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
          bookingCode: booking?.booking_code,
          bookingPhone: booking?.customer_phone,
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
        state: {
          booking,
          payment,
          // So the confirmation page can say what just happened rather
          // than leaving the customer to infer it from a status badge.
          justSubmitted: true,
          // A resubmission is worth distinguishing: the customer has been
          // here before, and this time it worked.
          resubmitted: existing.payment?.status === "rejected",
        },
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
            {/* The booking could not be read from this tab. Rather than
                leaving the customer with a form that would be refused,
                ask for the two things that identify it. */}
            {needsProof && (
              <form
                onSubmit={handleProveBooking}
                noValidate
                className="mt-10 rounded-2xl border border-[#d6a85f]/25 bg-[#d6a85f]/[0.04] p-5 sm:p-6"
              >
                <div className="flex gap-3">
                  <KeyRound size={17} className="mt-0.5 shrink-0 text-[#d6a85f]" />

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">
                      Confirm this is your booking
                    </p>

                    <p className="mt-1 text-xs leading-6 text-white/55">
                      You are not on the device you booked on, so we do not
                      know your booking code yet. Enter it with the phone
                      number you used, and we will check your payment against
                      the right appointment.
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
                        setProofCode(
                          normaliseBookingCode(event.target.value)
                        )
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
                  className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#d6a85f]/40 px-5 py-2.5 text-xs font-semibold text-[#e5bd7a] transition hover:bg-[#d6a85f]/10 disabled:opacity-50"
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

            {/* The shop could not read what was sent last time. Say so
                plainly, and make it obvious that sending again is the
                fix rather than a phone call. */}
            {existing.payment?.status === "rejected" && (
              <Alert
                tone="error"
                title="The shop could not match the payment you sent"
                className={needsProof ? "mt-6" : "mt-10"}
              >
                {existing.payment.rejection_reason ||
                  "The screenshot or reference did not match anything."}{" "}
                <strong className="font-semibold text-white/80">
                  Send it again below
                </strong>{" "}
                - a clearer screenshot of the transfer confirmation, or the
                transaction reference (TIN) on its own. Your appointment is
                still held.
              </Alert>
            )}

            {booking && (
              <BookingSummary booking={booking} className="mt-10" />
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

                {/* Why one of the two above is required, said once, in the
                    place where the customer decides what to send. */}
                {!receiptFile && !reference.trim() && !needsProof && (
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
                        ? "We could not reach the shop"
                        : apiError.isServer
                          ? "The shop's server had a problem"
                          : "We could not accept your payment"
                    }
                    details={unmappedErrors}
                  >
                    {apiError.message}

                    {apiError.isServer && (
                      <span className="mt-2 block text-white/45">
                        Nothing was charged and your booking is still held.
                        Please try again in a moment, or contact the shop so
                        they can record your payment.
                      </span>
                    )}

                    {/* A refused upload is nearly always one of two
                        things the customer can fix, so name the fix
                        rather than showing a status code's worth of
                        nothing. */}
                    {receiptFile && (
                      <span className="mt-2 block text-white/45">
                        If this keeps happening, try a JPG or PNG under 5 MB -
                        a screenshot straight from a phone gallery is
                        sometimes saved in a format the shop cannot open.
                      </span>
                    )}
                  </Alert>
                )}

                <div>
                  <button
                    type="submit"
                    disabled={submitting || needsProof}
                    className="group flex w-full items-center justify-center gap-3 rounded-full bg-[#d6a85f] px-6 py-4 text-sm font-semibold text-black transition hover:bg-[#e5bd7a] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/25 border-t-black" />
                        {receiptFile && progress !== null && progress < 100
                          ? `Sending your screenshot... ${progress}%`
                          : "Sending your payment..."}
                      </>
                    ) : needsProof ? (
                      "Confirm your booking above first"
                    ) : existing.payment?.status === "rejected" ? (
                      <>
                        Send a clearer payment
                        <span className="transition-transform group-hover:translate-x-1">
                          →
                        </span>
                      </>
                    ) : (
                      <>
                        Send my payment
                        <span className="transition-transform group-hover:translate-x-1">
                          →
                        </span>
                      </>
                    )}
                  </button>

                  <p className="mt-4 flex items-center justify-center gap-2 text-center text-[10px] leading-5 text-white/25">
                    <ShieldCheck size={12} />
                    Once we have it, your payment waits for the shop to check
                    it against the bank - usually within a few hours. Your
                    chair stays held in the meantime.
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
