import { DEFAULT_LANGUAGE, isSupported } from "./languages";

const STORAGE_KEY = "noir.language";

/**
 * Remembered language choice.
 *
 * localStorage is best-effort: Safari private mode and some embedded
 * webviews throw on access, so every call is wrapped. A visitor whose browser
 * refuses storage still gets a working session, they just start in English
 * again next time.
 */
export function readStoredLanguage() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    return isSupported(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function writeStoredLanguage(locale) {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Storage unavailable — the language still applies for this session.
  }
}

/**
 * First guess at a visitor's language.
 *
 * Stored choice wins. Otherwise we read the browser's preferred languages and
 * match on the base tag, so `am-ET` and `am` both land on Amharic and
 * `en-US` lands on English. An unsupported preference falls through to
 * English, which is the safe default for a shop that also takes bookings by
 * phone.
 */
export function detectLanguage() {
  const stored = readStoredLanguage();

  if (stored) {
    return stored;
  }

  const candidates = navigator.languages?.length
    ? navigator.languages
    : [navigator.language].filter(Boolean);

  for (const candidate of candidates) {
    const base = String(candidate).toLowerCase().split("-")[0];

    if (isSupported(base)) {
      return base;
    }
  }

  return DEFAULT_LANGUAGE;
}
