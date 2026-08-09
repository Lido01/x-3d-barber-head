import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-[#d6a85f]">
          404
        </p>

        <h1 className="mt-5 font-serif text-6xl">
          Wrong chair.
        </h1>

        <p className="mx-auto mt-5 max-w-md text-sm leading-6 text-white/40">
          This page doesn't exist. Let's get you back to the
          studio.
        </p>

        <Link
          to="/"
          className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-3 text-sm transition hover:bg-white/10"
        >
          <ArrowLeft size={15} />
          Back home
        </Link>
      </div>
    </div>
  );
}