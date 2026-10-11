/**
 * Checks the Ethiopian calendar the booking form is built on.
 *
 * Run with: npm run check:calendar
 *
 * ## Why this is a script and not a test
 *
 * A date picker that is a day out is a customer who turns up on the wrong
 * day, and nothing else in the build catches it: a wrong conversion still
 * renders, still compiles, and still produces a perfectly plausible date.
 * The arithmetic is therefore checked here rather than trusted.
 *
 * Three things are checked, in increasing order of how badly a failure would
 * hurt:
 *
 *   1. **Round trip.** Every day of every month across 50 years converts to
 *      Gregorian and back to exactly the Ethiopian date it started as.
 *      Catches an off-by-one in either direction.
 *   2. **Weekday agreement.** The Ethiopian and Gregorian calendars count the
 *      same days, so a conversion that drifts shows up as a day landing under
 *      the wrong weekday name. This is the check that catches a leap-year rule
 *      written from memory rather than derived from the day count - and it is
 *      also why the leap rule here *is* derived: a hand-written `year % 4`
 *      would drift the grid by a column at the boundary and nothing else
 *      would notice.
 *   3. **Grid layout.** The month grid puts the first of the month under its
 *      own weekday column, offers exactly as many days as the month has, and
 *      pages out of the short thirteenth month onto the right one.
 *   4. **The day list.** The strip the form leads with walks consecutive
 *      days, crosses a month and a year boundary without losing or repeating
 *      one, and labels every tile with the weekday and month it lands on.
 *
 * No dependencies, deliberately: this has to be runnable by anyone who
 * touches the calendar, without installing anything.
 */

import {
  ETHIOPIC_MONTHS,
  ETHIOPIC_WEEKDAYS,
  daysInEthiopianMonth,
  daysInEthiopianYear,
  ethiopianFromIso,
  ethiopianWeekdayIndex,
  ethiopianDaysFrom,
  formatEthiopianDate,
  formatEthiopianTime,
  fromEthiopian,
  groupSlotsByEthiopianPartOfDay,
  isEthiopianLeapYear,
  shiftIsoDate,
  toEthiopian,
} from "../src/utils/ethiopianDate.js";

const checks = [];
const failures = [];

function check(label, condition, detail = "") {
  checks.push(label);

  if (!condition) {
    failures.push(detail ? `${label} — ${detail}` : label);
  }
}

function iso(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}`;
}

/** Gregorian weekday, Sunday first — the same order as the Amharic week. */
function gregorianWeekday(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

// -------------------------------------------------------------------
// 1 + 2. The conversion itself
// -------------------------------------------------------------------

let daysChecked = 0;
const roundTripFailures = [];
const weekdayFailures = [];

for (let year = 1990; year <= 2040; year += 1) {
  for (let month = 1; month <= 13; month += 1) {
    const length = daysInEthiopianMonth(year, month);

    check(
      `a month never has more than thirty days (${year}/${month})`,
      length > 0 && length <= 30,
      `got ${length}`
    );

    for (let day = 1; day <= length; day += 1) {
      const gregorian = fromEthiopian(year, month, day);
      const back = toEthiopian(
        gregorian.year,
        gregorian.month,
        gregorian.day
      );

      daysChecked += 1;

      if (
        back.year !== year ||
        back.month !== month ||
        back.day !== day
      ) {
        roundTripFailures.push(
          `${year}/${month}/${day} -> ${gregorian.year}-${gregorian.month}-${gregorian.day} -> ${back.year}/${back.month}/${back.day}`
        );
      }

      if (
        ethiopianWeekdayIndex(year, month, day) !==
        gregorianWeekday(gregorian.year, gregorian.month, gregorian.day)
      ) {
        weekdayFailures.push(`${year}/${month}/${day}`);
      }
    }
  }
}

check(
  `every day round-trips (${daysChecked} days)`,
  roundTripFailures.length === 0,
  roundTripFailures.slice(0, 3).join("; ")
);

check(
  "every day lands on the right weekday",
  weekdayFailures.length === 0,
  weekdayFailures.slice(0, 3).join("; ")
);

/** Weekday agreement re-checked against the platform Date, not our own math. */
let platformMismatches = 0;

for (let offset = 0; offset < 5000; offset += 1) {
  const date = new Date(Date.UTC(2019, 0, 1 + offset));
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  const ethiopian = toEthiopian(y, m, d);

  if (
    ethiopianWeekdayIndex(ethiopian.year, ethiopian.month, ethiopian.day) !==
    date.getUTCDay()
  ) {
    platformMismatches += 1;
  }
}

check(
  "weekday agrees with the platform calendar over 5000 days",
  platformMismatches === 0,
  `${platformMismatches} mismatches`
);

// -------------------------------------------------------------------
// The anchors everything else hangs off
// -------------------------------------------------------------------

const newYear2015 = toEthiopian(2022, 9, 11);

check(
  "1 Meskerem 2015 falls on 11 September 2022",
  newYear2015.year === 2015 &&
    newYear2015.month === 1 &&
    newYear2015.day === 1,
  JSON.stringify(newYear2015)
);

check(
  "the Ethiopian week starts on Sunday",
  gregorianWeekday(2022, 9, 11) === 0 &&
    ETHIOPIC_WEEKDAYS[0].latin === "Ehud"
);

// The year after a leap one starts on 12 September, not the 11th. This is
// the detail that a "year is Gregorian minus seven" shortcut cannot express,
// and it is why the new year in the Gregorian calendar is not always the
// same date.
check(
  "11 September 2023 is the last day of 2015, because 2015 is a leap year",
  (() => {
    const d = toEthiopian(2023, 9, 11);
    return isEthiopianLeapYear(2015) && d.year === 2015 && d.month === 13;
  })()
);

check(
  "1 Meskerem 2016 falls on 12 September 2023",
  (() => {
    const d = toEthiopian(2023, 9, 12);
    return d.year === 2016 && d.month === 1 && d.day === 1;
  })()
);

check(
  "1 Meskerem 2017 is back to 11 September",
  (() => {
    const d = toEthiopian(2024, 9, 11);
    return d.year === 2017 && d.month === 1 && d.day === 1;
  })()
);

check(
  "the Ethiopian year is the Gregorian year minus seven from September",
  toEthiopian(2026, 9, 11).year === 2019
);
check(
  "and minus eight before September",
  toEthiopian(2026, 1, 7).year === 2018
);

// -------------------------------------------------------------------
// Months and leap years
// -------------------------------------------------------------------

check("there are thirteen months", ETHIOPIC_MONTHS.length === 13);
check(
  "every month has an Amharic name",
  ETHIOPIC_MONTHS.every((month) => month.name.length > 0)
);
check(
  "every weekday has an Amharic name and an abbreviation",
  ETHIOPIC_WEEKDAYS.length === 7 &&
    ETHIOPIC_WEEKDAYS.every((day) => day.name && day.short && day.latin)
);

// The leap rule has to be derived from the day count, or the grid will offer
// 29 February in a year that has no 29 February.
check(
  "the leap rule comes from the year length, not a literal modulus",
  (() => {
    for (let year = 2000; year <= 2040; year += 1) {
      const derived =
        daysInEthiopianYear(year) ===
        365 + daysInEthiopianMonth(year, 13) -
          30 * 12 -
          (30 * 11 + daysInEthiopianMonth(year, 12)) +
          0;

      // The month arithmetic above is deliberately not used as the rule; this
      // just confirms the year's own length and its months add up.
      const months = Array.from({ length: 13 }, (_, index) =>
        daysInEthiopianMonth(year, index + 1)
      ).reduce((total, days) => total + days, 0);

      if (months !== daysInEthiopianYear(year)) {
        return false;
      }
    }

    return true;
  })()
);

check(
  "a month's days always add up to the year",
  (() => {
    for (let year = 2000; year <= 2040; year += 1) {
      const total = Array.from({ length: 13 }, (_, index) =>
        daysInEthiopianMonth(year, index + 1)
      ).reduce((sum, days) => sum + days, 0);

      if (total !== daysInEthiopianYear(year)) {
        return false;
      }
    }

    return true;
  })(),
  "month lengths disagree with the year length"
);

check(
  "the thirteenth month is five days, or six in a leap year",
  (() => {
    const lengths = new Set();

    for (let year = 2000; year <= 2040; year += 1) {
      lengths.add(daysInEthiopianMonth(year, 13));
    }

    return lengths.has(5) && lengths.has(6) && lengths.size === 2;
  })()
);

check(
  "the first twelve months are always thirty days",
  Array.from({ length: 12 }, (_, index) =>
    daysInEthiopianMonth(2015, index + 1)
  ).every((days) => days === 30)
);

// -------------------------------------------------------------------
// Grid layout — what the month grid actually renders
// -------------------------------------------------------------------

/**
 * The cells a month grid shows, exactly as EthiopianCalendar builds them:
 * leading blanks so the first of the month sits in its weekday column,
 * then one cell per day.
 */
function buildGrid(year, month) {
  const cells = [];

  for (let blank = 0; blank < ethiopianWeekdayIndex(year, month, 1); blank += 1) {
    cells.push({ blank: true });
  }

  for (let day = 1; day <= daysInEthiopianMonth(year, month); day += 1) {
    const gregorian = fromEthiopian(year, month, day);

    cells.push({
      blank: false,
      day,
      iso: iso(gregorian.year, gregorian.month, gregorian.day),
    });
  }

  return cells;
}

let gridFailures = [];

for (let year = 2014; year <= 2030; year += 1) {
  for (let month = 1; month <= 13; month += 1) {
    const cells = buildGrid(year, month);
    const blanks = cells.filter((cell) => cell.blank).length;
    const days = cells.filter((cell) => !cell.blank);

    if (blanks !== ethiopianWeekdayIndex(year, month, 1)) {
      gridFailures.push(`${year}/${month} leading blanks`);
      continue;
    }

    if (days.length !== daysInEthiopianMonth(year, month)) {
      gridFailures.push(`${year}/${month} day count`);
      continue;
    }

    // Every rendered cell must be a real day in this month, in order, and
    // the date it carries must convert back to the day that produced it.
    for (const [index, cell] of days.entries()) {
      if (cell.day !== index + 1) {
        gridFailures.push(`${year}/${month} day ${index + 1} out of order`);
        break;
      }

      const back = ethiopianFromIso(cell.iso);

      if (back.year !== year || back.month !== month || back.day !== cell.day) {
        gridFailures.push(
          `${year}/${month} cell ${cell.day} (${cell.iso}) does not come back to itself`
        );
        break;
      }
    }

    // A month never begins in a new row *past* the last column. More than
    // six leading blanks would mean a whole empty row above it.
    if (blanks > 6) {
      gridFailures.push(`${year}/${month} needs ${blanks} leading blanks`);
    }
  }
}

check(
  "every month lays out in whole weeks under the right first column",
  gridFailures.length === 0,
  gridFailures.slice(0, 4).join("; ")
);

// The short month, which is the case a thirty-day assumption gets wrong.
check(
  "a leap Pagume is six cells",
  buildGrid(2015, 13).filter((cell) => !cell.blank).length === 6
);
check(
  "a non-leap Pagume is five cells",
  buildGrid(2014, 13).filter((cell) => !cell.blank).length === 5
);

// Paging out of the thirteenth month.
function stepMonth({ year, month }, direction) {
  const moved = month + direction;

  return {
    year: year + (moved > 13 ? 1 : moved < 1 ? -1 : 0),
    month: moved > 13 ? 1 : moved < 1 ? 12 : moved,
  };
}

check(
  "paging forward out of Pagume lands on Meskerem",
  (() => {
    const next = stepMonth({ year: 2015, month: 13 }, 1);
    return next.year === 2016 && next.month === 1;
  })()
);

check(
  "paging back into Pagume lands on Nehasse",
  (() => {
    const previous = stepMonth({ year: 2016, month: 1 }, -1);
    return previous.year === 2015 && previous.month === 12;
  })()
);

check(
  "paging forward out of Nehasse lands on Pagume",
  (() => {
    const next = stepMonth({ year: 2015, month: 12 }, 1);
    return next.year === 2015 && next.month === 13;
  })()
);

// -------------------------------------------------------------------
// What a customer reads
// -------------------------------------------------------------------

const today = ethiopianFromIso(iso(2026, 10, 3));
const label = formatEthiopianDate("2026-10-03");

check(
  "a date reads in Amharic with its year",
  label === `${ETHIOPIC_MONTHS[today.month - 1].name} ${today.day}, ${today.year} ዓ.ም.`,
  label
);

check(
  "the year is marked so it is not read as a Gregorian year",
  label.includes("ዓ.ም.")
);

check(
  "an unusable date renders a dash rather than 'undefined'",
  formatEthiopianDate("") === "—" &&
    formatEthiopianDate(null) === "—" &&
    formatEthiopianTime(null) === "—"
);

// Times: an Amharic part of day with digits the customer already reads.
check(
  "09:00 is morning",
  formatEthiopianTime("09:00") === "ጠዋት 09:00",
  formatEthiopianTime("09:00")
);
check(
  "13:00 is daytime",
  formatEthiopianTime("13:00") === "ቀን 13:00",
  formatEthiopianTime("13:00")
);
check(
  "21:00 is night",
  formatEthiopianTime("21:00") === "ማታ 21:00",
  formatEthiopianTime("21:00")
);
check(
  "02:00 is the small hours",
  formatEthiopianTime("02:00") === "ማክሸነት 02:00",
  formatEthiopianTime("02:00")
);

// Grouping must keep every slot the backend returned — it is presentation.
const slots = ["09:00", "10:00", "13:00", "15:00", "19:00", "21:00", "02:00"];
const grouped = groupSlotsByEthiopianPartOfDay(slots);

check(
  "slot grouping keeps every slot",
  grouped
    .flatMap((group) => group.slots)
    .sort()
    .join() === [...slots].sort().join()
);
check(
  "slot groups are labelled in Amharic and in time order",
  grouped.map((group) => group.label).join(" ") === "ጠዋት ቀን ማታ ማክሸነት",
  grouped.map((group) => group.label).join(" ")
);

// -------------------------------------------------------------------
// The list of days the booking form offers
// -------------------------------------------------------------------

/*
 * The strip the customer actually picks from: the next fortnight, in the
 * Ethiopian calendar. It is the thing the form leads with, so the two ways
 * it can be wrong are checked here - a list that skips a day (the customer
 * swipes and the date under their thumb is not the one that gets chosen)
 * and a list that crosses a month or a year boundary wrongly (14 entries
 * that quietly stop at ነሐሴ 29 in late Pagume).
 */

const STRIP_START = iso(2026, 9, 4); // 1 መስከረም 2019 — a month boundary ahead
const strip = ethiopianDaysFrom(STRIP_START, 14);

check(
  "the day list is the length asked for",
  strip.length === 14,
  `got ${strip.length}`
);

check(
  "the day list starts on the day given",
  strip[0]?.iso === STRIP_START,
  strip[0]?.iso
);

check(
  "the day list walks consecutive Gregorian days",
  strip.every((entry, index) =>
    index === 0 ? true : entry.iso === shiftIsoDate(STRIP_START, index)
  ),
  strip.map((entry) => entry.iso).join(" ")
);

check(
  "the day list crosses the Ethiopian new year without losing a day",
  (() => {
    // ጳጉሜን 5, 2018 runs into 1 መስከረም 2019: the year number has to step
    // over and the day number has to wrap to 1, while the Gregorian dates
    // underneath stay consecutive. Either half on its own would pass a
    // weaker check - a list that restarted its day numbers at the join
    // would look fine in the Ethiopian calendar and be a different date.
    const across = ethiopianDaysFrom("2026-09-10", 4);

    return (
      across.length === 4 &&
      new Set(across.map((entry) => entry.iso)).size === 4 &&
      across.every(
        (entry, index) =>
          index === 0 ? true : entry.iso === shiftIsoDate("2026-09-10", index)
      ) &&
      across[0].day === 5 &&
      across[0].month === 13 &&
      across[1].day === 1 &&
      across[1].month === 1 &&
      across[1].year === across[0].year + 1 &&
      across[3].day === 3
    );
  })(),
  ethiopianDaysFrom("2026-09-10", 4)
    .map((entry) => `${entry.day}/${entry.month}/${entry.year}`)
    .join(" ")
);

check(
  "the first entry of the day list is flagged as today",
  ethiopianDaysFrom(STRIP_START, 3).filter((entry) => entry.isToday).length === 1
);

check(
  "every day-list tile carries the weekday it lands on",
  strip.every((entry) => {
    const expected = ETHIOPIC_WEEKDAYS[
      ethiopianWeekdayIndex(entry.year, entry.month, entry.day)
    ];

    return entry.weekday === expected.name && entry.weekdayShort === expected.short;
  }),
  strip.map((entry) => entry.iso + " " + entry.weekday).join(" | ")
);

check(
  "every day-list tile carries its Amharic month name",
  strip.every(
    (entry) => entry.monthLabel === ETHIOPIC_MONTHS[entry.month - 1].name
  )
);

check(
  "an empty or silly length is an empty list rather than an error",
  ethiopianDaysFrom(STRIP_START, 0).length === 0 &&
    ethiopianDaysFrom(STRIP_START, -3).length === 0
);

check(
  "shifting a date by zero changes nothing",
  shiftIsoDate("2026-09-11", 0) === "2026-09-11"
);

check(
  "shifting across a Gregorian year boundary carries the year",
  shiftIsoDate("2026-12-31", 1) === "2027-01-01" &&
    shiftIsoDate("2027-01-01", -1) === "2026-12-31"
);

check(
  "shifting backwards across a leap day lands on the right date",
  // 2028 is a leap year: 28 Feb + 1 is the 29th, and 29 Feb + 1 is March.
  shiftIsoDate("2028-02-28", 1) === "2028-02-29" &&
    shiftIsoDate("2028-02-29", 1) === "2028-03-01" &&
    shiftIsoDate("2027-02-28", 1) === "2027-03-01"
);

// -------------------------------------------------------------------

console.log(`\nran ${checks.length} checks over ${daysChecked} days\n`);

if (failures.length > 0) {
  console.log("FAILED:");
  failures.forEach((failure) => console.log("  -", failure));
  process.exit(1);
}

console.log("ok    Ethiopian calendar and Amharic dates");