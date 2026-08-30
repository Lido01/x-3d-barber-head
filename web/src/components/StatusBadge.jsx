/**
 * Status pill for booking and payment states.
 *
 * The label is a straight translation of the backend value - it never
 * upgrades or guesses a status. Unknown values are shown verbatim so a
 * new backend state can't silently render as something friendlier than
 * it is.
 */

const TONES = {
  neutral: "border-white/15 bg-white/[0.04] text-white/60",
  waiting: "border-[#d6a85f]/40 bg-[#d6a85f]/10 text-[#e5bd7a]",
  good: "border-[#5fb98a]/40 bg-[#5fb98a]/10 text-[#7fcfa4]",
  bad: "border-[#e05a4f]/40 bg-[#e05a4f]/10 text-[#e0776b]",
};

const BOOKING = {
  pending: { label: "Pending", tone: "waiting" },
  confirmed: { label: "Confirmed", tone: "good" },
  cancelled: { label: "Cancelled", tone: "bad" },
  completed: { label: "Completed", tone: "good" },
  expired: { label: "Expired", tone: "neutral" },
};

const PAYMENT = {
  pending: { label: "Pending verification", tone: "waiting" },
  verified: { label: "Verified", tone: "good" },
  rejected: { label: "Rejected", tone: "bad" },
};

const TESTIMONIAL = {
  pending: { label: "Pending", tone: "waiting" },
  approved: { label: "Approved", tone: "good" },
  rejected: { label: "Rejected", tone: "bad" },
};

export default function StatusBadge({ status, kind = "booking", className = "" }) {
  if (!status) {
    return (
      <span
        className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] ${TONES.neutral} ${className}`}
      >
        Not submitted
      </span>
    );
  }

  const table =
    kind === "payment" ? PAYMENT : kind === "testimonial" ? TESTIMONIAL : BOOKING;

  const entry = table[status] || {
    label: String(status).replace(/_/g, " "),
    tone: "neutral",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] ${
        TONES[entry.tone]
      } ${className}`}
    >
      {entry.label}
    </span>
  );
}
