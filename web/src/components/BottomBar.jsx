import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  CalendarDays,
  CircleUser,
  Home,
  LayoutGrid,
  LogIn,
  Scissors,
  Sparkles,
  UserRound,
} from "lucide-react";

import LanguageSwitcher from "./LanguageSwitcher";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { useLanguage } from "../i18n/LanguageContext";

/**
 * Mobile-first bottom app bar (Telegram-style).
 *
 * Rendered only below the `lg` breakpoint:
 *   - Home · Services · [Book · FAB] · Barbers · Gallery
 *   - The centre item is a raised golden "Book" action.
 *   - The bar hides as you scroll down and slides back in when you
 *     scroll back up, so content stays unobstructed.
 *
 * A small tap-target overlay menu (opened from the "+ More" tab) gives
 * access to About + the staff console on small screens.
 */
export default function BottomBar() {
  const location = useLocation();
  const { t } = useLanguage();
  const { isAuthenticated } = useCustomerAuth();
  const [hidden, setHidden] = useState(false);
  const lastScroll = useRef(0);
  const [moreOpen, setMoreOpen] = useState(false);

  // Scroll direction: hide on the way down, reveal on the way up.
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastScroll.current;

      if (y > 90 && delta > 4) {
        setHidden(true);
      } else if (delta < -4 || y <= 90) {
        setHidden(false);
      }

      lastScroll.current = y;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the More sheet when navigating.
  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  // The staff console owns its layout.
  if (location.pathname.startsWith("/admin")) {
    return null;
  }

  const base =
    "flex flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 text-[10px] font-medium transition-colors";

  const tabClass = (active) =>
    `${base} ${active ? "text-white" : "text-white/45 active:text-white/80"}`;

  return (
    <nav
      className={`fixed inset-x-0 bottom-0 z-[55] lg:hidden ${
        hidden ? "translate-y-full" : "translate-y-0"
      } transition-transform duration-300 ease-out`}
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      <div
        className="mx-3 mb-3 flex items-end justify-between rounded-[1.6rem] border border-white/10 bg-[#0c0c0c]/92 px-2 py-2 shadow-[0_-10px_40px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
        style={{ boxShadow: "0 20px 50px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)" }}
      >
        {/* Home */}
        <NavLink to="/" end className={tabClass}>
          <Home size={20} strokeWidth={2} />
          <span>{t("nav.home")}</span>
        </NavLink>

        {/* Services */}
        <NavLink to="/services" className={tabClass}>
          <LayoutGrid size={20} strokeWidth={2} />
          <span>{t("nav.services")}</span>
        </NavLink>

        {/* Book — centre FAB */}
        <Link
          to="/booking"
          aria-label={t("nav.bookChair")}
          className="relative -mt-9 flex h-16 w-16 flex-col items-center justify-center rounded-full bg-[#f4c883] text-black shadow-[0_10px_30px_rgba(214,168,95,0.45)] transition active:scale-95"
        >
          <span className="pulse-ring absolute inset-0 rounded-full" />
          <Scissors size={20} strokeWidth={2.4} />
          <span className="mt-0.5 text-[9px] font-bold">{t("nav.bookChair")}</span>
        </Link>

        {/* Barbers */}
        <NavLink to="/barbers" className={tabClass}>
          <UserRound size={20} strokeWidth={2} />
          <span>{t("nav.barbers")}</span>
        </NavLink>

        {/* More (gallery + menu) */}
        <button
          type="button"
          onClick={() => setMoreOpen((value) => !value)}
          className={tabClass(false)}
        >
          <Sparkles size={20} strokeWidth={2} />
          <span>{t("nav.menu")}</span>
        </button>
      </div>

      {/* More sheet */}
      <div
        className={`absolute inset-x-3 bottom-[calc(100%+0.75rem)] overflow-hidden rounded-3xl border border-white/10 bg-[#0c0c0c]/95 backdrop-blur-2xl transition-all duration-300 ${
          moreOpen
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-3 opacity-0"
        }`}
      >
        <div className="grid grid-cols-2 gap-2 p-3">
          <NavLink
            to="/gallery"
            onClick={() => setMoreOpen(false)}
            className="flex items-center gap-3 rounded-2xl bg-white/[0.03] p-4 text-sm font-medium"
          >
            <LayoutGrid size={18}  />
            {t("nav.gallery")}
          </NavLink>

          <NavLink
            to="/haircuts"
            onClick={() => setMoreOpen(false)}
            className="flex items-center gap-3 rounded-2xl bg-white/[0.03] p-4 text-sm font-medium"
          >
            <Sparkles size={18} />
            {t("nav.haircuts")}
          </NavLink>

          <NavLink
            to="/#about"
            onClick={() => setMoreOpen(false)}
            className="flex items-center gap-3 rounded-2xl bg-white/[0.03] p-4 text-sm font-medium"
          >
            <CalendarDays size={18} />
            {t("nav.about")}
          </NavLink>

          <Link
            to="/admin"
            onClick={() => setMoreOpen(false)}
            className="flex items-center gap-3 rounded-2xl bg-white/[0.03] p-4 text-sm font-medium"
          >
            <UserRound size={18} />
            {t("nav.staff")}
          </Link>

          {/* Account entry point. A signed-in customer goes straight to
              their reviews; a visitor is sent to sign in. */}
          {isAuthenticated ? (
            <NavLink
              to="/account"
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-3 rounded-2xl bg-white/[0.03] p-4 text-sm font-medium"
            >
              <CircleUser size={18} />
              {t("account.title")}
            </NavLink>
          ) : (
            <NavLink
              to="/login"
              state={{ from: location.pathname }}
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-3 rounded-2xl bg-white/[0.03] p-4 text-sm font-medium"
            >
              <LogIn size={18} />
              {t("account.signInTitle")}
            </NavLink>
          )}
        </div>

        {/* Language — full width so the native names stay readable */}
        <div className="border-t border-white/10 p-3 pt-4">
          <p className="mb-2.5 px-1 text-[9px] uppercase tracking-[.28em] text-white/30">
            {t("common.language")}
          </p>

          <LanguageSwitcher variant="list" />
        </div>
      </div>

      {/* Dim overlay behind the More sheet */}
      {moreOpen && (
        <button
          type="button"
          aria-label={t("nav.closeMenu")}
          onClick={() => setMoreOpen(false)}
          className="fixed inset-0 z-[-1] bg-black/60"
        />
      )}
    </nav>
  );
}
