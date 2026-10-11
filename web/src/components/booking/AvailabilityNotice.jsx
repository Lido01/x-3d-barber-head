import { AlertTriangle, CalendarPlus, ChevronRight, Clock3, RefreshCw } from "lucide-react";

import { formatDate } from "../../utils/format";

/**
 * Why there are no times, said specifically.
 *
 * The time picker used to answer every dead end with the same sentence.
 * A shop with no barber on duty, a service that has been withdrawn, a
 * date that has passed and a genuinely full diary all rendered as "no
 * times available on this date" - which reads as a fault, tells the
 * customer nothing about what to change, and offers no way forward.
 *
 * Each case now gets its own heading, its own explanation and, where one
 * exists, its own action:
 *
 *   past_date          -> the date picker, which is already wrong
 *   time_passed        -> today is spent; tomorrow is the fix, not another time
 *   fully_booked       -> the next free date, one tap away
 *   no_barber_on_duty  -> nothing to offer; come back or call
 *   service_too_long   -> the service cannot fit in a day at all
 *   service_unavailable-> back to the service list
 *   barber_unavailable -> back to the barber list
 *
 * `time_passed` is the one that was missing and the one customers hit
 * most: the morning is still free in the diary at four in the afternoon,
 * so without it the panel said "every slot is taken" about a day that is
 * empty, and pointed at another time on today rather than at tomorrow.
 *
 * The wording is the backend's, not ours. Django knows the shop's hours
 * and the state of the diary; anything written here would be a second
 * guess that drifts out of date the moment either changes.
 */

const HEADINGS = {
  past_date: "That date has passed",
  time_passed: "Today is over",
  fully_booked: "Every slot is taken",
  no_barber_on_duty: "No barber on duty",
  service_too_long: "This service does not fit in a day",
  service_unavailable: "This service is not available",
  barber_unavailable: "This barber is not taking bookings",
};

export default function AvailabilityNotice({
  reason,
  window,
  onPickDate,
  onPickService,
  onReload,
  isRefreshing = false,
}) {
  if (!reason) {
    return null;
  }

  const status = reason.status;

  // An available list is not an absence; nothing to explain.
  if (status === "available") {
    return null;
  }

  const suggestion = reason.next_available || null;

  return (
    <div
      role="status"
      className="rounded-xl border border-[#d6a85f]/25 bg-[#d6a85f]/[0.06] p-4"
    >
      <div className="flex gap-3">
        <AlertTriangle
          size={17}
          className="mt-0.5 shrink-0 text-[#d6a85f]"
        />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">
            {HEADINGS[status] || "No times available"}
          </p>

          <p className="mt-1 text-xs leading-6 text-white/60">
            {reason.message}
          </p>

          {window && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-white/40">
              <Clock3 size={11} />
              The shop books appointments between {window}
            </p>
          )}

          {/* An offer, not just a refusal: one tap carries the whole
              booking - date and time - to a slot that works. */}
          {suggestion && (
            <button
              type="button"
              onClick={() =>
                onPickDate?.({
                  date: suggestion.date,
                  time: suggestion.times?.[0] || "",
                })
              }
              className="group mt-3 flex w-full items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 text-left transition hover:border-[#d6a85f]/50 hover:bg-white/[0.06]"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#d6a85f]/10">
                <CalendarPlus size={15} className="text-[#d6a85f]" />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-white">
                  Next free: {formatDate(suggestion.date)}
                </span>

                <span className="mt-0.5 block truncate text-[11px] text-white/45">
                  {suggestion.times?.length
                    ? suggestion.times.join(", ")
                    : "Tap to see the times"}
                </span>
              </span>

              <ChevronRight
                size={15}
                className="shrink-0 text-white/30 transition-transform group-hover:translate-x-0.5"
              />
            </button>
          )}

          {/* Where the fix is not a date, say which control to change
              rather than leaving the customer to hunt for it. */}
          {!suggestion && status === "service_too_long" && (
            <button
              type="button"
              onClick={onPickService}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#d6a85f]/40 px-3 py-1.5 text-[11px] font-semibold text-[#e5bd7a] transition hover:bg-[#d6a85f]/10"
            >
              Choose a shorter service
              <ChevronRight size={12} />
            </button>
          )}

          {onReload && (
            <button
              type="button"
              onClick={onReload}
              disabled={isRefreshing}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-semibold text-white/70 transition hover:border-[#d6a85f]/50 hover:text-white disabled:opacity-50"
            >
              <RefreshCw
                size={11}
                className={isRefreshing ? "animate-spin" : undefined}
              />
              Check again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}