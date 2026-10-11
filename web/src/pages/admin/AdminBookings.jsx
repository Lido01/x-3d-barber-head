import { useMemo, useState } from "react";
import {
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Copy,
  ExternalLink,
  FileImage,
  MoveHorizontal,
  Receipt,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";

import Alert from "../../components/ui/Alert";
import {
  AdminButton,
  AdminChip,
  AdminConfirmButton,
  AdminDetails,
  AdminDetail,
  AdminEmpty,
  AdminFilterTabs,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
  AdminSearch,
  AdminSheet,
  AdminStatus,
  AdminTable,
  AdminTableCell,
  AdminTableDetail,
  AdminTableHead,
  AdminTableHeadCell,
  AdminTableHint,
  AdminTableRow,
  AdminTextarea,
} from "../../components/admin/AdminUi";
import { EMPTY_LIST, invalidateQuery, useQuery } from "../../hooks/useQuery";
import { toArray } from "../../utils/toArray";
import {
  cancelBooking,
  completeBooking,
  confirmBooking,
  deleteBooking,
  listBookings,
} from "../../services/bookingApi";
import {
  rejectPayment,
  verifyPayment,
} from "../../services/paymentApi";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { hasCapability } from "../../utils/staffRole";
import { mediaUrl } from "../../services/api";
import { bookingCodeOf } from "../../utils/bookingCode";
import { formatDate, formatPrice, formatTimeRange } from "../../utils/format";
import { formatEthiopianDate } from "../../utils/ethiopianDate";

/**
 * Bookings management — GET /api/bookings/ (staff).
 *
 * ## A table, not a stack of cards
 *
 * This is the screen the whole booking/payment rule is enforced from, so
 * it has to show both halves at once. The API now sends the attached payment
 * with every row - amount, method, reference, receipt image, who verified
 * it and when, or the reason it was rejected - which is what removes the
 * two-screen routine this used to need: open the booking, note the id, leave,
 * open the payment queue, find the row, then work out whether the two
 * described the same appointment. They now cannot disagree, because there is
 * only one of them.
 *
 * It also means **verify** and **reject** live here, on the row, where the
 * appointment the money is for is on screen. Before, a decision about money
 * was made on a queue that had lost that context.
 *
 * The rows are a table because this is a working list, not a feed. Six
 * cards stacked down a phone screen show one fact each; six columns on one
 * line show every booking with its customer, its service, its time and its
 * money state at once, which is the only way to find the one that is
 * confirmed, unpaid and for 09:00 tomorrow while working through forty of
 * them. Below the width the columns need, the table scrolls sideways rather
 * than wrapping every cell to three lines - see `AdminTable`.
 *
 * ## The order on screen
 *
 *     Confirm -> Payment sent -> Checked -> Complete
 *
 * Reception confirms the chair first and payment opens second, so the
 * Confirm button is the first thing on a pending booking and the payment
 * column says "not payable yet" while it is still pending. A verified
 * payment no longer confirms the booking on the server (it did already need
 * to be confirmed to pay), so nothing on this screen assumes the two happen
 * in the other order.
 *
 * ## Money is only shown to an account entitled to see it
 *
 * The API attaches the payment to a booking row only when the caller holds
 * `payments.view`, and this screen reads the same two capabilities from the
 * session to decide what to render. A receptionist who can work the diary
 * but not the money still sees whether an appointment is unpaid - that is
 * what the diary is for - without being handed the amount, the transaction
 * reference or the receipt image, and without Verify and Reject buttons
 * that would only ever answer 403.
 *
 * The booking code leads and is searchable, because it is what a customer
 * reads off their confirmation and what staff have to recognise when someone
 * rings. It is also the fastest way to find one booking in a list sorted by
 * date: the caller already has the number and does not know who it belongs
 * to. That is also why it is the column that sticks to the left edge - it
 * has to stay readable at every scroll position for the rest of the row to
 * mean anything.
 *
 * A write invalidates the cached bookings list *and* the cached availability,
 * so the slots the booking form is offering drop the slot just taken without
 * anyone pressing refresh.
 */

/** Human labels. The raw status keys are for the API, not for a person. */
const FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "To confirm" },
  { key: "confirmed", label: "Confirmed" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "unpaid", label: "Awaiting payment" },
  { key: "to_verify", label: "Payments to check" },
];

/**
 * Where the money stands on this booking.
 *
 * Read from `payment_status` - the state word, which every staff account
 * gets - rather than from the attached payment, which only arrives for an
 * account holding `payments.view`. Falling back to the booking's status
 * instead would draw a confirmed, already-paid booking as "to pay" for any
 * account that cannot see money, which sends reception chasing money that
 * has already arrived.
 *
 * The two genuinely disagree, which is why this is not `booking.status`:
 * staff confirm a walk-in who will pay at the counter, and a payment can be
 * rejected while the appointment is held. Both leave a live appointment
 * with a confirmed badge and no money behind it, which is the thing worth
 * noticing before the customer is in the chair.
 */
function paymentState(booking) {
  if (booking.payment_status) {
    return booking.payment_status;
  }

  return booking.status === "pending" || booking.status === "confirmed"
    ? "none"
    : "settled";
}

/**
 * Whether this booking can be paid for right now.
 *
 * The server's own `payment_open`, not a re-derivation. A console that
 * worked it out from `booking.status` would offer a "waiting on the shop"
 * badge for a booking the customer can in fact pay for, and the badge is the
 * thing staff trust when deciding what to chase.
 */
function isPayable(booking) {
  return Boolean(booking.payment_open);
}

/**
 * One booking: a row, and the panel it opens.
 *
 * ## What is in the row and what is in the panel
 *
 * The row holds everything the queue is worked from - code, status, who it
 * is for, what it is, when, and whether the money is in. Those are the
 * facts that decide whether to touch a booking, and they have to be
 * scannable down a column or the table is decoration.
 *
 * The panel holds what is needed once you *have* decided: the customer's
 * note, the service length and price, the full payment record and the
 * receipt image. A 56px receipt thumbnail does not fit in a cell without
 * making the row unreadable, so it opens instead.
 *
 * Only one panel is open at a time. Two panels open means the second one
 * has pushed the row above it off the top of the screen, and the reason
 * they open is to compare a row against something - the next row, or the
 * one you had open a moment ago.
 *
 * ## Why the code column sticks to the left edge
 *
 * Six columns, and on a 360px screen the customer and the time are both
 * off the edge when you reach the actions. The code is the one field that
 * has to be readable at every scroll position - it is what the customer
 * quotes on the phone and what staff read out - so it stays put while the
 * rest of the row slides under it.
 */
function BookingRows({
  booking,
  code,
  money,
  payable,
  payment,
  busy,
  available,
  expanded,
  copied,
  canSeePayments,
  canVerifyPayments,
  onToggle,
  onCopy,
  onAction,
  onVerify,
  onReject,
}) {
  const receipt = payment ? mediaUrl(payment.receipt) : "";

  return (
    <>
      <AdminTableRow aria-expanded={expanded}>
        {/* --- the code, and the thing that opens the panel ---------- */}
        <AdminTableCell sticky>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={expanded}
              aria-label={
                expanded
                  ? `Hide the details of booking ${code}`
                  : `Show the details of booking ${code}`
              }
              className="-ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-console-muted transition hover:bg-console-sunken hover:text-console-ink"
            >
              {expanded ? (
                <ChevronDown size={15} />
              ) : (
                <ChevronRight size={15} />
              )}
            </button>

            <span className="font-serif text-base leading-none tracking-[0.08em] text-console-ink">
              {code}
            </span>

            <button
              type="button"
              onClick={onCopy}
              title={`Copy ${code}`}
              aria-label={`Copy booking code ${code}`}
              className="shrink-0 rounded-full border border-console-line p-1 text-console-muted transition hover:border-console-accent hover:text-console-accent"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
            </button>
          </div>

          <div className="mt-2">
            <AdminStatus status={booking.status} />
          </div>
        </AdminTableCell>

        {/* --- who it is for ----------------------------------------- */}
        <AdminTableCell>
          <span className="block break-words font-medium text-console-ink">
            {booking.customer_name}
          </span>

          {booking.customer_phone && (
            <a
              href={`tel:${booking.customer_phone}`}
              className="mt-0.5 inline-block text-xs tabular-nums text-console-muted transition hover:text-console-accent"
            >
              {booking.customer_phone}
            </a>
          )}
        </AdminTableCell>

        {/* --- what it is -------------------------------------------- */}
        <AdminTableCell>
          <span className="block break-words text-console-ink">
            {booking.service_name || "—"}
          </span>

          <span className="mt-0.5 block text-xs text-console-muted">
            {booking.barber_name || "Auto-assigned"}
          </span>
        </AdminTableCell>

        {/* --- when, in both calendars ------------------------------- */}
        <AdminTableCell>
          <span className="block font-medium tabular-nums text-console-ink">
            {formatDate(booking.booking_date)}
          </span>

          <span className="mt-0.5 block text-xs tabular-nums text-console-accent-strong">
            {formatEthiopianDate(booking.booking_date)}
          </span>

          <span className="mt-0.5 block text-xs tabular-nums text-console-muted">
            {formatTimeRange(booking.start_time, booking.end_time)}
          </span>
        </AdminTableCell>

        {/* --- where the money stands ------------------------------- */}
        <AdminTableCell>
          {/* The money state, spelled out. A confirmed booking with
              nothing paid is the case a confirmation badge alone hides,
              and it is the case reception needs to chase. */}
          {money === "none" &&
            (payable ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-console-warn/30 bg-console-warn-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-console-warn">
                <CircleDollarSign size={10} />
                To pay
              </span>
            ) : (
              <AdminChip tone="neutral">Not payable yet</AdminChip>
            ))}

          {money === "rejected" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-console-bad/40 bg-console-bad-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-console-bad">
              <CircleDollarSign size={10} />
              Rejected
            </span>
          )}

          {money === "verified" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-console-good/40 bg-console-good-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-console-good">
              Paid
            </span>
          )}

          {money === "pending" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-console-warn px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-console-warn">
              <Receipt size={10} />
              To check
            </span>
          )}

          {payment && (
            <span className="mt-1.5 block text-sm font-medium tabular-nums text-console-ink">
              {formatPrice(payment.amount)}
            </span>
          )}
        </AdminTableCell>

        {/* --- what can be done to it -------------------------------- */}
        <AdminTableCell>
          <div className="flex flex-wrap gap-2">
            {available.confirm && (
              <AdminButton
                tone="primary"
                icon={Check}
                loading={busy}
                onClick={() => onAction(available.confirm)}
              >
                Confirm
              </AdminButton>
            )}

            {available.complete && (
              <AdminButton
                tone="primary"
                icon={CheckCheck}
                loading={busy}
                onClick={() => onAction(available.complete)}
              >
                Complete
              </AdminButton>
            )}

            {payment?.status === "pending" && canVerifyPayments && (
              <>
                <AdminButton
                  tone="good"
                  icon={Check}
                  loading={busy}
                  onClick={onVerify}
                >
                  Verify payment
                </AdminButton>

                <AdminButton
                  icon={X}
                  loading={busy}
                  onClick={onReject}
                >
                  Reject
                </AdminButton>
              </>
            )}

            {/*
              A pending payment this account can see but not decide. Shown
              rather than silent, because the booking is sitting in
              someone's queue waiting for someone else and the screen
              should say so.
            */}
            {payment?.status === "pending" &&
              !canVerifyPayments && (
                <span className="text-[11px] leading-5 text-console-muted">
                  Waiting on someone with payments.verify.
                </span>
              )}

            {available.cancel && (
              <AdminConfirmButton
                icon={X}
                loading={busy}
                message={`Cancel booking ${code} for ${booking.customer_name}? The slot is released and the customer sees it as cancelled.`}
                onConfirm={() => onAction(available.cancel)}
              >
                Cancel
              </AdminConfirmButton>
            )}

            <AdminConfirmButton
              icon={Trash2}
              loading={busy}
              message={`Permanently delete booking ${code}? This cannot be undone, and the customer's record of it goes with it.`}
              onConfirm={() => onAction("delete")}
            >
              Delete
            </AdminConfirmButton>
          </div>
        </AdminTableCell>
      </AdminTableRow>

      {/* --- the panel ---------------------------------------------- */}
      {expanded && (
        <AdminTableDetail columns={6}>
          <AdminPanel className="p-4">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
              <div className="min-w-0">
                <AdminDetails columns={3}>
                  <AdminDetail label="Service">
                    {booking.service_name || "—"}
                  </AdminDetail>

                  <AdminDetail label="Barber">
                    {booking.barber_name || "Auto-assigned"}
                  </AdminDetail>

                  <AdminDetail label="Notes">
                    {booking.notes || "—"}
                  </AdminDetail>
                </AdminDetails>

                <div className="mt-4 border-t border-console-line pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-console-muted">
                      Payment
                    </p>

                    {payment && canSeePayments && (
                      <Link
                        to="/admin/payments"
                        className="inline-flex items-center gap-1 text-[11px] text-console-muted transition hover:text-console-accent"
                      >
                        Open the payment queue
                        <ExternalLink size={10} />
                      </Link>
                    )}
                  </div>

                  {/* No `payments.view`, so the API did not send the payment
                      and there is nothing to render. The unpaid badge in the
                      row is still there on purpose: whether an appointment
                      owes money is what the diary is for. */}
                  {!canSeePayments && (
                    <p className="mt-2 text-sm leading-6 text-console-muted">
                      Payment details are not shown to your account. The paid /
                      unpaid state in the row is still accurate.
                    </p>
                  )}

                  {canSeePayments && !payment && (
                    <p className="mt-2 text-sm leading-6 text-console-muted">
                      {payable
                        ? "Nothing sent yet. This booking is confirmed, so the customer can pay now."
                        : booking.status === "pending"
                          ? "Nothing sent yet, and nothing can be — this booking has not been confirmed, so payment is closed until it is."
                          : "No payment for this booking."}
                    </p>
                  )}

                  {canSeePayments && payment && (
                    <AdminDetails columns={2} className="mt-3">
                      <AdminDetail label="Amount">
                        <span className="font-serif text-lg tabular-nums text-console-accent-strong">
                          {formatPrice(payment.amount)}
                        </span>
                      </AdminDetail>

                      <AdminDetail label="Method">
                        {String(payment.method || "").replace(/_/g, " ") ||
                          "—"}
                      </AdminDetail>

                      <AdminDetail label="Reference" mono>
                        {payment.transaction_reference || "—"}
                      </AdminDetail>

                      <AdminDetail label="Sent">
                        {new Date(payment.created_at).toLocaleString("en-GB", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </AdminDetail>

                      {payment.verified_at && (
                        <AdminDetail label="Checked">
                          {new Date(payment.verified_at).toLocaleString(
                            "en-GB",
                            {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </AdminDetail>
                      )}

                      {payment.rejection_reason && (
                        <AdminDetail
                          label="Rejected because"
                          className="sm:col-span-2"
                        >
                          <span className="text-console-bad">
                            {payment.rejection_reason}
                          </span>
                        </AdminDetail>
                      )}
                    </AdminDetails>
                  )}
                </div>
              </div>

              {/* The receipt, in the space it needs to be read. A
                  thumbnail in a cell would make the row unreadable, and
                  deciding a payment means looking at it. */}
              <div className="min-w-0">
                {receipt ? (
                  <a href={receipt} target="_blank" rel="noreferrer" className="block">
                    <img
                      src={receipt}
                      alt={`Receipt sent for booking ${code}`}
                      loading="lazy"
                      className="h-44 w-full rounded-xl border border-console-line object-cover transition hover:border-console-accent sm:object-contain"
                    />

                    <span className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-console-muted">
                      <ExternalLink size={11} />
                      Open the receipt full size
                    </span>
                  </a>
                ) : (
                  <div className="flex h-24 items-center justify-center gap-2 rounded-xl border border-dashed border-console-line-strong text-center text-xs text-console-faint">
                    <FileImage size={14} />
                    No receipt attached
                  </div>
                )}
              </div>
            </div>
          </AdminPanel>
        </AdminTableDetail>
      )}
    </>
  );
}

export default function AdminBookings() {
  const { account } = useAdminAuth();

  /**
   * Whether this account may be shown the money, and whether it may decide
   * it. Read from the session rather than inferred from what the API
   * returned, so the screen does not render a panel the server will not
   * fill or a button the server will refuse.
   */
  const canSeePayments = hasCapability(account, "payments.view");
  const canVerifyPayments = hasCapability(account, "payments.verify");

  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [actionError, setActionError] = useState(null);

  /**
   * Which booking's panel is open.
   *
   * One at a time, and never the one that was just written to: a confirm or
   * a verify closes the panel rather than leaving it open on a row whose
   * buttons have all changed underneath it.
   */
  const [expandedId, setExpandedId] = useState(null);

  /** payment id whose reject sheet is open */
  const [rejectingId, setRejectingId] = useState(null);
  const [reason, setReason] = useState("");

  // Short TTL and no client-side cache reuse across a status change: this
  // is the screen staff act on, so a stale row is the one bug that matters.
  // Filtering and searching stay local over the fetched page.
  const {
    data,
    loading,
    error,
    isFetching: refreshing,
    refetch: load,
  } = useQuery("/bookings/", listBookings, {
    scope: "staff",
    staleMs: 30 * 1000,
    select: toArray,
  });

  const bookings = data || EMPTY_LIST;

  const counts = useMemo(() => {
    const tally = {
      all: bookings.length,
      unpaid: bookings.filter((row) => isPayable(row)).length,
      to_verify: bookings.filter((row) => row.payment_status === "pending")
        .length,
    };

    for (const option of FILTERS) {
      if (
        option.key === "all" ||
        option.key === "unpaid" ||
        option.key === "to_verify"
      ) {
        continue;
      }

      tally[option.key] = bookings.filter(
        (row) => row.status === option.key
      ).length;
    }

    return tally;
  }, [bookings]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return bookings.filter((booking) => {
      // The money tabs are not booking statuses, so they are checked
      // separately rather than against `booking.status`.
      if (filter === "unpaid") {
        if (!isPayable(booking)) {
          return false;
        }
      } else if (filter === "to_verify") {
        if (booking.payment_status !== "pending") {
          return false;
        }
      } else if (filter !== "all" && booking.status !== filter) {
        return false;
      }

      if (!needle) {
        return true;
      }

      return [
        booking.customer_name,
        booking.customer_phone,
        booking.service_name,
        booking.barber_name,
        booking.booking_code,
        booking.payment?.transaction_reference,
        String(booking.id),
      ]
        .filter(Boolean)
        .some((field) =>
          String(field).toLowerCase().includes(needle)
        );
    });
  }, [bookings, filter, query]);

  /**
   * A booking change also empties slots, so the availability lists behind
   * the booking form are now wrong and must be dropped with it. A payment
   * decision changes the booking too - confirming is what opens payment -
   * so both are invalidated together rather than one screen noticing later.
   */
  const refreshAffected = () => {
    invalidateQuery("bookings");
    invalidateQuery("payments");
    invalidateQuery("reports/dashboard");
    invalidateQuery("availability");

    // The panel on screen is showing a row whose status or money state has
    // just changed. Its action buttons are derived from that state, so it
    // is closed rather than left open offering "Confirm" on a booking that
    // is now confirmed.
    setExpandedId(null);
  };

  /**
   * Run one status transition, or a delete.
   *
   * `confirmFn` is a native confirm so a destructive action is never a
   * single stray tap on a phone, where the target is often under a thumb.
   */
  const runAction = async (booking, action, { confirmFn } = {}) => {
    if (confirmFn && !confirmFn()) {
      return;
    }

    setBusyId(booking.id);
    setActionError(null);

    try {
      if (action === "delete") {
        await deleteBooking(booking.id);
      } else {
        await action(booking.id);
      }

      refreshAffected();
    } catch (apiError) {
      setActionError(apiError);
    } finally {
      setBusyId(null);
    }
  };

  /** Copy the code to read out on the phone. */
  const copyCode = async (booking) => {
    const code = booking.booking_code || `#${booking.id}`;

    try {
      await navigator.clipboard?.writeText(code);
      setCopiedId(booking.id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Clipboard blocked - the code is on screen to read out anyway.
    }
  };

  /**
   * Accept a payment from the booking it belongs to.
   *
   * Same endpoint the payment queue uses, so the audit trail and the rules
   * are identical - only the context is better, because the appointment is
   * right here next to the receipt.
   */
  const handleVerifyPayment = async (booking) => {
    setBusyId(booking.id);
    setActionError(null);

    try {
      await verifyPayment(booking.payment.id);
      refreshAffected();
    } catch (apiError) {
      setActionError(apiError);
    } finally {
      setBusyId(null);
    }
  };

  const handleRejectPayment = async (booking) => {
    if (!reason.trim()) {
      setActionError({
        message: "A rejection reason is required.",
        fieldErrors: { reason: "Say what the customer needs to change." },
      });

      return;
    }

    setBusyId(booking.id);
    setActionError(null);

    try {
      await rejectPayment(booking.payment.id, reason.trim());

      setRejectingId(null);
      setReason("");
      refreshAffected();
    } catch (apiError) {
      setActionError(apiError);
    } finally {
      setBusyId(null);
    }
  };

  const actionsFor = (status) => {
    if (status === "pending") {
      return {
        confirm: (id) => confirmBooking(id),
        cancel: (id) => cancelBooking(id),
      };
    }

    if (status === "confirmed") {
      return {
        complete: (id) => completeBooking(id),
        cancel: (id) => cancelBooking(id),
      };
    }

    return {};
  };

  const rejectingBooking = bookings.find(
    (row) => row.payment?.id === rejectingId
  );

  const activeLabel = FILTERS.find((option) => option.key === filter)?.label;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Staff · Management"
        title="Bookings"
        description="Every appointment with the payment attached to it, so a booking and its money are checked in one place. Confirm the chair first — payment opens after that."
        actions={
          <AdminButton onClick={load} icon={RefreshCw} loading={refreshing}>
            Refresh
          </AdminButton>
        }
      />

      <AdminFilterTabs
        options={FILTERS.map((option) => ({
          key: option.key,
          label: option.label,
          count: counts[option.key] ?? 0,
        }))}
        value={filter}
        onChange={setFilter}
      />

      <AdminSearch
        value={query}
        onChange={setQuery}
        placeholder="Search by booking code, name, phone, service or TIN"
      />

      {actionError && (
        <Alert tone="error" title="Action failed" details={actionError.fieldErrors}>
          {actionError.message}
        </Alert>
      )}

      {loading && <AdminLoading label="Loading bookings..." />}

      {!loading && error && (
        <Alert
          tone="error"
          title="Could not load bookings"
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
              ? `No bookings match "${query}".`
              : filter === "all"
                ? "No bookings yet."
                : filter === "unpaid"
                  ? "Every confirmed appointment has a payment behind it."
                  : filter === "to_verify"
                    ? "No payments are waiting to be checked."
                    : `No ${activeLabel?.toLowerCase()} bookings right now.`
          }
          onRetry={load}
        />
      )}

      {!loading && !error && shown.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-console-muted">
              Showing {shown.length} of {bookings.length}
            </p>

            <p className="hidden items-center gap-1.5 text-[11px] text-console-faint sm:flex">
              <MoveHorizontal size={12} />
              Scroll the table sideways to reach every column
            </p>
          </div>

          <AdminTable
            label="Bookings"
            caption="Every appointment with its customer, service, time and payment state."
            minWidth="min-w-[64rem]"
          >
            <AdminTableHead>
              <tr>
                <AdminTableHeadCell sticky width="11rem">
                  Booking
                </AdminTableHeadCell>
                <AdminTableHeadCell width="14rem">Customer</AdminTableHeadCell>
                <AdminTableHeadCell width="13rem">Service</AdminTableHeadCell>
                <AdminTableHeadCell width="13rem">When</AdminTableHeadCell>
                <AdminTableHeadCell width="15rem">Payment</AdminTableHeadCell>
                <AdminTableHeadCell width="20rem">
                  Actions
                </AdminTableHeadCell>
              </tr>
            </AdminTableHead>

            <tbody>
              {shown.map((booking) => {
                const busy = busyId === booking.id;
                const available = actionsFor(booking.status);
                const money = paymentState(booking);
                const payable = isPayable(booking);
                const code = bookingCodeOf(booking);
                const payment = booking.payment;
                const expanded = expandedId === booking.id;

                return (
                  <BookingRows
                    key={booking.id}
                    booking={booking}
                    code={code}
                    money={money}
                    payable={payable}
                    payment={payment}
                    busy={busy}
                    available={available}
                    expanded={expanded}
                    copied={copiedId === booking.id}
                    canSeePayments={canSeePayments}
                    canVerifyPayments={canVerifyPayments}
                    onToggle={() =>
                      setExpandedId(expanded ? null : booking.id)
                    }
                    onCopy={() => copyCode(booking)}
                    onAction={(action) => runAction(booking, action)}
                    onVerify={() => handleVerifyPayment(booking)}
                    onReject={() => {
                      setRejectingId(payment?.id ?? null);
                      setReason("");
                      setActionError(null);
                    }}
                  />
                );
              })}
            </tbody>
          </AdminTable>

          <AdminTableHint>
            Swipe the table sideways for the rest of each row. Open a row
            for its notes and receipt.
          </AdminTableHint>

          <p className="text-[11px] leading-5 text-console-muted">
            Confirm the booking first — payment opens after that. Verifying a
            payment records who checked it; it no longer confirms the booking
            as a side effect.
          </p>
        </>
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
          rejectingBooking
            ? `${formatPrice(
                rejectingBooking.payment?.amount
              )} sent for booking ${bookingCodeOf(rejectingBooking)}. The customer reads this reason and can send a clearer one.`
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
              onClick={() =>
                rejectingBooking && handleRejectPayment(rejectingBooking)
              }
            >
              Confirm rejection
            </AdminButton>
          </>
        }
      >
        {rejectingBooking && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleRejectPayment(rejectingBooking);
            }}
            className="space-y-4"
          >
            {actionError && (
              <Alert
                tone="error"
                title="Could not reject"
                details={actionError.fieldErrors}
              >
                {actionError.message}
              </Alert>
            )}

            <label
              htmlFor="reject-reason"
              className="block text-[10px] font-semibold uppercase tracking-[0.15em] text-console-muted"
            >
              Reason <span className="text-console-bad">*</span>
            </label>

            <AdminTextarea
              id="reject-reason"
              rows={4}
              value={reason}
              placeholder="Why is this payment being rejected?"
              onChange={(event) => setReason(event.target.value)}
              invalid={Boolean(actionError?.fieldErrors?.reason)}
            />

            <p className="text-[11px] leading-5 text-console-muted">
              Say what they need to change — a legible screenshot of the
              transfer confirmation, or the TIN number on its own. The booking
              stays confirmed, so they can send a corrected payment straight
              away.
            </p>

            <button
              type="submit"
              className="sr-only"
              aria-hidden="true"
              tabIndex={-1}
            />
          </form>
        )}
      </AdminSheet>
    </div>
  );
}