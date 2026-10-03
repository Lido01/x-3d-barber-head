import { useMemo, useState } from "react";
import {
  Check,
  CheckCheck,
  CircleDollarSign,
  Copy,
  ExternalLink,
  FileImage,
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

/**
 * Bookings management — GET /api/bookings/ (staff).
 *
 * ## A booking and its money, on one card
 *
 * This is the screen the whole booking/payment rule is enforced from, so it
 * has to show both halves at once. The API now sends the attached payment
 * with every row - amount, method, reference, receipt image, who verified
 * it and when, or the reason it was rejected - which is what removes the
 * two-screen routine this used to need: open the booking, note the id, leave,
 * open the payment queue, find the row, then work out whether the two
 * described the same appointment. They now cannot disagree, because there is
 * only one of them.
 *
 * It also means **verify** and **reject** live here, on the card, where the
 * appointment the money is for is on screen. Before, a decision about money
 * was made on a queue that had lost that context.
 *
 * ## The order on screen
 *
 *     Confirm -> Payment sent -> Checked -> Complete
 *
 * Reception confirms the chair first and payment opens second, so the
 * Confirm button is the first thing on a pending booking and the payment
 * panel says "not payable until confirmed" while it is still pending. A
 * verified payment no longer confirms the booking on the server (it did
 * already need to be confirmed to pay), so nothing on this screen assumes
 * the two happen in the other order.
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
 * to.
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
          <p className="text-xs text-console-muted">
            Showing {shown.length} of {bookings.length}
          </p>

          <ul className="grid gap-3">
            {shown.map((booking) => {
              const busy = busyId === booking.id;
              const available = actionsFor(booking.status);
              const money = paymentState(booking);
              const payable = isPayable(booking);
              const code = bookingCodeOf(booking);
              const payment = booking.payment;

              return (
                <li key={booking.id}>
                  <AdminPanel>
                    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                          <p className="font-serif text-lg leading-none tracking-[0.08em] text-console-ink">
                            {code}
                          </p>

                          <AdminStatus status={booking.status} />

                          {/* The money state, spelled out. A confirmed
                              booking with nothing paid is the case a
                              confirmation badge alone would hide. */}
                          {money === "none" &&
                            (payable ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-console-warn/30 bg-console-warn-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-console-warn">
                                <CircleDollarSign size={10} />
                                To pay
                              </span>
                            ) : (
                              <AdminChip tone="neutral">
                                Not payable yet
                              </AdminChip>
                            ))}

                          {money === "rejected" && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-console-bad/40 bg-console-bad-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-console-bad">
                              <CircleDollarSign size={10} />
                              Payment rejected
                            </span>
                          )}

                          {money === "verified" && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-console-good/40 bg-console-good-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-console-good">
                              Paid
                            </span>
                          )}

                          {money === "pending" && (
                            <span className="inline-flex items-center gap-1 rounded-full border-console-warn px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-console-warn">
                              <Receipt size={10} />
                              To check
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => copyCode(booking)}
                            title={`Copy ${code}`}
                            className="rounded-full border border-console-line p-1 text-console-muted transition hover:border-console-accent hover:text-console-accent"
                          >
                            {copiedId === booking.id ? (
                              <Check size={11} />
                            ) : (
                              <Copy size={11} />
                            )}
                          </button>
                        </div>

                        <p className="mt-1.5 break-words text-sm font-medium text-console-ink">
                          {booking.customer_name}
                        </p>

                        {booking.customer_phone && (
                          <a
                            href={`tel:${booking.customer_phone}`}
                            className="mt-0.5 inline-block text-xs text-console-muted hover:text-console-accent"
                          >
                            {booking.customer_phone}
                          </a>
                        )}
                      </div>

                      <div className="shrink-0 text-left sm:text-right">
                        <p className="text-sm font-semibold text-console-ink">
                          {formatDate(booking.booking_date)}
                        </p>
                        <p className="mt-0.5 text-xs tabular-nums text-console-muted">
                          {formatTimeRange(
                            booking.start_time,
                            booking.end_time
                          )}
                        </p>
                      </div>
                    </div>

                    {/* One column on the narrowest phones, three from sm up. */}
                    <AdminDetails
                      columns={3}
                      className="mt-4 border-t border-console-line pt-4"
                    >
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

                    {/* --- the payment attached to this booking -------- */}
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

                      {/* No `payments.view`, so the API did not send the
                          payment and there is nothing to render. The unpaid
                          badge above is still there on purpose: whether an
                          appointment owes money is what the diary is for. */}
                      {!canSeePayments && (
                        <p className="mt-2 text-sm text-console-muted">
                          Payment details are not shown to your account. The
                          paid / unpaid state above is still accurate.
                        </p>
                      )}

                      {canSeePayments && !payment && (
                        <p className="mt-2 text-sm text-console-muted">
                          {payable
                            ? "Nothing sent yet. This booking is confirmed, so the customer can pay now."
                            : booking.status === "pending"
                              ? "Nothing sent yet, and nothing can be — this booking has not been confirmed, so payment is closed until it is."
                              : "No payment for this booking."}
                        </p>
                      )}

                      {canSeePayments && payment && (
                        <div className="mt-3 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                          <AdminDetails columns={2}>
                            <AdminDetail label="Amount">
                              <span className="font-serif text-lg tabular-nums text-console-accent-strong">
                                {formatPrice(payment.amount)}
                              </span>
                            </AdminDetail>

                            <AdminDetail label="Method">
                              {String(payment.method || "").replace(
                                /_/g,
                                " "
                              ) || "—"}
                            </AdminDetail>

                            <AdminDetail label="Reference" mono>
                              {payment.transaction_reference || "—"}
                            </AdminDetail>

                            <AdminDetail label="Sent">
                              {new Date(payment.created_at).toLocaleString(
                                "en-GB",
                                {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </AdminDetail>

                            {payment.verified_at && (
                              <AdminDetail label="Checked">
                                {new Date(
                                  payment.verified_at
                                ).toLocaleString("en-GB", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
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

                          {/* The receipt first and full width on a phone:
                              deciding a payment means looking at it, and a
                              96px thumbnail beside a two-column grid left
                              it unreadable. */}
                          <div className="sm:w-56">
                            {mediaUrl(payment.receipt) ? (
                              <a
                                href={mediaUrl(payment.receipt)}
                                target="_blank"
                                rel="noreferrer"
                                className="block"
                              >
                                <img
                                  src={mediaUrl(payment.receipt)}
                                  alt={`Receipt sent for booking ${code}`}
                                  loading="lazy"
                                  className="h-40 w-full rounded-xl border border-console-line object-cover transition hover:border-console-accent sm:h-44 sm:object-contain"
                                />

                                <span className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-console-muted">
                                  <ExternalLink size={11} />
                                  Tap the receipt to open it full size
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
                      )}
                    </div>

                    {/* --- actions ---------------------------------- */}
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-console-line pt-4">
                      {available.confirm && (
                        <AdminButton
                          tone="primary"
                          icon={Check}
                          loading={busy}
                          onClick={() =>
                            runAction(booking, available.confirm)
                          }
                        >
                          Confirm booking
                        </AdminButton>
                      )}

                      {available.complete && (
                        <AdminButton
                          tone="primary"
                          icon={CheckCheck}
                          loading={busy}
                          onClick={() =>
                            runAction(booking, available.complete)
                          }
                        >
                          Mark completed
                        </AdminButton>
                      )}

                      {payment?.status === "pending" && canVerifyPayments && (
                        <>
                          <AdminButton
                            tone="good"
                            icon={Check}
                            loading={busy}
                            onClick={() => handleVerifyPayment(booking)}
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
                            Reject payment
                          </AdminButton>
                        </>
                      )}

                      {/*
                        A pending payment this account can see but not
                        decide. Shown rather than silent, because the booking
                        is sitting in someone's queue waiting for someone
                        else and the screen should say so.
                      */}
                      {payment?.status === "pending" &&
                        !canVerifyPayments && (
                          <span className="inline-flex min-h-11 items-center text-[11px] leading-5 text-console-muted">
                            Someone with payments.verify has to check this one.
                          </span>
                        )}

                      {available.cancel && (
                        <AdminConfirmButton
                          icon={X}
                          loading={busy}
                          message={`Cancel booking ${code} for ${booking.customer_name}? The slot is released and the customer sees it as cancelled.`}
                          onConfirm={() =>
                            runAction(booking, available.cancel)
                          }
                        >
                          Cancel booking
                        </AdminConfirmButton>
                      )}

                      <AdminConfirmButton
                        icon={Trash2}
                        loading={busy}
                        message={`Permanently delete booking ${code}? This cannot be undone, and the customer's record of it goes with it.`}
                        onConfirm={() => runAction(booking, "delete")}
                      >
                        Delete
                      </AdminConfirmButton>
                    </div>
                  </AdminPanel>
                </li>
              );
            })}
          </ul>

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