import { useEffect, useState } from "react";

/**
 * A tiny module-level channel to the AI chat widget.
 *
 * ## Why a module and not props or context
 *
 * The widget is mounted once at the app root so it floats above every
 * storefront page — a context would mean threading it through every route
 * for no other reason. But two screens want to talk to it from the
 * *other* end:
 *
 *   /booking    wants the assistant to know the service, day and slot the
 *               customer has already chosen, so it stops asking for them
 *   /booking    also wants a button that says "ask about this" and opens
 *               the panel with a question already typed in
 *
 * Both are "tell the widget something" from a page that has no reference
 * to it, which is exactly the shape `utils/modalStack.js` already solves
 * for "is a modal open" — same reasoning, same mechanism, so the second
 * one does not need its own invention. See that file for why this is a
 * module rather than a provider.
 */

/** @type {Set<(request: {message?: string}|null) => void>} */
const openSubscribers = new Set();

/**
 * Booking context, sent with every chat message.
 *
 * Read at send time rather than captured at mount, so the assistant
 * always has the *current* selection. A customer who picks a service,
 * changes their mind and picks another is describing the second one.
 *
 * Cleared by the booking screen on unmount, so leaving /booking does not
 * leave the assistant quoting a service from three pages ago.
 */
let bookingContext = null;

/**
 * Open the panel. `message` is sent immediately once it is open.
 *
 * Asking for the chat undoes a dismissal. That is the whole reason the
 * widget can be closed for good without ever being unrecoverable: any
 * entry point that offers the assistant - the launcher, the "ask about
 * this" button on /booking, the item in the bottom bar's More sheet - is
 * a way back, so the flag is cleared here rather than leaving the caller
 * to remember to clear it.
 */
export function openAiChat(message = "") {
  const request = {
    message: (message || "").trim(),
    restored: isAiChatDismissed(),
  };

  if (request.restored) {
    setAiChatDismissed(false);
  }

  for (const notify of openSubscribers) {
    notify(request);
  }
}

/** Record what the customer has already chosen on the booking form. */
export function setAiBookingContext(context) {
  bookingContext = context
    ? {
        customerName: context.customerName || "",
        customerPhone: context.customerPhone || "",
        serviceId: context.serviceId ?? null,
        bookingDate: context.bookingDate || null,
        startTime: context.startTime || null,
      }
    : null;
}

export function readAiBookingContext() {
  return bookingContext;
}

/**
 * Subscribe to "open the chat" requests.
 *
 * Re-reads on mount because a page can call `openAiChat` between the
 * widget's first render and its effect running — which is exactly what
 * happens when the "ask about this" button on /booking mounts in the same
 * commit as the root.
 */
export function useAiChatOpen() {
  const [request, setRequest] = useState(null);

  useEffect(() => {
    openSubscribers.add(setRequest);

    return () => {
      openSubscribers.delete(setRequest);
    };
  }, []);

  return request;
}

// -----------------------------------------------------------------
// Dismissal
// -----------------------------------------------------------------

/**
 * The customer can close the assistant for good, and get it back.
 *
 * "Hide it" and "get it back" have to be the same fact stored in the same
 * place: a sessionStorage flag means the panel stays out of the way for
 * the rest of the visit — the person asked for it not to be there — and
 * a small launcher is left behind so it is never gone for good. Storage
 * rather than a component flag, so a route change does not bring back
 * something someone deliberately closed.
 */

const DISMISSED_KEY = "noir:ai-chat-dismissed";

function storage() {
  try {
    return window.sessionStorage;
  } catch {
    // Private browsing on some browsers throws on access rather than on
    // write. Losing the preference is acceptable; crashing is not.
    return null;
  }
}

export function isAiChatDismissed() {
  try {
    return storage()?.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAiChatDismissed(dismissed) {
  try {
    const store = storage();

    if (!store) {
      return;
    }

    if (dismissed) {
      store.setItem(DISMISSED_KEY, "1");
    } else {
      store.removeItem(DISMISSED_KEY);
    }
  } catch {
    // A full or blocked quota should not take the widget down with it.
  }
}