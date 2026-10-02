import { ExternalLink, FileImage, Receipt } from "lucide-react";

import StatusBadge from "../StatusBadge";
import { mediaUrl } from "../../services/api";
import { formatPrice } from "../../utils/format";

/**
 * What was paid, and proof of it.
 *
 * Shown beside every booking in a customer's history rather than only on
 * the confirmation page, because "did I pay for this, and can I prove
 * it" is the question someone scrolling their own bookings is usually
 * asking - and a receipt they cannot find is exactly what they are
 * hoping this screen will surface.
 *
 * The screenshot is rendered inline and clickable rather than as a
 * download link: on a phone, "was that the right screenshot" is answered
 * by looking at it.
 */

const TILE =
  "h-11 w-11 shrink-0 rounded-lg border border-white/10 object-cover transition hover:border-[#d6a85f]/60";

export default function PaymentPreview({ payment, bookingCode }) {
  // Nothing sent. Stated rather than hidden, because an absent payment
  // and a payment that exists but has not been looked at are very
  // different things to the person reading.
  if (!payment) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/25">
            <Receipt size={16} />
          </span>

          <div className="min-w-0">
            <p className="text-xs font-semibold text-white/70">
              No payment sent
            </p>

            <p className="mt-0.5 text-[11px] leading-5 text-white/35">
              The shop has not received money for this booking yet.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const receipt = mediaUrl(payment.receipt);
  const rejected = payment.status === "rejected";

  return (
    <div
      className={`rounded-xl border p-4 ${
        rejected
          ? "border-[#e05a4f]/25 bg-[#e05a4f]/[0.06]"
          : payment.status === "verified"
            ? "border-[#5fb98a]/25 bg-[#5fb98a]/[0.05]"
            : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <div className="flex gap-3">
        {receipt ? (
          <a
            href={receipt}
            target="_blank"
            rel="noreferrer"
            title="Open the receipt you sent"
            className="group relative"
          >
            <img src={receipt} alt="Payment receipt you sent" className={TILE} />

            <span className="pointer-events-none absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-white/20 bg-[#0c0c0c]">
              <ExternalLink size={8} className="text-white/60" />
            </span>
          </a>
        ) : (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/25">
            <FileImage size={16} />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-white/80">
              {formatPrice(payment.amount)}
              <span className="ml-2 font-normal capitalize text-white/40">
                {String(payment.method || "").replace(/_/g, " ")}
              </span>
            </p>

            <StatusBadge status={payment.status} kind="payment" />
          </div>

          {payment.transaction_reference && (
            <p className="mt-1.5 break-all text-[11px] text-white/45">
              <span className="text-white/30">TIN </span>
              {payment.transaction_reference}
            </p>
          )}

          {!receipt && !payment.transaction_reference && (
            <p className="mt-1.5 text-[11px] text-white/35">
              No screenshot or reference was recorded with this payment.
            </p>
          )}

          {rejected && payment.rejection_reason && (
            <p className="mt-2 border-t border-white/10 pt-2 text-[11px] leading-5 text-[#e0776b]/85">
              {payment.rejection_reason}
            </p>
          )}

          {payment.verified_at && (
            <p className="mt-1.5 text-[11px] text-white/30">
              Checked{" "}
              {new Date(payment.verified_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
              {bookingCode ? ` · booking ${bookingCode}` : ""}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}