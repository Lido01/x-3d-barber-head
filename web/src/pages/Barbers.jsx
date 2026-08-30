import { ArrowLeft, Scissors, Star } from "lucide-react";
import { Link } from "react-router-dom";

import Alert from "../components/ui/Alert";
import Spinner from "../components/ui/Spinner";
import { useBarberList } from "../hooks/useBarberList";
import { mediaUrl } from "../services/api";

/**
 * Meet the barbers — GET /api/barbers/.
 *
 * Every profile comes from the backend; no hardcoded team here.
 */
export default function Barbers() {
  const { barbers, loading, error, reload } = useBarberList();

  return (
    <div className="min-h-screen bg-[#090909] px-5 pb-24 pt-32 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1440px]">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/40 hover:text-white"
        >
          <ArrowLeft size={14} />
          Back home
        </Link>

        <div className="mt-12 max-w-4xl">
          <p className="text-[10px] uppercase tracking-[0.35em] text-[#d6a85f]">
            The artists
          </p>

          <h1 className="mt-5 font-serif text-6xl leading-[0.85] sm:text-7xl lg:text-9xl">
            Meet the
            <br />
            <span className="italic text-[#d6a85f]">barbers.</span>
          </h1>

          <p className="mt-8 max-w-xl text-sm leading-7 text-white/45 sm:text-base">
            Different styles. Different perspectives. One obsession: making
            sure you leave the chair looking your best.
          </p>
        </div>

        <div className="mt-20">
          {loading && (
            <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-[#111] py-24">
              <Spinner label="Loading the team..." />
            </div>
          )}

          {!loading && error && (
            <Alert
              tone="error"
              title="Could not load the team"
              details={error.fieldErrors}
              onRetry={reload}
            >
              {error.message}
            </Alert>
          )}

          {!loading && !error && barbers.length === 0 && (
            <Alert tone="info" title="The team is coming soon">
              The shop hasn't added its barbers yet.
            </Alert>
          )}

          {!loading && !error && barbers.length > 0 && (
            <div className="grid gap-5 lg:grid-cols-3">
              {barbers.map((barber, index) => (
                <article
                  key={barber.id}
                  className="group overflow-hidden border border-white/10 bg-[#111]"
                >
                  <div className="relative h-[430px] overflow-hidden bg-gradient-to-b from-[#292929] to-[#111]">
                    {barber.image ? (
                      <img
                        src={mediaUrl(barber.image)}
                        alt={barber.name}
                        className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#383838] via-[#1c1c1c] to-[#090909]">
                        <Scissors
                          size={42}
                          className="text-[#d6a85f]/30 transition-transform duration-700 group-hover:-rotate-12"
                        />
                      </div>
                    )}

                    <div className="absolute left-5 top-5 border border-white/10 bg-black/30 px-3 py-1.5 text-[9px] uppercase tracking-[0.2em] text-white/40 backdrop-blur">
                      0{index + 1}
                    </div>
                  </div>

                  <div className="p-7">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[9px] uppercase tracking-[0.25em] text-[#d6a85f]">
                          {barber.role || "Barber"}
                        </p>

                        <h2 className="mt-2 font-serif text-3xl">
                          {barber.name}
                        </h2>
                      </div>

                      <div className="flex items-center gap-1 text-xs text-[#d6a85f]">
                        <Star size={12} fill="currentColor" />
                        4.9
                      </div>
                    </div>

                    {(barber.specialty || barber.experience) && (
                      <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-5 text-xs text-white/40">
                        <span>{barber.specialty || "All styles"}</span>
                        <span>{barber.experience || ""}</span>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
