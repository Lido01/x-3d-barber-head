import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Scissors } from "lucide-react";

import Button from "./Button";

const links = [
  { label: "Home", to: "/" },
  { label: "Services", to: "/services" },
  { label: "Haircuts", to: "/haircuts" },
  { label: "Barbers", to: "/barbers" },
  { label: "Gallery", to: "/gallery" },
  { label: "About", to: "/#about" },
];

/**
 * Desktop top navigation (desktop-first apps keep a classic header).
 *
 * The mobile experience is handled by <BottomBar /> — a Telegram-style
 * bottom app bar — so this header only renders at the `lg` breakpoint
 * and up.
 */
export default function Navbar() {
  const location = useLocation();
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
        <Link to="/" className="group flex items-center gap-3">
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
          <Link
            to="/admin"
            className="text-[13px] font-medium tracking-[0.08em] text-white/40 transition hover:text-white"
          >
            Staff
          </Link>

          <Button
            to="/booking"
            className="px-4 py-2.5"
            icon={false}
          >
            Book a Chair
          </Button>
        </div>
      </div>
    </header>
  );
}
