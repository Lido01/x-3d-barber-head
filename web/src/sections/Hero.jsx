import { useEffect, useRef } from "react";
import { ArrowDown, CalendarDays, MapPin, Star } from "lucide-react";
import gsap from "gsap";

import Button from "../components/Button";
import { mediaUrl } from "../services/api";

const BG = "/media/services/barber-images.jpeg";

export default function Hero() {
  const intro = useRef(null);

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
      <div className="pointer-events-none absolute right-[-10%] top-[10%] h-[420px] w-[420px] rounded-full bg-[#d6a85f]/10 blur-[140px]" />

      <div className="relative z-10 mx-auto w-full max-w-[1440px] px-5 pb-24 pt-32 sm:px-8 lg:px-10">
        <div className="max-w-3xl">
          {/* Eyebrow */}
          <div data-hero-fade className="mb-6 flex items-center gap-3"></div>
          {/* Heading */}
          <h1
            data-hero-fade
            className="font-serif text-[clamp(4rem,9vw,8rem)] font-medium leading-[0.85] tracking-[-0.055em] text-[#f4f0e8]"
          >
            YOUR <span className="italic shimmer-text"> STYLE.</span>
            <br />
            YOUR IDENTITY.
          </h1>

          <p
            data-hero-fade
            className="mt-8 max-w-lg text-base leading-7 text-white/60 sm:text-lg"
          >
            A modern grooming studio built around precision, confidence, and
            the craft of the perfect cut.
          </p>

          {/* Buttons */}
          <div
            data-hero-fade
            className="mt-9 flex flex-col gap-3 sm:flex-row"
          >
            <Button to="/booking">Book Your Chair</Button>
            <Button to="/haircuts" variant="secondary" className="border-white/20 bg-black/30 backdrop-blur-sm hover:bg-black/50">
              Explore Haircuts
            </Button>
          </div>

          {/* Trust */}
          <div
            data-hero-fade
            className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-white/10 pt-6"
          >
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5 text-[#d6a85f]">
                <Star size={13} fill="currentColor" />
                <Star size={13} fill="currentColor" />
                <Star size={13} fill="currentColor" />
                <Star size={13} fill="currentColor" />
                <Star size={13} fill="currentColor" />
              </div>
              <span className="text-xs text-white/50">4.9 / 5</span>
            </div>

            <div className="h-4 w-px bg-white/10" />

            <div className="flex items-center gap-2 text-xs text-white/50">
              <CalendarDays size={14} className="text-[#d6a85f]" />
              1,200+ cuts
            </div>

            <div className="h-4 w-px bg-white/10" />

            <div className="flex items-center gap-2 text-xs text-white/50">
              <MapPin size={14} className="text-[#d6a85f]" />
              Addis Ababa
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-7 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 md:flex">
        <span className="text-[8px] uppercase tracking-[0.3em] text-white/40">
          Scroll to explore
        </span>
        <ArrowDown size={15} className="animate-bounce text-[#d6a85f]" />
      </div>
    </section>
  );
}
