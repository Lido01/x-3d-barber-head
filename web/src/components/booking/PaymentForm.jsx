import { useEffect, useMemo, useRef, useState } from "react";
import { Hash, ImageUp, ShieldCheck } from "lucide-react";

import ReceiptUpload from "../ReceiptUpload";
import Alert from "../ui/Alert";
import FieldError from "../ui/FieldError";
import { useServices } from "../../hooks/useServices";
import { invalidateQuery } from "../../hooks/useQuery";
import { PAYMENT_METHODS, createPayment } from "../../services/paymentApi";
import { rememberBooking, rememberPaymentId } from "../../utils/bookingSession";
import { formatPrice } from "../../utils/format";

/**
 * The payment form. One component, used wherever a customer owes money.
 *
 * It exists as a component rather than living on the payment page because
 * there is more than one place a customer can be told they owe money:
 * the booking that has just been made, a booking the shop confirmed before
 * the money arrived, one whose payment the shop could not match, and a
 * row in their own history. Each of those used to need its own copy of
 * "amount, method, evidence, send" and the copies drifted - the history
 * page had a link to a separate page where the form lived, so paying from
 * there was three taps and a page load away from the booking that needed
 * paying. One form means the same fields, the same rules and the same
 * wording everywhere, and it means paying takes one screen from any of
 * them.
 *
 * The backend matches every payment against a booking using the booking
 * code and the phone number it was made with, so both are sent from the
 * booking this form is given. When they are missing - a customer paying on
 * a device that does not hold the booking - the form says so and refuses
 * to submit rather than sending something that will be rejected.
 *
 * Evidence is a choice of one of two. The shop can match money against
 * the bank by its reference, or read the amount off a picture of the
 * transfer; with neither, all it has is the customer's word, so
 * PaymentSerializer.validate refuses the payment. Both are shown, one at a
 * time, and switching between them never discards what was already typed
 * into the other - a customer who photographed the receipt and then
 * decided to write the TIN instead should not lose the picture.
 */

const LABEL = "text-[10px] uppercase tracking-[0.25em] text-white/35";

const INPUT =
  "w-full min-w-0 border border-white/10 bg-[#181818] px-4 py-4 text-base text-white outline-none transition placeholder:text-white/25 focus:border-[#d6a85f]/50 sm:text-sm";

/** The two ways to prove a payment, in the order most people use them. */
const EVIDENCE = [
  {
    key: "screenshot",
    label: "Screenshot",
    hint: "Photo of your transfer confirmation",
    Icon: ImageUp,
  },
  {
    key: "tin",
    label: "TIN number",
    hint: "The reference on your transfer",
    Icon: Hash,
  },
];

/**
 * Mirrors PaymentSerializer.validate, so a customer who has neither is
 * told before they have chosen a file rather than after a refused upload.
 * One of the two is enough; both together are better.
 */
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

  if (!receiptFile && !String(reference).trim()) {
    errors.evidence =
      "Add a screenshot of your transfer or the TIN number from it. Either one is enough for the shop to check your payment - with neither there is nothing to match it against.";
  }

  return errors;
}

export default function PaymentForm({
  booking,
  payment = null,
  className = "",
  submitLabel = "Send my payment",
  onSubmitted,
}) {
  const bookingId = booking?.id;
  const bookingCode = booking?.booking_code;
  const bookingPhone = booking?.customer_phone;

  // False when this device cannot prove which booking this is. The backend
  // needs both halves on every payment call, so the form explains that
  // rather than letting the customer fill it in only to be refused.
  const canProveBooking = Boolean(bookingId && bookingCode && bookingPhone);

  const { services, loading: servicesLoading } = useServices();

  const servicePrice = useMemo(() => {
    if (!booking?.service) {
      return null;
    }

    const match = services.find(
      (item) => String(item.id) === String(booking.service)
    );

    return match?.price ?? null;
  }, [services, booking]);

  const [amount, setAmount] = useAmountState(
    servicePrice,
    servicesLoading,
    bookingId
  );
  const [method, setMethod] = useState(PAYMENT_METHODS[0].value);
  const [evidence, setEvidence] = useState("screenshot");
  const [reference, setReference] = useState("");
  const [receiptFile, setReceiptFile] = useState(null);

  const [localErrors, setLocalErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(null);

  const inFlight = useRef(false);

  const resubmitting = payment?.status === "rejected";

  const clearEvidenceErrors = () =>
    setLocalErrors((errors) => ({
      ...errors,
      evidence: undefined,
      transaction_reference: undefined,
      receipt: undefined,
    }));

  const fieldError = (field) =>
    localErrors[field] || apiError?.fieldErrors?.[field] || null;

  // Backend field messages with no input on screen are shown rather than
  // swallowed, so a refusal is never a silent no-op.
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

    if (!canProveBooking) {
      errors.evidence =
        "Confirm the booking code and phone number for this booking before sending your payment - the shop matches every payment against the appointment it belongs to.";
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
      const created = await createPayment(
        {
          bookingId,
          bookingCode,
          bookingPhone,
          amount,
          method,
          transactionReference: reference.trim(),
          receiptFile,
        },
        {
          onProgress: receiptFile ? setProgress : undefined,
        }
      );

      rememberPaymentId(bookingId, created.id);
      rememberBooking(booking);

      // The shop's queue and this customer's own screens both hold this
      // key, and both were read before this write, so the new row has to
      // replace them rather than wait out a TTL.
      invalidateQuery("payments");
      invalidateQuery("bookings");

      onSubmitted?.(created, { resubmitting });
    } catch (error) {
      setApiError(error);
      setProgress(null);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={`border border-white/10 bg-[#111] p-5 sm:p-7 ${className}`}
    >
      <div className="grid gap-6">
        {/* --- amount ------------------------------------------ */}
        <div>
          <label className={LABEL} htmlFor={`pay-amount-${bookingId ?? "new"}`}>
            Amount you paid
          </label>

          <div className="relative mt-3">
            <input
              id={`pay-amount-${bookingId ?? "new"}`}
              type="number"
              min="1"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setLocalErrors((errors) => ({ ...errors, amount: undefined }));
              }}
              placeholder="0.00"
              disabled={submitting}
              aria-invalid={Boolean(fieldError("amount"))}
              className={`${INPUT} pr-16`}
            />

            {servicePrice ? (
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-white/30">
                {formatPrice(servicePrice)}
              </span>
            ) : null}
          </div>

          {servicePrice ? (
            <p className="mt-2 text-[11px] leading-5 text-white/30">
              This is the price of your appointment. Change it only if you
              paid something different.
            </p>
          ) : null}

          <FieldError message={fieldError("amount")} />
        </div>

        {/* --- method ------------------------------------------ */}
        <div>
          <label className={LABEL} htmlFor={`pay-method-${bookingId ?? "new"}`}>
            How you paid
          </label>

          <select
            id={`pay-method-${bookingId ?? "new"}`}
            value={method}
            onChange={(event) => {
              setMethod(event.target.value);
              setLocalErrors((errors) => ({
                ...errors,
                method: undefined,
              }));
            }}
            disabled={submitting}
            className={`${INPUT} mt-3 appearance-none`}
          >
            {PAYMENT_METHODS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <FieldError message={fieldError("method")} />
        </div>

        {/* --- evidence: choose one of two ---------------------- */}
        <div>
          <p className={LABEL}>Proof of payment — pick one</p>

          <div
            role="tablist"
            aria-label="How to prove your payment"
            className="mt-3 grid grid-cols-2 gap-2"
          >
            {EVIDENCE.map((option) => {
              const active = evidence === option.key;
              const Icon = option.Icon;

              return (
                <button
                  key={option.key}
                  type="button"
                  role="tab"
                  id={`pay-evidence-${option.key}-${bookingId ?? "new"}`}
                  aria-selected={active}
                  aria-controls={`pay-evidence-panel-${option.key}-${bookingId ?? "new"}`}
                  onClick={() => {
                    setEvidence(option.key);
                    clearEvidenceErrors();
                  }}
                  disabled={submitting}
                  className={`flex min-h-[60px] flex-col items-start justify-center gap-1 rounded-xl border px-4 py-3 text-left transition ${
                    active
                      ? "border-[#d6a85f]/60 bg-[#d6a85f]/10"
                      : "border-white/10 bg-white/[0.02] hover:border-white/25"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Icon
                      size={14}
                      className={active ? "text-[#d6a85f]" : "text-white/40"}
                    />

                    <span
                      className={`text-xs font-semibold ${
                        active ? "text-white" : "text-white/65"
                      }`}
                    >
                      {option.label}
                    </span>
                  </span>

                  <span className="text-[10px] leading-4 text-white/35">
                    {option.hint}
                  </span>
                </button>
              );
            })}
          </div>

          {evidence === "screenshot" ? (
            <div
              role="tabpanel"
              id={`pay-evidence-panel-screenshot-${bookingId ?? "new"}`}
              aria-labelledby={`pay-evidence-screenshot-${bookingId ?? "new"}`}
              className="mt-4"
            >
              <ReceiptUpload
                value={receiptFile}
                onChange={(file) => {
                  setReceiptFile(file);
                  clearEvidenceErrors();
                }}
                error={fieldError("receipt")}
                progress={progress}
                disabled={submitting}
              />
            </div>
          ) : (
            <div
              role="tabpanel"
              id={`pay-evidence-panel-tin-${bookingId ?? "new"}`}
              aria-labelledby={`pay-evidence-tin-${bookingId ?? "new"}`}
              className="mt-4"
            >
              <label className={LABEL} htmlFor={`pay-tin-${bookingId ?? "new"}`}>
                Transaction reference (TIN)
              </label>

              <input
                id={`pay-tin-${bookingId ?? "new"}`}
                value={reference}
                onChange={(event) => {
                  setReference(event.target.value);
                  clearEvidenceErrors();
                }}
                placeholder="e.g. FT25091ABCD or TIN0987"
                maxLength={255}
                autoCapitalize="characters"
                spellCheck={false}
                disabled={submitting}
                aria-invalid={Boolean(fieldError("transaction_reference"))}
                className={`${INPUT} mt-3`}
              />

              <p className="mt-2 text-[11px] leading-5 text-white/30">
                On a Telebirr or bank transfer confirmation this is the
                reference next to the amount. The shop matches it against
                the bank, which is usually faster than reading a screenshot.
              </p>

              <FieldError message={fieldError("transaction_reference")} />
            </div>
          )}

          {/* What the shop is actually asking for, said in the place
              where the customer decides what to send. */}
          {receiptFile && reference.trim() ? (
            <p className="mt-4 flex items-start gap-2 text-[11px] leading-5 text-white/40">
              <ShieldCheck size={12} className="mt-0.5 shrink-0" />
              Screenshot and TIN both attached — the shop can match this
              the fastest.
            </p>
          ) : receiptFile || reference.trim() ? (
            <p className="mt-4 flex items-start gap-2 text-[11px] leading-5 text-white/40">
              <ShieldCheck size={12} className="mt-0.5 shrink-0" />
              That is enough. The shop checks it against the bank and
              confirms your chair.
            </p>
          ) : (
            <div className="mt-4 rounded-xl border border-[#d6a85f]/25 bg-[#d6a85f]/[0.06] p-4">
              <div className="flex gap-3">
                <ShieldCheck
                  size={16}
                  className="mt-0.5 shrink-0 text-[#d6a85f]"
                />

                <div>
                  <p className="text-xs font-semibold text-white">
                    Either one is enough to pay with
                  </p>

                  <p className="mt-2 text-[11px] leading-5 text-white/50">
                    A screenshot of your transfer, or the TIN number on it.
                    The shop checks your payment against the bank before it
                    confirms your chair — with neither of these there is
                    nothing to check it against.
                  </p>
                </div>
              </div>
            </div>
          )}

          <FieldError message={fieldError("evidence")} />
        </div>

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
                Nothing was charged and your appointment is still held.
                Please try again in a moment, or contact the shop so they
                can record your payment.
              </span>
            )}

            {/* A refused upload is nearly always one of two things the
                customer can fix, so name the fix rather than showing a
                status code's worth of nothing. */}
            {receiptFile && (
              <span className="mt-2 block text-white/45">
                If this keeps happening, try a JPG or PNG under 5 MB — a
                screenshot saved in a format the shop cannot open is the
                usual cause.
              </span>
            )}
          </Alert>
        )}

        <div>
          <button
            type="submit"
            disabled={submitting || !canProveBooking}
            className="flex min-h-[52px] w-full items-center justify-center gap-3 rounded-full bg-[#d6a85f] px-6 py-4 text-sm font-semibold text-black transition hover:bg-[#e5bd7a] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/25 border-t-black" />
                {receiptFile && progress !== null && progress < 100
                  ? `Sending your screenshot... ${progress}%`
                  : "Sending your payment..."}
              </>
            ) : !canProveBooking ? (
              "Confirm your booking above first"
            ) : (
              <>
                {resubmitting ? "Send a clearer payment" : submitLabel}
                <span className="transition-transform">→</span>
              </>
            )}
          </button>

          <p className="mt-4 flex items-start justify-center gap-2 text-center text-[10px] leading-5 text-white/25">
            <ShieldCheck size={12} className="mt-0.5 shrink-0" />
            Once we have it, your payment waits for the shop to check it
            against the bank — usually within a few hours. Your chair stays
            held in the meantime.
          </p>
        </div>
      </div>
    </form>
  );
}

/**
 * The amount, prefilled once from the service price.
 *
 * Split out because the "fill it in once" rule is easy to get wrong: the
 * services list arrives after the first paint, so an effect that fills in
 * whenever the price appears will also overwrite an amount the customer
 * has already typed. The booking id is recorded as "already prefilled"
 * instead, which also means moving between bookings in a history list
 * starts from the right price rather than the last one's.
 */
function useAmountState(price, servicesLoading, bookingId) {
  const [amount, setAmount] = useState("");
  const prefilledFor = useRef(null);

  useEffect(() => {
    if (servicesLoading || prefilledFor.current === bookingId) {
      return;
    }

    prefilledFor.current = bookingId;
    setAmount(price ? String(Number(price)) : "");
  }, [price, servicesLoading, bookingId]);

  return [amount, setAmount];
}