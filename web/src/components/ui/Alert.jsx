import { AlertTriangle, CheckCircle2, Info, RefreshCw } from "lucide-react";

const TONES = {
  error: {
    box: "border-[#e05a4f]/30 bg-[#e05a4f]/10",
    icon: "text-[#e0776b]",
    Icon: AlertTriangle,
  },
  success: {
    box: "border-[#5fb98a]/30 bg-[#5fb98a]/10",
    icon: "text-[#7fcfa4]",
    Icon: CheckCircle2,
  },
  info: {
    box: "border-white/10 bg-white/[0.03]",
    icon: "text-[#d6a85f]",
    Icon: Info,
  },
};

/**
 * Message panel for API errors and status explanations.
 *
 * `details` renders backend field messages that have no matching input
 * on screen, so a DRF validation error is never silently swallowed.
 */
export default function Alert({
  tone = "info",
  title,
  children,
  details,
  onRetry,
  retryLabel = "Try again",
  className = "",
}) {
  const { box, icon, Icon } = TONES[tone] || TONES.info;

  const detailEntries = details ? Object.entries(details) : [];

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={` rounded-xl border p-4 ${box} ${className}`}
    >
      <div className="flex gap-3">
        <Icon size={17} className={`mt-0.5 shrink-0 ${icon}`} />

        <div className="min-w-0 flex-1">
          {title && (
            <p className="text-sm font-semibold text-white">{title}</p>
          )}

          {children && (
            <div
              className={`text-xs leading-6 text-white/60 ${title ? "mt-1" : ""}`}
            >
              {children}
            </div>
          )}

          {detailEntries.length > 0 && (
            <ul className="mt-2 space-y-1">
              {detailEntries.map(([field, message]) => (
                <li key={field} className="text-xs leading-5 text-white/55">
                  <span className="text-white/40">
                    {field.replace(/_/g, " ")}:
                  </span>{" "}
                  {message}
                </li>
              ))}
            </ul>
          )}

          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-semibold text-white/80 transition hover:border-[#d6a85f]/50 hover:text-white"
            >
              <RefreshCw size={12} />
              {retryLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
