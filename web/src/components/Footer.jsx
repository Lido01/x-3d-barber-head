import { MapPin, Phone, Clock3, Send, Music2, Mail, CircleHelp } from "lucide-react";
import { Link } from "react-router-dom";

import { useLanguage } from "../i18n/LanguageContext";
import { studioLocation } from "../data/studioLocation";

/**
 * Shared public footer. Hidden on /admin/* routes (which have their own
 * sidebar) via useLocation.
 */
export default function Footer() {
  const { t } = useLanguage();

  // Deliberately a cheap check — the admin screen owns its layout.
  // The Navbar hides the same way.
  return (
    <footer className="border-t border-white/10 bg-[#070707] px-5 pb-28 pt-16 sm:px-8 lg:px-10 lg:pb-10">
      <div className="mx-auto grid gap-4 lg:grid-cols-[1.2fr_0.6fr_0.6fr_0.9fr]">
        <div>
          <Link to="/" className="inline-flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d6a85f] font-serif text-lg text-black">
              N
            </span>
            <span className="font-serif text-xl tracking-tight">NOIR</span>
          </Link>

          <p className="mt-5 max-w-sm text-sm leading-6 text-white/40">
            {t("footer.tagline")}
          </p>

          <div className="mt-6 flex gap-3">
            <a
              href="https://www.tiktok.com/"
              target="_blank"
              rel="noreferrer"
              aria-label="Follow NOIR on TikTok"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/50 transition hover:border-[#d6a85f] hover:text-[#d6a85f]"
            >
              <Music2 size={16} />
            </a>
            <a href="https://t.me/" target="_blank" rel="noreferrer" aria-label="Message NOIR on Telegram"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/50 transition hover:border-[#d6a85f] hover:text-[#d6a85f]"
            >
              <Send size={16} />
            </a>
            <a href="https://www.facebook.com/" target="_blank" rel="noreferrer" aria-label="Follow NOIR on Facebook" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-sm font-bold text-white/50 transition hover:border-[#d6a85f] hover:text-[#d6a85f]">f</a>
          </div>
        </div>

        <div className="justify-self-end">
          <p className="text-[10px] uppercase tracking-[.25em] text-white/30">
            {t("footer.visit")}
          </p>
          <ul className="mt-4 space-y-3 text-sm text-white/50">
            <li className="flex gap-2">
              <MapPin size={15} className="mt-0.5 shrink-0" />{" "}
              {studioLocation.addressLines.street}, {studioLocation.addressLines.city}
            </li>
            <li className="flex gap-2">
              <Clock3 size={15} className="mt-0.5 shrink-0" />{" "}
              {t("findUs.openDaily")}
            </li>
          </ul>
        </div>

        <div className="justify-self-end">
          <p className="text-[10px] uppercase tracking-[.25em] text-white/30">Need a hand?</p>
          <ul className="mt-4 space-y-3 text-sm text-white/50">
            <li><Link to="/help" className="flex items-center gap-2 transition hover:text-[#d6a85f]"><CircleHelp size={15} /> Help & FAQ</Link></li>
            <li><a href="tel:+251911000000" className="flex items-center gap-2 transition hover:text-[#d6a85f]"><Phone size={15} /> Call the studio</a></li>
            <li><a href="mailto:hello@noirbarbers.com" className="flex items-center gap-2 transition hover:text-[#d6a85f]"><Mail size={15} /> Email support</a></li>
          </ul>
        </div>
      </div>

      {/* Language on desktop, where the header switcher is out of reach. */}
      {/* <div className="mx-auto mt-12 hidden max-w-[1440px] lg:block">
        <p className="text-[10px] uppercase tracking-[.25em] text-white/30">
          {t("common.language")}
        </p>
        <div className="mt-3">
          <LanguageSwitcher variant="pills" />
        </div>
      </div> */}
    </footer>
  );
}
