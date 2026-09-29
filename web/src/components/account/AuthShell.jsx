import { Link } from "react-router-dom";
import { Scissors } from "lucide-react";

/**
 * Shared frame for the customer sign-in and register screens.
 *
 * Both are reached from the review form on a phone, so the layout is
 * single-column, tap targets are 44px tall, and the page scrolls under
 * a compact sticky header rather than trying to centre itself in a
 * viewport that may be shorter than the form.
 */
export default function AuthShell({
  eyebrow,
  title,
  lead,
  children,
  footer,
}) {
  return (
    <div className="min-h-[var(--viewport-height)] bg-[#090909]">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0d0d0d]/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <Link
            to="/"
            aria-label="Back to the site"
            className="flex h-10 w-10 shrink-0 items-center justify-center border border-white/10 transition hover:border-[#d6a85f]/40"
          >
            <Scissors size={16} className="text-[#d6a85f]" />
          </Link>

          <p className="font-serif text-base font-bold tracking-[0.12em] text-white">
            NOIR
          </p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-md px-4 pb-24 pt-8 sm:px-6 sm:pt-12">
        <h1 className="mt-3 font-serif text-3xl leading-tight text-white sm:text-4xl">
          {title}
        </h1>

        <div className="mt-7">{children}</div>

        {footer && <div className="mt-6">{footer}</div>}
      </div>
    </div>
  );
}
