import { HandCoins, CalendarClock, Scissors, Timer } from "lucide-react";
import { Link } from "react-router-dom";

import Reveal from "../components/Reveal";
import ParallaxSection from "../components/ParallaxSection";
import { useServices } from "../hooks/useServices";
import { formatPrice } from "../utils/format";
import { mediaUrl } from "../services/api";

const STEPS = [
  {
    icon: Scissors,
    title: "Pick your service",
    body: "Choose from fades, cuts, beard sculpts and more — each adds its own clear time and price.",
  },
  {
    icon: CalendarClock,
    title: "Pick a time slot",
    body: "Live availability from the shop. You only see free slots for the day you want.",
  },
  {
    icon: HandCoins,
    title: "Pay in seconds",
    body: "Check out by Telebirr or bank transfer right away. No account, no waiting.",
  },
];

/**
 * Image-backed "book in under a minute" band. The fixed barber-at-work
 * image stays put while this content scrolls up and overlays it.
 */
export default function QuickBook() {
  const { services } = useServices();

  return (
    <ParallaxSection
      image="/media/haircut_styles/megan-bagshaw-YmaaUNbHHtw-unsplash.jpg"
      overlay="from-black/95 via-black/75 to-black/95"
      contentClassName="py-20 sm:py-24"
    >
      <Reveal className="max-w-2xl">
        <h2 className="mt-4 font-serif text-5xl leading-[0.9] sm:text-6xl">
          Choose. Book.
          <br />
          <span className="italic text-[#eece9b]">Done in minutes.</span>
        </h2>
        <p className="mt-5 max-w-md text-sm leading-7 text-white/60">
          From picking a service to paying, the whole thing takes less time
          than a coffee. Here's how it works.
        </p>
      </Reveal>

      {/* steps */}
      <div className="mt-12 grid sm:grid-cols-3">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          return (
            <Reveal
              key={step.title}
              delay={index * 110}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black/45 p-7 backdrop-blur-md transition hover:border-[#d6a85f]/40"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#d6a85f]/15 text-[#d6a85f] transition group-hover:bg-[#d6a85f] group-hover:text-black">
                <Icon size={22} />
              </div>
              <p className="mt-6 font-serif text-2xl">{step.title}</p>
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
            Popular right now
          </div>

          <div className="no-scrollbar mt-5 flex snap-x gap-4 overflow-x-auto pb-2">
            {services.map((service) => (
              <Link
                key={service.id}
                to={`/booking?service=${service.id}`}
                className="group flex min-w-[240px] snap-start flex-col overflow-hidden  border border-white/10 bg-black/50 backdrop-blur-md transition hover:border-[#d6a85f]/45"
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
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center  border border-white/10 text-white/50 transition group-hover:bg-[#d6a85f] group-hover:text-black">
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
