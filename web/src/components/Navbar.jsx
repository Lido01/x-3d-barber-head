import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import {
  CalendarDays,
  Menu,
  Scissors,
  X,
} from "lucide-react";

import Button from "./Button";

const links = [
  {
    label: "Home",
    to: "/",
  },
  {
    label: "Services",
    to: "/services",
  },
  {
    label: "Haircuts",
    to: "/haircuts",
  },
  {
    label: "Barbers",
    to: "/barbers",
  },
  {
    label: "Gallery",
    to: "/#gallery",
  },
  {
    label: "About",
    to: "/#about",
  },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

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

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const closeMenu = () => {
    setMobileOpen(false);
  };

  return (
    <>
      <header
        className={`
          fixed
          inset-x-0
          top-0
          z-50
          transition-all
          duration-500
          ${
            scrolled
              ? "border-b border-white/10 bg-[#090909]/85 shadow-2xl backdrop-blur-2xl"
              : "bg-transparent"
          }
        `}
      >
        <div className="mx-auto flex h-[78px] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-10">
          {/* Logo */}
          <Link
            to="/"
            onClick={closeMenu}
            className="group flex items-center gap-3"
          >
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

              <div className="mt-1 text-[8px] font-medium tracking-[0.32em] text-[#d6a85f]">
                BARBER STUDIO
              </div>
            </div>
          </Link>

          {/* Desktop navigation */}
          <nav className="hidden items-center gap-8 lg:flex">
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
          <div className="hidden lg:block">
            <Button
              to="/booking"
              className="px-4 py-2.5"
              icon={false}
            >
              Book a Chair
            </Button>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen((value) => !value)}
            aria-label="Toggle navigation"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white lg:hidden"
          >
            {mobileOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </header>

      {/* Mobile navigation */}
      <div
        className={`
          fixed
          inset-0
          z-40
          bg-[#090909]
          transition-all
          duration-500
          lg:hidden
          ${
            mobileOpen
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0"
          }
        `}
      >
        <div className="flex min-h-full flex-col px-6 pb-8 pt-28 sm:px-10">
          <div className="mb-8 border-b border-white/10 pb-6">
            <p className="text-xs uppercase tracking-[0.3em] text-[#d6a85f]">
              Premium Men's Grooming
            </p>

            <h2 className="mt-4 max-w-md font-serif text-4xl leading-[0.95] text-white sm:text-5xl">
              Your style.
              <br />
              Your identity.
            </h2>
          </div>

          <nav className="flex flex-col">
            {links.map((link, index) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={closeMenu}
                className={({ isActive }) =>
                  `
                  flex items-center justify-between
                  border-b border-white/10
                  py-5
                  text-2xl
                  font-medium
                  transition-colors
                  ${
                    isActive
                      ? "text-[#d6a85f]"
                      : "text-white/75 hover:text-white"
                  }
                `
                }
              >
                <span>0{index + 1}</span>
                <span>{link.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto">
            <Button
              to="/booking"
              onClick={closeMenu}
              className="w-full"
            >
              Book Your Chair
            </Button>

            <div className="mt-5 flex items-center gap-2 text-sm text-white/40">
              <CalendarDays size={15} />
              <span>Open today · 09:00 — 21:00</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
