import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { translate } from "./dictionaries";
import { DEFAULT_LANGUAGE, LANGUAGES, getLanguage, isSupported } from "./languages";
import { detectLanguage, writeStoredLanguage } from "./languageStorage";

/**
 * Display language for the public storefront.
 *
 * Scope is the marketing surface only: nav, hero, about, quick book, gallery,
 * testimonials and the footer. The booking flow, the payment screens and the
 * staff console intentionally stay in English — those are the places where a
 * wrong or missing translation costs someone money.
 *
 * Mounted above <Shell /> in App.jsx so the switcher in the nav chrome can
 * drive every section at once.
 */

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [locale, setLocale] = useState(() => detectLanguage() || DEFAULT_LANGUAGE);

  const setLanguage = useCallback((next) => {
    if (!isSupported(next)) {
      return;
    }

    setLocale(next);
    writeStoredLanguage(next);
  }, []);

  // Keep <html lang> honest: screen readers switch voice on the tag, and
  // browsers use it to pick a font fallback.
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.lang;

    root.lang = locale;

    return () => {
      root.lang = previous;
    };
  }, [locale]);

  const value = useMemo(() => {
    const language = getLanguage(locale);

    return {
      locale,
      language,
      languages: LANGUAGES,
      setLanguage,
      isDefault: locale === DEFAULT_LANGUAGE,
      /** t("nav.home") -> "Home" / "\u1293\u1270\u1295" */
      t: (path, values) => translate(locale, path, values),
    };
  }, [locale, setLanguage]);

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used inside <LanguageProvider>");
  }

  return context;
}

/**
 * Just the translate function. Saves a destructure at call sites that only
 * need strings.
 */
export function useTranslate() {
  return useLanguage().t;
}
