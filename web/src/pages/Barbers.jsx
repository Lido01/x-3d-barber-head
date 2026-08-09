import { ArrowLeft, ArrowBigDown as Instagram, Star } from "lucide-react";
import { Link } from "react-router-dom";

const barbers = [
  {
    name: "Alex Tesfaye",
    role: "Master Barber",
    specialty: "Fades · Beard Design",
    experience: "8 years",
  },
  {
    name: "Mikael Daniel",
    role: "Senior Barber",
    specialty: "Classic · Modern Cuts",
    experience: "6 years",
  },
  {
    name: "Samuel Bekele",
    role: "Style Specialist",
    specialty: "Texture · Editorial",
    experience: "5 years",
  },
];

export default function Barbers() {
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
            <span className="italic text-[#d6a85f]">
              barbers.
            </span>
          </h1>

          <p className="mt-8 max-w-xl text-sm leading-7 text-white/45 sm:text-base">
            Different styles. Different perspectives. One obsession:
            making sure you leave the chair looking your best.
          </p>
        </div>

        <div className="mt-20 grid gap-5 lg:grid-cols-3">
          {barbers.map((barber, index) => (
            <article
              key={barber.name}
              className="group overflow-hidden rounded-3xl border border-white/10 bg-[#111]"
            >
              <div className="relative h-[430px] overflow-hidden bg-gradient-to-b from-[#292929] to-[#111]">
                <div className="absolute inset-x-10 bottom-0 top-16 rounded-t-[45%] bg-gradient-to-br from-[#383838] via-[#1c1c1c] to-[#090909] transition-transform duration-700 group-hover:scale-105" />

                <div className="absolute left-1/2 top-20 h-24 w-28 -translate-x-1/2 rounded-full bg-[#080808]" />

                <div className="absolute left-5 top-5 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[9px] uppercase tracking-[0.2em] text-white/40 backdrop-blur">
                  0{index + 1}
                </div>

                <button className="absolute bottom-5 right-5 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/50 backdrop-blur transition hover:bg-[#d6a85f] hover:text-black">
                  <Instagram size={16} />
                </button>
              </div>

              <div className="p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.25em] text-[#d6a85f]">
                      {barber.role}
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

                <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-5 text-xs text-white/40">
                  <span>{barber.specialty}</span>
                  <span>{barber.experience}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}