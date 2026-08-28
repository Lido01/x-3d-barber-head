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

/** "2026-08-28" -> "August 28, 2026" (parsed as a plain date, never UTC-shifted) */
export function formatDate(isoDate) {
  if (!isoDate) {
    return "—";
  }

  const [year, month, day] = String(isoDate).split("-").map(Number);

  if (!year || !month || !day) {
    return String(isoDate);
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

/**
 * Split the backend's available_times into parts of the day purely so
 * a long list stays scannable.
 *
 * This is presentation only: every slot Django returns is rendered,
 * nothing is filtered out or added.
 */
export function groupSlotsByPartOfDay(times = []) {
  const groups = [
    { key: "morning", label: "Morning", slots: [] },
    { key: "afternoon", label: "Afternoon", slots: [] },
    { key: "evening", label: "Evening", slots: [] },
    { key: "overnight", label: "Late night", slots: [] },
  ];

  const byKey = Object.fromEntries(groups.map((group) => [group.key, group]));

  for (const slot of times) {
    const hour = Number(String(slot).slice(0, 2));

    if (hour >= 5 && hour < 12) {
      byKey.morning.slots.push(slot);
    } else if (hour >= 12 && hour < 17) {
      byKey.afternoon.slots.push(slot);
    } else if (hour >= 17 && hour < 22) {
      byKey.evening.slots.push(slot);
    } else {
      byKey.overnight.slots.push(slot);
    }
  }

  return groups.filter((group) => group.slots.length > 0);
}
