/** Display helpers. No business logic - Django owns all of that. */

/** "300.00" -> "300 ETB", "5000.50" -> "5,000.50 ETB" */
export function formatPrice(value, { currency = "ETB" } = {}) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const amount = Number(value);

  if (Number.isNaN(amount)) {
    return `${value} ${currency}`;
  }

  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  return `${formatted} ${currency}`;
}

/** 60 -> "1 hr", 90 -> "1 hr 30 min", 45 -> "45 min" */
export function formatDuration(minutes) {
  const total = Number(minutes);

  if (!total || Number.isNaN(total)) {
    return "—";
  }

  const hours = Math.floor(total / 60);
  const rest = total % 60;

  if (!hours) {
    return `${rest} min`;
  }

  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

/**
 * "2026-08-28" -> "August 28, 2026"
 *
 * Parsed as a plain date from the year/month/day parts and never UTC-shifted:
 * `new Date("2026-08-28")` parses as UTC midnight, which renders as the 27th
 * for anyone west of Greenwich.
 *
 * An ISO timestamp is truncated at the `T` first. Without that, Number() hits
 * "30T12:00:00Z", returns NaN, and the raw string is what the user sees.
 */
export function formatDate(value) {
  if (!value) {
    return "—";
  }

  const [year, month, day] = String(value)
    .split("T")[0]
    .split("-")
    .map(Number);

  if (!year || !month || !day) {
    return String(value);
  }

  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** "09:00:00" -> "09:00" */
export function formatTime(value) {
  if (!value) {
    return "—";
  }

  return String(value).slice(0, 5);
}

/** ("10:00:00", "10:45:00") -> "10:00 — 10:45" */
export function formatTimeRange(start, end) {
  if (!start) {
    return "—";
  }

  return end ? `${formatTime(start)} — ${formatTime(end)}` : formatTime(start);
}

/** Today in the browser's timezone as YYYY-MM-DD, for <input type="date" min>. */
export function todayIsoDate() {
  const now = new Date();

  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${now.getFullYear()}-${month}-${day}`;
}
