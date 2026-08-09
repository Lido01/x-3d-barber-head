import { Quote, Star } from "lucide-react";
import { testimonials } from "../data/testimonials";

export default function Testimonials() {
  return (
    <section className="border-y border-white/10 bg-[#0d0d0d] px-5 py-20 sm:px-8 sm:py-28 lg:px-10">
      <div className="mx-auto max-w-[1440px]">
        <div className="max-w-xl">
          <p className="text-[10px] uppercase tracking-[.35em] text-[#d6a85f]">Client notes</p>
          <h2 className="mt-4 font-serif text-5xl leading-none sm:text-6xl">Good looks,<br /><span className="italic text-[#d6a85f]">better stories.</span></h2>
        </div>
        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {testimonials.map((item) => (
            <article key={item.name} className="rounded-3xl border border-white/10 bg-white/[.025] p-6 sm:p-8">
              <Quote className="text-[#d6a85f]" size={25} />
              <div className="mt-7 flex gap-1 text-[#d6a85f]">{Array.from({ length: item.rating }).map((_, i) => <Star key={i} size={13} fill="currentColor" />)}</div>
              <p className="mt-5 text-base leading-7 text-white/75">“{item.quote}”</p>
              <div className="mt-7 border-t border-white/10 pt-5"><p className="font-semibold">{item.name}</p><p className="mt-1 text-[10px] uppercase tracking-[.2em] text-white/35">{item.service}</p></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
