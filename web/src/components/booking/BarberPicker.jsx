import { ChevronDown, Sparkles } from "lucide-react";

import { mediaUrl } from "../../services/api";

const SELECT =
  "w-full appearance-none rounded-xl border border-white/10 bg-[#181818] px-4 py-4 pr-12 text-sm text-white outline-none transition focus:border-[#d6a85f]/50 disabled:cursor-not-allowed disabled:opacity-60";

export default function BarberPicker({
  barbers,
  selectedId,
  onSelect,
  disabled = false,
}) {
  const selectedBarber = barbers.find(
    (barber) => String(barber.id) === String(selectedId)
  );
  const selectedImage = selectedBarber && mediaUrl(selectedBarber.image);

  return (
    <div className="space-y-3">
      <div className="relative">
        <select
          value={selectedId || ""}
          onChange={(event) => onSelect(event.target.value)}
          disabled={disabled}
          aria-label="Choose a barber"
          className={SELECT}
        >
          <option value="">Any available barber</option>
          {barbers.map((barber) => (
            <option key={barber.id} value={barber.id}>
              {barber.name} — {barber.role || barber.specialty || "NOIR barber"}
            </option>
          ))}
        </select>
        <ChevronDown
          size={17}
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#d6a85f]"
        />
      </div>

      {selectedBarber ? (
        <div className="flex items-center gap-3 rounded-xl border border-[#d6a85f]/20 bg-[#d6a85f]/[0.05] p-3">
          {selectedImage ? (
            <img
              src={selectedImage}
              alt=""
              className="h-12 w-12 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 font-serif text-lg text-[#d6a85f]">
              {selectedBarber.name?.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium">{selectedBarber.name}</p>
            <p className="mt-1 text-xs text-white/40">
              {selectedBarber.specialty || selectedBarber.role || "NOIR barber"}
            </p>
          </div>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-xs text-white/35">
          <Sparkles size={13} className="text-[#d6a85f]" />
          We will assign the first barber available at your time.
        </p>
      )}
    </div>
  );
}
