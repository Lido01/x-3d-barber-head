import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { CircleUser, Scissors } from "lucide-react";

import Button from "./Button";
import LanguageSwitcher from "./LanguageSwitcher";
import {
  customerDisplayName,
  useCustomerAuth,
} from "../context/CustomerAuthContext";
import { useLanguage } from "../i18n/LanguageContext";

/**
 * Desktop top navigation (desktop-first apps keep a classic header).
 *
 * The mobile experience is handled by <BottomBar /> — a Telegram-style
 * bottom app bar — so this header only renders at the `lg` breakpoint
 * and up.
 */
export default function Navbar() {
  const location = useLocation();
  const { t } = useLanguage();
  const { isAuthenticated, account } = useCustomerAuth();
  const [scrolled, setScrolled] = useState(false);

  // Keyed off the translation function so the labels re-resolve on a
  // language change instead of freezing at first render.
  const links = [
    { label: t("nav.services"), to: "/services" },
    { label: t("nav.haircuts"), to: "/" },
    { label: t("nav.barbers"), to: "/barbers" },
    { label: t("nav.gallery"), to: "/gallery" },
    { label: "My bookings", to: "/bookings" },
    { label: "Help", to: "/help" },
    { label: t("nav.about"), to: "/#about" },
  ];

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    handleScroll();

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // The staff console has its own sidebar; hide the public nav there.
  if (location.pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <header
      className={`
        fixed
        inset-x-0
        top-0
        z-50
        hidden
        transition-all
        duration-500
        lg:block
        ${
          scrolled
            ? "border-b border-white/10 bg-[#090909]/85 shadow-2xl backdrop-blur-2xl"
            : "bg-transparent"
        }
      `}
    >
      <div className="mx-auto flex h-[78px] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-10">
        {/* Logo */}
        <Link to="/home" className="group flex items-center gap-3">
          <div className="relative flex h-16 w-14 items-center justify-center">
            <Scissors
              size={19}
              className="text-[#d6a85f] transition-transform duration-300 group-hover:rotate-[-12deg]"
            />
          </div>

          <div className="leading-none">
            <div className="font-serif text-lg font-bold tracking-[0.12em] text-white">
              NOIR
            </div>
          </div>
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden items-center gap-8 lg:flex xl:gap-10">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `
                relative
                py-2
                text-[13px]
                font-medium
                tracking-[0.08em]
                transition-colors
                ${
                  isActive
                    ? "text-white"
                    : "text-white/55 hover:text-white"
                }
              `
              }
            >
              {({ isActive }) => (
                <>
                  {link.label}

                  <span
                    className={`
                      absolute
                      -bottom-1
                      left-0
                      h-px
                      bg-[#d6a85f]
                      transition-all
                      duration-300
                      ${
                        isActive
                          ? "w-full"
                          : "w-0 group-hover:w-full"
                      }
                    `}
                  />
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden items-center gap-6 lg:flex">
          <LanguageSwitcher />

          {/* <Link
            to="/admin"
            className="text-[13px] font-medium tracking-[0.08em] text-white/40 transition hover:text-white"
          >
            {t("nav.staff")}
          </Link> */}

          {/* A signed-in customer gets their name and a way back to
              their reviews; a visitor gets a plain sign-in link. */}
          {isAuthenticated ? (
            <Link
              to="/account"
              title={customerDisplayName(account)}
              className="flex items-center gap-2 text-[13px] font-medium tracking-[0.08em] text-white/70 transition hover:text-white"
            >
              <CircleUser size={16} />
              <span className="max-w-32 truncate">
                {customerDisplayName(account)}
              </span>
            </Link>
          ) : (
            <Link
              to="/login"
              state={{ from: location.pathname }}
              className="text-[13px] font-medium tracking-[0.08em] text-white/40 transition hover:text-white"
            >
              {t("account.signInTitle")}
            </Link>
          )}

          <Button
            to="/booking"
            className="px-4 py-2.5"
            icon={false}
          >
            {t("nav.bookChair")}
          </Button>
        </div>
      </div>
    </header>
  );
}
