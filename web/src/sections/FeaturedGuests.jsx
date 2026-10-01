import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, BadgeCheck, Camera, Quote } from "lucide-react";

import Reveal from "../components/Reveal";
import { useLanguage } from "../i18n/LanguageContext";
import { featuredGuests, guestStats } from "../data/featuredGuests";

/**
 * "The chair they sit in" — a wall of guest cards.
 *
 * Deliberately a static data section rather than an API feed: the seeded
 * testimonials in sections/Testimonials.jsx still come from the backend and
 * still carry whatever customers actually type. This is editorial space for
 * the people the shop wants to shout about.
 *
 * Personas here are fictional sample content — see the header of
 * data/featuredGuests.js before replacing anything.
 */
export default function FeaturedGuests() {
  const { t, locale } = useLanguage();
  const [active, setActive] = useState(featuredGuests[0]?.id);

  const activeGuest =
    featuredGuests.find((guest) => guest.id === active) || featuredGuests[0];

  return (
    <section
      id="guests"
      className="relative overflow-hidden px-5 py-20 sm:px-8 sm:py-24 lg:px-10"
    >
      {/* soft gold wash so the section separates from the black page */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-[#d6a85f]/[0.07] blur-[150px]" />

      <div className="relative mx-auto max-w-[1440px]">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          {/* ---------- intro ---------- */}
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <p className="text-[10px] uppercase tracking-[.35em] text-[#d6a85f]">
              {t("guests.eyebrow")}
            </p>

            <h2 className="mt-4 font-serif text-4xl leading-[1.05] sm:text-6xl">
              {t("guests.titleLead")}
              <br />
              <span className="italic text-[#d6a85f]">
                {t("guests.titleAccent")}
              </span>
            </h2>

            <p className="mt-5 max-w-md text-sm leading-7 text-white/55">
              {t("guests.body")}
            </p>

            {/* ---------- stats ---------- */}
            <dl className="mt-10 grid grid-cols-2 gap-px rounded-2xl overflow-hidden border border-white/10 bg-white/[0.04] sm:grid-cols-4">
              {guestStats.map((stat) => (
                <div key={stat.id} className="bg-[#0b0b0b] p-5">
                  <dt className="text-[9px] uppercase leading-4 tracking-[.18em] text-white/35">
                    {t(stat.labelKey)}
                  </dt>
                  <dd className="mt-2 font-serif text-3xl text-[#d6a85f]">
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="sr-only">{t("guests.statsLabel")}</p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/gallery"
                className="inline-flex items-center gap-2 rounded-full bg-[#d6a85f] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#e5bd7a]"
              >
                <Camera size={15} />
                {t("guests.viewGallery")}
              </Link>

              <Link
                to="/booking"
                className="inline-flex items-center gap-2 border border-white/15 px-5 py-3 text-sm text-white/70 transition hover:border-[#d6a85f]/45 hover:text-white"
              >
                {t("guests.bookSameSlot")}
                <ArrowUpRight size={15} />
              </Link>
            </div>
          </Reveal>

          {/* ---------- the wall ---------- */}
          <div>
            {/* Big quote for the selected guest */}
            {activeGuest && (
              <Reveal>
                <figure
                  className="relative rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent p-7 sm:p-9"
                  style={{ borderTopColor: activeGuest.accent }}
                >
                  <Quote
                    size={40}
                    className="absolute right-7 top-7 opacity-10"
                    style={{ color: activeGuest.accent }}
                  />

                  <p className="max-w-2xl font-serif text-2xl leading-[1.4] text-white/90 sm:text-[28px]">
                    “{activeGuest.quote[locale] || activeGuest.quote.en}”
                  </p>

                  <figcaption className="mt-7 flex flex-wrap items-center gap-4 border-t border-white/10 pt-6">
                    <img
                      src={activeGuest.portrait}
                      alt=""
                      width={52}
                      height={52}
                      loading="lazy"
                      decoding="async"
                      className="h-13 w-13 shrink-0 rounded-2xl border object-cover"
                      style={{ borderColor: activeGuest.accent }}
                    />

                    <div className="min-w-0">
                      <p className="font-semibold">{activeGuest.name}</p>
                      <p className="mt-0.5 text-xs text-white/40">
                        {activeGuest.field} · {activeGuest.handle}
                      </p>
                    </div>

                    <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[#5fb98a]/30 bg-[#5fb98a]/10 px-2.5 py-1 text-[10px] font-medium tracking-wide text-[#7fcfa4]">
                      <BadgeCheck size={12} />
                      {t("guests.verified")}
                    </span>
                  </figcaption>
                </figure>
              </Reveal>
            )}

            {/* Selectable strip */}
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {featuredGuests.map((guest, index) => {
                const selected = guest.id === activeGuest?.id;

                return (
                  <Reveal key={guest.id} delay={index * 70}>
                    <button
                      type="button"
                      onClick={() => setActive(guest.id)}
                      aria-pressed={selected}
                      className={`group flex w-full items-center gap-3 border p-3 text-left transition ${
                        selected
                          ? "bg-white/[0.06]"
                          : "border-white/10 hover:border-white/25"
                      }`}
                      style={{
                        borderColor: selected
                          ? `${guest.accent}66`
                          : undefined,
                      }}
                    >
                      <img
                        src={guest.portrait}
                        alt=""
                        width={44}
                        height={44}
                        loading="lazy"
                        decoding="async"
                        className="h-11 w-11 shrink-0 rounded-xl border border-white/10 object-cover"
                      />

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {guest.name}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-white/40">
                          {guest.field}
                        </span>
                      </span>

                      {selected && (
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: guest.accent }}
                        />
                      )}
                    </button>
                  </Reveal>
                );
              })}
            </div>

            {/* Honesty note. Small, but it should not be hidden. */}
            <p className="mt-6 flex items-start gap-2 text-[11px] leading-5 text-white/30">
              <span aria-hidden="true">*</span>
              {t("guests.sampleNotice")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
