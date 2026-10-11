import { useState } from "react";
import { ChevronLeft, ChevronRight, ClipboardList, RefreshCw } from "lucide-react";

import Alert from "../../components/ui/Alert";
import {
  AdminButton,
  AdminChip,
  AdminEmpty,
  AdminFilterTabs,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
  AdminSearch,
} from "../../components/admin/AdminUi";
import { useQuery } from "../../hooks/useQuery";
import { listAuditLogs } from "../../services/authApi";

/**
 * The activity trail — who did what, and when.
 *
 * This is the screen that answers "why does this account have that
 * role", so it is filtered and paged rather than dumped: the
 * interesting question is almost always one person, one kind of
 * action, or one record, and an unfiltered list buries all three
 * under a week of payment decisions.
 *
 * Every filter maps to a query parameter the API applies, so a
 * narrower question is a narrower query, not a filter over a page
 * that has already been cut off. The "Load more" button pages forward
 * with offset rather than replacing the list, because the newest
 * entries are the ones being looked for and they should stay on
 * screen.
 *
 * Each page is cached under its own key, so paging forward and back
 * again costs no request, and so does returning to a filter that was
 * already looked at.
 */

const PAGE_SIZE = 50;

const FILTERS = [
  { key: "", label: "Everything" },
  { key: "user", label: "Accounts" },
  { key: "staff", label: "Access" },
  { key: "booking", label: "Bookings" },
  { key: "payment", label: "Payments" },
  { key: "service", label: "Services" },
  { key: "gallery", label: "Gallery" },
  { key: "testimonial", label: "Reviews" },
];

/**
 * Turn `user.updated` into `User updated`.
 *
 * A display concern only - the value sent to the API is still the raw
 * dotted action, which is what the filter matches on.
 */
function actionLabel(action) {
  return action
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Render the `details` payload a privileged action recorded.
 *
 * Most entries carry a flat set of changed fields; a user update
 * carries a `{from, to}` pair per field. Both are shown as plain text
 * rather than JSON, because a raw object dumped into the activity log
 * is the one thing on this screen nobody can read.
 */
function ActionDetails({ details }) {
  const entries = Object.entries(details || {}).filter(
    ([, value]) => value !== null && value !== undefined && value !== ""
  );

  if (entries.length === 0) {
    return null;
  }

  return (
    <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-console-muted">
      {entries.map(([key, value]) => {
        const isChange =
          value &&
          typeof value === "object" &&
          "from" in value &&
          "to" in value;

        const text = isChange
          ? `${JSON.stringify(value.from)} → ${JSON.stringify(value.to)}`
          : typeof value === "object"
            ? Object.entries(value)
                .map(([name, item]) => `${name}: ${JSON.stringify(item)}`)
                .join(", ")
            : String(value);

        return (
          <div key={key} className="flex min-w-0 gap-1.5">
            <dt className="shrink-0 text-console-faint">
              {key.replace(/_/g, " ")}:
            </dt>
            <dd className="min-w-0 break-words">{text}</dd>
          </div>
        );
      })}
    </dl>
  );
}

/** One entry in the trail. */
function LogRow({ log }) {
  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-console-sunken text-console-accent">
        <ClipboardList size={15} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-console-ink">
          {actionLabel(log.action)}
        </p>

        <p className="mt-0.5 text-xs text-console-muted">
          {log.actor_name} · {new Date(log.created_at).toLocaleString()}
          {log.target_id ? ` · #${log.target_id}` : ""}
          {log.ip_address ? ` · ${log.ip_address}` : ""}
        </p>

        <ActionDetails details={log.details} />
      </div>
    </li>
  );
}

/**
 * A page after the first.
 *
 * Kept as its own component so each offset is independently cached and
 * independently renders. A page that is already in the cache paints
 * immediately, which is what makes reading several pages feel like
 * reading a document rather than waiting on a spinner each time.
 */
function AuditPageTail({ filters, offset }) {
  const { data, loading, error } = useQuery(
    "/accounts/audit-logs/",
    (signal) => listAuditLogs({ filters, limit: PAGE_SIZE, offset, signal }),
    {
      params: { ...filters, limit: PAGE_SIZE, offset },
      scope: "staff",
      staleMs: 60 * 1000,
    }
  );

  if (error) {
    return (
      <Alert
        tone="error"
        title="Could not load more of the activity log"
        details={error.fieldErrors}
      >
        {error.message}
      </Alert>
    );
  }

  if (loading) {
    return <AdminLoading label="Loading more..." />;
  }

  const results = data?.results || [];

  if (results.length === 0) {
    return null;
  }

  return (
    <ol className="divide-y divide-console-line">
      {results.map((log) => (
        <LogRow key={log.id} log={log} />
      ))}
    </ol>
  );
}

export default function AdminAuditLog() {
  const [filter, setFilter] = useState("");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");

  /** How many pages are open. The first is always shown. */
  const [pages, setPages] = useState(1);

  const filters = { action: filter, q: search };

  const {
    data,
    loading,
    error,
    refetch,
  } = useQuery(
    "/accounts/audit-logs/",
    (signal) => listAuditLogs({ filters, limit: PAGE_SIZE, offset: 0, signal }),
    {
      params: { ...filters, limit: PAGE_SIZE, offset: 0 },
      scope: "staff",
      staleMs: 30 * 1000,
    }
  );

  const logs = data?.results || [];
  const count = data?.count ?? 0;
  const hasMore = Boolean(data?.has_more);

  /** Entries the open pages cover, capped at the real total. */
  const shown = Math.min(pages * PAGE_SIZE, count);

  const runSearch = (event) => {
    event.preventDefault();

    setSearch(query.trim());
    setPages(1);
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Oversight"
        title="Activity log"
        description="Every privileged action, in the order it happened: account and role changes, booking decisions, payment verifications and content changes."
        actions={
          <AdminButton onClick={refetch} icon={RefreshCw}>
            Refresh
          </AdminButton>
        }
      />

      {error && (
        <Alert
          tone="error"
          title="Could not load the activity log"
          details={error.fieldErrors}
          onRetry={refetch}
        >
          {error.message}
        </Alert>
      )}

      <form onSubmit={runSearch} className="space-y-4">
        <AdminSearch
          value={query}
          onChange={setQuery}
          placeholder="Search action, person or record type"
        />

        {/* The kind filter is applied by the API. Only the active
            selection could carry a count, and even that would need a
            request per kind to know, so the tabs stay unnumbered. */}
        <AdminFilterTabs
          options={FILTERS.map((option) => ({
            key: option.key,
            label: option.label,
          }))}
          value={filter}
          onChange={(next) => {
            setFilter(next);
            setSearch("");
            setQuery("");
            setPages(1);
          }}
        />

        <button type="submit" className="sr-only" aria-hidden="true" tabIndex={-1} />
      </form>

      {loading && <AdminLoading label="Loading activity..." />}

      {!loading && !error && logs.length === 0 && (
        <AdminEmpty
          title="Nothing recorded"
          body={
            search || filter
              ? "No actions match this filter."
              : "No privileged actions recorded yet."
          }
          onRetry={refetch}
        />
      )}

      {!loading && !error && logs.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-console-muted">
              Showing {shown} of {count}
            </p>

            {filters.action && (
              <AdminChip tone="warn">Filtered by {filters.action}</AdminChip>
            )}
          </div>

          <AdminPanel>
            <ol className="divide-y divide-console-line">
              {logs.map((log) => (
                <LogRow key={log.id} log={log} />
              ))}
            </ol>
          </AdminPanel>

          {Array.from({ length: Math.max(pages - 1, 0) }, (unused, index) => {
            const offset = (index + 1) * PAGE_SIZE;

            return (
              <AdminPanel key={offset}>
                <AuditPageTail filters={filters} offset={offset} />
              </AdminPanel>
            );
          })}

          {hasMore && (
            <div className="flex justify-center">
              <AdminButton
                icon={ChevronRight}
                block
                onClick={() => setPages((value) => value + 1)}
              >
                {`Load ${Math.min(PAGE_SIZE, count - shown)} more`}
              </AdminButton>
            </div>
          )}

          {!hasMore && pages > 1 && (
            <p className="flex items-center justify-center gap-2 text-xs text-console-muted">
              <ChevronLeft size={13} />
              That is the whole trail for this filter.
            </p>
          )}
        </>
      )}
    </div>
  );
}
