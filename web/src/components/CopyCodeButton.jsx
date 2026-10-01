import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * A booking code with a copy button.
 *
 * The code is the one piece of a booking the customer has to hold on to:
 * it is what they quote on the phone, what they type into "my bookings",
 * and what appears in a screenshot of their confirmation. Asking them to
 * select and copy eight characters by hand is where that chain breaks, so
 * the button is right there next to it.
 *
 * The clipboard API is not available everywhere - an insecure origin, an
 * older Safari, a denied permission - so there is a real fallback: select
 * the text and copy it the long way. The state says which happened, and
 * says so for long enough to be read.
 */

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fall through to the manual path rather than failing silently.
    }
  }

  const field = document.createElement("textarea");

  field.value = value;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";

  document.body.appendChild(field);
  field.select();

  let copied = false;

  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }

  document.body.removeChild(field);

  return copied;
}

export default function CopyCodeButton({
  value,
  label = "Booking code",
  hint = "Keep this. You will need it to check your booking.",
  size = "lg",
  className = "",
}) {
  const [state, setState] = useState("idle");
  const timer = useRef(null);

  const handleCopy = useCallback(async () => {
    const copied = await copyText(value);

    setState(copied ? "copied" : "failed");

    clearTimeout(timer.current);

    timer.current = setTimeout(() => setState("idle"), 2200);
  }, [value]);

  useEffect(() => () => clearTimeout(timer.current), []);

  if (!value) {
    return null;
  }

  const large = size === "lg";

  return (
    <div className={className}>
      <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">
        {label}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <code
          className={`select-all font-serif font-semibold tracking-[0.12em] text-white ${
            large ? "text-3xl sm:text-4xl" : "text-xl"
          }`}
        >
          {value}
        </code>

        <button
          type="button"
          onClick={handleCopy}
          aria-label={`Copy ${value}`}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] transition ${
            state === "copied"
              ? "border-[#5fb98a]/50 bg-[#5fb98a]/10 text-[#7fcfa4]"
              : state === "failed"
                ? "border-[#e05a4f]/50 bg-[#e05a4f]/10 text-[#e0776b]"
                : "border-white/15 text-white/60 hover:border-[#d6a85f]/50 hover:text-white"
          }`}
        >
          {state === "copied" ? (
            <>
              <Check size={12} />
              Copied
            </>
          ) : state === "failed" ? (
            "Select and copy"
          ) : (
            <>
              <Copy size={12} />
              Copy
            </>
          )}
        </button>
      </div>

      {hint && state !== "copied" && (
        <p className="mt-2 text-[11px] leading-5 text-white/30">
          {state === "failed"
            ? "Your browser would not copy it automatically - long-press the code and choose Copy."
            : hint}
        </p>
      )}
    </div>
  );
}