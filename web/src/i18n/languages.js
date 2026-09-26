/**
 * Supported languages for the public storefront.
 *
 * `code` is the BCP-47 tag we hand to <html lang> and to Intl formatters.
 * `native` is what the visitor reads in the switcher — never translate it,
 * a person looking for their own language recognises it fastest in the
 * script they already read.
 *
 * `beta` marks a catalogue that is still being reviewed by a native speaker.
 * The switcher shows a small tag next to it rather than hiding it, so the
 * state of the translation is honest instead of implied.
 */
export const LANGUAGES = [
  {
    code: "en",
    native: "English",
    english: "English",
    dir: "ltr",
    beta: false,
  },
  {
    code: "am",
    native: "\u12a0\u122d\u1235\u122a",
    english: "Amharic",
    dir: "ltr",
    beta: false,
  },
  {
    code: "om",
    native: "Afaan Oromoo",
    english: "Afaan Oromo",
    dir: "ltr",
    beta: true,
  },
];

export const DEFAULT_LANGUAGE = "en";

/** Short label for tight spots like the bottom app bar. */
export const LANGUAGE_SHORT = {
  en: "EN",
  am: "\u12a0\u122d",
  om: "OM",
};

export function isSupported(code) {
  return LANGUAGES.some((language) => language.code === code);
}

export function getLanguage(code) {
  return (
    LANGUAGES.find((language) => language.code === code) ||
    LANGUAGES.find((language) => language.code === DEFAULT_LANGUAGE)
  );
}
