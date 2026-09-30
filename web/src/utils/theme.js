/**
 * Console theme.
 *
 * Three states, not two, because "follow my phone" is the right default
 * for someone who never touches the toggle and the wrong one for
 * someone who has.
 *
 *   light  the console's original neutral ramp
 *   dark   the storefront's near-black, for a night shift
 *   auto   whatever the operating system says, re-evaluated live
 *
 * The choice is stored in localStorage rather than sessionStorage
 * because it is a preference about the device, not about the session -
 * a barber who sets it once should not set it again tomorrow.
 *
 * Applied by writing `data-theme` onto <html>. The matching custom
 * properties live in index.css, so nothing here needs to know what a
 * colour is; it only decides which set is in play.
 */

const STORAGE_KEY = "noir.console.theme";

/** @typedef {"light" | "dark" | "auto"} ThemePreference */

const VALID = new Set(["light", "dark", "auto"]);

/**
 * The value actually in effect, given a preference.
 *
 * `auto` resolves against `prefers-color-scheme`, which is why this is a
 * function rather than a constant: the answer can change while the tab
 * is open.
 *
 * @param {ThemePreference} preference
 * @returns {"light" | "dark"}
 */
export function resolveTheme(preference) {
  if (preference === "light" || preference === "dark") {
    return preference;
  }

  if (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }

  return "light";
}

/**
 * The stored preference.
 *
 * Wrapped in try/catch throughout because Safari in private mode throws
 * on localStorage access, and a theme preference is never worth breaking
 * the console over.
 *
 * @returns {ThemePreference}
 */
export function readThemePreference() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (stored && VALID.has(stored)) {
      return stored;
    }
  } catch {
    // Storage unavailable. Fall through to the default.
  }

  return "auto";
}

/**
 * Write the preference and apply it to the document.
 *
 * @param {ThemePreference} preference
 */
export function applyThemePreference(preference) {
  const next = VALID.has(preference) ? preference : "auto";

  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Not being able to remember it is survivable; being able to use it
    // for this session is not.
  }

  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", next);
  }
}

/**
 * Subscribe to system theme changes.
 *
 * Only meaningful while the preference is `auto`, but a caller cannot
 * easily know that without also reading the preference, so this fires on
 * every system change and the caller decides.
 *
 * @param {Function} listener
 * @returns {() => void} unsubscribe
 */
export function onSystemThemeChange(listener) {
  if (typeof window === "undefined" || !window.matchMedia) {
    return () => {};
  }

  const query = window.matchMedia("(prefers-color-scheme: dark)");

  // addEventListener is the modern API; addListener is Safari < 14 and
  // is kept because a shop may well have a decade-old iPhone on the
  // counter.
  if (query.addEventListener) {
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }

  query.addListener(listener);
  return () => query.removeListener(listener);
}

export { STORAGE_KEY as THEME_STORAGE_KEY };
