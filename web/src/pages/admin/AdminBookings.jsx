import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  CheckCheck,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

import StatusBadge from "../../components/StatusBadge";
import Alert from "../../components/ui/Alert";
import {
  AdminButton,
  AdminEmpty,
  AdminFilterTabs,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
} from "../../components/admin/AdminUi";
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
 * Every action replaces the card with the API's response, so the list
 * always shows the server's state rather than an optimistic guess.
 */

const FILTERS = [
  "all",
  "pending",
  "confirmed",
  "completed",
  "cancelled",
];

const SEARCH =
  "w-full rounded-xl border border-white/10 bg-[#181818] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#d6a85f]/50";

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    setRefreshing(true);

    return listBookings()
      .then((data) => {
        setBookings(Array.isArray(data) ? data : data?.results || []);
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
    const tally = { all: bookings.length };

    for (const option of FILTERS) {
      if (option === "all") {
        continue;
      }

      tally[option] = bookings.filter(
        (row) => row.status === option
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

  const replaceRow = (updated) => {
    setBookings((rows) =>
      rows.map((row) => (row.id === updated.id ? updated : row))
    );
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
        setBookings((rows) =>
          rows.filter((row) => row.id !== booking.id)
        );
        return;
      }

      replaceRow(await action(booking.id));
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

  return (
    <div>
      <AdminPageHeader
        eyebrow="Staff · Management"
        title="Bookings"
        description="Every appointment across the shop."
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
        options={FILTERS.map((key) => ({
          key,
          label: key,
          count: counts[key] ?? 0,
        }))}
        value={filter}
        onChange={setFilter}
      />

      {/* Search sits above the list on a phone and beside the title on
          a desktop, where there is room for it. */}
      <div className="relative mt-4">
        <Search
          size={15}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
        />

        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, phone, service or #"
          aria-label="Search bookings"
          className={`${SEARCH} pl-11 pr-11`}
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

      {loading && <AdminLoading label="Loading bookings..." />}

      {!loading && error && (
        <Alert
          tone="error"
          title="Could not load bookings"
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
              ? `No bookings match "${query}".`
              : filter === "all"
                ? "No bookings yet."
                : `No ${filter} bookings right now.`
          }
          onRetry={load}
        />
      )}

      {!loading && !error && shown.length > 0 && (
        <div className="mt-5 grid gap-3">
          {shown.map((booking) => {
            const busy = busyId === booking.id;
            const available = actionsFor(booking.status);

            return (
              <AdminPanel key={booking.id}>
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <p className="font-serif text-lg text-white sm:text-xl">
                        Booking #{booking.id}
                      </p>
                      <StatusBadge
                        status={booking.status}
                        kind="booking"
                      />
                    </div>

                    <p className="mt-2 break-words text-xs text-white/45">
                      {booking.customer_name}
                      {booking.customer_phone
                        ? ` · ${booking.customer_phone}`
                        : ""}
                    </p>
                  </div>

                  <div className="text-left sm:text-right">
                    <p className="text-sm font-medium text-white/75">
                      {formatDate(booking.booking_date)}
                    </p>
                    <p className="mt-1 text-xs text-white/45">
                      {formatTimeRange(
                        booking.start_time,
                        booking.end_time
                      )}
                    </p>
                  </div>
                </div>

                {/* One column on the narrowest phones, three from sm up */}
                <dl className="mt-4 grid gap-3 border-t border-white/10 pt-4 text-xs sm:grid-cols-3">
                  <div className="min-w-0">
                    <dt className="text-[10px] uppercase tracking-[0.2em] text-white/30">
                      Service
                    </dt>
                    <dd className="mt-1 break-words text-white/75">
                      {booking.service_name || "—"}
                    </dd>
                  </div>

                  <div className="min-w-0">
                    <dt className="text-[10px] uppercase tracking-[0.2em] text-white/30">
                      Barber
                    </dt>
                    <dd className="mt-1 break-words text-white/75">
                      {booking.barber_name || "Auto-assigned"}
                    </dd>
                  </div>

                  <div className="min-w-0">
                    <dt className="text-[10px] uppercase tracking-[0.2em] text-white/30">
                      Notes
                    </dt>
                    <dd className="mt-1 break-words text-white/75">
                      {booking.notes || "—"}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                  {available.confirm && (
                    <AdminButton
                      tone="primary"
                      icon={Check}
                      disabled={busy}
                      onClick={() =>
                        runAction(booking, available.confirm)
                      }
                    >
                      {busy ? "Working..." : "Confirm"}
                    </AdminButton>
                  )}

                  {available.complete && (
                    <AdminButton
                      tone="primary"
                      icon={CheckCheck}
                      disabled={busy}
                      onClick={() =>
                        runAction(booking, available.complete)
                      }
                    >
                      {busy ? "Working..." : "Mark completed"}
                    </AdminButton>
                  )}

                  {available.cancel && (
                    <AdminButton
                      tone="danger"
                      icon={X}
                      disabled={busy}
                      onClick={() =>
                        runAction(booking, available.cancel, {
                          confirmFn: () =>
                            window.confirm(
                              `Cancel booking #${booking.id} for ${booking.customer_name}?`
                            ),
                        })
                      }
                    >
                      Cancel
                    </AdminButton>
                  )}

                  <AdminButton
                    tone="danger"
                    disabled={busy}
                    onClick={() =>
                      runAction(booking, "delete", {
                        confirmFn: () =>
                          window.confirm(
                            `Permanently delete booking #${booking.id}? This cannot be undone.`
                          ),
                      })
                    }
                  >
                    Delete
                  </AdminButton>
                </div>
              </AdminPanel>
            );
          })}
        </div>
      )}
    </div>
  );
}
