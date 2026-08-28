import { Check, Sparkles } from "lucide-react";

/**
 * Step 4 - pick a barber, or leave it to the shop.
 *
 * "No preference" is the default and sends no barber field at all, so
 * Django's find_available_barber() assigns one and returns barber_name
 * on the created booking. The frontend never picks a barber itself.
 *
 * The named options only appear when the backend actually served a
 * barber list (see useBarbers).
 */
export default function BarberPicker({
  barbers,
  selectedId,
  onSelect,
  disabled = false,
}) {
  const noPreference = !selectedId;

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={() => onSelect("")}
        disabled={disabled}
        aria-pressed={noPreference}
        className={`flex items-center gap-3 rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
          noPreference
            ? "border-[#d6a85f]/50 bg-[#d6a85f]/10"
            : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
        }`}
      >
        <Sparkles
          size={16}
          className={noPreference ? "text-[#d6a85f]" : "text-white/30"}
        />

        <div className="min-w-0 flex-1">
          <p
            className={`text-sm font-medium ${
              noPreference ? "text-white" : "text-white/75"
            }`}
          >
            No preference
          </p>

          <p className="mt-1 text-xs text-white/35">
            We'll assign the first barber available at your time.
          </p>
        </div>

        {noPreference && (
          <Check size={16} className="shrink-0 text-[#d6a85f]" />
        )}
      </button>

      {barbers.map((barber) => {
        const selected = String(barber.id) === String(selectedId);

        return (
          <button
            type="button"
            key={barber.id}
            onClick={() => onSelect(barber.id)}
            disabled={disabled}
            aria-pressed={selected}
            className={`flex items-center justify-between gap-3 rounded-xl border p-4 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
              selected
                ? "border-[#d6a85f]/50 bg-[#d6a85f]/10 text-white"
                : "border-white/10 bg-white/[0.02] text-white/60 hover:bg-white/[0.05]"
            }`}
          >
            <span>{barber.name}</span>

            {selected && <Check size={16} className="text-[#d6a85f]" />}
          </button>
        );
      })}
    </div>
  );
}
