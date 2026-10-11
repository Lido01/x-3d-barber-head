import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

import Button from "../components/Button";
import { useLanguage } from "../i18n/LanguageContext";
import { mediaUrl } from "../services/api";
import {
  HERO_FADE_MS,
  HERO_ROTATE_MS,
  HERO_SLIDES,
} from "../data/heroSlides";

/**
 * The landing hero.
 *
 * ## The background
 *
 * One layer per entry in `data/heroSlides.js`, crossfaded by GSAP with a
 * slow zoom on the incoming frame so the picture is never completely
 * still. The images are configuration, not markup: see that file for why.
 *
 * Two decisions worth keeping:
 *
 *   - **`prefers-reduced-motion` stops the rotation.** The crossfade and
 *     the zoom are exactly the kind of ambient movement that setting asks
 *     to be turned off, and it costs one media query to honour. The first
 *     slide still renders, so the hero is not left bare.
 *   - **The rotation pauses on hover and on focus within the section.**
 *     Somebody reading the headline should not have a dissolve start
 *     underneath them, and a keyboard user tabbing through the CTAs
 *     should not have the text swapped out from under the focus ring.
 *
 * The headline entrance is separate from all of this and runs once.
 */

export default function Hero() {
  const intro = useRef(null);
  const [active, setActive] = useState(0);
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

  const rotate = HERO_SLIDES.length > 1;

  useEffect(() => {
    if (!rotate) {
      return undefined;
    }

    const query = window.matchMedia("(prefers-reduced-motion: reduce)");

    let timer = null;

    const start = () => {
      if (timer || query.matches) {
        return;
      }

      timer = window.setInterval(() => {
        setActive((current) => (current + 1) % HERO_SLIDES.length);
      }, HERO_ROTATE_MS);
    };

    const stop = () => {
      if (timer) {
        window.clearInterval(timer);
        timer = null;
      }
    };

    // Re-checked rather than read once: someone can turn the setting on
    // mid-session, and a rotation that keeps running after that is the
    // one case where honouring the preference actually has to be dynamic.
    const onChange = () => {
      if (query.matches) {
        stop();
      } else {
        start();
      }
    };

    const section = intro.current;

    /**
     * Focus moving *within* the section fires focusout too, so a plain
     * restart handler would reset the timer on every tab between the two
     * CTAs. `relatedTarget` is the element gaining focus, and only leaving
     * the section entirely counts.
     */
    const onFocusOut = (event) => {
      if (!section?.contains(event.relatedTarget)) {
        start();
      }
    };

    start();
    query.addEventListener("change", onChange);
    section?.addEventListener("mouseenter", stop);
    section?.addEventListener("focusin", stop);
    section?.addEventListener("mouseleave", start);
    section?.addEventListener("focusout", onFocusOut);

    return () => {
      stop();
      query.removeEventListener("change", onChange);
      section?.removeEventListener("mouseenter", stop);
      section?.removeEventListener("focusin", stop);
      section?.removeEventListener("mouseleave", start);
      section?.removeEventListener("focusout", onFocusOut);
    };
  }, [rotate]);

  // The dissolve itself. A separate effect so a manual dot tap and the
  // timer produce exactly the same animation - there is one code path, so
  // the picture cannot end up in a state only one of them can produce.
  useEffect(() => {
    if (!rotate) {
      return;
    }

    const layers = [...(intro.current?.querySelectorAll("[data-hero-slide]") || [])];
    const incoming = layers[active];

    if (!incoming) {
      return;
    }

    const others = layers.filter((layer) => layer !== incoming);
    const fade = HERO_FADE_MS / 1000;

    const ctx = gsap.context(() => {
      /*
       * Every other layer has to be faded out as well as the incoming one
       * in. Tying opacity to `index === 0` in the markup and only ever
       * animating the incoming frame leaves the previous slide sitting at
       * full opacity underneath it, so the crossfade achieves nothing.
       */
      gsap.to(others, { opacity: 0, duration: fade, ease: "power2.inOut" });

      gsap
        .timeline()
        .fromTo(
          incoming,
          { opacity: 0, scale: 1.08 },
          { opacity: 1, scale: 1, duration: fade, ease: "power2.inOut" }
        )
        // The slow drift, started once the dissolve has landed. `none` on
        // the ease so it never accelerates into the next cut.
        .fromTo(
          incoming,
          { scale: 1 },
          {
            scale: 1.06,
            duration: (HERO_ROTATE_MS + HERO_FADE_MS) / 1000,
            ease: "none",
          },
          fade
        );
    }, intro);

    return () => ctx.revert();
  }, [active, rotate]);

  return (
    <section
      ref={intro}
      className="relative flex min-h-[100svh] items-center overflow-hidden bg-[#0b0b0b] bg-cover bg-center bg-fixed"
    >
      {/* One layer per configured image. Absolutely stacked, the first
          one painted at full opacity so the hero is never a black box
          before the animation has run. */}
      {HERO_SLIDES.map((slide, index) => (
        <div
          key={slide.image}
          data-hero-slide={index}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-cover"
          style={{
            backgroundImage: `url("${mediaUrl(slide.image)}")`,
            backgroundPosition: slide.focus || "50% 50%",
            opacity: index === 0 ? 1 : 0,
          }}
        />
      ))}

      {/* dark cinematic overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/95 via-black/75 to-black/40" />
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/60 ${
          HERO_SLIDES[active]?.dark ? "opacity-90" : "opacity-100"
        }`}
      />

      {/* soft ambient glow */}
      <div className="pointer-events-none absolute right-[-10%] top-[10%] h-[420px] w-[420px]  bg-[#d6a85f]/10 blur-[140px]" />

      <div className="relative z-10 mx-auto w-full max-w-[1440px] px-5 pb-24 pt-32 sm:px-8 lg:px-10">
        <div className="max-w-3xl">
          {/* Eyebrow */}
          <div data-hero-fade className="mb-6 flex items-center gap-3"></div>
          {/* Heading */}
          <h3
            data-hero-fade
            className={`font-serif font-medium leading-[0.95] tracking-[-0.03em] text-[#f4f0e8] ${headlineSize}`}
          >
            {t("hero.titleLead")} <span className="italic shimmer-text">{t("hero.titleTail")}</span>
          </h3>

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

          {/* The slide dots. Only rendered when there is more than one
              image, so a single-photo hero does not carry a control that
              goes nowhere. */}
          {rotate && (
            <div
              data-hero-fade
              className="-ml-3 mt-6 flex items-center"
              role="tablist"
              aria-label="Background images"
            >
              {HERO_SLIDES.map((slide, index) => (
                <button
                  key={slide.image}
                  type="button"
                  role="tab"
                  aria-selected={index === active}
                  aria-label={`Background image ${index + 1}`}
                  onClick={() => setActive(index)}
                  /*
                   * A 6px bar is not a tap target. The button is a full
                   * 44px of thumb with the bar drawn inside it, so the dots
                   * still read as four thin lines but a finger can actually
                   * land on one.
                   */
                  className="flex h-11 min-w-8 cursor-pointer items-center justify-center"
                >
                  <span
                    className={`h-1.5  transition-all ${
                      index === active
                        ? "w-10 bg-[#d6a85f]"
                        : "w-5 bg-white/25 hover:bg-white/45"
                    }`}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}