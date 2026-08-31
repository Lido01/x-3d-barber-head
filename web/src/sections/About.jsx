import { Clock3, MapPin, Sparkles } from "lucide-react";

import Button from "../components/Button";
import Reveal from "../components/Reveal";
import ParallaxSection from "../components/ParallaxSection";

export default function About() {
  return (
    <ParallaxSection
      id="about"
      image="/media/services/lidetu-profile.png"
      overlay="from-black/95 via-black/80 to-black/95"
      contentClassName="py-20 sm:py-24"
    >
      <div className="grid gap-12 lg:grid-cols-[1.1fr_.9fr] lg:gap-24">
        <Reveal>
          <p className="text-[10px] font-bold uppercase tracking-[.35em] text-[#d6a85f]">
            About noir
          </p>
          <h2 className="mt-5 max-w-3xl font-serif text-5xl leading-[.95] sm:text-7xl">
            A chair made for your <span className="italic text-[#d6a85f]">next chapter.</span>
          </h2>
        </Reveal>

        <Reveal delay={120} className="lg:pt-10">
          <p className="max-w-md text-base leading-7 text-white/70">
            NOIR is a modern Addis Ababa grooming studio where classic barbering
            meets personal style. Every appointment begins with a conversation
            and ends with a look that feels unmistakably yours.
          </p>

          <div className="mt-9 space-y-4 border-t border-white/15 pt-6 text-sm text-white/80">
            <p className="flex gap-3">
              <MapPin size={18} className="text-[#d6a85f]" /> <span>5th Floor, Bole Road, Addis Ababa</span>
            </p>
            <p className="flex gap-3">
              <Clock3 size={18} className="text-[#d6a85f]" /> <span>Open daily, 09:00 — 21:00</span>
            </p>
            <p className="flex gap-3">
              <Sparkles size={18} className="text-[#d6a85f]" /> <span>Walk-ins welcome when chairs are free</span>
            </p>
          </div>

          <Button to="/booking" className="mt-10 bg-[#d6a85f] text-black hover:bg-[#e5bd7a]">
            Reserve your chair
          </Button>
        </Reveal>
      </div>
    </ParallaxSection>
  );
}
