import { Clock3, RefreshCw } from "lucide-react";

import BookingHistoryCard from "./BookingHistoryCard";

/**
 * One booking, in full.
 *
 * ## Why this is one booking and not a list
 *
 * Every booking has its own code, so the code the customer quotes names one
 * appointment and that is the appointment they get. Returning "everything on
 * this phone number" instead made the code identify the customer rather than
 * the booking, and the screen opened on however many rows they happened to
 * have - with the one they were asking about no more likely to be the one
 * they read than any other. If you have checked the wrong appointment's
 * payment status and walked away satisfied, the code did not identify
 * anything.
 *
 * So the booking fills the panel. There is nothing to pick from, and
 * therefore nothing to pick wrong. Someone who has booked three times has
 * three codes and opens the one they mean.
 *
 * The card is already expanded - no toggle, no disclosure arrow - because
 * there is nothing behind it to disclose, and an arrow on the only record on
 * a screen says "there is more behind this", which is the wrong thing to say.
 */
export default function BookingLookupPanel({
  booking,
  payment,
  paymentDue,
  paymentOpen,
  paymentRejected,
  loading = false,
  onRefresh,
  onPaid,
}) {
  if (!booking) {
    return null;
  }

  return (
    <div>
      <BookingHistoryCard
        alwaysOpen
        booking={booking}
        payment={payment}
        paymentDue={paymentDue}
        paymentOpen={paymentOpen}
        paymentRejected={paymentRejected}
        onPaid={onPaid}
        autoOpenPayment
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 text-[11px] leading-5 text-white/30">
          <Clock3 size={12} className="shrink-0" />
          Keep this code with the phone number you booked with — together
          they are how you open this booking again, from any device.
        </p>

        {onRefresh && (
          <button
            type="button"
            onClick={() => void onRefresh()}
            disabled={loading}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/60 transition hover:border-[#d6a85f]/50 hover:text-white disabled:opacity-50"
          >
            <RefreshCw
              size={11}
              className={loading ? "animate-spin" : undefined}
            />
            Check for updates
          </button>
        )}
      </div>
    </div>
  );
}