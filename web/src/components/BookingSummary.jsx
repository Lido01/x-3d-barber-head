import { CalendarDays, Clock3, Scissors, User } from "lucide-react";

import StatusBadge from "./StatusBadge";
import { bookingCodeOf } from "../utils/bookingCode";
import {
  formatEthiopianDate,
  formatEthiopianTime,
  formatEthiopianWeekday,
} from "../utils/ethiopianDate";

/**
 * Booking recap card.
 *
 * Renders only what Django returned on the booking - including the barber it
 * assigned when the customer had no preference.
 *
 * The heading is the booking ID rather than the row id, because that is the
 * number the customer has to quote. `bookingCodeOf` falls back to the id
 * only for a booking made before codes existed.
 *
 * The date and time are in the Ethiopian calendar, because that is the
 * calendar the customer chose the day in and the one they will read it back
 * in. Showing them a Gregorian date they have to convert is how someone
 * arrives on the wrong day; the Gregorian equivalent is kept out of the
 * recap rather than sat beside it, so there is only one date on screen to
 * be wrong. Staff read the Gregorian from the booking card and the admin
 * console.
 */
export default function BookingSummary({ booking, children, className = "" }) {
  if (!booking) {
    return null;
  }

  const rows = [
    {
      icon: Scissors,
      label: "Service",
      value: booking.service_name || `Service #${booking.service}`,
    },
    {
      icon: User,
      label: "Barber",
      value: booking.barber_name || "To be assigned by the shop",
    },
    {
      icon: CalendarDays,
      label: "Date",
      value: booking.booking_date
        ? `${formatEthiopianDate(booking.booking_date)} · ${formatEthiopianWeekday(
            booking.booking_date
          )}`
        : "—",
    },
    {
      icon: Clock3,
      label: "Time",
      value: formatEthiopianTime(booking.start_time),
    },
  ];

  return (
    <div
      className={`border-white/10 bg-white/[0.02] p-5 sm:p-6 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">
            Booking
          </p>

          <p className="mt-1 font-serif text-2xl tracking-[0.08em] text-white">
            {bookingCodeOf(booking)}
          </p>
        </div>

        <StatusBadge status={booking.status} kind="booking" />
      </div>

      {booking.customer_name && (
        <p className="mt-4 border-t border-white/10 pt-4 text-sm text-white/70">
          {booking.customer_name}
        </p>
      )}

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {rows.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex gap-3">
            <Icon size={15} className="mt-0.5 shrink-0" />

            <div className="min-w-0">
              <dt className="text-[10px] uppercase tracking-[0.2em] text-white/30">
                {label}
              </dt>

              <dd className="mt-1 text-sm text-white/80">{value}</dd>
            </div>
          </div>
        ))}
      </dl>

      {booking.notes && (
        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/30">
            Notes
          </p>

          <p className="mt-2 text-xs leading-6 text-white/50">
            {booking.notes}
          </p>
        </div>
      )}

      {children}
    </div>
  );
}
