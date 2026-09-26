import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";

import { useLanguage } from "../i18n/LanguageContext";
import { LANGUAGE_SHORT } from "../i18n/languages";

/**
 * Language picker.
 *
 * Two shapes from one component:
 *   - "dropdown" (default) sits in the desktop header. Collapsed to a small
 *     pill showing the active language, expands on click.
 *   - "list" renders every language expanded, for the mobile bottom-bar sheet
 *     where a popover anchored to the bottom of the screen would be awkward.
 *
 * Deliberately one tap to open and one tap to choose — no hover menus, since
 * the same control has to work on a phone.
 */
export default function LanguageSwitcher({ variant = "dropdown", className = "" }) {
  const { locale, languages, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const active = languages.find((language) => language.code === locale);

  // Click outside and Escape both dismiss the popover.
  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event) => {
      if (root.current && !root.current.contains(event.target)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const choose = (code) => {
    setLanguage(code);
    setOpen(false);
  };

  if (variant === "list") {
    return (
      <ul className={`space-y-1.5 ${className}`} aria-label={t("common.changeLanguage")}>
        {languages.map((language) => {
          const selected = language.code === locale;

          return (
            <li key={language.code}>
              <button
                type="button"
                onClick={() => choose(language.code)}
                aria-current={selected}
                className={`flex w-full items-center justify-between gap-3 rounded-2xl p-4 text-left text-sm font-medium transition ${
                  selected
                    ? "bg-[#d6a85f] text-black"
                    : "bg-white/[0.03] text-white/70 hover:bg-white/[0.07] hover:text-white"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate">{language.native}</span>
                  {language.code !== "en" && (
                    <span
                      className={`mt-0.5 block text-[11px] ${
                        selected ? "text-black/60" : "text-white/35"
                      }`}
                    >
                      {language.english}
                    </span>
                  )}
                </span>

                {language.beta ? (
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.12em] ${
                      selected ? "bg-black/15 text-black/70" : "bg-[#d6a85f]/15 text-[#d6a85f]"
                    }`}
                  >
                    {t("common.beta")}
                  </span>
                ) : (
                  selected && <Check size={16} className="shrink-0" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div ref={root} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={t("common.changeLanguage")}
        className="flex items-center gap-2 rounded-full border border-white/12 px-3 py-2 text-[12px] font-medium tracking-[.06em] text-white/70 transition hover:border-[#d6a85f]/45 hover:text-white"
      >
        <Globe size={14} className="text-[#d6a85f]" />
        <span>{LANGUAGE_SHORT[active?.code] || active?.native}</span>
        <ChevronDown
          size={13}
          className={`text-white/40 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-50 mt-2 w-56 origin-top-right  border border-white/10 bg-[#0c0c0c]/97 p-1.5 shadow-[0_24px_60px_rgba(0,0,0,0.7)] backdrop-blur-2xl"
        >
          <p className="px-3 py-2 text-[9px] uppercase tracking-[.28em] text-white/30">
            {t("common.language")}
          </p>

          {languages.map((language) => {
            const selected = language.code === locale;

            return (
              <button
                key={language.code}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => choose(language.code)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                  selected
                    ? "bg-[#d6a85f] font-semibold text-black"
                    : "text-white/70 hover:bg-white/[0.07] hover:text-white"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate">{language.native}</span>
                  {language.code !== "en" && (
                    <span
                      className={`mt-0.5 block text-[10px] ${
                        selected ? "text-black/55" : "text-white/30"
                      }`}
                    >
                      {language.english}
                    </span>
                  )}
                </span>

                {language.beta ? (
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[.1em] ${
                      selected ? "bg-black/15 text-black/70" : "bg-[#d6a85f]/15 text-[#d6a85f]"
                    }`}
                  >
                    {t("common.beta")}
                  </span>
                ) : (
                  selected && <Check size={15} className="shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
