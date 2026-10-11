import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

import { registerModal } from "../../utils/modalStack";

/**
 * A bottom sheet on a phone, a centred dialog on a desktop.
 *
 * The shape every "here is the result of what you just typed" moment takes
 * on the customer side, and the reason it is a modal at all rather than a
 * page: the customer has already given the shop what it asked for - a
 * booking code and the phone number it was made with - and what comes back
 * is their own record, not a new destination. Replacing the form with the
 * answer keeps the two halves of the interaction on one screen, so the code
 * they just typed is still visible behind the sheet and there is nothing to
 * navigate back to.
 *
 * ## Above the bottom bar, not merely over the page
 *
 * The mobile bottom bar is `fixed` at `z-55`. A sheet on the usual `z-50`
 * is drawn underneath it, and the bar is about 90px tall on a phone: it
 * sits exactly across the sheet's footer, so the buttons that dismiss it -
 * and on "My bookings" the last rows of the booking itself - cannot be
 * reached at all. Two changes fix that together and neither is enough on
 * its own:
 *
 *   - the sheet is above the bar (`z-70`);
 *   - the bar removes itself while any sheet is open (`utils/modalStack`),
 *     because a raised "Book" button floating on top of a modal is a link
 *     out of that modal sitting under someone's thumb.
 *
 * ## The responsive split is not decoration
 *
 * A 360px phone has no room for a centred dialog with a title, a body that
 * scrolls and a close button: a dialog narrower than the screen is unusable,
 * and the safe-area inset at the bottom is where the home indicator is. So
 * on the narrowest screens it is a sheet pinned to the bottom edge with real
 * bottom padding, and from `sm` up - where there is finally room for both -
 * it becomes a dialog, capped at a width so it still reads as a dialog on a
 * 1440px display rather than a full-screen takeover.
 *
 * The body scrolls on its own with `overscroll-contain`, and the header and
 * footer sit outside that scroll area, so the title and the close button are
 * still there at the bottom of a long booking - which is the whole reason
 * the bar has to move rather than the sheet growing taller.
 *
 * Handles its own scroll lock, Escape and initial focus, so no screen has
 * to. The body scroll lock matters more here than in the console: these
 * sheets open on top of a booking form, and a page that scrolls behind its
 * own modal is how the code the customer just typed ends up scrolled out of
 * sight the moment they reach for the keyboard.
 */
export default function BookingSheet({
  open,
  onClose,
  title,
  eyebrow,
  description,
  children,
  footer,
  labelledBy,
}) {
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const generated = useId();

  const headingId = labelledBy || `${generated}-title`;

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    const releaseModal = registerModal();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    // Focus the close button rather than the panel. Moving focus into a
    // dialog is what a screen reader needs; focusing *the close button* is
    // what stops the first Tab from landing on something behind the sheet.
    closeRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);

      // After the listener, so the bottom bar comes back on the same tick
      // the sheet is gone rather than a frame later over a page that is
      // already interactive again.
      releaseModal();
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="relative flex max-h-[92svh] w-full flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#111] shadow-2xl sm:max-h-[88svh] sm:max-w-2xl sm:rounded-2xl sm:border-white/10"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-[10px] uppercase tracking-[0.3em] text-[#d6a85f]">
                {eyebrow}
              </p>
            )}

            <h2
              id={headingId}
              className={`font-serif leading-tight text-white ${
                eyebrow ? "mt-1.5 text-lg sm:text-2xl" : "text-lg sm:text-2xl"
              }`}
            >
              {title}
            </h2>

            {description && (
              <p className="mt-1 text-xs leading-5 text-white/45">
                {description}
              </p>
            )}
          </div>

          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/5 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* `overscroll-contain` so a flick at the end of the list scrolls the
            sheet rather than the page locked behind it. The extra bottom
            padding is only for the no-footer case, since a footer already
            clears the home indicator itself. */}
        <div
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5 ${
            footer ? "" : "pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
          }`}
        >
          {children}
        </div>

        {footer && (
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-white/10 bg-[#0e0e0e] px-4 py-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-5 sm:pb-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}