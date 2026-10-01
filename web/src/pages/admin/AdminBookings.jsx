import { useMemo, useState } from "react";
import { Check, CheckCheck, RefreshCw, Trash2, X } from "lucide-react";

import Alert from "../../components/ui/Alert";
import {
  AdminButton,
  AdminConfirmButton,
  AdminDetails,
  AdminDetail,
  AdminEmpty,
  AdminFilterTabs,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
  AdminSearch,
  AdminStatus,
} from "../../components/admin/AdminUi";
import { EMPTY_LIST, invalidateQuery, useQuery } from "../../hooks/useQuery";
import {
  cancelBooking,
  completeBooking,
  confirmBooking,
  deleteBooking,
  listBookings,
} from "../../services/bookingApi";
import { formatDate, formatTimeRange } from "../../utils/format";

/**
 * Bookings management — GET /api/bookings/ (admin).
 *
 * Built for a phone held in one hand between customers: the whole
 * schedule is filterable by status and searchable by name or phone, and
 * the four status transitions staff actually need are on each card
 * rather than behind a menu.
 *
 * Transitions and the statuses that enable them, which the server
 * enforces too:
 *
 *   pending   -> Confirm · Cancel
 *   confirmed -> Complete · Cancel
 *   completed -> (read only)
 *   cancelled -> (read only)
 *
 * The two irreversible actions are the two in the danger tone, and both
 * ask first, so the one thing that cannot be undone is never the
 * easiest thing to hit on a screen full of buttons.
 *
 * A write invalidates the cached list *and* the cached availability, so
 * the slots the booking form is offering drop the slot just taken
 * without anyone pressing refresh.
 */

/** Human labels. The raw status keys are for the API, not for a person. */
const FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

export default function AdminBookings() {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Short TTL and no client-side cache reuse across a status change:
  // this is the screen staff act on, so a stale row is the one bug that
  // matters. Filtering and searching stay local over the fetched page.
  const {
    data,
    loading,
    error,
    isFetching: refreshing,
    refetch: load,
  } = useQuery("/bookings/", listBookings, {
    scope: "staff",
    staleMs: 30 * 1000,
    select: (payload) => (Array.isArray(payload) ? payload : payload?.results || []),
  });

  const bookings = data || EMPTY_LIST;

  const counts = useMemo(() => {
    const tally = { all: bookings.length };

    for (const option of FILTERS) {
      if (option.key === "all") {
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
      if (filter !== "all" && booking.status !== filter) {
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
   * the booking form are now wrong and must be dropped with it.
   */
  const refreshAffected = () => {
    invalidateQuery("bookings");
    invalidateQuery("availability");
  };

  /**
   * Run one status transition, or a delete.
   *
   * `confirmFn` is a native confirm so a destructive action is never a
   * single stray tap on a phone, where the target is often under a
   * thumb.
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

  const activeLabel = FILTERS.find((option) => option.key === filter)?.label;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Staff · Management"
        title="Bookings"
        description="Every appointment across the shop, with the transitions staff actually need on each one."
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
        placeholder="Search by name, phone, service or #"
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

              return (
                <li key={booking.id}>
                  <AdminPanel>
                    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                          <p className="font-serif text-lg leading-none text-console-ink">
                            #{booking.id}
                          </p>
                          <AdminStatus status={booking.status} />
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
                          Confirm
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

                      {available.cancel && (
                        <AdminConfirmButton
                          icon={X}
                          loading={busy}
                          message={`Cancel booking #${booking.id} for ${booking.customer_name}? The slot is released and the customer sees it as cancelled.`}
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
                        message={`Permanently delete booking #${booking.id}? This cannot be undone, and the customer's record of it goes with it.`}
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
        </>
      )}
    </div>
  );
}
