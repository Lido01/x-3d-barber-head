import { HandCoins, CalendarClock, Scissors, Timer } from "lucide-react";
import { Link } from "react-router-dom";

import Reveal from "../components/Reveal";
import ParallaxSection from "../components/ParallaxSection";
import { useServices } from "../hooks/useServices";
import { useLanguage } from "../i18n/LanguageContext";
import { formatPrice } from "../utils/format";
import { mediaUrl } from "../services/api";

/**
 * Image-backed "book in under a minute" band. The fixed barber-at-work
 * image stays put while this content scrolls up and overlays it.
 */
export default function QuickBook() {
  const { services } = useServices();
  const { t } = useLanguage();

  // Icons stay in code because they are components, not copy.
  const steps = [
    { icon: Scissors, title: t("quickBook.steps.service.title"), body: t("quickBook.steps.service.body") },
    { icon: CalendarClock, title: t("quickBook.steps.slot.title"), body: t("quickBook.steps.slot.body") },
    { icon: HandCoins, title: t("quickBook.steps.pay.title"), body: t("quickBook.steps.pay.body") },
  ];

  return (
    <ParallaxSection
      image="/media/services/demo-signature-haircut.jpg"
      overlay="from-black/95 via-black/75 to-black/95"
      contentClassName="py-20 sm:py-24"
    >
      <Reveal className="max-w-2xl">
        <h2 className="mt-4 font-serif text-4xl leading-[1.05] sm:text-6xl">
          {t("quickBook.titleLead")}
          <br />
          <span className="italic text-[#eece9b]">{t("quickBook.titleAccent")}</span>
        </h2>
      </Reveal>

      {/* steps */}
      <div className="mt-12 grid sm:grid-cols-3">
        {steps.map((step, index) => {
          const Icon = step.icon;

          return (
            <Reveal
              key={step.title}
              delay={index * 110}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black/45 p-7 backdrop-blur-md transition hover:border-[#d6a85f]/40"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
                <Icon
                  size={18}
                  className="text-[#d6a85f]"
                />
              </span>

              <p className="mt-6 font-serif text-2xl leading-tight">{step.title}</p>
              <p className="mt-3 text-sm leading-6 text-white/55">{step.body}</p>
            </Reveal>
          );
        })}
      </div>

      {/* quick service chips */}
      {services.length > 0 && (
        <Reveal className="mt-14">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[.3em] text-white/40">
            <Timer size={13} className="text-[#d6a85f]" />
            {t("quickBook.popularNow")}
          </div>

          <div className="no-scrollbar mt-5 flex snap-x gap-4 overflow-x-auto pb-2">
            {services.map((service) => (
              <Link
                key={service.id}
                to={`/booking?service=${service.id}`}
                className="group flex min-w-[240px] snap-start flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/50 backdrop-blur-md transition hover:border-[#d6a85f]/45"
              >
                {service.image ? (
                  <div className="relative h-32 overflow-hidden">
                    <img
                      src={mediaUrl(service.image)}
                      alt={service.name}
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  </div>
                ) : (
                  <div className="flex h-32 items-center justify-center bg-gradient-to-br from-[#1c1410] to-[#0d0d0d]">
                    <Scissors size={30} className="text-[#d6a85f]/40" />
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{service.name}</p>
                    <p className="mt-1 text-xs text-[#d6a85f]">
                      {formatPrice(service.price)}
                    </p>
                  </div>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/50 transition group-hover:bg-[#d6a85f] group-hover:text-black">
                    →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </Reveal>
      )}
    </ParallaxSection>
  );
}
