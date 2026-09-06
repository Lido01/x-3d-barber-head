export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080808] px-5 text-center text-white">

      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-[#d6a85f]">
          404
        </p>

        <h1 className="mt-5 text-5xl font-semibold">
          This chair doesn't exist.
        </h1>

        <p className="mt-4 text-white/40">
          The page you're looking for couldn't be found.
        </p>
      </div>

    </main>
  );
}