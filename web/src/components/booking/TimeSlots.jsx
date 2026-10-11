import { ChevronDown } from "lucide-react";

import {
  formatEthiopianTime,
  groupSlotsByEthiopianPartOfDay,
} from "../../utils/ethiopianDate";
import { splitPassedSlots } from "../../utils/bookingWindow";
import Alert from "../ui/Alert";
import Spinner from "../ui/Spinner";
import AvailabilityNotice from "./AvailabilityNotice";

const SELECT =
  "w-full appearance-none rounded-xl border border-white/10 bg-[#181818] px-4 py-4 pr-12 text-sm text-white outline-none transition focus:border-[#d6a85f]/50 disabled:cursor-not-allowed disabled:opacity-60";

/**
 * The time picker.
 *
 * Grouped by the Amharic part of the day - ጠዋት, ቀን, ማታ, ማክሸነት - because
 * that is how the shop already talks about when it is open, and reading
 * "ማታ" for a 9pm slot says more to the person choosing it than "Evening"
 * does. Every slot Django returned is still rendered; nothing here is
 * filtered or invented.
 *
 * The digits stay Western. This is a time the customer compares against a
 * booking confirmation and against what staff read out on the phone, and a
 * clock they would have to learn a second numeral system to read is worse
 * than the one they already read it in.
 *
 * Rendering is a native `<select>` rather than a grid of buttons on purpose:
 * it is the control that already works one-handed on a phone, opens a
 * scrollable list rather than a grid that has to fit 30 minutes into a
 * screen, and is announced correctly. A prettier grid here would cost
 * scrolling and accessibility for nothing.
 *
 * ## The one thing that is filtered, and why it is said out loud
 *
 * Slots whose start time has already gone on *today*. The server does not
 * send these, but the list is a snapshot and this form is a long page:
 * open it before lunch, come back after, and the morning is still sitting
 * there. Dropping them silently would make the picker look like it lost
 * four times for no reason, so the count of what went with the clock is
 * printed under the control. Only today is ever affected - tomorrow's
 * 09:00 is tomorrow's, not this morning's.
 */
export default function TimeSlots({
  times,
  date,
  loading,
  error,
  isEmpty,
  onReload,
  isRefreshing = false,
  reason,
  window,
  onPickDate,
  onPickService,
  selectedTime,
  onSelect,
  needsService,
  needsDate,
  disabled = false,
}) {
  if (needsService || needsDate) {
    return (
      <p className=" rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-xs text-white/35">
        {needsService
          ? "Choose a service to see available times."
          : "Choose a date to see available times."}
      </p>
    );
  }

  if (loading) {
    return (
      <div className=" rounded-xl border border-white/10 bg-white/[0.02] px-4 py-8 text-center">
        <Spinner label="Checking available times..." />
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        tone="error"
        title="Could not load available times"
        details={error.fieldErrors}
        onRetry={onReload}
      >
        {error.message}
      </Alert>
    );
  }

  // The backend said there is nothing here, and said which of the several
  // reasons it is. That distinction is the whole point of the panel, so
  // it is rendered instead of "please try another date" - which is wrong
  // advice for a withdrawn service or a shop with nobody on duty.
  if (isEmpty) {
    return (
      <AvailabilityNotice
        reason={reason}
        window={window}
        onPickDate={onPickDate}
        onPickService={onPickService}
        onReload={onReload}
        isRefreshing={isRefreshing}
      />
    );
  }

  const { open, passed } = splitPassedSlots(times, { date });
  const groups = groupSlotsByEthiopianPartOfDay(open);

  return (
    <div className="space-y-2">
      <div className="relative">
        <select
          value={selectedTime || ""}
          onChange={(event) => onSelect(event.target.value)}
          disabled={disabled || open.length === 0}
          aria-label="Choose an available time"
          className={SELECT}
        >
          <option value="">ጊዜ ይምረጡ — choose a time</option>
          {groups.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.slots.map((slot) => (
                <option key={slot} value={slot}>
                  {formatEthiopianTime(slot)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <ChevronDown
          size={17}
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#d6a85f]"
        />
      </div>

      <p className="text-[10px] leading-5 text-white/25">
        {open.length} live slots available
        {window ? ` · ${window}` : ""}. Times refresh with your service, date,
        or barber selection.
      </p>

      {/* The morning does not disappear without explanation. */}
      {passed.length > 0 && (
        <p className="text-[10px] leading-5 text-white/30">
          {passed.length} earlier {passed.length === 1 ? "time" : "times"} on
          this day {passed.length === 1 ? "has" : "have"} already passed, so{" "}
          {passed.length === 1 ? "it is" : "they are"} not offered.
        </p>
      )}
    </div>
  );
}