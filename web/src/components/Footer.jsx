import { AtSign, MapPin, Phone, Clock3 } from "lucide-react";
import { Link } from "react-router-dom";

import Button from "./Button";

/**
 * Shared public footer. Hidden on /admin/* routes (which have their own
 * sidebar) via useLocation.
 */
export default function Footer() {
  // Deliberately a cheap check — the admin screen owns its layout.
  // The Navbar hides the same way.
  return (
    <footer className="border-t border-white/10 bg-[#070707] px-5 pb-28 pt-16 sm:px-8 lg:px-10 lg:pb-10">
      <div className="mx-auto grid max-w-[1440px] gap-12 lg:grid-cols-[1.2fr_0.6fr_0.6fr_0.9fr]">
        <div>
          <Link to="/" className="inline-flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d6a85f] font-serif text-lg text-black">
              N
            </span>
            <span className="font-serif text-xl tracking-tight">NOIR</span>
          </Link>

          <p className="mt-5 max-w-sm text-sm leading-6 text-white/40">
            A modern Addis Ababa grooming studio where classic barbering meets
            personal style.
          </p>

          <div className="mt-6 flex gap-3">
            <button
              aria-label="Social"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/50 transition hover:border-[#d6a85f] hover:text-[#d6a85f]"
            >
              <AtSign size={16} />
            </button>
            <button
              aria-label="Phone"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/50 transition hover:border-[#d6a85f] hover:text-[#d6a85f]"
            >
              <Phone size={16} />
            </button>
          </div>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-[.25em] text-white/30">
            Explore
          </p>
          <ul className="mt-4 space-y-3 text-sm text-white/50">
            <li><Link className="transition hover:text-white" to="/services">Services</Link></li>
            <li><Link className="transition hover:text-white" to="/haircuts">Haircuts</Link></li>
            <li><Link className="transition hover:text-white" to="/barbers">Barbers</Link></li>
            <li><Link className="transition hover:text-white" to="/gallery">Gallery</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-[.25em] text-white/30">
            Visit
          </p>
          <ul className="mt-4 space-y-3 text-sm text-white/50">
            <li className="flex gap-2"><MapPin size={15} className="mt-0.5 shrink-0 text-[#d6a85f]" /> Bole Road, Addis Ababa</li>
            <li className="flex gap-2"><Clock3 size={15} className="mt-0.5 shrink-0 text-[#d6a85f]" /> Daily 09:00 — 21:00</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <p className="font-serif text-xl">Ready for a fresh look?</p>
          <p className="mt-2 text-sm text-white/40">
            Book your chair online in under a minute.
          </p>
          <Button to="/booking" className="mt-4 w-full py-3">
            Book now
          </Button>
        </div>
      </div>

      <div className="mx-auto mt-14 flex max-w-[1440px] flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-white/30 sm:flex-row">
        <p>© {new Date().getFullYear()} NOIR Barber Studio. All rights reserved.</p>
        <p>Made for the craft of the cut.</p>
      </div>
    </footer>
  );
}
