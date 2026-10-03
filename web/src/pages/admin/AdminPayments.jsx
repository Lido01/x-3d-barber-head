import { useMemo, useState } from "react";
import { Check, ExternalLink, RefreshCw, X } from "lucide-react";
import { Link } from "react-router-dom";

import Alert from "../../components/ui/Alert";
import {
  AdminButton,
  AdminDetails,
  AdminDetail,
  AdminEmpty,
  AdminField,
  AdminFilterTabs,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
  AdminSearch,
  AdminSheet,
  AdminStatus,
  AdminTextarea,
} from "../../components/admin/AdminUi";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { mediaUrl } from "../../services/api";
import { toArray } from "../../utils/toArray";
import {
  listPayments,
  rejectPayment,
  verifyPayment,
} from "../../services/paymentApi";
import { invalidateQuery, useQuery, EMPTY_LIST } from "../../hooks/useQuery";
import { formatDate, formatPrice, formatTime } from "../../utils/format";

/**
 * Staff payment verification.
 *
 * The queue. Its job is to answer one question per row - is this the right
 * money for this appointment - and that is why every row now carries the
 * booking's code, status, date and time rather than only the money: the
 * answer is impossible to give from an amount, a method and a reference
 * alone, and getting it wrong means accepting a transfer against the wrong
 * chair.
 *
 * Verifying calls POST /api/payments/payments/{id}/verify/. It no longer
 * confirms the booking as a side effect - reception confirms first and
 * payment opens second - so the booking status on a row is information
 * rather than something this screen quietly fixes. Both cached views are
 * invalidated afterwards, so the bookings screen moves with this one rather
 * than waiting out a TTL: deciding a payment is deciding the booking's money
 * state, and the two screens must never disagree about it.
 *
 * The same decision can be made on the bookings screen, where the
 * appointment and its receipt are on one card. This queue is the other way
 * in: everything still waiting, in one list, ordered by what needs doing.
 *
 * The default filter is `pending` because that is the queue staff actually
 * work.
 *
 * On a phone the receipt is the first thing shown, full width and tappable,
 * since deciding a payment means looking at it. From `lg` it moves beside the
 * details instead, because by then there is room for both and a 256px image
 * under a full-width column is wasted space.
 *
 * Rejecting asks for a reason in a sheet rather than expanding a field
 * inline: a rejection is a decision with a consequence for a customer, and
 * it should not be one tap away from the row above it.
 */

const FILTERS = [
  { key: "pending", label: "Pending" },
  { key: "verified", label: "Verified" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

export default function AdminPayments() {
  const { account } = useAdminAuth();

  const [filter, setFilter] = useState("pending");
  const [query, setQuery] = useState("");

  /** id of the payment currently being verified or rejected */
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  /** payment id whose reject sheet is open */
  const [rejectingId, setRejectingId] = useState(null);
  const [reason, setReason] = useState("");

  // Verified and rejected are final, so this queue settles rather than
  // drifting. The short TTL keeps a second staff member's decision from
  // sitting unseen.
  const {
    data,
    loading,
    error,
    isFetching: refreshing,
    refetch: load,
  } = useQuery("/payments/payments/", listPayments, {
    scope: "staff",
    staleMs: 30 * 1000,
    select: toArray,
  });

  const payments = data || EMPTY_LIST;

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
        payment.booking_code,
        payment.booking_barber,
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

/**
   * A decision here changes the booking's money state, so the bookings
   * screen is now out of date too - it carries the same payment attached.
   * It also has to reach the customer's live page, which reads the booking
   * status endpoint; both keys contain "bookings", so one invalidation
   * covers them and neither screen is left showing a payment the other has
   * already settled.
   */
  const refreshAffected = () => {
    invalidateQuery("payments");
    invalidateQuery("bookings");
    invalidateQuery("reports/dashboard");
  };

  const handleVerify = async (payment) => {
    setBusyId(payment.id);
    setActionError(null);

    try {
      await verifyPayment(payment.id);
      refreshAffected();
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
      await rejectPayment(payment.id, reason.trim());
      setRejectingId(null);
      setReason("");
      refreshAffected();
    } catch (apiError) {
      setActionError(apiError);
    } finally {
      setBusyId(null);
    }
  };

  const rejecting = payments.find((payment) => payment.id === rejectingId);
  const activeLabel = FILTERS.find((option) => option.key === filter)?.label;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Staff · Management"
        title="Payments"
        description={
          account?.username
            ? `Signed in as ${account.username}`
            : "Verify customer payments"
        }
        actions={
          <AdminButton onClick={load} icon={RefreshCw} loading={refreshing}>
            Refresh
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

      <AdminSearch
        value={query}
        onChange={setQuery}
        placeholder="Search by name, service or reference"
      />

      {actionError && !rejectingId && (
        <Alert tone="error" title="Action failed" details={actionError.fieldErrors}>
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
                : `No ${activeLabel?.toLowerCase()} payments right now.`
          }
          onRetry={load}
        />
      )}

      {!loading && !error && shown.length > 0 && (
        <ul className="grid gap-3">
          {shown.map((payment) => {
            const receipt = mediaUrl(payment.receipt);
            const busy = busyId === payment.id;
            const isPending = payment.status === "pending";

            return (
              <li key={payment.id}>
<AdminPanel>
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                        <p className="font-serif text-lg leading-none text-console-ink">
                          {payment.booking_code || `#${payment.booking}`}
                        </p>

                        <AdminStatus status={payment.status} />

                        {/* The booking's own state, so "is this money for a
                            chair the shop agreed to" is answerable from this
                            row. A pending booking on a payment is a booking
                            that should never have been payable. */}
                        <AdminStatus
                          status={payment.booking_status}
                          className="opacity-80"
                        />
                      </div>

                      <p className="mt-1.5 break-words text-sm font-medium text-console-ink">
                        {payment.booking_customer || "Unknown customer"}
                      </p>

                      <p className="mt-0.5 text-xs text-console-muted">
                        {[
                          payment.booking_service,
                          payment.booking_barber,
                          payment.booking_date &&
                            `${formatDate(payment.booking_date)} · ${formatTime(
                              payment.booking_start_time
                            )}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>

                    <p className="shrink-0 font-serif text-xl leading-none tabular-nums text-console-accent-strong">
                      {formatPrice(payment.amount)}
                    </p>
                  </div>

                  {/* Receipt first and full width on a phone: deciding a
                      payment means looking at it, and a 96px thumbnail
                      beside a two-column grid left it unreadable. */}
                  <div className="mt-4 border-t border-console-line pt-4">
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
                          loading="lazy"
                          className="h-40 w-full rounded-xl border border-console-line object-cover transition hover:border-console-accent sm:h-48 lg:h-56 lg:w-72 lg:object-contain"
                        />

                        <span className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-console-muted">
                          <ExternalLink size={11} />
                          Tap the receipt to open it full size
                        </span>
                      </a>
                    ) : (
                      <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-console-line-strong text-center text-xs text-console-faint">
                        No receipt attached
                      </div>
                    )}
                  </div>

<AdminDetails
                    columns={2}
                    className="mt-4 border-t border-console-line pt-4"
                  >
                    <AdminDetail label="Method">
                      {String(payment.method || "").replace(/_/g, " ") || "—"}
                    </AdminDetail>

                    <AdminDetail label="Reference" mono>
                      {payment.transaction_reference || "—"}
                    </AdminDetail>

                    {payment.rejection_reason && (
                      <AdminDetail
                        label="Rejection reason"
                        className="sm:col-span-2"
                      >
                        <span className="text-console-bad">
                          {payment.rejection_reason}
                        </span>
                      </AdminDetail>
                    )}
                  </AdminDetails>

                  {isPending && (
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-console-line pt-4">
                      <AdminButton
                        tone="good"
                        icon={Check}
                        loading={busy}
                        onClick={() => handleVerify(payment)}
                      >
                        Verify payment
                      </AdminButton>

                      <AdminButton
                        icon={X}
                        loading={busy}
                        onClick={() => {
                          setRejectingId(payment.id);
                          setReason("");
                          setActionError(null);
                        }}
                      >
                        Reject
                      </AdminButton>

                      {/* The same decision is available on the booking,
                          where the appointment and its receipt sit on one
                          card. Linked rather than repeated, so there is one
                          place that decides money and one that decides the
                          chair. */}
                      <Link
                        to="/admin/bookings"
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-[11px] text-console-muted transition hover:text-console-accent"
                      >
                        Open the booking
                        <ExternalLink size={11} />
                      </Link>
                    </div>
                  )}
                </AdminPanel>
              </li>
            );
          })}
        </ul>
      )}

{shown.length > 0 && (
        <p className="text-[11px] leading-5 text-console-muted">
          Bookings are confirmed by reception before payment opens, so
          everything here should sit on a confirmed booking. Verifying
          records who checked the money; it does not confirm the chair.
        </p>
      )}

      <AdminSheet
        open={Boolean(rejectingId)}
        onClose={() => {
          setRejectingId(null);
          setReason("");
          setActionError(null);
        }}
        title="Reject this payment"
        description={
          rejecting
            ? `Payment #${rejecting.id} for ${formatPrice(rejecting.amount)}. The customer sees this reason.`
            : ""
        }
        footer={
          <>
            <AdminButton
              onClick={() => {
                setRejectingId(null);
                setReason("");
                setActionError(null);
              }}
              disabled={busyId === rejectingId}
            >
              Cancel
            </AdminButton>

            <AdminButton
              tone="danger"
              loading={busyId === rejectingId}
              onClick={() => rejecting && handleReject(rejecting)}
            >
              Confirm rejection
            </AdminButton>
          </>
        }
      >
        {rejecting && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleReject(rejecting);
            }}
            className="space-y-4"
          >
            {actionError && (
              <Alert tone="error" title="Could not reject" details={actionError.fieldErrors}>
                {actionError.message}
              </Alert>
            )}

            <AdminField
              label="Reason"
              required
              error={actionError?.fieldErrors?.reason}
              hint="The customer reads this, so say what they need to do."
            >
              <AdminTextarea
                rows={4}
                value={reason}
                placeholder="Why is this payment being rejected?"
                onChange={(event) => setReason(event.target.value)}
              />
            </AdminField>

            <button type="submit" className="sr-only" aria-hidden="true" tabIndex={-1} />
          </form>
        )}
      </AdminSheet>
    </div>
  );
}
