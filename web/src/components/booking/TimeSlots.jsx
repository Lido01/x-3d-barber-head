import { groupSlotsByPartOfDay } from "../../utils/format";
import Alert from "../ui/Alert";
import Spinner from "../ui/Spinner";

/**
 * Step 3 - pick a start time.
 *
 * The list comes from GET /api/bookings/availability/ and is rendered
 * exactly as Django returned it. Slots are only grouped by part of day
 * for readability; none are filtered out, added or reordered here.
 */
export default function TimeSlots({
  times,
  loading,
  error,
  isEmpty,
  onReload,
  selectedTime,
  onSelect,
  needsService,
  needsDate,
  disabled = false,
}) {
  if (needsService || needsDate) {
    return (
      <p className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-xs text-white/35">
        {needsService
          ? "Choose a service to see available times."
          : "Choose a date to see available times."}
      </p>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-8 text-center">
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

  if (isEmpty) {
    return (
      <Alert tone="info" title="Fully booked" onRetry={onReload}>
        No times are available for this service on this date. Please try
        another date.
      </Alert>
    );
  }

  const groups = groupSlotsByPartOfDay(times);

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.key}>
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/25">
            {group.label}
          </p>

          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
            {group.slots.map((slot) => {
              const selected = slot === selectedTime;

              return (
                <button
                  type="button"
                  key={slot}
                  onClick={() => onSelect(slot)}
                  disabled={disabled}
                  aria-pressed={selected}
                  className={`rounded-xl border px-2 py-3 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    selected
                      ? "border-[#d6a85f]/50 bg-[#d6a85f]/10 text-[#d6a85f]"
                      : "border-white/10 text-white/45 hover:bg-white/[0.05] hover:text-white/70"
                  }`}
                >
                  {slot}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <p className="text-[10px] leading-5 text-white/25">
        Times are provided by the shop's schedule and refresh whenever you
        change the service or date.
      </p>
    </div>
  );
}
