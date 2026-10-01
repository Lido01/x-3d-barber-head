import {
  BadgeCheck,
  CalendarX,
  Check,
  Circle,
  Clock3,
  CreditCard,
  Hourglass,
  Receipt,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";

import StatusBadge from "../StatusBadge";
import { formatDate, formatPrice, formatTime } from "../../utils/format";

/**
 * Where a booking has got to, and what the customer should do next.
 *
 * One component, used by both the confirmation page and "my bookings",
 * because they are the same question answered twice: *is this sorted,
 * and if not, what do I do now?* Two copies of that logic would drift,
 * and the customer who checks their booking from a different page would
 * be told something different from the one who booked ten minutes ago.
 *
 * Everything rendered here is the backend's answer. `booking.status` and
 * `payment.status` are read, never inferred - the frontend does not
 * decide that a verified payment means a confirmed booking, it is told.
 */

const STEP_STATES = {
  pending: "current",
  confirmed: "done",
  completed: "done",
  cancelled: "failed",
};

/** The four things that happen, in order, for a booking that goes well. */
function bookingSteps({ booking, payment }) {
  const done = [
    {
      key: "requested",
      label: "Appointment requested",
      detail: `${formatDate(booking.booking_date)} at ${formatTime(
        booking.start_time
      )}`,
      state: "done",
    },
    {
      key: "paid",
      label: payment ? "Payment sent" : "Payment sent",
      detail: payment
        ? `${formatPrice(payment.amount)} by ${String(
            payment.method || ""
          ).replace(/_/g, " ")}`
        : "Not sent yet",
      state: payment
        ? "done"
        : booking.status === "cancelled" || booking.status === "completed"
          ? "skipped"
          : "current",
    },
    {
      key: "verified",
      label: "Payment verified by the shop",
      detail:
        payment?.status === "verified"
          ? "Your chair is secured."
          : payment?.status === "rejected"
            ? payment.rejection_reason || "The shop could not match it."
            : "The shop checks the receipt or the transaction reference.",
      state:
        payment?.status === "verified"
          ? "done"
          : payment?.status === "rejected"
            ? "failed"
            : "waiting",
    },
    {
      key: "confirmed",
      label: "Appointment confirmed",
      detail:
        booking.status === "confirmed"
          ? "See you in the chair."
          : booking.status === "completed"
            ? "Done."
            : "The shop confirms once the payment checks out.",
      state: STEP_STATES[booking.status] || "waiting",
    },
  ];

  return done;
}

function StepIcon({ state }) {
  if (state === "done") {
    return <Check size={11} />;
  }

  if (state === "failed") {
    return <X size={11} />;
  }

  if (state === "skipped") {
    return <Circle size={9} />;
  }

  if (state === "current") {
    return <Hourglass size={11} />;
  }

  return <Circle size={9} />;
}

const STEP_TONE = {
  done: "border-[#5fb98a]/40 bg-[#5fb98a]/15 text-[#7fcfa4]",
  current: "border-[#d6a85f]/40 bg-[#d6a85f]/15 text-[#e5bd7a]",
  waiting: "border-white/15 text-white/25",
  failed: "border-[#e05a4f]/40 bg-[#e05a4f]/15 text-[#e0776b]",
  skipped: "border-white/10 text-white/20",
};

export function BookingTimeline({ booking, payment }) {
  const cancelled = booking.status === "cancelled";
  const steps = bookingSteps({ booking, payment });

  return (
    <ol className="space-y-4">
      {steps.map((step, index) => (
        <li key={step.key} className="flex gap-3">
          <span className="flex flex-col items-center">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                STEP_TONE[step.state]
              }`}
            >
              <StepIcon state={step.state} />
            </span>

            {index < steps.length - 1 && (
              <span className="mt-1 w-px flex-1 bg-white/10" />
            )}
          </span>

          <span className="min-w-0 pb-1">
            <span
              className={`block text-xs font-semibold ${
                step.state === "waiting"
                  ? "text-white/40"
                  : "text-white/85"
              }`}
            >
              {step.label}
            </span>

            <span className="mt-0.5 block text-[11px] leading-5 text-white/40">
              {cancelled && step.state !== "failed"
                ? "Did not happen - this booking was cancelled."
                : step.detail}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * The action, or the reason there is none.
 *
 * The one case worth spelling out: a booking can be *confirmed* with no
 * payment behind it. Staff confirm walk-ins who will pay at the counter,
 * and a payment can be rejected while the appointment is held. Both leave
 * a live appointment the customer still owes money on, which is easy to
 * miss - the badge says confirmed and it looks finished. So the prompt is
 * driven by whether money has actually arrived, not by the booking's
 * status.
 */
export function PaymentPrompt({ booking, payment, paymentDue }) {
  const code = booking.booking_code || `#${booking.id}`;

  if (booking.status === "completed") {
    return (
      <div className="rounded-2xl border border-[#5fb98a]/25 bg-[#5fb98a]/[0.06] p-5">
        <div className="flex gap-3">
          <BadgeCheck size={17} className="mt-0.5 shrink-0 text-[#7fcfa4]" />

          <div>
            <p className="text-sm font-semibold text-white">
              This appointment is done
            </p>

            <p className="mt-1 text-xs leading-6 text-white/55">
              {formatDate(booking.booking_date)} at{" "}
              {formatTime(booking.start_time)} with{" "}
              {booking.barber_name || "the shop"}. Nothing more to do.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (booking.status === "cancelled") {
    return (
      <div className="rounded-2xl border border-[#e05a4f]/25 bg-[#e05a4f]/[0.06] p-5">
        <div className="flex gap-3">
          <CalendarX size={17} className="mt-0.5 shrink-0 text-[#e0776b]" />

          <div>
            <p className="text-sm font-semibold text-white">
              This booking was cancelled
            </p>

            <p className="mt-1 text-xs leading-6 text-white/55">
              The slot has been released and nothing is owed. Make a new
              booking whenever you are ready.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Nothing sent yet.
  if (!payment) {
    // A confirmed booking with no payment is the case worth naming out
    // loud. Staff confirm walk-ins who will pay at the counter, so
    // "confirmed" and "paid" are genuinely different states here - and a
    // green confirmed badge with nothing paid behind it reads as finished
    // when it is not. The copy says what is outstanding and why it still
    // matters.
    const confirmed = booking.status === "confirmed";

    return (
      <div
        className={`rounded-2xl p-5 ${
          confirmed
            ? "border border-[#d6a85f]/35 bg-[#d6a85f]/[0.08]"
            : "border border-[#d6a85f]/25 bg-[#d6a85f]/[0.06]"
        }`}
      >
        <div className="flex gap-3">
          <CreditCard
            size={17}
            className="mt-0.5 shrink-0 text-[#d6a85f]"
          />

          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">
              {confirmed
                ? "Confirmed, but not paid yet"
                : "Payment needed to keep this booking"}
            </p>

            <p className="mt-1 text-xs leading-6 text-white/55">
              {confirmed && (
                <>
                  Your appointment is confirmed, so the chair is yours. The
                  shop is still waiting on the money behind it. Send either a{" "}
                </>
              )}

              {!confirmed && (
                <>Send either a </>
              )}

              <strong className="font-semibold text-white/75">
                screenshot of the transfer
              </strong>{" "}
              or the{" "}
              <strong className="font-semibold text-white/75">
                transaction reference (TIN)
              </strong>{" "}
              from it - the shop needs one of the two to match your payment
              against the bank.
            </p>

            <Link
              to={`/payment/${booking.id}`}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#d6a85f] px-5 py-2.5 text-xs font-semibold text-black transition hover:bg-[#e5bd7a]"
            >
              {confirmed ? "Pay now" : "Pay for this booking"} {code}
              <span>→</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (payment.status === "rejected") {
    return (
      <div className="rounded-2xl border border-[#e05a4f]/25 bg-[#e05a4f]/[0.06] p-5">
        <div className="flex gap-3">
          <X size={17} className="mt-0.5 shrink-0 text-[#e0776b]" />

          <div>
            <p className="text-sm font-semibold text-white">
              The shop could not match this payment
            </p>

            <p className="mt-1 text-xs leading-6 text-white/55">
              {payment.rejection_reason ||
                "The receipt or reference did not match anything."}{" "}
              Your appointment is still being held. Please call the shop so
              the two can be sorted out.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (payment.status === "verified") {
    return (
      <div className="rounded-2xl border border-[#5fb98a]/25 bg-[#5fb98a]/[0.06] p-5">
        <div className="flex gap-3">
          <BadgeCheck size={17} className="mt-0.5 shrink-0 text-[#7fcfa4]" />

          <div>
            <p className="text-sm font-semibold text-white">
              Paid and confirmed
            </p>

            <p className="mt-1 text-xs leading-6 text-white/55">
              {formatPrice(payment.amount)} received. Arrive a few minutes
              before {formatTime(booking.start_time)} on{" "}
              {formatDate(booking.booking_date)}.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Sent, waiting.
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex gap-3">
        <Receipt size={17} className="mt-0.5 shrink-0 text-[#d6a85f]" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">
              Waiting for the shop to check it
            </p>

            <StatusBadge status="pending" kind="payment" />
          </div>

          <p className="mt-1 text-xs leading-6 text-white/55">
            {formatPrice(payment.amount)} sent
            {payment.transaction_reference
              ? ` under reference ${payment.transaction_reference}`
              : ""}
            . The shop matches it against the bank and confirms your chair -
            this page updates on its own, and you do not need to do anything.
          </p>

          <p className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3 text-[11px] text-white/30">
            <Clock3 size={12} />
            Usually checked within a few hours. Keep booking code {code} to
            hand.
          </p>
        </div>
      </div>
    </div>
  );
}