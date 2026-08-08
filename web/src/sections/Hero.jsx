import {
  ArrowDown,
  CalendarDays,
  CirclePlay,
  Star,
} from "lucide-react";

import Button from "../components/Botton";

export default function Hero() {
  return (
    <section className="relative min-h-[100svh] overflow-hidden bg-[#090909]">
      {/* Ambient lighting */}
      <div className="pointer-events-none absolute left-[-15%] top-[10%] h-[500px] w-[500px] rounded-full bg-[#d6a85f]/[0.07] blur-[140px]" />

      <div className="pointer-events-none absolute bottom-[-20%] right-[-10%] h-[500px] w-[500px] rounded-full bg-white/[0.03] blur-[130px]" />

      {/* Background grid */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.045]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }}
        />
      </div>

      {/* Main content */}
      <div className="relative mx-auto flex min-h-[100svh] max-w-[1440px] items-center px-5 pb-10 pt-28 sm:px-8 lg:px-10">
        <div className="grid w-full items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-8">
          {/* Left */}
          <div className="relative z-10 max-w-2xl">
            {/* Eyebrow */}
            <div className="mb-6 flex items-center gap-3">
              <span className="h-px w-10 bg-[#d6a85f]" />

              <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-[#d6a85f] sm:text-xs">
                Premium Men's Grooming
              </span>
            </div>

            {/* Heading */}
            <h1 className="font-serif text-[clamp(4rem,9vw,8.5rem)] font-medium leading-[0.82] tracking-[-0.055em] text-[#f4f0e8]">
              YOUR
              <br />

              <span className="italic text-[#d6a85f]">
                STYLE.
              </span>
              <br />

              YOUR
              <br />

              IDENTITY.
            </h1>

            <p className="mt-8 max-w-lg text-base leading-7 text-white/50 sm:text-lg">
              A modern grooming studio built around precision,
              confidence, and the craft of the perfect cut.
            </p>

            {/* Buttons */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button to="/booking">
                Book Your Chair
              </Button>

              <Button
                to="/haircuts"
                variant="secondary"
              >
                Explore Haircuts
              </Button>
            </div>

            {/* Trust */}
            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-white/10 pt-6">
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5 text-[#d6a85f]">
                  <Star size={13} fill="currentColor" />
                  <Star size={13} fill="currentColor" />
                  <Star size={13} fill="currentColor" />
                  <Star size={13} fill="currentColor" />
                  <Star size={13} fill="currentColor" />
                </div>

                <span className="text-xs text-white/50">
                  4.9 / 5
                </span>
              </div>

              <div className="h-4 w-px bg-white/10" />

              <div className="flex items-center gap-2 text-xs text-white/50">
                <CalendarDays
                  size={14}
                  className="text-[#d6a85f]"
                />

                1,200+ cuts
              </div>

              <div className="h-4 w-px bg-white/10" />

              <div className="text-xs text-white/50">
                Addis Ababa
              </div>
            </div>
          </div>

          {/* Right visual */}
          <div className="relative mx-auto h-[520px] w-full max-w-[650px] lg:h-[700px]">
            {/* Large ring */}
            <div className="absolute left-1/2 top-1/2 h-[390px] w-[390px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.08] sm:h-[500px] sm:w-[500px]" />

            <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#d6a85f]/15 sm:h-[390px] sm:w-[390px]" />

            {/* Glow */}
            <div className="absolute left-1/2 top-1/2 h-[260px] w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#d6a85f]/10 blur-[100px]" />

            {/* Placeholder for 3D character */}
            <div className="absolute inset-x-10 bottom-0 top-8 overflow-hidden rounded-[45%_45%_18%_18%] border border-white/10 bg-gradient-to-b from-[#222] via-[#151515] to-[#0d0d0d] shadow-[0_40px_120px_rgba(0,0,0,0.7)]">
              {/* Fake cinematic silhouette */}
              <div className="absolute left-1/2 top-[12%] h-[270px] w-[210px] -translate-x-1/2 rounded-[45%_45%_38%_38%] bg-gradient-to-br from-[#3a3a3a] via-[#181818] to-[#080808] shadow-2xl sm:h-[360px] sm:w-[280px]" />

              {/* Hair */}
              <div className="absolute left-1/2 top-[8%] h-[110px] w-[230px] -translate-x-1/2 rounded-[50%_50%_35%_35%] bg-[#070707] shadow-[0_0_40px_rgba(0,0,0,0.9)] sm:h-[140px] sm:w-[300px]" />

              {/* Neck */}
              <div className="absolute bottom-[20%] left-1/2 h-[100px] w-[100px] -translate-x-1/2 rounded-b-3xl bg-[#242424]" />

              {/* Shirt */}
              <div className="absolute bottom-[-15%] left-1/2 h-[270px] w-[330px] -translate-x-1/2 rounded-[50%_50%_0_0] bg-[#111] sm:h-[330px] sm:w-[430px]" />

              {/* Highlight */}
              <div className="absolute left-[23%] top-[20%] h-[140px] w-[55px] rotate-[18deg] rounded-full bg-white/[0.06] blur-2xl" />

              {/* 3D coming soon label */}
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-black/50 px-4 py-2 text-[9px] uppercase tracking-[0.25em] text-white/50 backdrop-blur-md">
                3D Experience
              </div>
            </div>

            {/* Floating badge */}
            <div className="absolute left-0 top-[18%] hidden rounded-2xl border border-white/10 bg-[#111]/80 p-4 shadow-2xl backdrop-blur-xl sm:block">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d6a85f] text-black">
                  <ScissorsIcon />
                </div>

                <div>
                  <p className="text-[9px] uppercase tracking-[0.2em] text-white/40">
                    The craft
                  </p>

                  <p className="mt-1 text-sm font-semibold">
                    Precision Cut
                  </p>
                </div>
              </div>
            </div>

            {/* Floating review */}
            <div className="absolute bottom-[17%] right-0 hidden rounded-2xl border border-white/10 bg-[#111]/80 p-4 shadow-2xl backdrop-blur-xl sm:block">
              <div className="flex gap-0.5 text-[#d6a85f]">
                <Star size={12} fill="currentColor" />
                <Star size={12} fill="currentColor" />
                <Star size={12} fill="currentColor" />
                <Star size={12} fill="currentColor" />
                <Star size={12} fill="currentColor" />
              </div>

              <p className="mt-2 text-xs text-white/60">
                "The best fade in town."
              </p>

              <p className="mt-1 text-[9px] uppercase tracking-widest text-white/30">
                Daniel · Client
              </p>
            </div>

            {/* Play button */}
            <button className="absolute bottom-5 left-5 flex items-center gap-3 rounded-full border border-white/10 bg-black/60 px-4 py-2.5 backdrop-blur-xl transition hover:bg-white/10">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black">
                <CirclePlay size={15} fill="currentColor" />
              </span>

              <span className="text-[10px] uppercase tracking-[0.2em] text-white/70">
                Watch the craft
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-7 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 md:flex">
        <span className="text-[8px] uppercase tracking-[0.3em] text-white/30">
          Scroll to explore
        </span>

        <ArrowDown
          size={15}
          className="animate-bounce text-[#d6a85f]"
        />
      </div>
    </section>
  );
}

function ScissorsIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="m20 4-8.5 8.5M20 20l-8.5-8.5" />
    </svg>
  );
}