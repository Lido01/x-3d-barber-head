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
    </div>
  );
}