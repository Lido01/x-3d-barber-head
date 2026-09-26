export {
  LANGUAGES,
  DEFAULT_LANGUAGE,
  LANGUAGE_SHORT,
  isSupported,
  getLanguage,
} from "./languages";

export { dictionaries, translate, lookup, interpolate } from "./dictionaries";

export {
  detectLanguage,
  readStoredLanguage,
  writeStoredLanguage,
} from "./languageStorage";

export { LanguageProvider, useLanguage, useTranslate } from "./LanguageContext";

export { translatedTestimonials, getTranslatedQuote } from "./translatedTestimonials";
