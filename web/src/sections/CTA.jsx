import { ArrowRight, Clock3, MapPin, Wallet } from "lucide-react";
import { Link } from "react-router-dom";

import Reveal from "../components/Reveal";

/**
 * Final full-width call-to-action band. Uses a layered gradient plus a
 * fine barber-stripe texture (pure CSS, no missing-image risk).
 */
export default function CTA() {
  return (
    <section className="relative overflow-hidden bg-[#d6a85f] text-[#090909]">
      {/* rich barber-stripe texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(-45deg, #090909 0 2px, transparent 2px 14px)",
        }}
      />

      <div className="relative mx-auto grid max-w-[1440px] gap-10 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:px-10">
        <Reveal>
          <p className="text-[10px] font-bold uppercase tracking-[.35em]">
            Your chair is waiting
          </p>
          <h2 className="mt-4 max-w-2xl font-serif text-5xl leading-[0.92] sm:text-6xl">
            Walk out looking
            <span className="italic"> the way you feel.</span>
          </h2>
          <p className="mt-5 max-w-md text-base leading-7 text-black/70">
            Reserve your spot in seconds and pay however suits you. We'll have
            the chair warm and the playlist right when you arrive.
          </p>
        </Reveal>

        <Reveal delay={140}>
          <div className="rounded-3xl border border-black/10 bg-[#090909] p-6 text-[#f4f0e8] sm:p-8">
            <div className="space-y-5 border-b border-white/10 pb-6 text-sm">
              <p className="flex items-center gap-3">
                <Clock3 size={17} className="text-[#d6a85f]" />
                Open daily · 09:00 — 21:00
              </p>
              <p className="flex items-center gap-3">
                <MapPin size={17} className="text-[#d6a85f]" />
                5th Floor, Bole Road, Addis Ababa
              </p>
              <p className="flex items-center gap-3">
                <Wallet size={17} className="text-[#d6a85f]" />
                Telebirr · Bank transfer · Cash
              </p>
            </div>

            <Link
              to="/booking"
              className="group mt-6 flex w-full items-center justify-center gap-3 rounded-full bg-[#d6a85f] px-6 py-4 text-sm font-semibold text-black transition hover:bg-[#e5bd7a]"
            >
              Book your chair
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-1"
              />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
