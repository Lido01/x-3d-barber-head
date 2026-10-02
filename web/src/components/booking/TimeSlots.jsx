import { ChevronDown } from "lucide-react";

import { groupSlotsByPartOfDay } from "../../utils/format";
import Alert from "../ui/Alert";
import Spinner from "../ui/Spinner";
import AvailabilityNotice from "./AvailabilityNotice";

const SELECT =
  "w-full appearance-none rounded-xl border border-white/10 bg-[#181818] px-4 py-4 pr-12 text-sm text-white outline-none transition focus:border-[#d6a85f]/50 disabled:cursor-not-allowed disabled:opacity-60";

export default function TimeSlots({
  times,
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

  const availableTimes = Array.isArray(times) ? times : [];
  const groups = groupSlotsByPartOfDay(availableTimes);

  return (
    <div className="space-y-2">
      <div className="relative">
        <select
          value={selectedTime || ""}
          onChange={(event) => onSelect(event.target.value)}
          disabled={disabled}
          aria-label="Choose an available time"
          className={SELECT}
        >
          <option value="">Choose a time...</option>
          {groups.map((group) => (
            <optgroup key={group.key} label={group.label}>
              {group.slots.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
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
        {availableTimes.length} live slots available
        {window ? ` · booked between ${window}` : ""}. Times refresh with
        your service, date, or barber selection.
      </p>
    </div>
  );
}