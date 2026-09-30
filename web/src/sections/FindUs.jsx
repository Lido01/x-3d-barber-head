import { useState } from "react";
import {
  Bike,
  Check,
  Clock3,
  Copy,
  ExternalLink,
  MapPin,
  Navigation,
} from "lucide-react";

import Reveal from "../components/Reveal";
import { useLanguage } from "../i18n/LanguageContext";
import {
  directionsUrl,
  openStreetMapEmbedUrl,
  openStreetMapLink,
  showOnGoogleMapsUrl,
  studioLocation,
} from "../data/studioLocation";

/**
 * "Find us" - an embedded OpenStreetMap plus real directions links.
 *
 * Why OSM for the map and Google for the routing: the OSM embed is a plain
 * iframe with no API key, so it cannot break on an expired key, a billing
 * problem or a quota. For actually getting a person there, Google Maps is what
 * people in Addis actually use, so that is the primary button.
 */
export default function FindUs() {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  const { addressLines } = studioLocation;
  const address = studioLocation.fullAddress;

  // Clipboard API needs a secure context; fall back to selecting nothing and
  // telling the user rather than throwing.
  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section
      id="find-us"
      className="relative overflow-hidden border-t border-white/10 px-5 py-20 sm:px-8 sm:py-24 lg:px-10"
    >
      <div className="pointer-events-none absolute right-[-10%] top-1/4 h-[380px] w-[380px] rounded-full bg-[#d6a85f]/[0.06] blur-[140px]" />

      <div className="relative mx-auto max-w-[1440px]">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
          {/* ---------- details ---------- */}
          <Reveal>
            <h2 className="mt-4 font-serif text-4xl leading-[1.05] sm:text-6xl">
              {t("findUs.titleLead")}
              <br />
              <span className="italic text-[#d6a85f]">
                {t("findUs.titleAccent")}
              </span>
            </h2>

            <p className="mt-5 max-w-md text-sm leading-7 text-white/55">
              {t("findUs.body")}
            </p>

            {/* Address + hours */}
            <div className="mt-8 space-y-3 border-t border-white/10 pt-6 text-sm text-white/70">
              <p className="flex gap-3">
                <MapPin size={17} className="mt-0.5 shrink-0" />
                <span>
                  {addressLines.building}
                  <br />
                  {addressLines.street}
                  <br />
                  {addressLines.city}
                </span>
              </p>

              <p className="flex gap-3">
                <Clock3 size={17} className="mt-0.5 shrink-0" />
                <span>
                  {t("findUs.openDaily")}
                </span>
              </p>
            </div>

            {/* Travel mode */}
            <div className="mt-8">
              <p className="text-[10px] uppercase tracking-[.25em] text-white/30">
                {t("findUs.getDirections")}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href={directionsUrl()}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-2 rounded-full bg-[#f3d29d] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#e5bd7a]"
                >
                  <Navigation size={15} />
                  {t("findUs.getDirections")}
                </a>

                <button
                  type="button"
                  onClick={copyAddress}
                  className="inline-flex items-center gap-2 border border-white/15 px-5 py-3 text-sm text-white/70 transition hover:border-[#d6a85f]/45 hover:text-white"
                >
                  {copied ? (
                    <>
                      <Check size={15} className="text-[#7fcfa4]" />
                      {t("findUs.copied")}
                    </>
                  ) : (
                    <>
                      <Copy size={15} />
                      {t("findUs.copyAddress")}
                    </>
                  )}
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-white/35">
                <a
                  href={showOnGoogleMapsUrl()}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 transition hover:text-[#d6a85f]"
                >
                  <ExternalLink size={12} />
                  {t("findUs.showOnMaps")}
                </a>

                <a
                  href={openStreetMapLink()}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 transition hover:text-[#d6a85f]"
                >
                  <Bike size={12} />
                  {t("findUs.openStreetMap")}
                </a>
              </div>
            </div>

          </Reveal>

          {/* ---------- map ---------- */}
          <Reveal delay={120}>
            <div className="relative">
              <div className="rounded-2xl overflow-hidden border border-white/10">
                <iframe
                  title={t("findUs.mapTitle")}
                  src={openStreetMapEmbedUrl()}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="block h-[420px] w-full sm:h-[520px] lg:h-[620px]"
                  style={{
                    // OSM ships a light map. Invert + rotate the hue back to
                    // land on a dark basemap that matches the site, then pull
                    // the contrast back so street labels stay readable.
                    filter:
                      "invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.88) saturate(0.7)",
                  }}
                />
              </div>

              {/* Attribution is required by the ODbL — keep it legible. */}
              <p className="mt-2 text-right text-[10px] text-white/25">
                {t("findUs.mapNote")}
              </p>

              {/* Pin card overlaid on the map */}
              <div className="pointer-events-none absolute left-4 top-4 max-w-[240px] border border-white/12 bg-[#0c0c0c]/92 p-4 backdrop-blur-xl sm:left-6 sm:top-6">
                <p className="font-serif text-lg leading-tight">
                  {studioLocation.name}
                </p>
                <p className="mt-1.5 text-[11px] leading-5 text-white/45">
                  {addressLines.building}
                  <br />
                  {addressLines.street}
                </p>
                <p className="mt-2.5 text-[10px] text-[#d6a85f]">
                  {t("findUs.openDaily")}
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
