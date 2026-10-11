import { useEffect, useMemo, useRef } from "react";

import {
  ethiopianDaysFrom,
  formatEthiopianDate,
  formatEthiopianWeekday,
} from "../../utils/ethiopianDate";
import { formatDate, todayIsoDate } from "../../utils/format";

/**
 * The bookable days, as a row you swipe along.
 *
 * ## Why a strip rather than only the month grid
 *
 * The grid answers "what is the date of the 23rd". Almost nobody is asking
 * that. They are asking "can I come tomorrow" or "are you free on
 * Saturday", and those are two taps on a month of thirty numbers rather
 * than one tap on a tile. Worse, the grid answers them *negatively*:
 * everything before today is dimmed out, so a customer whose eye lands on
 * the row above the selected one is looking at days that cannot be booked
 * at all.
 *
 * The strip starts at today and runs to the end of the booking horizon,
 * so every tile on it is a day the shop will take. Past days are not
 * drawn dimmed and unpressable here - they are simply not in the list,
 * because a control that cannot be pressed is a control that wastes a
 * third of the screen on the answer "no".
 *
 * ## Why the tiles are Ethiopian
 *
 * `ሰኞ 5` and a numeral the shop's customers already read, in the order
 * they already read them. The Gregorian date is printed once underneath,
 * on the selected day only, for anyone cross-checking against a message or
 * a receipt - the same rule the month grid follows.
 *
 * ## Why it scrolls itself
 *
 * The selected day is brought into view whenever it changes, so picking a
 * date elsewhere on the page - the next-free-date offer, the Gregorian
 * fallback, a link with `?date=` - does not leave the strip showing a
 * fortnight the customer is not on. Without this the strip is correct but
 * appears wrong, which is worse than not having it.
 *
 * The month grid stays, below it, for anyone booking further out than the
 * horizon or looking for a specific date in the month.
 */

const TILE =
  "flex w-[4.25rem] shrink-0 snap-start flex-col items-center gap-0.5 rounded-xl border py-2 transition sm:w-[4.75rem]";

export default function EthiopianDayStrip({
  value,
  onChange,
  days = 14,
  min = todayIsoDate(),
}) {
  const today = todayIsoDate();
  const trackRef = useRef(null);
  const selectedRef = useRef(null);

  /**
   * Built from today, not from the selection.
   *
   * A strip anchored on the selected day would move as the customer picks,
   * so the list under their finger would never be the same list twice -
   * and picking a far date would make every nearer day unreachable by
   * scrolling back up. The strip is the fortnight from today; the grid
   * handles anything further out.
   */
  const entries = useMemo(
    () => ethiopianDaysFrom(today, days),
    [today, days]
  );

/**
   * Keep the chosen tile in view.
   *
   * Done by hand on the track rather than with `scrollIntoView`, which also
   * scrolls the nearest vertical ancestor and would yank the booking form
   * while someone is reaching for the time picker. Today is the first tile
   * and always in view, so the offset is negative on first paint and
   * nothing is touched.
   */
  useEffect(() => {
    const track = trackRef.current;
    const tile = selectedRef.current;

    if (!track || !tile) {
      return;
    }

    const offset =
      tile.offsetLeft -
      track.offsetLeft -
      (track.clientWidth - tile.offsetWidth) / 2;

    if (offset <= 0) {
      return;
    }

    track.scrollTo({
      left: offset,
      behavior: "smooth",
    });
  }, [value, entries]);

  const selected = entries.find((entry) => entry.iso === value);

  /**
   * What the strip has to say about the choice.
   *
   * A day chosen from the month grid can be past the end of the fortnight,
   * and then no tile is highlighted - so the readout below names the day
   * anyway and says plainly that it is outside the list. Without the second
   * half it reads as though nothing had been picked, which is exactly the
   * wrong thing to tell someone who has just picked something.
   */
  const outside = Boolean(value) && !selected;

  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">
          ቀን ይምረጡ — the days ahead
        </p>

        <p className="shrink-0 text-[10px] tabular-nums text-white/30">
          {entries.length} ቀን
        </p>
      </div>

      {/*
        A group of toggle buttons rather than a `listbox`. A listbox is the
        right *role* for a single-choice day list, but it also promises
        arrow-key navigation and roving focus, and a horizontal one would
        need its own key handling - which is a lot of machinery for a row
        of fourteen buttons that are all visible, all 44px tall and all in
        the tab order anyway. `aria-pressed` says exactly what is true:
        this one is chosen.
      */}
      <div
        ref={trackRef}
        role="group"
        aria-label="Choose a day"
        className="no-scrollbar -mx-1 mt-3 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1"
      >
        {entries.map((entry) => {
          const isSelected = entry.iso === value;
          const isPast = entry.iso < min;

          return (
            <button
              key={entry.iso}
              type="button"
              aria-pressed={isSelected}
              disabled={isPast}
              ref={isSelected ? selectedRef : null}
              onClick={() => onChange(entry.iso)}
              title={formatEthiopianDate(entry.iso)}
              className={`${TILE} ${
                isSelected
                  ? "border-[#d6a85f] bg-[#d6a85f] text-black"
                  : isPast
                    ? "border-white/5 text-white/15"
                    : "border-white/10 bg-white/[0.03] text-white/75 hover:border-[#d6a85f]/50 hover:text-white"
              } disabled:cursor-not-allowed`}
            >
              <span
                className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${
                  isSelected ? "text-black/60" : "text-white/35"
                }`}
              >
                {entry.weekdayShort}
              </span>

              <span className="font-serif text-xl leading-none tabular-nums">
                {entry.day}
              </span>

              <span
                className={`text-[9px] tracking-wide ${
                  isSelected ? "text-black/55" : "text-white/25"
                }`}
              >
                {entry.monthLabel}
              </span>
            </button>
          );
        })}
      </div>

      {/* The Gregorian date, once, for the day that is actually chosen. */}
      <p className="mt-2 min-h-[16px] text-[11px] text-white/30">
        {value ? (
          <>
            {formatDate(value)} · {formatEthiopianWeekday(value)}

            {outside && (
              <span className="text-white/20">
                {" "}
                — beyond the next {entries.length} days
              </span>
            )}
          </>
        ) : (
          "ቀን ይምረጡ — choose a day"
        )}
      </p>
    </div>
  );
}