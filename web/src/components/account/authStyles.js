export const LABEL =
  "block text-[10px] uppercase tracking-[0.25em] text-white/35";

/**
 * Shared control styling for the customer account forms.
 *
 * py-3.5 on a 16px base keeps every control at or above the 44px touch
 * target iOS and Android expect, which is what makes these forms
 * usable on a phone without zooming.
 */
export const INPUT =
  "mt-2 w-full rounded-xl border border-white/10 bg-[#181818] px-4 py-3.5 text-base text-white outline-none transition placeholder:text-white/25 focus:border-[#d6a85f]/50 sm:text-sm";

export const PRIMARY_BUTTON =
  "flex w-full items-center justify-center gap-3 rounded-full bg-[#d6a85f] px-6 py-4 text-sm font-semibold text-black transition hover:bg-[#e5bd7a] disabled:cursor-not-allowed disabled:opacity-60";
