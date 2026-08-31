import { Scissors } from "lucide-react";

import { useServices } from "../hooks/useServices";
import { formatPrice } from "../utils/format";

const FALLBACK = [
  "Fade & Fresh",
  "Signature Cut",
  "Beard Sculpt",
  "Hot Towel Shave",
  "Restyle & Clean",
  "Kids Cut",
];

/**
 * Infinite scrolling service ticker between the hero and the content.
 * Runs twice for a seamless loop; CSS handles the animation and stops
 * on hover so the current price/link stays readable.
 */
export default function Marquee() {
  const { services } = useServices();

  const items =
    services.length > 0
      ? services.map((service) => ({
          name: service.name,
          price: formatPrice(service.price),
        }))
      : FALLBACK.map((name) => ({ name, price: "—" }));

  const doubled = [...items, ...items];

  return (
    <section className="relative border-y border-[#d6a85f]/25 bg-[#d6a85f] py-4 text-[#090909]">
      <div className="no-scrollbar overflow-hidden">
        <div className="flex w-max animate-marquee items-center gap-10 pr-10 whitespace-nowrap">
          {doubled.map((item, index) => (
            <span
              key={index}
              className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.15em]"
            >
              <Scissors size={15} strokeWidth={2.4} />
              {item.name}
              <span className="font-bold">{item.price}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
