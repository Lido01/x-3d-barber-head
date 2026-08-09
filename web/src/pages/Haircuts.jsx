import { ArrowLeft, ArrowUpRight, Clock3 } from "lucide-react";
import { Link } from "react-router-dom";

const haircuts = [
  {
    id: "01",
    name: "Low Fade",
    category: "Modern",
    description:
      "A clean and subtle fade that keeps the sides refined while maintaining natural length on top.",
    price: "350 ETB",
  },
  {
    id: "02",
    name: "Mid Fade",
    category: "Classic / Modern",
    description:
      "A balanced fade with a stronger transition for a sharp everyday look.",
    price: "400 ETB",
  },
  {
    id: "03",
    name: "Skin Fade",
    category: "Sharp",
    description:
      "Ultra-clean sides fading directly into the skin for a crisp modern finish.",
    price: "450 ETB",
  },
  {
    id: "04",
    name: "Textured Crop",
    category: "Editorial",
    description:
      "A textured top with controlled shape and a clean contemporary finish.",
    price: "400 ETB",
  },
  {
    id: "05",
    name: "Classic Cut",
    category: "Timeless",
    description:
      "Traditional barbering with modern proportions and personalized styling.",
    price: "300 ETB",
  },
  {
    id: "06",
    name: "Beard Design",
    category: "Grooming",
    description:
      "Precision beard shaping designed around your facial structure.",
    price: "250 ETB",
  },
];

export default function Haircuts() {
  return (
    <div className="min-h-screen bg-[#090909] px-5 pb-24 pt-32 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1440px]">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/40 transition hover:text-white"
        >
          <ArrowLeft size={14} />
          Back home
        </Link>

        <div className="mt-12 max-w-4xl">
          <p className="text-[10px] uppercase tracking-[0.35em] text-[#d6a85f]">
            Haircut collection
          </p>

          <h1 className="mt-5 font-serif text-6xl leading-[0.85] tracking-tight sm:text-7xl lg:text-9xl">
            Find your
            <br />
            <span className="italic text-[#d6a85f]">
              signature.
            </span>
          </h1>

          <p className="mt-8 max-w-xl text-sm leading-7 text-white/45 sm:text-base">
            Explore our signature cuts. The full 3D transformation
            experience will allow you to preview each style before
            booking your chair.
          </p>
        </div>

        <div className="mt-20 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {haircuts.map((cut) => (
            <article
              key={cut.id}
              className="group relative min-h-[380px] overflow-hidden rounded-3xl border border-white/10 bg-[#111] p-7 transition-all duration-500 hover:-translate-y-1 hover:border-[#d6a85f]/30"
            >
              <div className="flex items-center justify-between">
                <span className="font-serif text-4xl text-white/10">
                  {cut.id}
                </span>

                <span className="rounded-full border border-white/10 px-3 py-1 text-[9px] uppercase tracking-widest text-white/40">
                  {cut.category}
                </span>
              </div>

              {/* Future 3D model area */}
              <div className="absolute left-1/2 top-[34%] h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#d6a85f]/10 bg-[#d6a85f]/5 blur-[1px] transition-transform duration-700 group-hover:scale-125" />

              <div className="absolute bottom-7 left-7 right-7">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <h2 className="font-serif text-3xl">
                      {cut.name}
                    </h2>

                    <p className="mt-3 max-w-sm text-xs leading-6 text-white/40">
                      {cut.description}
                    </p>
                  </div>

                  <ArrowUpRight
                    size={22}
                    className="shrink-0 text-white/20 transition-all duration-300 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-[#d6a85f]"
                  />
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-5">
                  <span className="font-semibold">
                    {cut.price}
                  </span>

                  <span className="flex items-center gap-2 text-xs text-white/35">
                    <Clock3 size={13} />
                    35–60 min
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}