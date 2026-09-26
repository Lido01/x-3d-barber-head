import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

import { applyNavigationScroll, prefersReducedMotion } from "../utils/scroll";

/**
 * Scroll behaviour on navigation.
 *
 * react-router changes the URL and the rendered tree but never touches the
 * scroll position. Without help here, a visitor who scrolls halfway down the
 * gallery and clicks "Services" arrives halfway down the services page, with
 * no idea they missed the top.
 *
 * The rules live in utils/scroll.js — this component only wires them to the
 * router and moves focus.
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const previousPath = useRef(pathname);

  useEffect(() => {
    const pageChanged = previousPath.current !== pathname;

    previousPath.current = pathname;

    applyNavigationScroll({
      hash,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });

    if (pageChanged) {
      // A keyboard or screen-reader user is still focused on the link they
      // pressed. Move focus into the new page so the next Tab continues from
      // the content rather than back through the nav. preventScroll keeps this
      // from undoing the scroll we just did.
      requestAnimationFrame(() => {
        document.getElementById("main-content")?.focus({ preventScroll: true });
      });
    }
  }, [pathname, hash]);

  return null;
}
