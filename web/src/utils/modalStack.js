import { useEffect, useState } from "react";

/**
 * Is a modal open anywhere right now?
 *
 * ## The problem this exists to solve
 *
 * The customer-side bottom bar is `fixed` at `z-55` - above every page's
 * content, below nothing. A sheet that opens on `z-50` is therefore drawn
 * *underneath* the bar, and on a phone the bar covers the bottom 90px of
 * the sheet: the part with the footer buttons and, on "My bookings", the
 * bottom of the booking itself. Raising the sheet above the bar fixes the
 * overlap but leaves the raised "Book" button floating on top of a modal
 * the customer is trying to read, with a link that navigates away from it
 * if they tap the wrong inch.
 *
 * So neither z-index is the whole answer. The bar has to *go away* while a
 * sheet is open, and it has no way of knowing - it renders at the app root
 * and the sheet is rendered by whichever page opened it.
 *
 * ## Why a counter and not a boolean
 *
 * Several of these can be open at once and they do not strictly nest. The
 * payment sheet opens over the booking sheet on `/payment/:id`; a screen
 * may open one and then find another. A boolean would be cleared by the
 * first one to close while the second is still up, putting the bottom bar
 * back on top of a live modal. Counting open modals means the bar returns
 * only when the last one has gone.
 *
 * ## Why this is a module and not a context
 *
 * It has to be readable from a component that is not inside any provider -
 * the bottom bar sits outside the page tree on purpose, and threading a
 * context through the app for one boolean would put a modal's existence
 * into every route. The subscriber list is a few lines and has no state to
 * keep in step with the tree.
 */

let openCount = 0;

const subscribers = new Set();

function publish() {
  /*
   * The current answer, passed *as an argument*.
   *
   * Subscribers are React state setters, and `setState()` with no argument
   * is `setState(undefined)` — not "re-render with what you have". Calling
   * them bare therefore drove every subscriber to `undefined`, which is
   * falsy, so `useModalOpen()` returned false and the bottom bar never
   * stepped aside for a sheet: the whole reason this module exists.
   *
   * Every subscriber is handed the value rather than being trusted to read
   * `openCount` itself, so a late subscriber and an early one are told the
   * same thing.
   */
  const next = openCount > 0;

  for (const notify of subscribers) {
    notify(next);
  }
}

/** Register one open modal. Returns the function that closes it. */
export function registerModal() {
  openCount += 1;
  publish();

  let released = false;

  return () => {
    if (released) {
      // React 18 mounts effects twice in development. Closing a modal that
      // was never counted open again would drive the counter negative and
      // leave the bottom bar permanently hidden.
      return;
    }

    released = true;
    openCount = Math.max(0, openCount - 1);
    publish();
  };
}

/**
 * Whether to keep the bottom app bar out of the way.
 *
 * Subscribes rather than reading once, so a screen that opens a sheet
 * while the bar is already on screen takes it away immediately - the bar
 * has a scroll-driven slide of its own, and leaving it visible for a
 * frame next to a modal is exactly the flicker being avoided.
 */
export function useModalOpen() {
  const [open, setOpen] = useState(() => openCount > 0);

  useEffect(() => {
    subscribers.add(setOpen);

    // Re-read on mount: a modal may have opened between this component's
    // first render and this effect running.
    setOpen(openCount > 0);

    return () => {
      subscribers.delete(setOpen);
    };
  }, []);

  return open;
}