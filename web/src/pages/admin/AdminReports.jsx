import { useMemo } from "react";
import {
  BarChart3,
  CalendarCheck,
  CircleDollarSign,
  CreditCard,
  MessageSquareQuote,
  Printer,
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
  AdminSection,
  AdminStat,
  AdminStatGrid,
} from "../../components/admin/AdminUi";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { invalidateQuery, useQuery } from "../../hooks/useQuery";
import { getDashboard, getOperationsReport } from "../../services/authApi";
import { formatDate, formatPrice, formatTime } from "../../utils/format";
import { formatEthiopianWeekday, shiftIsoDate } from "../../utils/ethiopianDate";
import { canManagePeople, hasCapability } from "../../utils/staffRole";

/**
 * Reports — /admin/reports
 *
 * Two endpoints, read together rather than one of them replacing the other:
 *
 *   GET /api/accounts/reports/dashboard/    scoped to the caller
 *   GET /api/accounts/reports/operations/   whole-shop totals, owner/admin
 *
 * The dashboard is the one every staff account can read and it is scoped:
 * a receptionist gets the volumes they are allowed to see and the revenue
 * sections come back absent rather than as zero. The operations report is
 * refused outright to anyone but the owner and administrators, so it is
 * only requested when the account could read it — asking and catching a
 * 403 would put a permanent error banner above a screen that is otherwise
 * perfectly usable.
 *
 * ## Where the numbers come from, said on the page
 *
 * The seven-day chart and the service mix are built from the schedule rows
 * the dashboard returns, and that is *a* window rather than the whole
 * diary: the endpoint caps the upcoming list. So the chart is labelled as
 * what it is — the appointments this console can see — instead of being
 * captioned "bookings per day" and quietly under-reporting a busy week.
 * Anyone who needs the true daily totals gets them from the booking list
 * filtered by date, which is a question about rows rather than about
 * aggregates.
 */

/** How many days the load chart covers. Matches the dashboard's horizon. */
const CHART_DAYS = 7;

export default function AdminReports() {
  const { account } = useAdminAuth();

  const canSeeCustomers = hasCapability(account, "customers.view");
  const canSeeServices = hasCapability(account, "services.manage");
  const canSeeReviews = hasCapability(account, "reviews.moderate");

  const isOwner = canManagePeople(account);

  const {
    data,
    error,
    isFetching: refreshing,
    refetch: load,
  } = useQuery("/accounts/reports/dashboard/", getDashboard, {
    scope: "staff",
    // A report is the one screen people screenshot and send to someone
    // else, so it is always read fresh rather than served from cache.
    staleMs: 0,
  });

  const {
    data: operations,
    error: operationsError,
    isFetching: operationsLoading,
    refetch: loadOperations,
  } = useQuery(
    "/accounts/reports/operations/",
    getOperationsReport,
    {
      scope: "staff",
      // Only asked for by an account that may read it. See the note above.
      enabled: isOwner,
      staleMs: 60 * 1000,
    }
  );

  const handleRefresh = () => {
    load();
    invalidateQuery("reports/dashboard");

    if (isOwner) {
      loadOperations();
    }
  };

  const schedule = data?.schedule || { today: [], upcoming: [] };

  /** Today plus the horizon, each with the appointments booked on it. */
  const weekLoad = useMemo(() => {
    const rows = [...schedule.today, ...schedule.upcoming];

    return Array.from({ length: CHART_DAYS }, (_, index) => {
      const date = shiftIsoDate(data?.today, index);

      return {
        date,
        isToday: index === 0,
        count: rows.filter((row) => row.booking_date === date).length,
      };
    });
  }, [data?.today, schedule.today, schedule.upcoming]);

  const peak = Math.max(1, ...weekLoad.map((day) => day.count));

  /** Which services the visible schedule is actually for. */
  const serviceMix = useMemo(() => {
    const tally = new Map();

    for (const row of [...schedule.today, ...schedule.upcoming]) {
      const name = row.service_name || "Unassigned";

      tally.set(name, (tally.get(name) || 0) + 1);
    }

    return [...tally.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [schedule.today, schedule.upcoming]);

  const mixTotal = serviceMix.reduce((sum, item) => sum + item.count, 0);

  const hasMoney = data?.revenue?.verified_total != null;
  const hasCounts = Boolean(data?.counts);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Numbers"
        title="Reports"
        description="The shop's own figures, read from the API rather than counted in the browser."
        actions={
          <>
            <AdminButton
              onClick={handleRefresh}
              icon={RefreshCw}
              loading={refreshing}
            >
              Refresh
            </AdminButton>

            <AdminButton onClick={() => window.print()} icon={Printer}>
              Print
            </AdminButton>
          </>
        }
      />

      {error && (
        <Alert
          tone="error"
          title="Could not load the report"
          details={error.fieldErrors}
          onRetry={load}
        >
          {error.message}
        </Alert>
      )}

      {!data && !error && <AdminLoading label="Building the report..." />}

      {data && (
        <>
          {/* ------------------------------------------------------------
              Money first, because it is the question people open this for.
              Absent rather than zero for a caller with no money
              capability - the endpoint omits the section entirely, and
              printing "0 ETB" for something they may not see is a lie.
              ------------------------------------------------------------ */}
          {hasMoney && (
            <AdminStatGrid columns={4}>
              <AdminStat
                label="Verified revenue"
                value={formatPrice(data.revenue.verified_total)}
                sub="All time, checked by staff"
                icon={CircleDollarSign}
                tone="accent"
              />
              <AdminStat
                label="This month"
                value={formatPrice(data.revenue.verified_this_month)}
                sub="Verified since the 1st"
                icon={TrendingUp}
                to="/admin/payments"
              />
              <AdminStat
                label="Today"
                value={formatPrice(data.revenue.verified_today)}
                sub="Money actually checked today"
                icon={CircleDollarSign}
              />
              <AdminStat
                label="Awaiting a decision"
                value={data.queues?.payments_to_verify ?? 0}
                sub="Receipts sitting in the inbox"
                icon={CreditCard}
                to="/admin/payments"
                tone={data.queues?.payments_to_verify > 0 ? "warn" : "neutral"}
              />
            </AdminStatGrid>
          )}

          {/* ------------------------------------------------------------
              Volume
              ------------------------------------------------------------ */}
          {hasCounts && (
            <AdminSection
              title="Volume"
              description="Counts as they stand right now. Every card is a link to the rows behind it."
            >
              <AdminStatGrid columns={3}>
                {data.counts?.bookings && (
                  <AdminStat
                    label="Bookings today"
                    value={data.counts.bookings.today}
                    sub={`${data.counts.bookings.pending_today} awaiting confirmation`}
                    icon={CalendarCheck}
                    to="/admin/bookings"
                  />
                )}

                {data.counts?.bookings && (
                  <AdminStat
                    label="Booked all time"
                    value={data.counts.bookings.all_time}
                    sub={`${data.counts.bookings.awaiting_payment} confirmed, unpaid`}
                    icon={BarChart3}
                    to="/admin/bookings"
                  />
                )}

                {canSeeCustomers && data.counts?.users && (
                  <AdminStat
                    label="Accounts"
                    value={data.counts.users.total}
                    sub={`${data.counts.users.active} active · ${data.counts.users.staff} staff`}
                    icon={UserRound}
                    to="/admin/customers"
                  />
                )}

                {canSeeServices && data.counts?.services && (
                  <AdminStat
                    label="Services live"
                    value={data.counts.services.active}
                    sub={`${data.counts.services.total} in total`}
                    icon={Scissors}
                    to="/admin/services"
                  />
                )}

                {canSeeReviews && data.counts?.reviews && (
                  <AdminStat
                    label="Reviews"
                    value={data.counts.reviews.total}
                    sub={`${data.counts.reviews.pending} waiting to be approved`}
                    icon={MessageSquareQuote}
                    to="/admin/testimonials"
                    tone={
                      data.counts.reviews.pending > 0 ? "warn" : "neutral"
                    }
                  />
                )}
              </AdminStatGrid>
            </AdminSection>
          )}

          {/* ------------------------------------------------------------
              The week ahead
              ------------------------------------------------------------ */}
          <AdminSection
            title="The week ahead"
            description="Appointments this console can see, by day. The dashboard caps how far ahead it lists, so a busy week reads as a floor rather than a total."
            actions={<AdminChip tone="neutral">{peak} peak</AdminChip>}
          >
            <div className="flex h-40 items-end gap-1.5 sm:gap-3">
              {weekLoad.map((day) => {
                const height = Math.round((day.count / peak) * 100);

                return (
                  <div
                    key={day.date}
                    className="flex min-w-0 flex-1 flex-col items-center gap-2"
                  >
                    <span className="text-[11px] font-semibold tabular-nums text-console-ink">
                      {day.count || ""}
                    </span>

                    <div className="flex h-full w-full items-end">
                      <div
                        className={`w-full rounded-t-md transition-all ${
                          day.isToday
                            ? "bg-console-accent"
                            : "bg-console-accent/35"
                        }`}
                        style={{ height: `${Math.max(height, day.count ? 8 : 2)}%` }}
                        title={`${formatDate(day.date)}: ${day.count} booked`}
                      />
                    </div>

                    <span className="text-center text-[10px] leading-4 text-console-muted">
                      {day.isToday
                        ? "Today"
                        : formatEthiopianWeekday(day.date).replace(/^./, "")}
                    </span>
                  </div>
                );
              })}
            </div>
          </AdminSection>

          {/* ------------------------------------------------------------
              Service mix
              ------------------------------------------------------------ */}
          <AdminSection
            title="What people are booking"
            description="Counted from the same visible schedule. Open the booking list to see the rows themselves."
          >
            {serviceMix.length === 0 ? (
              <AdminEmpty
                title="Nothing in the schedule yet"
                body="Once bookings exist in the next week they will be counted here."
                action={
                  <a
                    href="/admin/bookings"
                    className="text-sm font-semibold text-console-accent hover:underline"
                  >
                    Open bookings
                  </a>
                }
              />
            ) : (
              <ul className="space-y-3">
                {serviceMix.map((item) => {
                  const share = Math.round((item.count / mixTotal) * 100);

                  return (
                    <li key={item.name}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate text-sm text-console-ink">
                          {item.name}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-console-muted">
                          {item.count} · {share}%
                        </span>
                      </div>

                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-console-sunken">
                        <div
                          className="h-full rounded-full bg-console-accent/70"
                          style={{ width: `${share}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </AdminSection>

          {/* ------------------------------------------------------------
              Whole-shop totals — owner and administrators only
              ------------------------------------------------------------ */}
          {isOwner && (
            <AdminSection
              title="Whole-shop totals"
              description="Everything, with no capability scoping. Owner and administrators only."
              actions={
                operationsLoading ? (
                  <AdminChip tone="neutral">Loading</AdminChip>
                ) : null
              }
            >
              {operationsError && (
                <Alert
                  tone="error"
                  title="Could not load the operations report"
                  details={operationsError.fieldErrors}
                  onRetry={loadOperations}
                >
                  {operationsError.message}
                </Alert>
              )}

              {!operations && !operationsError && (
                <AdminLoading label="Loading the operations report..." />
              )}

              {operations && (
                <>
                  <AdminDetails columns={4}>
                    <ReportFigure
                      label="Accounts"
                      value={operations.users?.total}
                      sub={`${operations.users?.active ?? 0} active · ${operations.users?.staff ?? 0} staff`}
                    />
                    <ReportFigure
                      label="Bookings"
                      value={operations.bookings?.total}
                      sub={`${operations.bookings?.pending ?? 0} pending · ${operations.bookings?.confirmed ?? 0} confirmed`}
                    />
                    <ReportFigure
                      label="Payments"
                      value={operations.payments?.total}
                      sub={`${operations.payments?.verified ?? 0} verified · ${operations.payments?.rejected ?? 0} rejected`}
                    />
                    <ReportFigure
                      label="Verified value"
                      value={operations.payments?.verified_value}
                      money
                      sub="All time"
                    />
                  </AdminDetails>

                  <div className="mt-4 grid gap-4 border-t border-console-line pt-4 sm:grid-cols-3">
                    <ReportFigure
                      label="Completed"
                      value={operations.bookings?.completed}
                      sub="Appointments served"
                    />
                    <ReportFigure
                      label="Services live"
                      value={operations.services?.active}
                      sub={`${operations.services?.total ?? 0} in total`}
                    />
                    <ReportFigure
                      label="Generated"
                      value={formatDate(operations.generated_at)}
                      sub="Server time, recorded in the audit trail"
                    />
                  </div>
                </>
              )}
            </AdminSection>
          )}

          {/* ------------------------------------------------------------
              Today's rows, so the report can be acted on without a second
              screen. The same list the dashboard shows, not a re-count.
              ------------------------------------------------------------ */}
          {schedule.today.length > 0 && (
            <AdminSection
              title="Today, row by row"
              description={formatDate(data.today)}
            >
              <ul className="divide-y divide-console-line">
                {schedule.today.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0"
                  >
                    <span className="w-12 shrink-0 text-xs font-semibold tabular-nums text-console-accent-strong">
                      {formatTime(row.start_time)}
                    </span>

                    <span className="min-w-0 flex-1 truncate text-sm text-console-ink">
                      {row.customer_name}
                    </span>

                    <span className="min-w-0 shrink-0 truncate text-xs text-console-muted">
                      {row.service_name}
                    </span>

                    <span className="shrink-0 font-mono text-[11px] tracking-[0.08em] text-console-muted">
                      {row.booking_code}
                    </span>

                    <AdminChip
                      tone={
                        row.payment_status === "verified"
                          ? "good"
                          : row.payment_due
                            ? "warn"
                            : "neutral"
                      }
                    >
                      {row.payment_status || (row.payment_due ? "unpaid" : "no money due")}
                    </AdminChip>
                  </li>
                ))}
              </ul>
            </AdminSection>
          )}
        </>
      )}
    </div>
  );
}

/** One label/figure/sub line, for the whole-shop panel. */
function ReportFigure({ label, value, sub, money = false }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-console-muted">
        {label}
      </p>
      <p className="mt-1 font-serif text-2xl leading-none tabular-nums text-console-ink">
        {money ? formatPrice(value ?? 0) : (value ?? "—")}
      </p>
      {sub && (
        <p className="mt-1 text-[11px] leading-5 text-console-muted">{sub}</p>
      )}
    </div>
  );
}