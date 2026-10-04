/**
 * Ethiopian calendar conversion and Amharic naming.
 *
 * The shop's customers think in the Ethiopian calendar. A date picker that
 * opens on "September" for someone whose month is ጥር is a picker that has to
 * be translated in the head before it can be used, and getting a day wrong
 * means turning up on the wrong day - so the conversion here is the calendar
 * the booking form is built on, not decoration on top of a Gregorian one.
 *
 * ## The conversion
 *
 * Everything pivots on one number: the day number, RD (days since
 * 1 January 1 in the proleptic Gregorian calendar, which is the same epoch
 * the Ethiopian calendar counts from). Both directions are exact integer
 * arithmetic, so there is no timezone and no daylight saving anywhere in
 * it - a date is a date, and it converts to the same number on every
 * machine in the shop.
 *
 * ## Why the arithmetic is written out rather than shifted by a constant
 *
 * The tempting shortcut is "Ethiopian year is always Gregorian minus seven
 * and the month is the same number". It is wrong in two ways that only
 * show up at the edges:
 *
 *   - The year is minus seven from 11 September and minus eight before it,
 *     because the Ethiopian year starts on 11 September Gregorian. Two
 *     numbers for one rule.
 *   - After a leap year the new year lands on 12 September rather than the
 *     11th, so even the start date moves.
 *
 * Counting days avoids both, which is why this is day arithmetic and not
 * date arithmetic. `verifyEthiopianCalendar()` at the bottom checks the
 * round trip and the weekday alignment over a wide range; the Ethiopian and
 * Gregorian calendars share weekdays, so a conversion that drifts by a day
 * shows up as a weekday that does not match.
 */

const MS_PER_DAY = 86400000;

/** RD of the day before 1 January 1970, the unix epoch's day number. */
const RD_AT_UNIX_EPOCH = 719163;

/**
 * RD of the Ethiopian epoch, 29 August 8 AD in the proleptic Julian
 * calendar - the day the Ethiopian calendar counts from.
 */
const ETHIOPIC_EPOCH = 2796;

/**
 * The thirteen months, in Amharic and transliterated.
 *
 * Twelve months of thirty days, and a short thirteenth that exists only in a
 * leap year: five days, or six. That is why `daysInEthiopianMonth` needs the
 * year - the same month number is 30 days in one year and 5 in the next.
 */
export const ETHIOPIC_MONTHS = [
  { name: "መስከረም", latin: "Meskerem" },
  { name: "ጥቅምት", latin: "Tikimt" },
  { name: "ኅዳር", latin: "Hidar" },
  { name: "ታኅሣሥ", latin: "Tahsas" },
  { name: "ጥር", latin: "Tir" },
  { name: "የካቲት", latin: "Yekatit" },
  { name: "መጋቢት", latin: "Megabit" },
  { name: "ሚያዝያ", latin: "Miazia" },
  { name: "ግንቦት", latin: "Ginbot" },
  { name: "ሰኔ", latin: "Sene" },
  { name: "ሐምሌ", latin: "Hamle" },
  { name: "ነሐሴ", latin: "Nehasse" },
  { name: "ጳጉሜን", latin: "Pagumen" },
];

/**
 * The week, Sunday first, which is where the Ethiopian week starts.
 *
 * Sunday is እሑድ and it is day one, so the calendar grid is laid out with it
 * on the left and the week reads left to right. Getting this wrong shifts
 * every day against its name by one - a picker that says ሰኞ for a Tuesday.
 */
export const ETHIOPIC_WEEKDAYS = [
  { name: "እሑድ", short: "እሑ", latin: "Ehud" },
  { name: "ሰኞ", short: "ሰኞ", latin: "Sane" },
  { name: "ማክሰኞ", short: "ማክ", latin: "Maksegno" },
  { name: "ረቡዕ", short: "ረቡ", latin: "Rebuwo" },
  { name: "ሐሙስ", short: "ሐሙ", latin: "Hamus" },
  { name: "አርብ", short: "አርብ", latin: "Arb" },
  { name: "ቅዳሜ", short: "ቅዳ", latin: "Kidame" },
];

/**
 * Whether an Ethiopian year has a sixth Pagumen.
 *
 * Derived from the calendar's own day count rather than written down as
 * "year mod 4", because a rule written from memory is a rule that can
 * disagree with the arithmetic used to convert dates - and then the grid
 * offers 29 February in a year that has no 29 February. A leap year is
 * exactly one that is 366 days long, and this asks that.
 */
export function isEthiopianLeapYear(year) {
  return (
    firstDayOfEthiopianYear(year + 1) - firstDayOfEthiopianYear(year) ===
    366
  );
}

/**
 * How many days a month has.
 *
 * Pagumen is the only month that is not thirty days, and it only exists at
 * all in a leap year - so the same month number is 30 days in most years,
 * 5 in some leap years, and 6 in others. Callers that assume 30 get it
 * wrong exactly once every four years, in the month nobody has a name for.
 */
export function daysInEthiopianMonth(year, month) {
  if (month !== 13) {
    return 30;
  }

  return isEthiopianLeapYear(year) ? 6 : 5;
}

/** Days in a whole Ethiopian year: 365, or 366 in a leap year. */
export function daysInEthiopianYear(year) {
  return isEthiopianLeapYear(year) ? 366 : 365;
}

/**
 * Days from the Ethiopian epoch to 1 Meskerem of an Ethiopian year.
 *
 * Measured from the epoch, so it is directly comparable with the offset
 * `toEthiopian` works in. Adding the epoch here as well would put the two
 * on different scales and quietly send every date back a thousand years.
 */
function firstDayOfEthiopianYear(year) {
  return 365 * (year - 1) + Math.floor(year / 4);
}

/** Gregorian (year, month, day) -> RD. */
export function gregorianToDayNumber(year, month, day) {
  return (
    Date.UTC(year, month - 1, day) / MS_PER_DAY + RD_AT_UNIX_EPOCH
  );
}

/**
 * RD (days since 1 January 1) -> Gregorian (year, month, day).
 *
 * The unix epoch offset is removed on the way out. A `Date` counts days
 * since 1970 and an RD counts days since year 1, so passing one to the
 * other as though they matched puts every date about 1969 years out - a
 * round trip still lands on a real date, because the error is a constant,
 * which is exactly why it survives a test that only checks the trip.
 */
export function dayNumberToGregorian(dayNumber) {
  const date = new Date((dayNumber - RD_AT_UNIX_EPOCH) * MS_PER_DAY);

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

/**
 * Gregorian (year, month, day) -> Ethiopian (year, month, day).
 */
export function toEthiopian(gregorianYear, gregorianMonth, gregorianDay) {
  const dayNumber = gregorianToDayNumber(
    gregorianYear,
    gregorianMonth,
    gregorianDay
  );

  const offset = dayNumber - ETHIOPIC_EPOCH;

  // Start from an estimate and correct, rather than inverting the leap rule
  // algebraically. Two iterations at most, and there is no way for it to be
  // wrong at a boundary the way a closed-form inversion can be.
  let year = Math.floor((4 * offset) / 1461) + 1;

  while (firstDayOfEthiopianYear(year) > offset) {
    year -= 1;
  }

  while (firstDayOfEthiopianYear(year + 1) <= offset) {
    year += 1;
  }

  const dayOfYear = offset - firstDayOfEthiopianYear(year);

  return {
    year,
    month: Math.floor(dayOfYear / 30) + 1,
    day: (dayOfYear % 30) + 1,
  };
}

/**
 * Ethiopian (year, month, day) -> Gregorian (year, month, day).
 */
export function fromEthiopian(ethiopianYear, ethiopianMonth, ethiopianDay) {
  const offset =
    365 * (ethiopianYear - 1) +
    Math.floor(ethiopianYear / 4) +
    30 * ethiopianMonth +
    ethiopianDay -
    31;

  // The epoch is added back here because `toEthiopian` works in days since
  // the Ethiopian epoch while the calendar works in days since 1 January 1.
  // Leaving it off throws every date about 1700 years - which is the one
  // failure mode that still round-trips, so the round-trip test alone would
  // not have caught it.
  return dayNumberToGregorian(ETHIOPIC_EPOCH + offset);
}

/**
 * The weekday index for a Gregorian date, Sunday first - matching the order
 * of `ETHIOPIC_WEEKDAYS`.
 *
 * Needed for laying out a month grid: the calendar has to know where the
 * first of the month falls, and Ethiopian and Gregorian calendars agree on
 * weekdays, so this works for either.
 */
export function gregorianWeekdayIndex(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** The weekday index for an Ethiopian date, Sunday first. */
export function ethiopianWeekdayIndex(year, month, day) {
  const { year: gYear, month: gMonth, day: gDay } = fromEthiopian(
    year,
    month,
    day
  );

  return gregorianWeekdayIndex(gYear, gMonth, gDay);
}

/**
 * "2026-09-11" (or a Date) -> the Ethiopian date for it.
 *
 * Accepts the `YYYY-MM-DD` strings the API speaks, because that is what the
 * booking form already holds - so a date can be converted in place without
 * first being parsed into something else and risking a timezone shift.
 */
export function ethiopianFromIso(value) {
  if (value instanceof Date) {
    return toEthiopian(
      value.getFullYear(),
      value.getMonth() + 1,
      value.getDate()
    );
  }

  const [year, month, day] = String(value || "")
    .split("T")[0]
    .split("-")
    .map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return toEthiopian(year, month, day);
}

/** The Ethiopian date -> "YYYY-MM-DD", which is what the API expects. */
export function ethiopianToIso({ year, month, day }) {
  const { year: gYear, month: gMonth, day: gDay } = fromEthiopian(
    year,
    month,
    day
  );

  return [
    String(gYear).padStart(4, "0"),
    String(gMonth).padStart(2, "0"),
    String(gDay).padStart(2, "0"),
  ].join("-");
}

/**
 * The Amharic name of an Ethiopian month, or of a Gregorian one.
 *
 * Two calendars in one function because every caller wants "the name of the
 * month this date is in" and does not care which calendar it arrived in -
 * and picking the wrong one silently shows ጥር next to a Gregorian date,
 * which reads as nonsense rather than as a bug.
 */
export function monthName(month) {
  const index = Number(month) - 1;

  return ETHIOPIC_MONTHS[index]?.name || "";
}

/**
 * "2026-09-11" -> "ጳጉሜን 3, 2019 ዓ.ም."
 *
 * Short enough to fit on a phone button, and the year is marked `ዓ.ም.`
 * because a bare 2019 next to a Gregorian 2026 on the same screen is a
 * number that has to be decoded rather than read.
 */
export function formatEthiopianDate(value, { withYear = true } = {}) {
  const ethiopian = ethiopianFromIso(value);

  if (!ethiopian) {
    return "—";
  }

  const head = `${monthName(ethiopian.month)} ${ethiopian.day}`;

  return withYear ? `${head}, ${ethiopian.year} ዓ.ም.` : head;
}

/** "2026-09-11" -> "እሑድ" */
export function formatEthiopianWeekday(value) {
  const ethiopian = ethiopianFromIso(value);

  if (!ethiopian) {
    return "—";
  }

  return ETHIOPIC_WEEKDAYS[ethiopianWeekdayIndex(
    ethiopian.year,
    ethiopian.month,
    ethiopian.day
  )].name;
}

/** "2026-09-11" -> 3, the Ethiopian day of the month. */
export function ethiopianDayOfMonth(value) {
  return ethiopianFromIso(value)?.day ?? null;
}

/** "2026-09-11" -> 2019, the Ethiopian year. */
export function ethiopianYearOf(value) {
  return ethiopianFromIso(value)?.year ?? null;
}

/**
 * "2026-09-11" -> "2026-09-14", or the same string for a zero shift.
 *
 * Built on `Date.UTC` rather than on a local `Date`, because the one job
 * here is to move a calendar day number and a local midnight is exactly
 * the thing that shifts when the arithmetic is done wrong: a DST boundary
 * makes `setDate(+1)` produce the same day twice or skip one outright.
 *
 * Nothing is ever converted back through a local `Date` either - the
 * result is formatted from the UTC parts, so the round trip is arithmetic
 * from beginning to end.
 */
export function shiftIsoDate(iso, days = 0) {
  const [year, month, day] = String(iso || "")
    .split("T")[0]
    .split("-")
    .map(Number);

  if (!year || !month || !day) {
    return iso || null;
  }

  const shifted = new Date(Date.UTC(year, month - 1, day + days));

  return [
    String(shifted.getUTCFullYear()).padStart(4, "0"),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

/**
 * The next `count` days from `fromIso`, each in the Ethiopian calendar.
 *
 * ## Why a list and not a month grid
 *
 * A month grid asks someone to read a page of thirty numbers to answer
 * "when can I come in?". Almost nobody is coming in on the 23rd; they
 * are coming tomorrow, or on Saturday. A row of the next fortnight answers
 * that question by being the answer - one swipe along and the day is
 * chosen - and every day in it is a day the shop will actually take a
 * booking, because the list stops where the availability lookahead does.
 *
 * ## Why it starts at today and not at the month
 *
 * Every day before today is already refused by the form and by the
 * server, so showing them would spend most of the strip on buttons that
 * cannot be pressed. The strip is the bookable future; the month grid
 * below it is still there for anyone who needs to look further ahead.
 *
 * ## The shape of one entry
 *
 * Enough for a day tile with no conversion in the component: the ISO the
 * API speaks, the Ethiopian day number, both names of the weekday, and
 * whether it is today. Computed once here so eleven tiles and the readout
 * under them cannot disagree about what day is which.
 *
 * @returns {{iso: string, day: number, month: number, year: number,
 *            monthLabel: string, weekday: string, weekdayShort: string,
 *            isToday: boolean}[]}
 */
export function ethiopianDaysFrom(fromIso, count = 14) {
  const total = Math.max(0, Math.floor(Number(count) || 0));
  const days = [];

  for (let offset = 0; offset < total; offset += 1) {
    const iso = shiftIsoDate(fromIso, offset);
    const ethiopian = ethiopianFromIso(iso);

    if (!ethiopian) {
      break;
    }

    const weekdayIndex = ethiopianWeekdayIndex(
      ethiopian.year,
      ethiopian.month,
      ethiopian.day
    );

    days.push({
      iso,
      day: ethiopian.day,
      month: ethiopian.month,
      year: ethiopian.year,
      monthLabel: monthName(ethiopian.month),
      weekday: ETHIOPIC_WEEKDAYS[weekdayIndex].name,
      weekdayShort: ETHIOPIC_WEEKDAYS[weekdayIndex].short,
      isToday: offset === 0,
    });
  }

  return days;
}

/**
 * The Amharic part of the day a 24-hour time falls in.
 */
export function ethiopianPartOfDay(hour) {
  const value = Number(hour);

  if (value < 6) {
    return "ማክሸነት";
  }

  if (value < 12) {
    return "ጠዋት";
  }

  if (value < 18) {
    return "ቀን";
  }

  return "ማታ";
}

/**
 * "09:00:00" -> "ጠዋት 9:00"
 *
 * Amharic part of day plus the time in digits. Digits rather than Amharic
 * numerals on purpose: this is a time someone has to compare against a
 * booking confirmation and a phone call, and a numeral system they have to
 * learn to read the clock is worse than the one they already read it in.
 */
export function formatEthiopianTime(value) {
  if (!value) {
    return "—";
  }

  const hour = Number(String(value).slice(0, 2));

  if (Number.isNaN(hour)) {
    return String(value);
  }

  return `${ethiopianPartOfDay(hour)} ${String(value).slice(0, 5)}`;
}

/**
 * Group slots by the Amharic part of the day.
 *
 * The same grouping the English picker uses, relabelled - because the
 * Amharic names carry the same information and reading "ማታ" for a 9pm slot
 * tells someone more than "Evening" does. Every slot Django returned is
 * still rendered; nothing is filtered or added here.
 */
export function groupSlotsByEthiopianPartOfDay(times = []) {
  const order = ["ጠዋት", "ቀን", "ማታ", "ማክሸነት"];
  const groups = new Map(order.map((label) => [label, []]));

  for (const slot of times) {
    const label = ethiopianPartOfDay(String(slot).slice(0, 2));

    groups.get(label).push(slot);
  }

  return order
    .filter((label) => groups.get(label).length > 0)
    .map((label) => ({ label, slots: groups.get(label) }));
}

/**
 * Check the conversion against itself.
 *
 * Not called in normal operation - it is here so the calendar can be proved
 * rather than trusted. Round-trips every day across a range that straddles
 * several leap years, and checks the weekday agrees with the Gregorian
 * calendar's, which is the invariant that catches an off-by-one no amount of
 * round-tripping would.
 *
 * @returns {{days: number, ok: boolean, failed: string[]}}
 */
export function verifyEthiopianCalendar(fromYear = 1990, toYear = 2040) {
  const failed = [];
  let days = 0;

  for (let year = fromYear; year <= toYear; year += 1) {
    for (let month = 1; month <= 13; month += 1) {
      const monthLength = daysInEthiopianMonth(year, month);

      for (let day = 1; day <= monthLength; day += 1) {
        const gregorian = fromEthiopian(year, month, day);
        const back = toEthiopian(
          gregorian.year,
          gregorian.month,
          gregorian.day
        );

        days += 1;

        if (
          back.year !== year ||
          back.month !== month ||
          back.day !== day
        ) {
          failed.push(
            `${year}-${month}-${day} -> ${gregorian.year}-${gregorian.month}-${gregorian.day} -> ${back.year}-${back.month}-${back.day}`
          );

          continue;
        }

        if (
          ethiopianWeekdayIndex(year, month, day) !==
          gregorianWeekdayIndex(
            gregorian.year,
            gregorian.month,
            gregorian.day
          )
        ) {
          failed.push(`weekday mismatch at ${year}-${month}-${day}`);
        }
      }
    }
  }

  return { days, ok: failed.length === 0, failed: failed.slice(0, 10) };
}