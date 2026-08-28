/** Inline validation message shown directly under its input. */
export default function FieldError({ message, id }) {
  if (!message) {
    return null;
  }

  return (
    <p id={id} role="alert" className="mt-2 text-[11px] leading-5 text-[#e0776b]">
      {message}
    </p>
  );
}
