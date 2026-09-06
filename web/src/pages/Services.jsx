import { ArrowUpRight, Clock3 } from "lucide-react";
import { Link } from "react-router-dom";

import Alert from "../components/ui/Alert";
import Spinner from "../components/ui/Spinner";
import { useServices } from "../hooks/useServices";
import { mediaUrl } from "../services/api";
import { formatDuration, formatPrice } from "../utils/format";

/**
 * The shop's live service list, straight from GET /api/services/.
 *
 * Django's list() returns active services only, so nothing is filtered
 * here, and every price and duration shown is the backend's own.
 */
export default function Services() {
  const { services, loading, error, reload } = useServices();

  return (
    <div className="min-h-screen bg-[#090909] px-5 pb-24 pt-28 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1440px]">
        <div className="mt-12 max-w-4xl">
          <p className="text-[10px] uppercase tracking-[0.35em] text-[#d6a85f]">
            Services &amp; pricing
          </p>

          <h1 className="mt-5 font-serif text-5xl leading-[0.85] tracking-tight sm:text-7xl lg:text-8xl">
            Book the
            <br />
            <span className="italic text-[#d6a85f]">service.</span>
          </h1>

          <p className="mt-8 max-w-xl text-sm leading-7 text-white/45 sm:text-base">
            Live pricing and appointment lengths from the shop. Pick one to
            jump straight into booking.
          </p>
        </div>

        <div className="mt-14">
          {loading && (
            <div className="flex justify-center rounded-2xl border border-white/10 bg-[#111] py-20">
              <Spinner label="Loading services..." />
            </div>
          )}

          {!loading && error && (
            <Alert
              tone="error"
              title="Could not load services"
              details={error.fieldErrors}
              onRetry={reload}
              className="mx-auto max-w-2xl"
            >
              {error.message}
            </Alert>
          )}

          {!loading && !error && services.length === 0 && (
            <Alert
              tone="info"
              title="No services published yet"
              onRetry={reload}
              className="mx-auto max-w-2xl"
            >
              The shop has not added any services. Please check back soon.
            </Alert>
          )}

          {!loading && !error && services.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {services.map((service) => {
                const image = mediaUrl(service.image);

                return (
                  <article
                    key={service.id}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111] transition hover:border-[#d6a85f]/40"
                  >
                    {image ? (
                      <img
                        src={image}
                        alt={service.name}
                        className="h-48 w-full object-cover transition duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-48 items-center justify-center bg-gradient-to-br from-[#292929] via-[#1c1c1c] to-[#090909]">
                        <span className="font-serif text-5xl text-white/10">
                          {service.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}

                    <div className="flex flex-1 flex-col p-6">
                      <h2 className="font-serif text-2xl text-white">
                        {service.name}
                      </h2>

                      {service.description && (
                        <p className="mt-3 text-xs leading-6 text-white/45">
                          {service.description}
                        </p>
                      )}

                      <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-5 text-sm">
                        <span className="font-semibold text-[#d6a85f]">
                          {formatPrice(service.price)}
                        </span>

                        <span className="flex items-center gap-2 text-xs text-white/45">
                          <Clock3 size={13} />
                          {formatDuration(service.duration)}
                        </span>
                      </div>

                      <Link
                        to={`/booking?service=${service.id}`}
                        className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-[#d6a85f] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#e5bd7a]"
                      >
                        Book this service
                        <ArrowUpRight size={15} strokeWidth={2.2} />
                      </Link>

                      <Link
                        to={`/services/${service.id}`}
                        className="mt-3 inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white/70 transition hover:border-[#d6a85f]/50 hover:text-white"
                      >
                        View details
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
