import { Link } from "react-router-dom";

/**
 * 404.
 *
 * A <div>, not a <main>: App.jsx already renders the page's single
 * <main id="main-content"> landmark around every route.
 *
 * The background matches the app shell (#090909) rather than the older
 * #080808 this page was still using, which showed as a visible band
 * against every other page.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[var(--viewport-height)] items-center justify-center bg-[#090909] px-5 py-16 text-center text-white">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-[#d6a85f]">
          404
        </p>

        <h1 className="mt-5 font-serif text-3xl leading-tight sm:text-5xl">
          This chair doesn't exist.
        </h1>

        <p className="mt-4 text-sm text-white/40 sm:text-base">
          The page you're looking for couldn't be found.
        </p>

        <Link
          to="/"
          className="mt-8 inline-flex min-h-11 items-center rounded-full bg-[#d6a85f] px-6 py-3 text-sm font-semibold text-black transition hover:bg-[#e5bd7a]"
        >
          Back to the shop
        </Link>
      </div>
    </div>
  );
}
