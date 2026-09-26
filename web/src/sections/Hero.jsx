import { useEffect, useRef } from "react";
import { ArrowDown, CalendarDays, MapPin, Star } from "lucide-react";
import gsap from "gsap";

import Button from "../components/Button";
import { useLanguage } from "../i18n/LanguageContext";
import { mediaUrl } from "../services/api";

const BG = "/media/services/demo-skin-fade.jpg";

export default function Hero() {
  const intro = useRef(null);
  const { t, language } = useLanguage();

  // "YOUR IDENTITY." is two short Latin words. The Amharic and Oromo
  // equivalents are considerably longer, so they need a smaller clamp or the
  // headline overflows the viewport on a phone.
  const headlineSize =
    language.code === "en"
      ? "text-[clamp(4rem,9vw,8rem)]"
      : "text-[clamp(2.5rem,6.5vw,5.5rem)]";

  // Entrance: stagger the eyebrow, headline, copy, CTAs and trust bar.
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .fromTo(
          "[data-hero-fade]",
          { y: 40, opacity: 0 },
          { y: 0, opacity: 1, duration: 1, stagger: 0.13 }
        );
    }, intro);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={intro}
      className="relative flex min-h-[100svh] items-center overflow-hidden bg-cover bg-center bg-fixed"
      style={{ backgroundImage: `url("${mediaUrl(BG)}")` }}
    >
      {/* dark cinematic overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/95 via-black/75 to-black/40" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/60" />

      {/* soft ambient glow */}
      <div className="pointer-events-none absolute right-[-10%] top-[10%] h-[420px] w-[420px]  bg-[#d6a85f]/10 blur-[140px]" />

      <div className="relative z-10 mx-auto w-full max-w-[1440px] px-5 pb-24 pt-32 sm:px-8 lg:px-10">
        <div className="max-w-3xl">
          {/* Eyebrow */}
          <div data-hero-fade className="mb-6 flex items-center gap-3"></div>
          {/* Heading */}
          <h1
            data-hero-fade
            className={`font-serif font-medium leading-[0.95] tracking-[-0.03em] text-[#f4f0e8] ${headlineSize}`}
          >
            {t("hero.titleLead")} <span className="italic shimmer-text">{t("hero.titleTail")}</span>
          </h1>

          <p
            data-hero-fade
            className="mt-8 max-w-lg text-base leading-7 text-white/60 sm:text-lg"
          >
            {t("hero.body")}
          </p>

          {/* Buttons */}
          <div
            data-hero-fade
            className="mt-9 flex flex-col gap-3 sm:flex-row"
          >
            <Button to="/booking">{t("hero.primaryCta")}</Button>
            <Button to="/haircuts" variant="secondary" className="border-white/20 bg-black/30 backdrop-blur-sm hover:bg-black/50">
              {t("hero.secondaryCta")}
            </Button>
          </div>

          {/* Trust */}
          <div
            data-hero-fade
            className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-white/10 pt-6"
          >
            <div className="h-4 w-px bg-white/10" />

            <div className="flex items-center gap-2 text-xs text-white/50">
              <CalendarDays size={14} />
              {t("hero.openDaily")}
            </div>

            <div className="h-4 w-px bg-white/10" />

            <div className="flex items-center gap-2 text-xs text-white/50">
              <MapPin size={14} />
              {t("hero.city")}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
