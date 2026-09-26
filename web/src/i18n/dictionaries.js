import en from "./translations/en";
import am from "./translations/am";
import om from "./translations/om";

/**
 * Locale code -> catalogue.
 *
 * A missing locale deliberately falls back to English rather than rendering
 * the raw key. Half a translation beats a wall of "testimonials.titleAccent".
 */
export const dictionaries = {
  en,
  am,
  om,
};

export const FALLBACK_LOCALE = "en";

/**
 * Walk a dot path through a catalogue.
 * Returns undefined on the first missing segment so the caller can fall back.
 */
export function lookup(dictionary, path) {
  if (!dictionary || !path) {
    return undefined;
  }

  return path
    .split(".")
    .reduce(
      (node, segment) =>
        node && typeof node === "object" ? node[segment] : undefined,
      dictionary
    );
}

/**
 * Fill `{placeholders}` from `values`. Unknown placeholders are left as-is so
 * a typo is visible in the UI rather than silently swallowed.
 */
export function interpolate(template, values) {
  if (typeof template !== "string" || !values) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (match, key) =>
    Object.hasOwn(values, key) ? String(values[key]) : match
  );
}

/**
 * Resolve a dot path for a locale, then translate.
 *
 * t("testimonials.rating.many", { count: 5 })
 */
export function translate(locale, path, values) {
  const dictionary = dictionaries[locale];
  const value = lookup(dictionary, path) ?? lookup(dictionaries[FALLBACK_LOCALE], path);

  if (typeof value !== "string") {
    return path;
  }

  return interpolate(value, values);
}
