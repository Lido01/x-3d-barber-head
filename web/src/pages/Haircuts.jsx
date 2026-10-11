import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Clock3, X } from "lucide-react";
import { Link } from "react-router-dom";

import Alert from "../components/ui/Alert";
import Spinner from "../components/ui/Spinner";
import { useServices } from "../hooks/useServices";
import { mediaUrl } from "../services/api";
import { formatDuration, formatPrice } from "../utils/format";

/**
 * Haircut collection — built from GET /api/services/.
 *
 * Each "haircut" is a haircut style belonging to a service. Clicking a
 * haircut opens its details and lets the customer book that service or
 * open the full service details page.
 */
export default function Haircuts() {
  const { services, loading, error, reload } = useServices();

  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState(null);

  // Flatten services + styles into a single list of "haircuts".
  const haircuts = useMemo(() => {
    const rows = [];

    for (const service of services) {
      const styles = Array.isArray(service.styles) ? service.styles : [];

      if (styles.length > 0) {
        for (const style of styles) {
          rows.push({ ...style, service });
        }
      } else {
        rows.push({ ...service, service, isServiceRoot: true });
      }
    }

    return rows;
  }, [services]);

  const categories = useMemo(
    () => [
      "All",
      ...new Set(
        haircuts
          .map((cut) => cut.category || cut.service?.name)
          .filter(Boolean)
      ),
    ],
    [haircuts]
  );

  const shown =
    category === "All"
      ? haircuts
      : haircuts.filter(
          (cut) => (cut.category || cut.service?.name) === category
        );

  useEffect(() => {
    document.body.style.overflow = selected ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [selected]);

  return (
    <div className="min-h-screen bg-[#090909] px-5 pb-24 pt-28 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1440px]">
        {loading && (
          <div className="mt-14 flex items-center justify-center  border border-white/10 bg-[#111] py-24">
            <Spinner label="Loading haircuts..." />
          </div>
        )}

        {!loading && error && (
          <Alert
            tone="error"
            title="Could not load haircuts"
            details={error.fieldErrors}
            onRetry={reload}
            className="mt-14"
          >
            {error.message}
          </Alert>
        )}

        {!loading && !error && haircuts.length === 0 && (
          <Alert tone="info" title="Nothing here yet" className="mt-14">
            The shop hasn't published its collection yet. Check back soon.
          </Alert>
        )}

        {!loading && !error && haircuts.length > 0 && (
          <>
            <div className="mt-10 flex gap-2 overflow-x-auto pb-2">
              {categories.map((item) => (
                <button
                  key={item}
                  onClick={() => setCategory(item)}
                  className={`whitespace-nowrap border px-4 py-2 text-xs transition ${
                    category === item
                      ? "border-[#d6a85f] bg-[#d6a85f] text-black"
                      : "border-white/10 text-white/50 hover:border-white/40"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="mt-9 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {shown.map((cut) => (
                <button
                  key={`${cut.service?.id || "root"}-${cut.id || cut.name}`}
                  onClick={() => setSelected(cut)}
                  className="group relative min-h-[420px]  overflow-hidden border border-white/10 bg-[#111] text-left transition hover:border-[#d6a85f]/50"
                >
                  {cut.image ? (
                    <img
                      src={mediaUrl(cut.image)}
                      alt={cut.name}
                      className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#222] to-[#0d0d0d]" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#090909] via-[#090909]/25 to-black/10" />
                  <div className="absolute left-6 right-6 top-6 flex items-center justify-between">
                    <span className="font-serif text-4xl text-white/50">
                      {cut.service?.id || "N"}
                    </span>
                    <span className=" border border-white/20 bg-black/30 px-3 py-1 text-[9px] uppercase tracking-widest text-white/80 backdrop-blur">
                      {cut.service?.name || "NOIR service"}
                    </span>
                  </div>
                  <div className="absolute bottom-6 left-6 right-6">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <h2 className="font-serif text-3xl">{cut.name}</h2>
                        {/* <p className="mt-2 max-w-sm text-xs leading-6 text-white/65">
                          {cut.description || cut.service?.description}
                        </p> */}
                      </div>
                      <ArrowUpRight
                        size={22}
                        className="mb-1 shrink-0 text-[#d6a85f]"
                      />
                    </div>
                    <div className="mt-5 flex justify-between border-t border-white/20 pt-4 text-sm">
                      <span className="font-semibold">
                        {formatPrice(cut.service?.price)}
                      </span>
                      {/* <span className="flex items-center gap-2 text-white/60">
                        <Clock3 size={13} />
                        {formatDuration(cut.service?.duration)}
                      </span> */}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {selected && <CutModal cut={selected} close={() => setSelected(null)} />}
    </div>
  );
}

function CutModal({ cut, close }) {
  const hasImage = cut.image;

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

        {hasImage ? (
          <img
            src={mediaUrl(hasImage)}
            alt={cut.name}
            className="h-64 w-full object-cover sm:h-full sm:min-h-[470px]"
          />
        ) : (
          <div className="h-64 w-full bg-gradient-to-br from-[#242424] to-[#0d0d0d] sm:h-full sm:min-h-[470px]" />
        )}

        <div className="p-7 sm:p-9">
          <p className="text-[10px] uppercase tracking-[.3em] text-[#d6a85f]">
            {cut.service.name}
          </p>
          <h2 className="mt-4 font-serif text-5xl leading-none">{cut.name}</h2>
          <p className="mt-6 text-sm leading-7 text-white/55">
            {cut.description || cut.service.description}
          </p>
          <div className="mt-8 flex justify-between border-y border-white/10 py-5 text-sm">
            <span>{formatPrice(cut.service.price)}</span>
            <span>{formatDuration(cut.service.duration)}</span>
          </div>
          <Link
            to={`/services/${cut.service.id}`}
            onClick={close}
            className="mt-3 block border border-white/15 px-5 py-3 text-center text-sm font-semibold text-white/80 transition hover:border-[#d6a85f]/50 hover:text-white"
          >
            View service details
          </Link>
          <Link
            to={`/booking?service=${cut.service.id}`}
            onClick={close}
            className="mt-3 block bg-[#d6a85f] px-5 py-3 text-center text-sm font-semibold text-black transition hover:bg-[#e5bd7a]"
          >
            Book this look
          </Link>
        </div>
      </article>
    </div>
  );
}
