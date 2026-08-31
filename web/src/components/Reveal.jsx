import { useEffect, useRef, useState } from "react";

/**
 * Lightweight scroll-reveal wrapper (no extra deps).
 *
 * Wraps its children in a div that is invisible and offset until it
 * scrolls into view, then animates it in with a soft fade + rise.
 * `delay` is in milliseconds and is passed straight to the CSS
 * transition-delay so stagger effects are trivial.
 */
export default function Reveal({
  children,
  className = "",
  as: Tag = "div",
  delay = 0,
  y = 24,
  once = true,
}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;

    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            if (once) {
              observer.unobserve(entry.target);
            }
          } else if (!once) {
            setVisible(false);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [once]);

  return (
    <Tag
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : `translateY(${y}px)`,
        transition: `opacity 0.8s cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 0.8s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </Tag>
  );
}
