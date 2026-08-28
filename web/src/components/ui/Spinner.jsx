import { Loader2 } from "lucide-react";

/** Inline loading indicator. `label` is announced to screen readers. */
export default function Spinner({ size = 16, label, className = "" }) {
  return (
    <span
      role="status"
      className={`inline-flex items-center gap-2 text-white/45 ${className}`}
    >
      <Loader2 size={size} className="animate-spin text-[#d6a85f]" />

      {label && <span className="text-xs">{label}</span>}

      {!label && <span className="sr-only">Loading</span>}
    </span>
  );
}
