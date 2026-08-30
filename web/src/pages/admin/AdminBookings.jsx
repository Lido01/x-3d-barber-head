import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

import StatusBadge from "../../components/StatusBadge";
import Alert from "../../components/ui/Alert";
import Spinner from "../../components/ui/Spinner";
import {
  cancelBooking,
  listBookings,
} from "../../services/bookingApi";
import { formatDate, formatTimeRange } from "../../utils/format";

/**
 * Bookings management — GET /api/bookings/ (admin).
 *
 * View every booking with its status and cancel any pending/confirmed
 * appointment directly from the dashboard.
 */

const FILTERS = ["all", "pending", "confirmed", "completed", "cancelled"];

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    return listBookings()
      .then((data) => {
        setBookings(Array.isArray(data) ? data : data?.results || []);
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
      return bookings;
    }

    return bookings.filter((booking) => booking.status === filter);
  }, [bookings, filter]);

  const replaceRow = (updated) => {
    setBookings((rows) =>
      rows.map((row) => (row.id === updated.id ? updated : row))
    );
  };

  const handleCancel = async (booking) => {
    setBusyId(booking.id);
    setActionError(null);

    try {
      replaceRow(await cancelBooking(booking.id));
    } catch (apiError) {
      setActionError(apiError);
    } finally {
      setBusyId(null);
    }
  };

  const countFor = (status) =>
    status === "all"
      ? bookings.length
      : bookings.filter((row) => row.status === status).length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-[#d6a85f]">
            Staff · Management
          </p>
          <h1 className="mt-4 font-serif text-4xl leading-none sm:text-5xl">
            Bookings
          </h1>
          <p className="mt-3 text-xs text-white/35">
            Every appointment across the shop.
          </p>
        </div>

        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-xs font-semibold text-white/70 transition hover:border-[#d6a85f]/50 hover:text-white"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      <div className="mt-7 flex gap-2 overflow-x-auto pb-2">
        {FILTERS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setFilter(option)}
            className={`whitespace-nowrap rounded-full border px-4 py-2 text-xs capitalize transition ${
              filter === option
                ? "border-[#d6a85f] bg-[#d6a85f] text-black"
                : "border-white/10 text-white/50 hover:border-white/40"
            }`}
          >
            {option}
            <span className={filter === option ? "text-black/60" : "text-white/30"}>
              {" "}
              {countFor(option)}
            </span>
          </button>
        ))}
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
          <Spinner label="Loading bookings..." />
        </div>
      )}

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
        <Alert tone="info" title="Nothing here" onRetry={load} className="mt-8">
          {filter === "all"
            ? "No bookings yet."
            : `No ${filter} bookings right now.`}
        </Alert>
      )}

      {!loading && !error && shown.length > 0 && (
        <div className="mt-8 grid gap-3">
          {shown.map((booking) => {
            const busy = busyId === booking.id;
            const cancellable = ["pending", "confirmed"].includes(booking.status);

            return (
              <article
                key={booking.id}
                className="rounded-2xl border border-white/10 bg-[#111] p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="font-serif text-xl text-white">
                        Booking #{booking.id}
                      </p>
                      <StatusBadge status={booking.status} kind="booking" />
                    </div>
                    <p className="mt-2 text-xs text-white/45">
                      {booking.customer_name}
                      {booking.customer_phone ? ` · ${booking.customer_phone}` : ""}
                    </p>
                  </div>

                  <div className="text-right text-xs text-white/45">
                    <p className="font-medium text-white/75">
                      {formatDate(booking.booking_date)}
                    </p>
                    <p className="mt-1">
                      {formatTimeRange(booking.start_time, booking.end_time)}
                    </p>
                  </div>
                </div>

                <dl className="mt-4 grid gap-3 border-t border-white/10 pt-4 text-xs sm:grid-cols-3">
                  <div>
                    <dt className="text-[10px] uppercase tracking-[0.2em] text-white/30">
                      Service
                    </dt>
                    <dd className="mt-1 text-white/75">
                      {booking.service_name || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-[0.2em] text-white/30">
                      Barber
                    </dt>
                    <dd className="mt-1 text-white/75">
                      {booking.barber_name || "Auto-assigned"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-[0.2em] text-white/30">
                      Notes
                    </dt>
                    <dd className="mt-1 text-white/75">
                      {booking.notes || "—"}
                    </dd>
                  </div>
                </dl>

                {cancellable && (
                  <div className="mt-4 border-t border-white/10 pt-4">
                    <button
                      type="button"
                      onClick={() => handleCancel(booking)}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-full border border-[#e05a4f]/40 px-4 py-2.5 text-xs font-semibold text-[#e0776b] transition hover:bg-[#e05a4f]/10 disabled:opacity-60"
                    >
                      {busy ? "Cancelling..." : "Cancel booking"}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
