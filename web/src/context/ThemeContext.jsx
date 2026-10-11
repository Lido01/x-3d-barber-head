import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  applyThemePreference,
  onSystemThemeChange,
  readThemePreference,
  resolveTheme,
} from "../utils/theme";

/**
 * The console's light/dark preference.
 *
 * Exists as context rather than a bare read of the DOM because two things
 * need to agree about it: the toggle has to show what is selected, and
 * anything that renders an inline SVG or a chart needs to know the
 * resolved value to pick a colour that is not invisible. Reading
 * `document.documentElement` in each of those would work right up until
 * the first change, when one of them forgets to re-render.
 *
 * The attribute on <html> is still the source of truth for *styling* -
 * this only mirrors it so React can react.
 */

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(() => readThemePreference());
  const [resolved, setResolved] = useState(() =>
    resolveTheme(readThemePreference())
  );

  // Re-apply on mount. index.html already set the attribute before
  // first paint, so this cannot cause a flash - it only guarantees the
  // attribute matches storage in case the two ever disagree.
  useEffect(() => {
    applyThemePreference(preference);
    setResolved(resolveTheme(preference));
  }, [preference]);

  // While the preference is "auto", a system change has to move the UI
  // with it - someone flipping their phone to dark mode mid-shift should
  // not have to reload the console.
  useEffect(() => {
    if (preference !== "auto") {
      return undefined;
    }

    return onSystemThemeChange(() => {
      setResolved(resolveTheme("auto"));
    });
  }, [preference]);

  const setTheme = useCallback((next) => {
    setPreference(next);
  }, []);

  /** Flip between light and dark, resolving "auto" first. */
  const toggleTheme = useCallback(() => {
    setPreference((current) => {
      const active = resolveTheme(current);

      return active === "dark" ? "light" : "dark";
    });
  }, []);

  const value = useMemo(
    () => ({ preference, resolved, setTheme, toggleTheme }),
    [preference, resolved, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }

  return context;
}
