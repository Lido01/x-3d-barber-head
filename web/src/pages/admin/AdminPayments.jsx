import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, LogOut, RefreshCw, X } from "lucide-react";
import { Link } from "react-router-dom";

import StatusBadge from "../../components/StatusBadge";
import Alert from "../../components/ui/Alert";
import Spinner from "../../components/ui/Spinner";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { mediaUrl } from "../../services/api";
import {
  listPayments,
  rejectPayment,
  verifyPayment,
} from "../../services/paymentApi";
import { formatPrice } from "../../utils/format";

/**
 * Staff payment verification.
 *
 * Verifying calls POST /api/payments/payments/{id}/verify/, which is
 * also what confirms the booking on the backend (verify_payment ->
 * confirm_booking). Rows are replaced with the API's response, so the
 * table always shows the server's state rather than an optimistic
 * guess.
 */

const FILTERS = [
  { key: "pending", label: "Pending" },
  { key: "verified", label: "Verified" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

export default function AdminPayments() {
  const { account, signOut } = useAdminAuth();

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("pending");

  /** id of the payment currently being verified or rejected */
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  /** payment id whose reject form is open */
  const [rejectingId, setRejectingId] = useState(null);
  const [reason, setReason] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    return listPayments()
      .then((data) => {
        setPayments(Array.isArray(data) ? data : data?.results || []);
        setLoading(false);
      })
      .catch((apiError) => {
        setError(apiError);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(() => {
    if (filter === "all") {
      return payments;
    }

    return payments.filter((payment) => payment.status === filter);
  }, [payments, filter]);

  const replaceRow = (updated) => {
    setPayments((rows) =>
      rows.map((row) => (row.id === updated.id ? updated : row))
    );
  };

  const handleVerify = async (payment) => {
    setBusyId(payment.id);
    setActionError(null);

    try {
      replaceRow(await verifyPayment(payment.id));
    } catch (apiError) {
      setActionError(apiError);
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (payment) => {
    if (!reason.trim()) {
      setActionError({
        message: "A rejection reason is required.",
        fieldErrors: {},
      });

      return;
    }

    setBusyId(payment.id);
    setActionError(null);

    try {
      replaceRow(await rejectPayment(payment.id, reason.trim()));
      setRejectingId(null);
      setReason("");
    } catch (apiError) {
      setActionError(apiError);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#090909] px-5 pb-24 pt-32 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1100px]">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] text-[#d6a85f]">
              Staff
            </p>

            <h1 className="mt-4 font-serif text-4xl leading-none sm:text-5xl">
              Payments
            </h1>

            {account?.username && (
              <p className="mt-3 text-xs text-white/35">
                Signed in as {account.username}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-xs font-semibold text-white/70 transition hover:border-[#d6a85f]/50 hover:text-white"
            >
              <RefreshCw size={13} />
              Refresh
            </button>

            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-xs font-semibold text-white/50 transition hover:border-[#e05a4f]/50 hover:text-[#e0776b]"
            >
              <LogOut size={13} />
              Sign out
            </button>
          </div>
        </div>

        {/* filters */}
        <div className="mt-9 flex gap-2 overflow-x-auto pb-2">
          {FILTERS.map((option) => {
            const active = filter === option.key;

            const count =
              option.key === "all"
                ? payments.length
                : payments.filter((row) => row.status === option.key).length;

            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setFilter(option.key)}
                className={`whitespace-nowrap rounded-full border px-4 py-2 text-xs transition ${
                  active
                    ? "border-[#d6a85f] bg-[#d6a85f] text-black"
                    : "border-white/10 text-white/50 hover:border-white/40"
                }`}
              >
                {option.label}
                <span className={active ? "text-black/60" : "text-white/30"}>
                  {" "}
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {actionError && (
          <Alert
            tone="error"
            title="Action failed"
            details={actionError.fieldErrors}
            className="mt-6"
          >
            {actionError.message}
          </Alert>
        )}

        {loading && (
          <div className="mt-8 flex justify-center rounded-2xl border border-white/10 bg-[#111] py-16">
            <Spinner label="Loading payments..." />
          </div>
        )}

        {!loading && error && (
          <Alert
            tone="error"
            title="Could not load payments"
            details={error.fieldErrors}
            onRetry={load}
            className="mt-8"
          >
            {error.message}
          </Alert>
        )}

        {!loading && !error && shown.length === 0 && (
          <Alert tone="info" title="Nothing here" onRetry={load} className="mt-8">
            {filter === "all"
              ? "No payments have been submitted yet."
              : `No ${filter} payments right now.`}
          </Alert>
        )}

        {!loading && !error && shown.length > 0 && (
          <div className="mt-8 grid gap-3">
            {shown.map((payment) => {
              const receipt = mediaUrl(payment.receipt);
              const busy = busyId === payment.id;
              const isPending = payment.status === "pending";

              return (
                <article
                  key={payment.id}
                  className="rounded-2xl border border-white/10 bg-[#111] p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="font-serif text-xl text-white">
                          Payment #{payment.id}
                        </p>

                        <StatusBadge status={payment.status} kind="payment" />
                      </div>

                      <p className="mt-2 text-xs text-white/45">
                        Booking #{payment.booking}
                        {payment.booking_customer
                          ? ` · ${payment.booking_customer}`
                          : ""}
                        {payment.booking_service
                          ? ` · ${payment.booking_service}`
                          : ""}
                      </p>
                    </div>

                    <p className="text-lg font-semibold text-[#d6a85f]">
                      {formatPrice(payment.amount)}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap items-start gap-5 border-t border-white/10 pt-4">
                    {receipt ? (
                      <a href={receipt} target="_blank" rel="noreferrer">
                        <img
                          src={receipt}
                          alt={`Receipt for payment ${payment.id}`}
                          className="h-24 w-24 rounded-lg border border-white/10 object-cover transition hover:border-[#d6a85f]/50"
                        />
                      </a>
                    ) : (
                      <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-dashed border-white/10 text-center text-[10px] leading-4 text-white/25">
                        No
                        <br />
                        receipt
                      </div>
                    )}

                    <dl className="grid flex-1 gap-3 sm:grid-cols-2">
                      <div>
                        <dt className="text-[10px] uppercase tracking-[0.2em] text-white/30">
                          Method
                        </dt>

                        <dd className="mt-1 text-sm capitalize text-white/75">
                          {String(payment.method || "").replace(/_/g, " ") ||
                            "—"}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-[10px] uppercase tracking-[0.2em] text-white/30">
                          Reference
                        </dt>

                        <dd className="mt-1 break-all text-sm text-white/75">
                          {payment.transaction_reference || "—"}
                        </dd>
                      </div>

                      {payment.rejection_reason && (
                        <div className="sm:col-span-2">
                          <dt className="text-[10px] uppercase tracking-[0.2em] text-white/30">
                            Rejection reason
                          </dt>

                          <dd className="mt-1 text-sm text-[#e0776b]">
                            {payment.rejection_reason}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  {isPending && (
                    <div className="mt-4 border-t border-white/10 pt-4">
                      {rejectingId === payment.id ? (
                        <div className="grid gap-3">
                          <textarea
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            placeholder="Why is this payment being rejected?"
                            rows={2}
                            disabled={busy}
                            className="w-full resize-none rounded-xl border border-white/10 bg-[#181818] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#d6a85f]/50"
                          />

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleReject(payment)}
                              disabled={busy}
                              className="inline-flex items-center gap-2 rounded-full bg-[#e05a4f] px-4 py-2.5 text-xs font-semibold text-black transition hover:bg-[#e0776b] disabled:opacity-60"
                            >
                              {busy ? "Rejecting..." : "Confirm rejection"}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setRejectingId(null);
                                setReason("");
                                setActionError(null);
                              }}
                              disabled={busy}
                              className="rounded-full border border-white/15 px-4 py-2.5 text-xs font-semibold text-white/60 transition hover:text-white disabled:opacity-60"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleVerify(payment)}
                            disabled={busy}
                            className="inline-flex items-center gap-2 rounded-full bg-[#d6a85f] px-4 py-2.5 text-xs font-semibold text-black transition hover:bg-[#e5bd7a] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {busy ? (
                              <>
                                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/25 border-t-black" />
                                Verifying...
                              </>
                            ) : (
                              <>
                                <Check size={14} />
                                Verify payment
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setRejectingId(payment.id);
                              setActionError(null);
                            }}
                            disabled={busy}
                            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-xs font-semibold text-white/60 transition hover:border-[#e05a4f]/50 hover:text-[#e0776b] disabled:opacity-60"
                          >
                            <X size={14} />
                            Reject
                          </button>
                        </div>
                      )}

                      <p className="mt-3 text-[10px] leading-5 text-white/25">
                        Verifying a payment also confirms its booking.
                      </p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        <p className="mt-10 text-center text-[11px] text-white/25">
          <Link to="/" className="transition hover:text-white/60">
            Back to the site
          </Link>
        </p>
      </div>
    </div>
  );
}
