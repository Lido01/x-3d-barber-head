import { useEffect, useState } from "react";
import { Clock3, Scissors, X } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import Alert from "../components/ui/Alert";
import Spinner from "../components/ui/Spinner";
import { getService } from "../services/servicesApi";
import { mediaUrl } from "../services/api";
import { formatDuration, formatPrice } from "../utils/format";

/**
 * Single service details — GET /api/services/{id}/.
 *
 * The "click to view" destination for a haircut. Shows the service's
 * full description, its haircut styles, pricing and a direct booking
 * action.
 */
export default function ServiceDetail() {
  const { id } = useParams();

  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedStyle, setSelectedStyle] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    getService(id, { signal: controller.signal })
      .then((data) => {
        setService(data);
        setLoading(false);
      })
      .catch((apiError) => {
        if (apiError?.isCancelled) {
          return;
        }

        setError(apiError);
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [id, reloadKey]);

  const styles = Array.isArray(service?.styles) ? service.styles : [];

  return (
    <div className="min-h-screen bg-[#090909] px-5 pb-24 pt-28 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1200px]">
        {loading && (
          <div className="mt-16 flex items-center justify-center  border border-white/10 bg-[#111] py-24">
            <Spinner label="Loading service details..." />
          </div>
        )}

        {!loading && error && (
          <Alert
            tone="error"
            title="Could not load this service"
            details={error.fieldErrors}
            onRetry={() => setReloadKey((key) => key + 1)}
            className="mt-16"
          >
            {error.message}
          </Alert>
        )}

        {!loading && !error && service && (
          <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_0.9fr] lg:gap-20">
            {/* ---------- editorial / gallery ---------- */}
            <div>
              <p className="text-[10px] uppercase tracking-[.35em] text-[#d6a85f]">
                Service details
              </p>
              <h1 className="mt-4 font-serif text-5xl leading-[.9] sm:text-7xl">
                {service.name}
              </h1>

              <p className="mt-7 max-w-xl text-sm leading-7 text-white/55 sm:text-base">
                {service.description || "Premium grooming crafted by our barbers."}
              </p>

              {service.image ? (
                <img
                  src={mediaUrl(service.image)}
                  alt={service.name}
                  className="mt-10 aspect-[4/3] w-full max-w-xl  border border-white/10 object-cover"
                />
              ) : (
                <div className="mt-10 flex aspect-[4/3] w-full max-w-xl items-center justify-center  border border-white/10 bg-gradient-to-br from-[#242424] to-[#0d0d0d]">
                  <Scissors size={40} className="text-[#d6a85f]/40" />
                </div>
              )}

              {styles.length > 0 && (
                <div className="mt-10">
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] uppercase tracking-[.3em] text-white/45">
                      Available styles
                    </p>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {styles.map((style) => (
                      <button
                        key={style.id}
                        onClick={() => setSelectedStyle(style)}
                        className="group flex items-center gap-4 overflow-hidden border border-white/10 bg-[#111] text-left transition hover:border-[#d6a85f]/50"
                      >
                        {style.image ? (
                          <img
                            src={mediaUrl(style.image)}
                            alt={style.name}
                            className="h-20 w-20 shrink-0 object-cover transition duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-20 w-20 shrink-0 items-center justify-center bg-gradient-to-br from-[#242424] to-[#0d0d0d] text-[#d6a85f]/50">
                            <Scissors size={20} />
                          </div>
                        )}
                        <div className="min-w-0 pr-4">
                          <p className="font-serif text-lg text-white">
                            {style.name}
                          </p>
                          <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-white/45">
                            {style.description || "Included with this service."}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ---------- booking summary ---------- */}
            <div>
              <div className="border border-white/10 bg-[#111] p-7 sm:p-8">
                <p className="text-[10px] uppercase tracking-[.3em] text-[#d6a85f]">
                  This service
                </p>

                <h2 className="mt-3 font-serif text-3xl">{service.name}</h2>

                <dl className="mt-8 space-y-4 border-t border-white/10 pt-6 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-white/45">Price</dt>
                    <dd className="font-semibold text-[#d6a85f]">
                      {formatPrice(service.price)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-white/45">Duration</dt>
                    <dd className="flex items-center gap-2 text-white/75">
                      <Clock3 size={14} /> {formatDuration(service.duration)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-white/45">Styles</dt>
                    <dd className="text-white/75">
                      {styles.length > 0 ? `${styles.length} available` : "—"}
                    </dd>
                  </div>
                </dl>

                <Link
                  to={`/booking?service=${service.id}`}
                  className="mt-8 block bg-[#d6a85f] px-6 py-4 text-center text-sm font-semibold text-black transition hover:bg-[#e5bd7a]"
                >
                  Book this service
                </Link>

                <p className="mt-4 text-center text-[10px] leading-5 text-white/25">
                  No account needed — just pick your date and time.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedStyle && (
        <StyleModal style={selectedStyle} close={() => setSelectedStyle(null)} />
      )}
    </div>
  );
}

function StyleModal({ style, close }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-end bg-black/80 p-3 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6"
      onMouseDown={close}
    >
      <article
        className="relative max-h-[92svh] w-full max-w-3xl overflow-auto border border-white/15 bg-[#121212] sm:grid sm:grid-cols-2"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          onClick={close}
          aria-label="Close details"
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center border border-white/10 bg-black/60 text-white backdrop-blur hover:bg-[#d6a85f] hover:text-black"
        >
          <X size={18} />
        </button>

        {style.image ? (
          <img
            src={mediaUrl(style.image)}
            alt={style.name}
            className="h-64 w-full object-cover sm:h-full sm:min-h-[420px]"
          />
        ) : (
          <div className="h-64 w-full bg-gradient-to-br from-[#242424] to-[#0d0d0d] sm:h-full sm:min-h-[420px]" />
        )}

        <div className="p-7 sm:p-9">
          <p className="text-[10px] uppercase tracking-[.3em] text-[#d6a85f]">
            Style
          </p>
          <h2 className="mt-4 font-serif text-5xl leading-none">{style.name}</h2>
          <p className="mt-6 text-sm leading-7 text-white/55">
            {style.description || "A signature NOIR take."}
          </p>
          <button
            onClick={close}
            className="mt-8 text-xs uppercase tracking-[.2em] text-[#d6a85f]"
          >
            Close
          </button>
        </div>
      </article>
    </div>
  );
}
