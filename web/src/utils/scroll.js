/**
 * Scroll rules for client-side navigation.
 *
 * Kept out of the ScrollToTop component on purpose: these are plain functions
 * with no React in them, so they can be reasoned about and tested directly
 * instead of only through a rendered tree.
 */

/** Honour the OS motion preference. Jumping is the accessible default. */
export function prefersReducedMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** "#about" -> "about". Tolerates encoded characters and a lone "#". */
export function hashToId(hash) {
  if (!hash) {
    return null;
  }

  const id = hash.replace(/^#/, "");

  return id ? decodeURIComponent(id) : null;
}

/**
 * Scroll an element into view. Returns false when it is not in the DOM yet,
 * which happens on the first frame after a route change.
 */
export function scrollToId(id, behavior) {
  if (!id || typeof document === "undefined") {
    return false;
  }

  const target = document.getElementById(id);

  if (!target) {
    return false;
  }

  target.scrollIntoView({ behavior, block: "start" });

  return true;
}

/**
 * The whole navigation-scroll rule.
 *
 * A link with a hash goes to that section; anything else goes to the top.
 * Returns a short description of what happened, which is handy in tests and
 * when debugging.
 */
export function applyNavigationScroll({ hash, behavior = "smooth" }) {
  if (hash) {
    const id = hashToId(hash);

    if (scrollToId(id, behavior)) {
      return { action: "section", id };
    }

    // The section may not be mounted on the very first frame of a new route,
    // so look again once the browser has painted. Deliberately no fallback to
    // the top: someone who asked for /#about wants the About band, and being
    // dumped at the top of the page is a worse answer than landing a frame
    // late.
    requestAnimationFrame(() => scrollToId(id, behavior));

    return { action: "pending", id };
  }

  window.scrollTo({ top: 0, left: 0, behavior });

  return { action: "top" };
}
