import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, RefreshCw, Search, X } from "lucide-react";

import StatusBadge from "../../components/StatusBadge";
import Alert from "../../components/ui/Alert";
import Spinner from "../../components/ui/Spinner";
import {
  AdminButton,
  AdminEmpty,
  AdminFilterTabs,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
} from "../../components/admin/AdminUi";
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
 * list always shows the server's state rather than an optimistic guess.
 *
 * The default filter is `pending` because that is the queue staff
 * actually work. On a phone the receipt is the first thing shown, full
 * width and tappable, since deciding a payment means looking at it, and
 * the reference and method sit underneath as scannable rows rather
 * than a two-column grid that would be 150px wide.
 */

const FILTERS = [
  { key: "pending", label: "Pending" },
  { key: "verified", label: "Verified" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

const TEXTAREA =
  "w-full resize-none rounded-xl border border-white/10 bg-[#181818] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#d6a85f]/50";

export default function AdminPayments() {
  const { account } = useAdminAuth();

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("pending");
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  /** id of the payment currently being verified or rejected */
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  /** payment id whose reject form is open */
  const [rejectingId, setRejectingId] = useState(null);
  const [reason, setReason] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    setRefreshing(true);

    return listPayments()
      .then((data) => {
        setPayments(Array.isArray(data) ? data : data?.results || []);
        setLoading(false);
        setRefreshing(false);
      })
      .catch((apiError) => {
        setError(apiError);
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const tally = { all: payments.length };

    for (const option of FILTERS) {
      tally[option.key] = payments.filter(
        (row) => row.status === option.key
      ).length;
    }

    return tally;
  }, [payments]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return payments.filter((payment) => {
      if (filter !== "all" && payment.status !== filter) {
        return false;
      }

      if (!needle) {
        return true;
      }

      return [
        payment.booking_customer,
        payment.booking_service,
        payment.transaction_reference,
        String(payment.id),
        String(payment.booking),
      ]
        .filter(Boolean)
        .some((field) =>
          String(field).toLowerCase().includes(needle)
        );
    });
  }, [payments, filter, query]);

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
    <div>
      <AdminPageHeader
        eyebrow="Staff · Management"
        title="Payments"
        description={
          account?.username
            ? `Signed in as ${account.username}`
            : "Verify customer payments"
        }
        actions={
          <AdminButton
            onClick={load}
            icon={RefreshCw}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </AdminButton>
        }
      />

      <AdminFilterTabs
        options={FILTERS.map((option) => ({
          ...option,
          count: counts[option.key] ?? 0,
        }))}
        value={filter}
        onChange={setFilter}
      />

      <div className="relative mt-4">
        <Search
          size={15}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
        />

        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, service or reference"
          aria-label="Search payments"
          className="w-full rounded-xl border border-white/10 bg-[#181818] py-3 pl-11 pr-11 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#d6a85f]/50"
        />

        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-white/40 transition hover:text-white"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {actionError && (
        <Alert
          tone="error"
          title="Action failed"
          details={actionError.fieldErrors}
          className="mt-5"
        >
          {actionError.message}
        </Alert>
      )}

      {loading && <AdminLoading label="Loading payments..." />}

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
        <AdminEmpty
          title="Nothing here"
          body={
            query
              ? `No payments match "${query}".`
              : filter === "all"
                ? "No payments have been submitted yet."
                : `No ${filter} payments right now.`
          }
          onRetry={load}
        />
      )}

      {!loading && !error && shown.length > 0 && (
        <div className="mt-5 grid gap-3">
          {shown.map((payment) => {
            const receipt = mediaUrl(payment.receipt);
            const busy = busyId === payment.id;
            const isPending = payment.status === "pending";

            return (
              <AdminPanel key={payment.id}>
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <p className="font-serif text-lg text-white sm:text-xl">
                        Payment #{payment.id}
                      </p>

                      <StatusBadge
                        status={payment.status}
                        kind="payment"
                      />
                    </div>

                    <p className="mt-2 break-words text-xs text-white/45">
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

                {/* Receipt first and full width on a phone: deciding a
                    payment means looking at it, and a 96px thumbnail
                    beside a two-column grid left it unreadable. */}
                <div className="mt-4 border-t border-white/10 pt-4">
                  {receipt ? (
                    <a
                      href={receipt}
                      target="_blank"
                      rel="noreferrer"
                      className="block"
                    >
                      <img
                        src={receipt}
                        alt={`Receipt for payment ${payment.id}`}
                        className="h-40 w-full rounded-xl border border-white/10 object-cover transition hover:border-[#d6a85f]/50 sm:h-48 lg:h-56 lg:w-56 lg:object-contain"
                      />

                      <span className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-white/35">
                        <ExternalLink size={11} />
                        Tap the receipt to open it full size
                      </span>
                    </a>
                  ) : (
                    <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-white/10 text-center text-xs text-white/25">
                      No receipt attached
                    </div>
                  )}
                </div>

                <dl className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2">
                  <div className="min-w-0">
                    <dt className="text-[10px] uppercase tracking-[0.2em] text-white/30">
                      Method
                    </dt>
                    <dd className="mt-1 text-sm capitalize text-white/75">
                      {String(payment.method || "").replace(/_/g, " ") ||
                        "—"}
                    </dd>
                  </div>

                  <div className="min-w-0">
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

                      <dd className="mt-1 break-words text-sm text-[#e0776b]">
                        {payment.rejection_reason}
                      </dd>
                    </div>
                  )}
                </dl>

                {isPending && (
                  <div className="mt-4 border-t border-white/10 pt-4">
                    {rejectingId === payment.id ? (
                      <div className="grid gap-3">
                        <textarea
                          value={reason}
                          onChange={(event) =>
                            setReason(event.target.value)
                          }
                          placeholder="Why is this payment being rejected?"
                          rows={2}
                          disabled={busy}
                          className={TEXTAREA}
                        />

                        <div className="flex flex-wrap gap-2">
                          <AdminButton
                            tone="primary"
                            onClick={() =>
                              handleReject(payment)
                            }
                            disabled={busy}
                            className="!border-[#e05a4f] !bg-[#e05a4f] !text-black hover:!bg-[#e0776b]"
                          >
                            {busy ? "Rejecting..." : "Confirm rejection"}
                          </AdminButton>

                          <AdminButton
                            onClick={() => {
                              setRejectingId(null);
                              setReason("");
                              setActionError(null);
                            }}
                            disabled={busy}
                          >
                            Cancel
                          </AdminButton>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <AdminButton
                          tone="primary"
                          icon={busy ? undefined : Check}
                          onClick={() => handleVerify(payment)}
                          disabled={busy}
                        >
                          {busy ? (
                            <Spinner size={13} label="Verifying" />
                          ) : (
                            "Verify payment"
                          )}
                        </AdminButton>

                        <AdminButton
                          icon={X}
                          onClick={() => {
                            setRejectingId(payment.id);
                            setActionError(null);
                          }}
                          disabled={busy}
                        >
                          Reject
                        </AdminButton>
                      </div>
                    )}

                    <p className="mt-3 text-[10px] leading-5 text-white/25">
                      Verifying a payment also confirms its booking.
                    </p>
                  </div>
                )}
              </AdminPanel>
            );
          })}
        </div>
      )}
    </div>
  );
}
