/**
 * Has this time on this day already gone by?
 *
 * ## Why this exists on the client at all
 *
 * The server refuses a start time that has passed - `time_passed`, from
 * `bookings.services.validate_time_not_passed`. So why check again here?
 *
 * Because the list of times is a *snapshot*. Availability is cached for a
 * minute and the booking form is a long page: someone can open it before
 * lunch, read the morning, eat, and come back to press Reserve on a 09:00
 * slot that no longer exists. The server will say no - it is the authority
 * and it is right - but the customer gets refused for something the screen
 * could have shown them the moment they came back, which is a worse answer
 * than the same rule applied twice.
 *
 * So the server decides and the interface agrees with it. The two are
 * deliberately the same rule, down to the "no lead time" part: the shop
 * asked for "not this morning any more", and a client that invented thirty
 * minutes of cut-off would grey out a slot the shop would still take.
 *
 * ## Why it reads the clock in the browser
 *
 * The shop is in one time zone and the customer is in it too, which is the
 * only reason this can work at all. The server's own answer is the truth;
 * this is the same comparison done with the same clock the customer is
 * looking at, so "the morning has gone" is true on their screen and not
 * merely on the machine in the back office.
 */

import { todayIsoDate } from "./format";

/** "09:00", "09:00:00" -> 540. Minutes from midnight. */
export function slotMinutes(slot) {
  const [hour, minute] = String(slot || "")
    .slice(0, 5)
    .split(":")
    .map(Number);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }

  return hour * 60 + minute;
}

/** Minutes from midnight on the machine's clock, right now. */
export function nowMinutes(at = new Date()) {
  return at.getHours() * 60 + at.getMinutes();
}

/**
 * Whether a start time has already passed.
 *
 * Yesterday always has - the whole day is behind us. Any other date is
 * compared against the clock only when it is today, because tomorrow's
 * 09:00 is not "passed" this afternoon; it is tomorrow morning, and
 * treating it as elapsed would empty every future day as the day wore on.
 *
 * @param {string} isoDate "YYYY-MM-DD"
 * @param {string} slot "HH:MM" or "HH:MM:SS"
 */
export function isPassedSlot(isoDate, slot, { at = new Date(), today = todayIsoDate() } = {}) {
  const minutes = slotMinutes(slot);

  if (minutes === null) {
    return false;
  }

  if (!isoDate) {
    return false;
  }

  if (isoDate < today) {
    return true;
  }

  if (isoDate > today) {
    return false;
  }

  return minutes < nowMinutes(at);
}

/**
 * Split a list of slots into the ones still ahead and the ones gone.
 *
 * Both halves are returned rather than only the survivors because the
 * count of the dropped ones is worth saying out loud: a customer who was
 * offered sixteen times and now sees twelve needs to be told the other
 * four went with the clock, or the time picker looks like it lost them.
 *
 * @returns {{open: string[], passed: string[]}}
 */
export function splitPassedSlots(times = [], options = {}) {
  const open = [];
  const passed = [];

  for (const slot of Array.isArray(times) ? times : []) {
    if (isPassedSlot(options.date, slot, options)) {
      passed.push(slot);

      continue;
    }

    open.push(slot);
  }

  return { open, passed };
}