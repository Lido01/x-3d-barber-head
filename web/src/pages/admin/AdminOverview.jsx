import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  CheckCheck,
  CircleDollarSign,
  CreditCard,
  MessageSquareQuote,
  RefreshCw,
  Scissors,
  TrendingUp,
  UserRound,
} from "lucide-react";

import Alert from "../../components/ui/Alert";
import {
  AdminButton,
  AdminChip,
  AdminDetails,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
  AdminSection,
  AdminStat,
  AdminStatGrid,
  AdminStatus,
} from "../../components/admin/AdminUi";
import { completeBooking, confirmBooking } from "../../services/bookingApi";
import { getDashboard } from "../../services/authApi";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { invalidateQuery, useQuery } from "../../hooks/useQuery";
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
 * The layout is ordered by what the person opening this actually needs,
 * in the order they need it:
 *
 *   1. anything waiting on a decision, because that is work
 *   2. today's numbers, because that is context for the work
 *   3. today's schedule, because that is the work
 *   4. the week ahead, because that is what to prepare for
 *
 * Queues sit above the figures deliberately. A dashboard that leads with
 * revenue while three payments are unverified has its priorities
 * upside-down for the person who opened it.
 *
 * The response is scoped to the signed-in account, so a receptionist
 * sees today's schedule and the bookings queue and no revenue figure
 * or customer count they have no capability to fetch.
 */

const SECTIONS = {
  bookings: "bookings.view",
  payments: "payments.view",
  customers: "customers.view",
  services: "services.manage",
  gallery: "gallery.manage",
  reviews: "reviews.moderate",
};

const QUICK_ACTIONS = [
  { key: "payments", label: "Verify payments", to: "/admin/payments" },
  { key: "bookings", label: "Confirm bookings", to: "/admin/bookings" },
  { key: "customers", label: "Customers", to: "/admin/customers" },
  { key: "services", label: "Services", to: "/admin/services" },
  { key: "gallery", label: "Gallery", to: "/admin/gallery" },
  { key: "reviews", label: "Reviews", to: "/admin/testimonials" },
];

export default function AdminOverview() {
  const { account } = useAdminAuth();

  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  // This is the screen a barber opens between customers, and it is the
  // one place where a stale number is actively misleading, so it is
  // always fetched fresh rather than served from cache. Every write on
  // this screen invalidates it, so the counts and the schedule move
  // together.
  const {
    data,
    error,
    isFetching: refreshing,
    refetch: load,
  } = useQuery("/accounts/reports/dashboard/", getDashboard, {
    scope: "staff",
    staleMs: 0,
  });

  const can = (section) => hasCapability(account, SECTIONS[section]);
  const canManageBookings = hasCapability(account, "bookings.manage");

  /**
   * Run a status transition on a schedule row.
   *
   * The whole dashboard is re-read afterwards rather than the row being
   * patched in place. This payload aggregates counts and rows from
   * several tables, so a booking transition changes today's count, the
   * pending tally and the revenue figure at the same time - there is no
   * correct way to patch one card in isolation and leave the rest true.
   */
  const runBookingAction = async (booking, action) => {
    setBusyId(booking.id);
    setActionError(null);

    try {
      await action(booking.id);

      invalidateQuery("reports/dashboard");
      invalidateQuery("bookings");
      invalidateQuery("availability");
    } catch (apiError) {
      setActionError(apiError);
    } finally {
      setBusyId(null);
    }
  };

  const queues = [
    data?.queues?.bookings_to_confirm != null && {
      label: "Bookings to confirm",
      count: data.queues.bookings_to_confirm,
      to: "/admin/bookings",
      icon: CalendarCheck,
    },
    data?.queues?.payments_to_verify != null && {
      label: "Payments to verify",
      count: data.queues.payments_to_verify,
      to: "/admin/payments",
      icon: CreditCard,
    },
    // Not the same question as "payments to verify". That one is receipts
    // sitting in the inbox waiting to be checked; this one is *confirmed*
    // appointments with no money behind them at all - a walk-in confirmed
    // by hand, or a payment rejected while the slot was held. Both need
    // chasing, and neither is visible from the other.
    //
    // Confirmed only, because payment opens after confirmation. A booking
    // nobody has confirmed yet is not money to chase - the customer cannot
    // send any - so it is counted by the queue above instead, where it
    // belongs.
    data?.queues?.payments_outstanding != null && {
      label: "Confirmed, unpaid",
      count: data.queues.payments_outstanding,
      to: "/admin/bookings",
      icon: CircleDollarSign,
    },
    data?.queues?.reviews_to_approve != null && {
      label: "Reviews to approve",
      count: data.queues.reviews_to_approve,
      to: "/admin/testimonials",
      icon: MessageSquareQuote,
    },
  ].filter(Boolean);

  const queueTotal = queues.reduce((sum, item) => sum + item.count, 0);

  const quickActions = QUICK_ACTIONS.filter((action) => can(action.key));

  const todayCount = data?.counts?.bookings?.today ?? 0;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow={`${staffRoleLabel(account?.staff_role)} console`}
        title={`Good to see you, ${account?.username || "there"}`}
        description={
          data
            ? `${formatDate(data.today)} — the shop as it stands right now.`
            : "The shop as it stands right now."
        }
        actions={
          <AdminButton
            onClick={load}
            icon={RefreshCw}
            loading={refreshing}
          >
            Refresh
          </AdminButton>
        }
      />

      {error && (
        <Alert
          tone="error"
          title="Could not load the dashboard"
          details={error.fieldErrors}
          onRetry={load}
        >
          {error.message}
        </Alert>
      )}

      {actionError && (
        <Alert
          tone="error"
          title="Action failed"
          details={actionError.fieldErrors}
        >
          {actionError.message}
        </Alert>
      )}

      {!data && !error && <AdminLoading label="Loading the dashboard..." />}

      {data && (
        <>
          {/* Work first. A dashboard that leads with revenue while
              three payments sit unverified has its priorities
              upside-down for whoever just opened it. */}
          {queueTotal > 0 && (
            <AdminSection
              title="Needs a decision"
              description="Work through these from your phone — each one is a tap away."
              actions={<AdminChip tone="warn">{queueTotal} waiting</AdminChip>}
            >
              <div className="grid gap-2 sm:grid-cols-3">
                {queues.map((item) => {
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.label}
                      to={item.to}
                      className="group flex min-h-16 items-center justify-between gap-3 rounded-xl border border-console-line bg-console-sunken px-3.5 py-3 transition hover:border-console-accent"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Icon size={16} className="shrink-0 text-console-accent" />
                        <span className="text-sm font-medium text-console-body">
                          {item.label}
                        </span>
                      </span>

                      <span className="flex shrink-0 items-center gap-1.5">
                        <span className="font-serif text-2xl leading-none tabular-nums text-console-ink">
                          {item.count}
                        </span>
                        <ArrowRight
                          size={14}
                          className="text-console-faint transition group-hover:translate-x-0.5 group-hover:text-console-accent"
                        />
                      </span>
                    </Link>
                  );
                })}
              </div>
            </AdminSection>
          )}

          {/* Then the numbers behind the work. */}
          <AdminStatGrid columns={4}>
            {data.counts?.bookings && (
              <AdminStat
                label="Bookings today"
                value={data.counts.bookings.today}
                sub={`${data.counts.bookings.pending_today} awaiting confirmation`}
                icon={CalendarCheck}
                to="/admin/bookings"
              />
            )}

            {data.counts?.payments && (
              <AdminStat
                label="Payments to verify"
                value={data.counts.payments.pending}
                sub={`${data.counts.payments.verified} verified all time`}
                icon={CreditCard}
                to="/admin/payments"
                tone={data.counts.payments.pending > 0 ? "warn" : "neutral"}
              />
            )}

            {data.revenue?.verified_total != null && (
              <AdminStat
                label="Verified revenue"
                value={formatPrice(data.revenue.verified_total)}
                sub={`${formatPrice(data.revenue.verified_this_month)} this month`}
                icon={TrendingUp}
                to="/admin/payments"
                tone="accent"
              />
            )}

            {data.counts?.users && (
              <AdminStat
                label="Customers"
                value={data.counts.users.total}
                sub={`${data.counts.users.staff} staff · ${data.counts.users.disabled} disabled`}
                icon={UserRound}
                to="/admin/customers"
              />
            )}

            {data.counts?.services && (
              <AdminStat
                label="Services live"
                value={data.counts.services.active}
                sub={`${data.counts.services.total} in total`}
                icon={Scissors}
                to="/admin/services"
              />
            )}

            {data.counts?.reviews && (
              <AdminStat
                label="Reviews to approve"
                value={data.counts.reviews.pending}
                sub={`${data.counts.reviews.total} submitted`}
                icon={MessageSquareQuote}
                to="/admin/testimonials"
                tone={data.counts.reviews.pending > 0 ? "warn" : "neutral"}
              />
            )}
          </AdminStatGrid>

          {/* Then the work itself, with the actions attached to the row
              they belong to. */}
          {can("bookings") && (
            <AdminSection
              title="Today's schedule"
              description={formatDate(data.today)}
              actions={
                <Link
                  to="/admin/bookings"
                  className="text-xs font-semibold text-console-accent hover:underline"
                >
                  All bookings
                </Link>
              }
            >
              {todayCount === 0 ? (
                <AdminEmpty
                  title="Nothing booked today"
                  body="No appointments on the book. A quiet day, or a gap worth filling."
                  action={
                    <Link
                      to="/admin/bookings"
                      className="text-sm font-semibold text-console-accent hover:underline"
                    >
                      Open bookings
                    </Link>
                  }
                />
              ) : (
                <>
                  {/* A dense row list from `sm` up. Below that the same
                      data as cards, because a 6-column grid at 360px is
                      60px per column and unreadable. */}
                  <ul className="hidden divide-y divide-console-line sm:block">
                    {data.schedule.today.map((booking) => {
                      const busy = busyId === booking.id;
                      const actionable =
                        canManageBookings &&
                        (booking.status === "pending" ||
                          booking.status === "confirmed");

                      return (
                        <li
                          key={booking.id}
                          className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0"
                        >
                          <span className="w-14 shrink-0 font-serif text-lg leading-none tabular-nums text-console-accent-strong">
                            {formatTime(booking.start_time)}
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-console-ink">
                              {booking.customer_name}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-console-muted">
                              {[
                                booking.service_name,
                                booking.barber_name || "Auto-assigned",
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </span>

                          {/* The code, because it is what the customer
                              will quote and what staff match against
                              when someone rings. */}
                          <span className="shrink-0 font-mono text-[11px] tracking-[0.08em] text-console-muted">
                            {booking.booking_code}
                          </span>

                          {booking.payment_due && (
                            <span
                              title="No payment received for this booking"
                              className="shrink-0 text-console-accent"
                            >
                              <CircleDollarSign size={14} />
                            </span>
                          )}

                          <AdminStatus status={booking.status} />

                          {actionable && (
                            <span className="shrink-0">
                              {booking.status === "pending" ? (
                                <AdminButton
                                  tone="primary"
                                  size="sm"
                                  icon={Check}
                                  loading={busy}
                                  onClick={() =>
                                    runBookingAction(booking, confirmBooking)
                                  }
                                >
                                  Confirm
                                </AdminButton>
                              ) : (
                                <AdminButton
                                  tone="primary"
                                  size="sm"
                                  icon={CheckCheck}
                                  loading={busy}
                                  onClick={() =>
                                    runBookingAction(booking, completeBooking)
                                  }
                                >
                                  Complete
                                </AdminButton>
                              )}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  <ul className="grid gap-2 sm:hidden">
                    {data.schedule.today.map((booking) => {
                      const busy = busyId === booking.id;
                      const actionable =
                        canManageBookings &&
                        (booking.status === "pending" ||
                          booking.status === "confirmed");

                      return (
                        <li
                          key={booking.id}
                          className=" rounded-xl border border-console-line bg-console-sunken p-3.5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                              <span className="shrink-0 font-serif text-lg leading-none tabular-nums text-console-accent-strong">
                                {formatTime(booking.start_time)}
                              </span>

                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-console-ink">
                                  {booking.customer_name}
                                </p>
                                <p className="mt-0.5 truncate text-xs text-console-muted">
                                  {[
                                    booking.service_name,
                                    booking.barber_name || "Auto-assigned",
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </p>
                                <p className="mt-0.5 font-mono text-[10px] tracking-[0.08em] text-console-muted">
                                  {booking.booking_code}
                                </p>
                              </div>
                            </div>

                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <AdminStatus status={booking.status} />

                              {booking.payment_due && (
                                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-console-accent">
                                  Unpaid
                                </span>
                              )}
                            </div>
                          </div>

                          {actionable && (
                            <div className="mt-3">
                              {booking.status === "pending" ? (
                                <AdminButton
                                  tone="primary"
                                  block
                                  icon={Check}
                                  loading={busy}
                                  onClick={() =>
                                    runBookingAction(booking, confirmBooking)
                                  }
                                >
                                  Confirm booking
                                </AdminButton>
                              ) : (
                                <AdminButton
                                  tone="primary"
                                  block
                                  icon={CheckCheck}
                                  loading={busy}
                                  onClick={() =>
                                    runBookingAction(booking, completeBooking)
                                  }
                                >
                                  Mark completed
                                </AdminButton>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </AdminSection>
          )}

          {can("bookings") && data.schedule.upcoming.length > 0 && (
            <AdminSection
              title="The week ahead"
              description="The next seven days, so a quiet one can be covered before it is empty."
            >
              <ul className="divide-y divide-console-line">
                {data.schedule.upcoming.map((booking) => (
                  <li
                    key={booking.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 first:pt-0 last:pb-0"
                  >
                    <span className="w-24 shrink-0 text-xs font-medium text-console-muted">
                      {formatDate(booking.booking_date).replace(/, \d{4}$/, "")}
                    </span>

                    <span className="w-12 shrink-0 text-xs font-semibold tabular-nums text-console-accent-strong">
                      {formatTime(booking.start_time)}
                    </span>

                    <span className="min-w-0 flex-1 truncate text-sm text-console-ink">
                      {booking.customer_name}
                    </span>

                    <span className="shrink-0 font-mono text-[11px] tracking-[0.08em] text-console-muted">
                      {booking.booking_code}
                    </span>

                    <span className="min-w-0 shrink-0 truncate text-xs text-console-muted">
                      {booking.service_name}
                    </span>

                    {booking.payment_due && (
                      <span
                        title="No payment received for this booking"
                        className="shrink-0 text-console-accent"
                      >
                        <CircleDollarSign size={13} />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </AdminSection>
          )}

          {can("bookings") && data.schedule.today.length > 0 && (
            <AdminPanel>
              <AdminDetails columns={3}>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-console-muted">
                    Confirmed today
                  </p>
                  <p className="mt-1 font-serif text-2xl leading-none tabular-nums text-console-ink">
                    {data.counts?.bookings?.confirmed_today ?? 0}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-console-muted">
                    Completed today
                  </p>
                  <p className="mt-1 font-serif text-2xl leading-none tabular-nums text-console-ink">
                    {data.counts?.bookings?.completed_today ?? 0}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-console-muted">
                    Booked all time
                  </p>
                  <p className="mt-1 font-serif text-2xl leading-none tabular-nums text-console-ink">
                    {data.counts?.bookings?.all_time ?? 0}
                  </p>
                </div>
              </AdminDetails>
            </AdminPanel>
          )}

          {quickActions.length > 0 && (
            <AdminSection title="Go to" bodyClassName="p-4 sm:p-5">
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {quickActions.map((action) => (
                  <Link
                    key={action.to}
                    to={action.to}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-console-line bg-console-raised px-3 py-2.5 text-center text-xs font-semibold text-console-body transition hover:border-console-accent hover:text-console-accent-strong"
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            </AdminSection>
          )}
        </>
      )}
    </div>
  );
}
