import { Clock3, MapPin } from "lucide-react";

import Button from "../components/Button";
import Reveal from "../components/Reveal";
import ParallaxSection from "../components/ParallaxSection";
import { useLanguage } from "../i18n/LanguageContext";
import { studioLocation } from "../data/studioLocation";

export default function About() {
  const { t } = useLanguage();

  return (
    <ParallaxSection
      id="about"
      image="/media/barbers/lidetu-tesfaye.jpg"
      overlay="from-black/95 via-black/80 to-black/95"
      contentClassName="py-20 sm:py-24"
    >
      <div className="grid gap-12 lg:grid-cols-[1.1fr_.9fr] lg:gap-24">
        <Reveal>
          <h2 className="mt-5 max-w-3xl font-serif text-4xl leading-[1.05] sm:text-6xl">
            {t("about.titleLead")}{" "}
            <span className="italic text-[#d6a85f]">{t("about.titleAccent")}</span>
          </h2>
        </Reveal>

        <Reveal delay={120} className="">
          <div className="space-y-4 border-t border-white/15 pt-6 text-sm text-white/80">
            <p className="flex gap-3">
              <MapPin size={18} className="shrink-0" />{" "}
              <span>
                {studioLocation.addressLines.building}
                <br />
                {studioLocation.addressLines.street}, {studioLocation.addressLines.city}
              </span>
            </p>
            <p className="flex gap-3">
              <Clock3 size={18} className="shrink-0" />{" "}
              <span>{t("findUs.openDaily")}</span>
            </p>
          </div>

          <Button to="/booking" className="mt-10 bg-[rgb(234,208,167)] text-black hover:bg-[#e5bd7a]">
            {t("about.cta")}
          </Button>
        </Reveal>
      </div>
    </ParallaxSection>
  );
}
