import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

import { useGallery } from "../hooks/useGallery";
import { mediaUrl } from "../services/api";
import Alert from "../components/ui/Alert";
import Spinner from "../components/ui/Spinner";

/**
 * "Recent work" grid on the home page.
 *
 * Fed by GET /api/gallery/gallery/ — no mock data. Clicking a post
 * opens the detail modal via onSelect, or the customer can browse the
 * full gallery.
 */
export default function Gallery({ onSelect }) {
  const { posts, loading, error, reload } = useGallery();

  return (
    <section id="gallery" className="bg-[#090909] px-5 py-20 sm:px-8 sm:py-28 lg:px-10">
      <div className="mx-auto max-w-[1440px]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-[10px] uppercase tracking-[.35em] text-[#d6a85f]">
              Recent work
            </p>
            <h2 className="mt-4 font-serif text-5xl sm:text-6xl">
              The <span className="italic text-[#d6a85f]">gallery.</span>
            </h2>
            <p className="mt-5 max-w-xs text-sm leading-6 text-white/45">
              Real cuts from the chair — tap a look to explore the style and
              find the right booking time.
            </p>
          </div>

          <Link
            to="/gallery"
            className="inline-flex items-center gap-2 text-xs uppercase tracking-[.2em] text-[#d6a85f] transition hover:text-[#e5bd7a]"
          >
            View full gallery <ArrowRight size={14} />
          </Link>
        </div>

        {loading && (
          <div className="mt-12 flex items-center justify-center rounded-2xl border border-white/10 bg-[#111] py-20">
            <Spinner label="Loading the gallery..." />
          </div>
        )}

        {!loading && error && (
          <Alert
            tone="error"
            title="Could not load the gallery"
            details={error.fieldErrors}
            onRetry={reload}
            className="mt-12"
          >
            {error.message}
          </Alert>
        )}

        {!loading && !error && posts.length === 0 && (
          <Alert tone="info" title="Nothing here yet" className="mt-12">
            The shop hasn't shared any looks yet. Check back soon.
          </Alert>
        )}

        {!loading && !error && posts.length > 0 && (
          <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {posts.map((post, index) => (
              <button
                key={post.id}
                onClick={() => onSelect(post)}
                className={`group relative min-h-60 overflow-hidden border border-white/10 text-left transition hover:border-[#d6a85f]/50 ${
                  index === 0 || index === 3 ? "sm:col-span-2" : ""
                }`}
              >
                <img
                  src={mediaUrl(post.image)}
                  alt={post.title}
                  className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[9px] uppercase tracking-[.2em] text-[#d6a85f]">
                      {post.style_name || "Recent work"}
                    </p>
                    <p className="mt-1 truncate font-serif text-xl">{post.title}</p>
                  </div>
                  <ArrowUpRight className="mb-1 shrink-0 text-white/80" size={18} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
