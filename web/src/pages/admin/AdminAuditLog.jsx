import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ClipboardList, Search, X } from "lucide-react";

import Alert from "../../components/ui/Alert";
import {
  AdminButton,
  AdminEmpty,
  AdminFilterTabs,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
} from "../../components/admin/AdminUi";
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

const SEARCH =
  "w-full rounded-xl border border-white/10 bg-[#181818] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#d6a85f]/50";

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
    <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/40">
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
            <dt className="shrink-0 text-white/30">
              {key.replace(/_/g, " ")}:
            </dt>
            <dd className="min-w-0 break-words">{text}</dd>
          </div>
        );
      })}
    </dl>
  );
}

export default function AdminAuditLog() {
  const [logs, setLogs] = useState([]);
  const [count, setCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [filter, setFilter] = useState("");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");

  /**
   * Fetch one page.
   *
   * `append` is what "load more" uses, so the rows already on screen
   * stay put and a new filter replaces them instead.
   */
  const fetchPage = useCallback(
    async ({ nextOffset, append, filters }) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const data = await listAuditLogs({
          filters,
          limit: PAGE_SIZE,
          offset: nextOffset,
        });

        setLogs((current) =>
          append ? [...current, ...data.results] : data.results
        );
        setCount(data.count);
        setHasMore(data.has_more);
        setOffset(nextOffset);
        setError(null);
      } catch (apiError) {
        setError(apiError);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    []
  );

  const runSearch = (event) => {
    event.preventDefault();

    const next = { action: filter, q: search.trim() };

    setSearch(query.trim());
    fetchPage({ nextOffset: 0, append: false, filters: next });
  };

  useEffect(() => {
    fetchPage({
      nextOffset: 0,
      append: false,
      filters: { action: "", q: "" },
    });
  }, [fetchPage]);

  const counts = {
    "": count,
  };

  return (
    <div>
      <AdminPageHeader
        eyebrow="Oversight"
        title="Activity log"
        description="Every privileged action, in the order it happened: account and role changes, booking decisions, payment verifications and content changes."
      />

      {error && (
        <Alert
          tone="error"
          title="Could not load the activity log"
          details={error.fieldErrors}
          onRetry={() =>
            fetchPage({
              nextOffset: 0,
              append: false,
              filters: { action: filter, q: search },
            })
          }
          className="mt-6"
        >
          {error.message}
        </Alert>
      )}

      <form onSubmit={runSearch} className="relative mt-6">
        <Search
          size={15}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
        />

        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search action, person or record type"
          aria-label="Search the activity log"
          className={`${SEARCH} pl-11 pr-11`}
        />

        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSearch("");
              fetchPage({
                nextOffset: 0,
                append: false,
                filters: { action: filter, q: "" },
              });
            }}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-white/40 transition hover:text-white"
          >
            <X size={15} />
          </button>
        )}
      </form>

      {/* The kind filter is applied by the API, so only the active
          selection carries a count — an unfiltered page cannot say how
          many of each kind exist without a request per kind. */}
      <AdminFilterTabs
        options={FILTERS.map((option) => ({
          key: option.key,
          label: option.label,
          count: counts[option.key],
        }))}
        value={filter}
        onChange={(next) => {
          setFilter(next);
          setSearch("");
          setQuery("");
          fetchPage({
            nextOffset: 0,
            append: false,
            filters: { action: next, q: "" },
          });
        }}
      />

      {loading && <AdminLoading label="Loading activity..." />}

      {!loading && !error && logs.length === 0 && (
        <AdminEmpty
          title="Nothing recorded"
          body={
            search || filter
              ? "No actions match this filter."
              : "No privileged actions recorded yet."
          }
          onRetry={() =>
            fetchPage({
              nextOffset: 0,
              append: false,
              filters: { action: filter, q: search },
            })
          }
        />
      )}

      {!loading && !error && logs.length > 0 && (
        <>
          <p className="mt-4 text-[11px] uppercase tracking-[0.2em] text-white/30">
            Showing {logs.length} of {count}
          </p>

          <AdminPanel className="mt-3">
            <ol className="space-y-3">
              {logs.map((log) => (
                <li
                  key={log.id}
                  className="flex gap-3 border-b border-white/10 pb-3 last:border-0 last:pb-0"
                >
                  <ClipboardList
                    size={17}
                    className="mt-0.5 shrink-0 text-[#d6a85f]"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">
                      {actionLabel(log.action)}
                    </p>

                    <p className="mt-1 text-xs text-white/45">
                      {log.actor_name} ·{" "}
                      {new Date(log.created_at).toLocaleString()}
                      {log.target_id ? ` · #${log.target_id}` : ""}
                      {log.ip_address ? ` · ${log.ip_address}` : ""}
                    </p>

                    <ActionDetails details={log.details} />
                  </div>
                </li>
              ))}
            </ol>
          </AdminPanel>

          {hasMore && (
            <div className="mt-4 flex justify-center">
              <AdminButton
                icon={ChevronRight}
                disabled={loadingMore}
                onClick={() =>
                  fetchPage({
                    nextOffset: offset + PAGE_SIZE,
                    append: true,
                    filters: { action: filter, q: search },
                  })
                }
              >
                {loadingMore
                  ? "Loading..."
                  : `Load ${Math.min(PAGE_SIZE, count - offset - PAGE_SIZE)} more`}
              </AdminButton>
            </div>
          )}

          {offset > 0 && !hasMore && (
            <p className="mt-4 flex items-center justify-center gap-2 text-xs text-white/35">
              <ChevronLeft size={13} />
              That is the whole trail for this filter.
            </p>
          )}
        </>
      )}
    </div>
  );
}
