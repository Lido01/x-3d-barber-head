import { ArrowUpRight } from "lucide-react";
import { haircuts } from "../data/haircuts";

export default function Gallery({ onSelect }) {
  return (
    <section id="gallery" className="bg-[#090909] px-5 py-20 sm:px-8 sm:py-28 lg:px-10">
      <div className="mx-auto max-w-[1440px]">
        <div className="flex flex-wrap items-end justify-between gap-6"><div><p className="text-[10px] uppercase tracking-[.35em] text-[#d6a85f]">Recent work</p><h2 className="mt-4 font-serif text-5xl sm:text-6xl">The <span className="italic text-[#d6a85f]">gallery.</span></h2></div><p className="max-w-xs text-sm leading-6 text-white/45">Tap a look to explore the cut, its finish and the right booking time.</p></div>
        <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {haircuts.map((cut, index) => <button key={cut.id} onClick={() => onSelect(cut)} className={`group relative min-h-60 overflow-hidden rounded-2xl text-left ${index === 0 || index === 3 ? "sm:col-span-2" : ""}`}>
            <img src={cut.image} alt={cut.name} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-110" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
            <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-2"><div><p className="text-[9px] uppercase tracking-[.2em] text-[#d6a85f]">{cut.category}</p><p className="mt-1 font-serif text-xl">{cut.name}</p></div><ArrowUpRight className="mb-1 text-white/80" size={18} /></div>
          </button>)}
        </div>
      </div>
    </section>
  );
}
