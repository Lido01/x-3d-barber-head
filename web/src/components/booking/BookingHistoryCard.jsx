import {
  CalendarDays,
  ChevronDown,
  Clock3,
  Scissors,
  User,
} from "lucide-react";

import StatusBadge from "../StatusBadge";
import PaymentPreview from "./PaymentPreview";
import { BookingTimeline, PaymentPrompt } from "./BookingProgress";
import { bookingCodeOf } from "../../utils/bookingCode";
import {
  formatEthiopianDate,
  formatEthiopianTime,
  formatEthiopianWeekday,
} from "../../utils/ethiopianDate";

/**
 * One booking in full.
 *
 * Two ways it is used, and the difference is only whether it is a row in a
 * list or the whole answer:
 *
 *   - in a list, collapsed it is a scannable row - the code, the date, what
 *     it was for, and whether the money is in - and it opens itself when
 *     there is something the customer has to do;
 *   - alone, `alwaysOpen` shows the full record with no toggle at all.
 *
 * Always expanded when alone, because a customer who has just quoted one
 * code and been handed one appointment should not then have to tap to find
 * out whether they paid. A disclosure arrow on the only record on a screen
 * says "there is more behind this", which is the wrong thing to say.
 *
 * `paymentOpen` is the server's answer to "may this be paid right now", and
 * it is kept distinct from `paymentDue` on purpose. A booking waiting on
 * reception owes money but cannot be paid yet, and that row needs the
 * customer to do nothing at all - so it is tagged "With the shop" rather
 * than "To pay", and it does not open itself offering a form the endpoint
 * would refuse.
 */

const DETAILS = [
  { key: "service", icon: Scissors, label: "Service" },
  { key: "barber", icon: User, label: "Barber" },
  { key: "date", icon: CalendarDays, label: "Date" },
  { key: "time", icon: Clock3, label: "Time" },
];

export default function BookingHistoryCard({
  booking,
  payment,
  paymentDue,
  paymentOpen = false,
  paymentRejected,
  expanded,
  onToggle,
  onPaid,
  autoOpenPayment = false,
  alwaysOpen = false,
}) {
  const code = bookingCodeOf(booking);

  const values = {
    service: booking.service_name || `Service #${booking.service}`,
    barber: booking.barber_name || "Assigned by the shop",
    date: booking.booking_date
      ? `${formatEthiopianDate(booking.booking_date)} · ${formatEthiopianWeekday(
          booking.booking_date
        )}`
      : "—",
    time: `${formatEthiopianTime(booking.start_time)} – ${formatEthiopianTime(
      booking.end_time
    )}`,
  };

  // Anything the customer can act on right now, or a payment the shop
  // could not match. Both need something from them, which is why they open
  // themselves. A booking still awaiting confirmation does not: there is
  // nothing for them to do but wait, and opening itself would only put an
  // unreadable waiting notice at the top of a list.
  const needsAttention = paymentOpen || paymentRejected;

  const open = alwaysOpen || expanded || needsAttention;

  const tag = paymentRejected
    ? "Needs a call"
    : paymentOpen
      ? "To pay"
      : paymentDue && booking.status === "pending"
        ? "With the shop"
        : null;

  return (
    <li
      className={`rounded-2xl border bg-[#111] ${
        alwaysOpen ? "border-[#d6a85f]/25" : "border-white/10"
      }`}
    >
      <div
        className={`flex items-start gap-4 p-4 text-left sm:p-5 ${
          alwaysOpen ? "" : "cursor-pointer"
        }`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <code className="select-all font-serif text-lg leading-none tracking-[0.1em] text-white">
              {code}
            </code>

            <StatusBadge status={booking.status} kind="booking" />

            {payment?.status && (
              <StatusBadge status={payment.status} kind="payment" />
            )}
          </div>

          <p className="mt-2 truncate text-sm font-medium text-white/80">
            {booking.service_name || "Service"}
            {booking.barber_name ? ` · ${booking.barber_name}` : ""}
          </p>

          <p className="mt-0.5 text-xs text-white/40">
            {formatEthiopianDate(booking.booking_date)} ·{" "}
            {formatEthiopianWeekday(booking.booking_date)} ·{" "}
            {formatEthiopianTime(booking.start_time)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3 pt-1">
          {tag && (
            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                tag === "To pay"
                  ? "border-[#d6a85f]/40 bg-[#d6a85f]/10 text-[#e5bd7a]"
                  : "border-white/15 bg-white/[0.04] text-white/45"
              }`}
            >
              {tag}
            </span>
          )}

          {/* No chevron when this is the only record on the screen: there is
              nothing to expand into. */}
          {!alwaysOpen && (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={open}
              aria-label={open ? "Hide the details" : "Show the details"}
              className="-mr-1 flex h-11 w-11 items-center justify-center rounded-lg text-white/30 transition hover:text-white/70"
            >
              <ChevronDown
                size={16}
                className={`transition-transform ${
                  open ? "rotate-180" : ""
                }`}
              />
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="border-t border-white/10 px-4 pb-5 pt-4 sm:px-5">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {DETAILS.map(({ key, icon: Icon, label }) => (
              <div key={key} className="flex gap-3">
                <Icon size={14} className="mt-0.5 shrink-0 text-[#d6a85f]/70" />

                <div className="min-w-0">
                  <dt className="text-[10px] uppercase tracking-[0.2em] text-white/30">
                    {label}
                  </dt>

                  <dd className="mt-0.5 text-xs text-white/75">
                    {values[key]}
                  </dd>
                </div>
              </div>
            ))}
          </dl>

          {booking.notes && (
            <div className="mt-4 rounded-lg bg-white/[0.02] px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/30">
                Note
              </p>

              <p className="mt-1 text-xs leading-5 text-white/50">
                {booking.notes}
              </p>
            </div>
          )}

          <div className="mt-4">
            <PaymentPreview payment={payment} bookingCode={code} />
          </div>

          {/* The action, or the reason there is none. Not shown when it
              would only restate the payment panel above. The pay form
              opens in this card rather than on another page, so paying
              for a booking in the history is one screen, not three
              navigations. */}
          {(paymentOpen || paymentRejected || paymentDue) && (
            <div className="mt-4">
              <PaymentPrompt
                booking={booking}
                payment={payment}
                paymentOpen={paymentOpen}
                autoOpen={autoOpenPayment}
                onPaid={onPaid}
              />
            </div>
          )}

          <div className="mt-5 border-t border-white/10 pt-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/30">
              What happened
            </p>

            <div className="mt-4">
              <BookingTimeline booking={booking} payment={payment} />
            </div>
          </div>
        </div>
      )}
    </li>
  );
}