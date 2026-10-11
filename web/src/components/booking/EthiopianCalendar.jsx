import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  ETHIOPIC_WEEKDAYS,
  daysInEthiopianMonth,
  ethiopianFromIso,
  ethiopianToIso,
  ethiopianWeekdayIndex,
  formatEthiopianDate,
  formatEthiopianWeekday,
  monthName,
} from "../../utils/ethiopianDate";
import { formatDate, todayIsoDate } from "../../utils/format";

/**
 * The Ethiopian calendar, as the date picker.
 *
 * ## Why this and not `<input type="date">`
 *
 * A native date picker opens on "September". For someone whose month is ጥር,
 * that is a picker which has to be translated in the head before it can be
 * used, and a day picked in the wrong frame is a day the customer turns up
 * on the wrong day for. So the calendar the shop's customers think in is the
 * calendar they are offered.
 *
 * ## What it shows
 *
 * Month and weekday in Amharic, read the way a calendar in Addis is read:
 * እሑድ first on the left, Sunday first, because that is where the Ethiopian
 * week starts. The Gregorian date is deliberately *not* printed on every day -
 * that turns a month grid into a wall of numbers and puts the calendar the
 * customer is using in competition with one they are not. It appears once,
 * under the grid, on the day that is selected.
 *
 * ## What it still speaks
 *
 * `value` and `onChange` are `YYYY-MM-DD` Gregorian, unchanged. The API takes
 * Gregorian dates, the availability endpoint compares them against Gregorian
 * rows, and the staff who read a booking card write them in Gregorian.
 * Converting at the edge means the conversion exists in exactly one place and
 * nothing downstream can disagree with it about what day was picked.
 *
 * ## Past days
 *
 * Dimmed and not pressable, because the shop will not book them. The bound
 * comes from the same "today" the rest of the form uses, so there is one
 * answer to what today is rather than two computed at different moments.
 */

const CELL =
  "flex aspect-square min-h-[38px] items-center justify-center rounded-lg text-sm tabular-nums transition sm:min-h-[44px]";

export default function EthiopianCalendar({
  value,
  onChange,
  min = todayIsoDate(),
}) {
  const today = todayIsoDate();

  const selected = useMemo(() => ethiopianFromIso(value), [value]);

  /**
   * Which month is on screen.
   *
   * The selected date's month when there is one, today's month otherwise -
   * so the calendar opens on the month the customer means rather than on an
   * arbitrary January.
   */
  const [cursor, setCursor] = useState(() => {
    const opening = selected || ethiopianFromIso(today);

    return { year: opening.year, month: opening.month };
  });

  // Follow the selection when it moves to another month from outside - the
  // native fallback below, or the "next free date" the availability notice
  // offers when a day turns out to be full.
  useEffect(() => {
    if (selected && (selected.year !== cursor.year || selected.month !== cursor.month)) {
      setCursor({ year: selected.year, month: selected.month });
    }
  }, [selected, cursor.year, cursor.month]);

  const monthLength = daysInEthiopianMonth(cursor.year, cursor.month);

  const leadingBlanks = ethiopianWeekdayIndex(
    cursor.year,
    cursor.month,
    1
  );

  const cells = useMemo(() => {
    const rows = [];

    for (let blank = 0; blank < leadingBlanks; blank += 1) {
      rows.push({ key: `blank-${blank}`, blank: true });
    }

    for (let day = 1; day <= monthLength; day += 1) {
      const iso = ethiopianToIso({
        year: cursor.year,
        month: cursor.month,
        day,
      });

      rows.push({
        key: iso,
        iso,
        day,
        isPast: iso < min,
        isToday: iso === today,
        isSelected: iso === value,
      });
    }

    return rows;
  }, [cursor, leadingBlanks, monthLength, min, today, value]);

  /**
   * Page the month.
   *
   * Thirteen months, so wrapping at either end moves the year. Pagume is
   * short - five days, or six in a leap year - but it is a real month, so
   * stepping past it lands on Meskerem and stepping back out of it lands on
   * Nehasse.
   */
  const step = (direction) => {
    const month = cursor.month + direction;
    const year = cursor.year + (month > 13 ? 1 : month < 1 ? -1 : 0);

    setCursor({
      year,
      month: month > 13 ? 1 : month < 1 ? 12 : month,
    });
  };

  const goToday = () => {
    const now = ethiopianFromIso(today);

    setCursor({ year: now.year, month: now.month });
    onChange(today);
  };

  const selectedGregorian = selected
    ? formatDate(
        ethiopianToIso(selected)
      )
    : null;

  return (
    <div
      role="group"
      aria-label="Choose a date on the Ethiopian calendar"
      className="min-w-0 rounded-2xl border border-white/10 bg-[#181818] p-3 sm:p-4"
    >
      {/* --- month header --------------------------------------- */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="Previous month"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white/50 transition hover:bg-white/5 hover:text-white"
        >
          <ChevronLeft size={18} />
        </button>

        <p className="min-w-0 text-center font-serif text-base leading-tight text-white sm:text-lg">
          {monthName(cursor.month)}{" "}
          <span className="tabular-nums text-white/70">{cursor.year}</span>
          <span className="text-[11px] text-white/40"> ዓ.ም.</span>
        </p>

        <button
          type="button"
          onClick={() => step(1)}
          aria-label="Next month"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white/50 transition hover:bg-white/5 hover:text-white"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* --- weekday header ------------------------------------- */}
      <div className="mt-3 grid grid-cols-7 gap-1">
        {ETHIOPIC_WEEKDAYS.map((weekday) => (
          <div
            key={weekday.latin}
            title={weekday.latin}
            className="py-1 text-center text-[10px] font-semibold text-white/35"
          >
            {weekday.short}
          </div>
        ))}
      </div>

      {/* --- the month ----------------------------------------- */}
      <div
        role="grid"
        aria-label={`${monthName(cursor.month)} ${cursor.year}`}
        className="mt-1 grid grid-cols-7 gap-1"
      >
        {cells.map((cell) => {
          if (cell.blank) {
            return <div key={cell.key} aria-hidden="true" />;
          }

          const state = cell.isSelected
            ? "bg-[#d6a85f] text-black"
            : cell.isPast
              ? "text-white/15"
              : cell.isToday
                ? "border border-[#d6a85f]/50 text-[#e5bd7a]"
                : "text-white/80 hover:bg-white/[0.06]";

          return (
            <button
              key={cell.key}
              type="button"
              role="gridcell"
              disabled={cell.isPast}
              onClick={() => onChange(cell.iso)}
              aria-pressed={cell.isSelected}
              aria-label={`${formatEthiopianDate(cell.iso)}, ${formatEthiopianWeekday(cell.iso)}`}
              className={`${CELL} ${state} disabled:cursor-not-allowed`}
            >
              {cell.day}
            </button>
          );
        })}
      </div>

      {/* --- what is selected ---------------------------------- */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
        <p className="min-w-0 text-xs text-white/60">
          {value ? (
            <>
              <span className="text-white/85">{formatEthiopianDate(value)}</span>
              <span className="text-white/35">
                {" "}
                · {formatEthiopianWeekday(value)}
              </span>
            </>
          ) : (
            "ቀን ይምረጡ — choose a day"
          )}
        </p>

        <button
          type="button"
          onClick={goToday}
          className="inline-flex min-h-[44px] items-center rounded-full border border-white/15 px-3.5 py-2 text-[11px] font-semibold text-white/60 transition hover:border-[#d6a85f]/50 hover:text-white"
        >
          ዛሬ — Today
        </button>
      </div>

      {/* The other calendar, once, for anyone keeping it. */}
      {value && selectedGregorian && (
        <p className="mt-1.5 text-[11px] text-white/25">
          {selectedGregorian}
        </p>
      )}
    </div>
  );
}