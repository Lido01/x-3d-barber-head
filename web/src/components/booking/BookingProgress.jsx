import { useEffect, useState } from "react";
import {
  BadgeCheck,
  BellRing,
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
import PaymentForm from "./PaymentForm";
import {
  formatEthiopianDate,
  formatEthiopianTime,
  formatEthiopianWeekday,
} from "../../utils/ethiopianDate";
import { formatPrice } from "../../utils/format";

/**
 * Where a booking has got to, and what the customer should do next.
 *
 * One component, used by the confirmation page, the history card and the
 * payment sheet, because they are the same question answered three times:
 * *is this sorted, and if not, what do I do now?* Two copies of that logic
 * would drift, and the customer who checks their booking from a different
 * screen would be told something different from the one who booked ten
 * minutes ago.
 *
 * Everything rendered here is the backend's answer. `booking.status`,
 * `payment.status` and `payment_open` are read, never inferred - the
 * frontend does not decide that a confirmed booking may be paid for, it is
 * told, and the endpoint enforces the same rule.
 */

/** A booking the shop has agreed to and the customer can pay for. */
function isPayable(booking) {
  return booking.status === "confirmed";
}

/** Nothing further can happen to this booking. */
function isFinished(booking) {
  return (
    booking.status === "cancelled" ||
    booking.status === "completed" ||
    booking.status === "expired"
  );
}

/**
 * The four things that happen, in order, for a booking that goes well.
 *
 * The order is the shop's, and it is not the order it used to be:
 *
 *     requested -> confirmed -> paid -> checked
 *
 * Reception confirms the appointment first and payment opens second. That
 * is what stops a customer handing over money for a slot nobody has looked
 * at, and it is why "confirmed" sits above "paid" here rather than below.
 */
function bookingSteps({ booking, payment }) {
  const payable = isPayable(booking);
  const finished = isFinished(booking);
  const cancelled = booking.status === "cancelled";

  return [
    {
      key: "requested",
      label: "Appointment requested",
      detail: `${formatEthiopianDate(booking.booking_date)} · ${formatEthiopianWeekday(
        booking.booking_date
      )} · ${formatEthiopianTime(booking.start_time)}`,
      state: "done",
    },
    {
      key: "confirmed",
      label: "Confirmed by the shop",
      detail: cancelled
        ? "The shop could not hold this chair."
        : booking.status === "expired"
          ? "This booking was not taken up in time."
          : booking.status === "completed"
            ? "The shop confirmed this chair for you."
            : payable
              ? "Your chair is held. Payment is open below."
              : "The shop checks the request and holds your chair.",
      state: finished
        ? cancelled || booking.status === "expired"
          ? "failed"
          : "done"
        : payable
          ? "done"
          : "current",
    },
    {
      key: "paid",
      label: "Payment sent",
      detail: payment
        ? `${formatPrice(payment.amount)} by ${String(
            payment.method || ""
          ).replace(/_/g, " ")}`
        : payable
          ? "Open now that the shop has confirmed."
          : finished
            ? "Not needed"
            : "Opens once the shop confirms",
      state: payment
        ? "done"
        : finished
          ? "skipped"
          : payable
            ? "current"
            : "waiting",
    },
    {
      key: "checked",
      label: "Payment checked by the shop",
      detail:
        payment?.status === "verified"
          ? "The shop matched your payment. Nothing more to do."
          : payment?.status === "rejected"
            ? payment.rejection_reason || "The shop could not match it."
            : payment
              ? "The shop matches the receipt or the transaction reference."
              : "Once you have sent a payment, the shop checks it.",
      state:
        payment?.status === "verified"
          ? "done"
          : payment?.status === "rejected"
            ? "failed"
            : "waiting",
    },
  ];
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
              {step.detail}
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
 * Driven by two server answers rather than one: whether money is owed, and
 * whether it may be sent yet. Collapsing them is what produced the bug this
 * replaced - a pay form shown for a booking reception had not looked at, so
 * the customer paid first and the shop found out afterwards.
 *
 * `paymentOpen` is the gate. While it is false the prompt says so and offers
 * no form at all, because a disabled button on a screen whose whole job is
 * taking money reads as broken rather than as "not yet". While it is true the
 * form opens on its own (`autoOpen`), because the customer has already
 * proved who they are and confirmed they are here to pay - making them find
 * and press a button first is a step with no purpose.
 *
 * @param {object} booking
 * @param {object|null} payment
 * @param {boolean} paymentOpen  the server's answer to "may this be paid now"
 * @param {boolean} autoOpen     open the form as soon as it is payable
 * @param {(created: object) => void} [onPaid]
 */
export function PaymentPrompt({
  booking,
  payment,
  paymentOpen = false,
  autoOpen = false,
  onPaid,
}) {
  const [paying, setPaying] = useState(false);

  const code = booking.booking_code || `#${booking.id}`;

  // Auto-open the moment the shop confirms, and only then. Keyed on the
  // server's flag rather than on the status so it cannot fire on a booking
  // that is already paid, rejected or finished.
  useEffect(() => {
    if (autoOpen && paymentOpen && !payment) {
      setPaying(true);
    }
  }, [autoOpen, paymentOpen, payment]);

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
              {formatEthiopianDate(booking.booking_date)} ·{" "}
              {formatEthiopianTime(booking.start_time)} with{" "}
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

  if (booking.status === "expired") {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex gap-3">
          <CalendarX size={17} className="mt-0.5 shrink-0 text-white/30" />

          <div>
            <p className="text-sm font-semibold text-white">
              This booking was not taken up
            </p>

            <p className="mt-1 text-xs leading-6 text-white/55">
              The date has passed without the appointment happening, so it
              is no longer held and nothing is owed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Awaiting the shop. The most important branch on this screen, and the
  // one that has to be unmistakable: no form, no button, no way to pay,
  // and a plain statement of who is holding it up and what happens next.
  if (!paymentOpen) {
    const payableSoon = booking.status === "pending";

    return (
      <div className="rounded-2xl border border-[#d6a85f]/25 bg-[#d6a85f]/[0.06] p-5">
        <div className="flex gap-3">
          <BellRing size={17} className="mt-0.5 shrink-0 text-[#d6a85f]" />

          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">
                {payableSoon
                  ? "Waiting for the shop to confirm"
                  : "Payment is not open yet"}
              </p>

              <StatusBadge status={booking.status} kind="booking" />
            </div>

            <p className="mt-1 text-xs leading-6 text-white/55">
              {payableSoon
                ? "Reception confirms every booking by hand, and payment opens once they have. Your request is in front of them now — nothing is needed from you, and this page checks on its own."
                : "The shop will confirm this appointment before it can be paid for."}
            </p>

            <p className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3 text-[11px] text-white/30">
              Keep booking code {code} to hand — that is what staff will ask
              for.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Money sent, not yet checked. Waiting on the shop, not on the customer,
  // so there is nothing to offer here but the reassurance that they do not
  // have to do anything.
  if (payment && payment.status === "pending") {
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
              . The shop matches it against the bank — this page updates on
              its own, and you do not need to do anything.
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

  // Paid and settled. The end of the line, and the only state in which
  // nothing on this screen is a to-do.
  if (payment && payment.status === "verified") {
    return (
      <div className="rounded-2xl border border-[#5fb98a]/25 bg-[#5fb98a]/[0.06] p-5">
        <div className="flex gap-3">
          <BadgeCheck size={17} className="mt-0.5 shrink-0 text-[#7fcfa4]" />

          <div>
            <p className="text-sm font-semibold text-white">
              Paid and confirmed
            </p>

            <p className="mt-1 text-xs leading-6 text-white/55">
              {formatPrice(payment.amount)} received and checked. Arrive a
              few minutes before {formatEthiopianTime(booking.start_time)} on{" "}
              {formatEthiopianDate(booking.booking_date)}.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Payable, with nothing sent - or something sent that the shop could not
  // match. Both are "money is still owed and here is how to send it".
  const rejected = payment?.status === "rejected";

  return (
    <div
      className={`rounded-2xl p-5 ${
        rejected
          ? "border border-[#e05a4f]/30 bg-[#e05a4f]/[0.05]"
          : "border border-[#d6a85f]/35 bg-[#d6a85f]/[0.08]"
      }`}
    >
      <div className="flex gap-3">
        {rejected ? (
          <X size={17} className="mt-0.5 shrink-0 text-[#e0776b]" />
        ) : (
          <CreditCard size={17} className="mt-0.5 shrink-0 text-[#d6a85f]" />
        )}

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">
            {rejected
              ? "The shop could not match this payment"
              : "Your appointment is confirmed — pay here"}
          </p>

          <p className="mt-1 text-xs leading-6 text-white/55">
            {rejected
              ? `${payment.rejection_reason || "The screenshot or reference did not match anything."} Your appointment is still held — a clearer screenshot, or the TIN number on its own, is usually all it takes.`
              : "Your chair is yours. Send a screenshot of your transfer or the TIN number on it — either one is enough for the shop to check your payment against the bank."}
          </p>

          {!paying && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setPaying(true)}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#d6a85f] px-5 py-2.5 text-xs font-semibold text-black transition hover:bg-[#e5bd7a]"
              >
                {rejected ? "Send a clearer payment" : "Pay now"}
                <span>→</span>
              </button>

              <Link
                to={`/payment/${booking.id}`}
                state={{ booking }}
                className="inline-flex min-h-[44px] items-center px-1 text-[11px] text-white/35 underline underline-offset-4 transition hover:text-white/70"
              >
                Open the full payment page
              </Link>
            </div>
          )}
        </div>
      </div>

      {paying && (
        <div className="mt-5 border-t border-white/10 pt-5">
          <PaymentForm
            booking={booking}
            payment={payment}
            onSubmitted={(created) => {
              setPaying(false);
              onPaid?.(created);
            }}
          />

          <button
            type="button"
            onClick={() => setPaying(false)}
            className="mt-3 inline-flex min-h-[40px] items-center text-[11px] text-white/35 transition hover:text-white/70"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}