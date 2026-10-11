import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Link } from "react-router-dom";

import Alert from "../components/ui/Alert";
import Spinner from "../components/ui/Spinner";
import { useGallery } from "../hooks/useGallery";
import { mediaUrl } from "../services/api";

/**
 * Full gallery — GET /api/gallery/gallery/.
 *
 * Every tile comes from the backend; clicking one opens a detail
 * modal with the post's style and description.
 */
export default function Gallery() {
  const { posts, loading, error, reload } = useGallery();
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    document.body.style.overflow = selected ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [selected]);

  return (
    <div className="min-h-screen bg-[#090909] px-5 pb-24 pt-28 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1440px]">

        <div className="mt-2 max-w-4xl">
          <h4 className="mt-5 font-serif text-6xl leading-[.85] sm:text-7xl lg:text-9xl">
            The
            <span className="italic text-[#d6a85f]"> gallery.</span>
          </h4>
        </div>

        {loading && (
          <div className="mt-8 flex items-center justify-center  border border-white/10 bg-[#111] py-24">
            <Spinner label="Loading the gallery..." />
          </div>
        )}

        {!loading && error && (
          <Alert
            tone="error"
            title="Could not load the gallery"
            details={error.fieldErrors}
            onRetry={reload}
            className="mt-14"
          >
            {error.message}
          </Alert>
        )}

        {!loading && !error && posts.length === 0 && (
          <Alert tone="info" title="Nothing here yet" className="mt-14">
            The shop hasn't shared any looks yet. Check back soon.
          </Alert>
        )}

        {!loading && !error && posts.length > 0 && (
          <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {posts.map((post) => (
              <button
                key={post.id}
                onClick={() => setSelected(post)}
                className="group relative h-80  overflow-hidden border border-white/10 bg-[#111] text-left transition hover:border-[#d6a85f]/50"
              >
                <img
                  src={mediaUrl(post.image)}
                  alt={post.title}
                  className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                <div className="absolute inset-x-5 bottom-5">
                  <p className="text-[9px] uppercase tracking-[.25em] text-[#d6a85f]">
                    {post.style_name || "Recent work"}
                  </p>
                  <p className="mt-1.5 font-serif text-2xl">{post.title}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && <PostModal post={selected} close={() => setSelected(null)} />}
    </div>
  );
}

function PostModal({ post, close }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-end bg-black/80 p-3 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6"
      onMouseDown={close}
    >
      <article
        className="relative max-h-[92svh] w-full max-w-3xl overflow-auto  border border-white/15 bg-[#121212] sm:grid sm:grid-cols-2"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          onClick={close}
          aria-label="Close details"
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center border border-white/10 bg-black/60 text-white backdrop-blur hover:bg-[#d6a85f] hover:text-black"
        >
          <X size={18} />
        </button>

        <img
          src={mediaUrl(post.image)}
          alt={post.title}
          className="h-64 w-full object-cover sm:h-full sm:min-h-[440px]"
        />

        <div className="p-7 sm:p-9">
          <p className="text-[10px] uppercase tracking-[.3em] text-[#d6a85f]">
            {post.style_name || "Recent work"}
          </p>
          <h2 className="mt-4 font-serif text-5xl leading-none">{post.title}</h2>
          <p className="mt-6 text-sm leading-7 text-white/55">
            {post.description || "Fresh from the chair at NOIR Barber Studio."}
          </p>
          <div className="mt-8 border-t border-white/10 pt-6">
            <p className="text-[10px] uppercase tracking-[.25em] text-white/35">
              Shot at NOIR
            </p>
            <p className="mt-2 font-serif text-2xl text-[#d6a85f]">
              {post.style_name || "Signature cut"}
            </p>
          </div>
          <Link
            to={post.service ? `/booking?service=${post.service}` : "/booking"}
            onClick={close}
            className="mt-8 block bg-[#d6a85f] px-5 py-3 text-center text-sm font-semibold text-black transition hover:bg-[#e5bd7a]"
          >
            Book this look
          </Link>
        </div>
      </article>
    </div>
  );
}
