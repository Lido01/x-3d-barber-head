import { useEffect, useState } from "react";

/**
 * A value that only updates after it has stopped changing.
 *
 * Used to keep a search box from firing a request per keystroke: the
 * field stays fully controlled and responsive while the expensive part
 * (the query) waits for a pause.
 *
 * @param {unknown} value the fast-changing value, e.g. input text
 * @param {number} [delayMs] quiet period before the value is published
 * @returns {unknown} the value as of the last pause
 */
export function useDebouncedValue(value, delayMs = 300) {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return settled;
}
