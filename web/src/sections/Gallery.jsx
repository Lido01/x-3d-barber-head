import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

import { useGallery } from "../hooks/useGallery";
import { useLanguage } from "../i18n/LanguageContext";
import { mediaUrl } from "../services/api";
import Alert from "../components/ui/Alert";
import Spinner from "../components/ui/Spinner";
import Reveal from "../components/Reveal";
import ParallaxSection from "../components/ParallaxSection";

/**
 * Image-backed "Recent work" band. The gallery backdrop stays fixed
 * while the cards and links scroll up and overlay it.
 *
 * Fed by GET /api/gallery/gallery/ — no mock data.
 */
export default function Gallery({ onSelect }) {
  const { posts, loading, error, reload } = useGallery();
  const { t } = useLanguage();

  return (
    <ParallaxSection
      id="gallery"
      image="/media/gallery/demo-soft-texture.jpg"
      overlay="from-black/95 via-black/70 to-black/95"
      contentClassName="py-10 sm:py-14"
    >
      <div className="flex flex-wrap items-end justify-between gap-6">
        <Reveal>
          <h2 className="mt-4 font-serif text-4xl sm:text-6xl">
            {t("gallery.titleLead")} <span className="italic text-[#d6a85f]">{t("gallery.titleAccent")}</span>
          </h2>
        </Reveal>

        <Reveal delay={120}>
          <Link
            to="/gallery"
            className="inline-flex items-center gap-2 text-xs uppercase tracking-[.2em] text-[#d6a85f] transition hover:text-[#e5bd7a]"
          >
            {t("gallery.viewAll")} <ArrowRight size={14} />
          </Link>
        </Reveal>
      </div>

      {loading && (
        <div className="mt-12 flex items-center justify-center  border border-white/10 bg-black/40 py-20 backdrop-blur-md">
          <Spinner label={t("gallery.loading")} />
        </div>
      )}

      {!loading && error && (
        <Alert
          tone="error"
          title={t("gallery.errorTitle")}
          details={error.fieldErrors}
          onRetry={reload}
          className="mt-12"
        >
          {error.message}
        </Alert>
      )}

      {!loading && !error && posts.length === 0 && (
        <Alert tone="info" title={t("gallery.emptyTitle")} className="mt-12">
          {t("gallery.emptyBody")}
        </Alert>
      )}

      {!loading && !error && posts.length > 0 && (
        <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {posts.map((post, index) => (
            <Reveal
              key={post.id}
              delay={index * 70}
              className={`group relative min-h-60 ${
                index === 0 || index === 3 ? "sm:col-span-2" : ""
              }`}
            >
              <button
                onClick={() => onSelect(post)}
                className="relative h-full w-full  overflow-hidden border border-white/10 text-left transition hover:border-[#d6a85f]/50"
              >
                <img
                  src={mediaUrl(post.image)}
                  alt={post.title}
                  className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    {/* <p className="text-[9px] uppercase tracking-[.2em] text-[#d6a85f]">
                      {post.style_name || t("gallery.recentWork")}
                    </p> */}
                    <p className="mt-1 truncate font-serif text-xl">{post.title}</p>
                  </div>
                  <ArrowUpRight className="mb-1 shrink-0 text-white/80" size={18} />
                </div>
              </button>
            </Reveal>
          ))}
        </div>
      )}
    </ParallaxSection>
  );
}
