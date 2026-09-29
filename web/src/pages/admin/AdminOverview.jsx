import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  Check,
  CheckCheck,
  CreditCard,
  MessageSquareQuote,
  RefreshCw,
  Scissors,
  TrendingUp,
  UserRound,
} from "lucide-react";

import StatusBadge from "../../components/StatusBadge";
import Alert from "../../components/ui/Alert";
import {
  AdminButton,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
} from "../../components/admin/AdminUi";
import { completeBooking, confirmBooking } from "../../services/bookingApi";
import { getDashboard } from "../../services/authApi";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { hasCapability, staffRoleLabel } from "../../utils/staffRole";
import { formatDate, formatPrice, formatTime } from "../../utils/format";

/**
 * The dashboard — the shop as it actually is, in one request.
 *
 * It used to be assembled in the browser from six list endpoints: the
 * console downloaded every booking and every payment in the shop and
 * counted them with `.filter().length` to produce six numbers. That is
 * the wrong shape for a screen a barber opens between customers — it
 * transfers the whole shop to render a handful of digits, and the
 * counts are only as fresh as the slowest of six requests.
 *
 * Now one endpoint returns the counts from SQL plus the rows worth
 * reading: today's schedule and what is coming in the next week. Those
 * carry their own actions, so confirming a booking or marking it
 * complete happens where the appointment already is, rather than
 * requiring a trip to the bookings screen to find the same row again.
 *
 * The response is scoped to the signed-in account, so a receptionist
 * sees today's schedule and the bookings queue and no revenue figure
 * or customer count they have no capability to fetch.
 *
 * Every action replaces its row with the server's response rather than
 * guessing the new state, so the schedule never shows a status the API
 * did not agree with.
 */

const SECTIONS = {
  bookings: "bookings.view",
  payments: "payments.view",
  customers: "customers.view",
  services: "services.manage",
  gallery: "gallery.manage",
  reviews: "reviews.moderate",
};

export default function AdminOverview() {
  const { account } = useAdminAuth();

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const load = useCallback(async () => {
    setRefreshing(true);

    try {
      setData(await getDashboard());
      setError(null);
    } catch (apiError) {
      setError(apiError);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const can = (section) => hasCapability(account, SECTIONS[section]);
  const canManageBookings = hasCapability(account, "bookings.manage");

  /**
   * Run a status transition on a schedule row.
   *
   * Only the status is copied back from the response: the row was built
   * by the dashboard endpoint and carries a different field shape from
   * the bookings endpoint, so merging the whole booking in would
   * blank out the service and barber names on a card that already had
   * them. The status is the only thing the transition can change.
   */
  const runBookingAction = async (booking, action) => {
    setBusyId(booking.id);
    setActionError(null);

    try {
      const updated = await action(booking.id);

      setData((current) => {
        if (!current) {
          return current;
        }

        const patch = (row) =>
          row.id === updated.id ? { ...row, status: updated.status } : row;

        return {
          ...current,
          schedule: {
            today: current.schedule.today.map(patch),
            upcoming: current.schedule.upcoming.map(patch),
          },
        };
      });
    } catch (apiError) {
      setActionError(apiError);
    } finally {
      setBusyId(null);
    }
  };

  const stats = data
    ? [
        data.counts?.bookings && {
          label: "Bookings today",
          to: "/admin/bookings",
          icon: CalendarCheck,
          count: data.counts.bookings.today,
          sub: `${data.counts.bookings.pending_today} awaiting confirmation`,
        },
        data.counts?.users && {
          label: "Customers",
          to: "/admin/customers",
          icon: UserRound,
          count: data.counts.users.total,
          sub: `${data.counts.users.staff} staff accounts`,
        },
        data.counts?.payments && {
          label: "Payments to verify",
          to: "/admin/payments",
          icon: CreditCard,
          count: data.counts.payments.pending,
          sub: `${data.counts.payments.verified} verified`,
        },
        data.revenue?.verified_total != null && {
          label: "Verified revenue",
          to: "/admin/payments",
          icon: TrendingUp,
          // A currency figure is text, not a count — it has to be
          // allowed to shrink where a four-digit number would fit.
          count: formatPrice(data.revenue.verified_total),
          sub: `${formatPrice(data.revenue.verified_this_month)} this month`,
          isText: true,
        },
        data.counts?.services && {
          label: "Services live",
          to: "/admin/services",
          icon: Scissors,
          count: data.counts.services.active,
          sub: `${data.counts.services.total} in total`,
        },
        data.counts?.reviews && {
          label: "Reviews to approve",
          to: "/admin/testimonials",
          icon: MessageSquareQuote,
          count: data.counts.reviews.pending,
          sub: `${data.counts.reviews.total} submitted`,
        },
      ].filter(Boolean)
    : [];

  const queues = data
    ? [
        data.queues?.bookings_to_confirm != null && {
          label: "Bookings to confirm",
          count: data.queues.bookings_to_confirm,
          to: "/admin/bookings",
        },
        data.queues?.payments_to_verify != null && {
          label: "Payments to verify",
          count: data.queues.payments_to_verify,
          to: "/admin/payments",
        },
        data.queues?.reviews_to_approve != null && {
          label: "Reviews to approve",
          count: data.queues.reviews_to_approve,
          to: "/admin/testimonials",
        },
      ].filter(Boolean)
    : [];

  const queueTotal = queues.reduce((sum, item) => sum + item.count, 0);

  const quickActions = data
    ? [
        can("payments") && { label: "Verify payments", to: "/admin/payments" },
        can("bookings") && { label: "Confirm bookings", to: "/admin/bookings" },
        can("customers") && { label: "View customers", to: "/admin/customers" },
        can("services") && { label: "Add a service", to: "/admin/services" },
        can("gallery") && { label: "Add gallery post", to: "/admin/gallery" },
        can("reviews") && { label: "Review testimonials", to: "/admin/testimonials" },
      ].filter(Boolean)
    : [];

  return (
    <div>
      <AdminPageHeader
        eyebrow={`${staffRoleLabel(account?.staff_role)} dashboard`}
        title="Overview"
        description="Today's schedule, what needs a decision, and the numbers behind them — counted in the database, not in the browser."
        actions={
          <AdminButton onClick={load} icon={RefreshCw} disabled={refreshing}>
            {refreshing ? "Refreshing..." : "Refresh"}
          </AdminButton>
        }
      />

      {error && (
        <Alert
          tone="error"
          title="Could not load the dashboard"
          details={error.fieldErrors}
          onRetry={load}
          className="mt-6"
        >
          {error.message}
        </Alert>
      )}

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

      {!data && !error && <AdminLoading label="Loading the dashboard..." />}

      {data && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {stats.map((stat) => {
              const Icon = stat.icon;

              return (
                <Link
                  key={stat.label}
                  to={stat.to}
                  className="group min-w-0 rounded-2xl border border-white/10 bg-[#111] p-4 transition hover:border-[#d6a85f]/40 sm:p-6"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#181818]">
                      <Icon size={17} className="text-[#d6a85f]" />
                    </span>

                    <ArrowRight
                      size={16}
                      className="mt-1 shrink-0 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-[#d6a85f]"
                    />
                  </div>

                  <p
                    className={`mt-4 truncate font-serif leading-none text-white ${
                      stat.isText ? "text-2xl sm:text-3xl" : "text-4xl sm:text-5xl"
                    }`}
                  >
                    {stat.count}
                  </p>

                  <p className="mt-2 truncate text-sm font-medium text-white/75">
                    {stat.label}
                  </p>

                  <p className="mt-1 truncate text-[11px] uppercase tracking-[0.12em] text-white/30">
                    {stat.sub}
                  </p>
                </Link>
              );
            })}
          </div>

          {queueTotal > 0 && (
            <AdminPanel className="mt-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-[#d6a85f]">
                    Needs attention
                  </p>
                  <p className="mt-2 text-sm text-white/55">
                    Work through the live queue from your phone.
                  </p>
                </div>

                <span className="shrink-0 rounded-full border border-[#d6a85f]/25 bg-[#d6a85f]/10 px-3 py-1.5 text-xs font-semibold text-[#d6a85f]">
                  {queueTotal}
                </span>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {queues.map((item) => (
                  <Link
                    key={item.label}
                    to={item.to}
                    className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 transition hover:border-[#d6a85f]/40"
                  >
                    <span className="text-xs text-white/65">{item.label}</span>
                    <span className="font-serif text-2xl leading-none text-white">
                      {item.count}
                    </span>
                  </Link>
                ))}
              </div>
            </AdminPanel>
          )}

          {can("bookings") && (
            <AdminPanel className="mt-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CalendarCheck size={18} className="shrink-0 text-[#d6a85f]" />

                  <div>
                    <p className="font-semibold text-white">Today’s schedule</p>
                    <p className="mt-1 text-xs text-white/45">
                      {formatDate(data.today)}
                    </p>
                  </div>
                </div>

                <Link
                  to="/admin/bookings"
                  className="text-xs font-semibold text-[#d6a85f] hover:underline"
                >
                  All bookings
                </Link>
              </div>

              {data.schedule.today.length === 0 ? (
                <p className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-8 text-center text-sm text-white/40">
                  Nothing booked for today.
                </p>
              ) : (
                <div className="mt-5 space-y-2">
                  {data.schedule.today.map((booking) => {
                    const busy = busyId === booking.id;
                    const actionable =
                      canManageBookings &&
                      (booking.status === "pending" ||
                        booking.status === "confirmed");

                    return (
                      <div
                        key={booking.id}
                        className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                          <div className="flex min-w-0 items-center gap-3">
                            <p className="shrink-0 font-serif text-lg leading-none text-[#d6a85f]">
                              {formatTime(booking.start_time)}
                            </p>

                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-white">
                                {booking.customer_name}
                              </p>

                              <p className="mt-1 truncate text-xs text-white/40">
                                {[
                                  booking.service_name,
                                  booking.barber_name || "Auto-assigned",
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            </div>
                          </div>

                          <StatusBadge status={booking.status} kind="booking" />
                        </div>

                        {actionable && (
                          <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3">
                            {booking.status === "pending" ? (
                              <AdminButton
                                tone="primary"
                                icon={Check}
                                disabled={busy}
                                onClick={() =>
                                  runBookingAction(booking, confirmBooking)
                                }
                              >
                                {busy ? "Working..." : "Confirm"}
                              </AdminButton>
                            ) : (
                              <AdminButton
                                tone="primary"
                                icon={CheckCheck}
                                disabled={busy}
                                onClick={() =>
                                  runBookingAction(booking, completeBooking)
                                }
                              >
                                {busy ? "Working..." : "Mark completed"}
                              </AdminButton>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </AdminPanel>
          )}

          {can("bookings") && data.schedule.upcoming.length > 0 && (
            <AdminPanel className="mt-3">
              <div className="flex items-center gap-3">
                <CalendarDays size={18} className="shrink-0 text-[#d6a85f]" />
                <p className="font-semibold text-white">Coming up</p>
              </div>

              <p className="mt-1 text-xs text-white/45">
                The next seven days, so a quiet one can be covered before
                it is empty.
              </p>

              <div className="mt-5 space-y-2">
                {data.schedule.upcoming.map((booking) => (
                  <div
                    key={booking.id}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <p className="shrink-0 text-xs font-semibold text-white/55">
                        {formatDate(booking.booking_date).replace(/, \d{4}$/, "")}
                      </p>

                      <p className="shrink-0 text-xs text-[#d6a85f]">
                        {formatTime(booking.start_time)}
                      </p>

                      <p className="truncate text-sm text-white/75">
                        {booking.customer_name}
                      </p>
                    </div>

                    <p className="truncate text-xs text-white/35">
                      {booking.service_name}
                    </p>
                  </div>
                ))}
              </div>
            </AdminPanel>
          )}

          {quickActions.length > 0 && (
            <AdminPanel className="mt-3">
              <p className="text-[10px] uppercase tracking-[0.3em] text-[#d6a85f]">
                Quick actions
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {quickActions.map((action) => (
                  <Link
                    key={action.to + action.label}
                    to={action.to}
                    className="inline-flex min-h-10 items-center rounded-full border border-white/15 px-4 py-2.5 text-xs font-semibold text-white/70 transition hover:border-[#d6a85f]/50 hover:text-white"
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            </AdminPanel>
          )}
        </>
      )}
    </div>
  );
}
