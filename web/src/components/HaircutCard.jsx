import { ArrowUpRight, Clock3 } from "lucide-react";
import { Link } from "react-router-dom";

export default function HaircutCard({ haircut }) {
  return (
    <article className="group overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.025] transition-all duration-500 hover:-translate-y-2 hover:border-white/20">

      <div className="relative aspect-[4/5] overflow-hidden">

        <img
          src={haircut.image}
          alt={`${haircut.name} haircut`}
          className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
          loading="lazy"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />

        <span className="absolute left-4 top-4 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-[10px] uppercase tracking-widest text-white/70 backdrop-blur">
          {haircut.category}
        </span>

        <span className="absolute bottom-4 right-4 rounded-full bg-[#d6a85f] px-3 py-1.5 text-xs font-bold text-black">
          {haircut.price} ETB
        </span>
      </div>

      <div className="p-5">

        <h3 className="text-xl font-semibold text-white">
          {haircut.name}
        </h3>

        <p className="mt-2 text-sm leading-6 text-white/45">
          {haircut.description}
        </p>

        <div className="mt-5 flex items-center justify-between">

          <span className="flex items-center gap-2 text-xs text-white/40">
            <Clock3 size={14} />
            {haircut.duration}
          </span>

          <Link
            to={`/booking?haircut=${haircut.id}`}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black transition duration-300 group-hover:rotate-45"
          >
            <ArrowUpRight size={18} />
          </Link>

        </div>

      </div>
    </article>
  );
}