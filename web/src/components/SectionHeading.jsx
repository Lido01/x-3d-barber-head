export default function SectionHeading({
  eyebrow,
  title,
  description,
  center = false,
}) {
  return (
    <div
      className={`max-w-2xl ${
        center ? "mx-auto text-center" : ""
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#d6a85f]">
        {eyebrow}
      </p>

      <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
        {title}
      </h2>

      {description && (
        <p className="mt-5 text-base leading-7 text-white/45">
          {description}
        </p>
      )}
    </div>
  );
}