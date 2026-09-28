import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, RefreshCw, Search, Star, Trash2, X } from "lucide-react";

import Alert from "../../components/ui/Alert";
import StatusBadge from "../../components/StatusBadge";
import {
  AdminButton,
  AdminEmpty,
  AdminFilterTabs,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
} from "../../components/admin/AdminUi";
import { mediaUrl } from "../../services/api";
import {
  approveTestimonial,
  deleteTestimonial,
  listAllTestimonials,
  rejectTestimonial,
} from "../../services/testimonialsApi";

/**
 * Testimonials moderation — GET /api/testimonials/testimonials/ (admin
 * sees every status). Approve pending reviews to publish them, reject
 * or delete unwanted ones.
 *
 * Every review now belongs to an account, so a review submitted before
 * accounts existed has `user: null` and its name came from a free-text
 * field. Those are marked "legacy, name unverified" rather than being
 * presented as if the name were checked - the moderator is judging
 * whether to publish, and that distinction is the whole point of the
 * gate.
 */

const FILTERS = ["all", "pending", "approved", "rejected"];

export default function AdminTestimonials() {
  const [items, setItems] = useState([]);
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

    return listAllTestimonials()
      .then((data) => {
        setItems(Array.isArray(data) ? data : data?.results || []);
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
    const tally = { all: items.length };

    for (const option of FILTERS) {
      if (option === "all") {
        continue;
      }

      tally[option] = items.filter(
        (row) => row.status === option
      ).length;
    }

    return tally;
  }, [items]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return items.filter((item) => {
      if (filter !== "all" && item.status !== filter) {
        return false;
      }

      if (!needle) {
        return true;
      }

      return [
        item.customer_name,
        item.message,
      ]
        .filter(Boolean)
        .some((field) =>
          String(field).toLowerCase().includes(needle)
        );
    });
  }, [items, filter, query]);

  const replaceRow = (updated) => {
    setItems((rows) =>
      rows.map((row) => (row.id === updated.id ? updated : row))
    );
  };

  const run = async (item, action, { confirmFn } = {}) => {
    if (confirmFn && !confirmFn()) {
      return;
    }

    setBusyId(item.id);
    setActionError(null);

    try {
      replaceRow(await action(item.id));
    } catch (apiError) {
      setActionError(apiError);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = (item) =>
    run(item, async (id) => {
      await deleteTestimonial(id);
      setItems((rows) => rows.filter((row) => row.id !== id));
    }, {
      confirmFn: () =>
        window.confirm(`Delete review by ${item.customer_name}?`),
    });

  return (
    <div>
      <AdminPageHeader
        eyebrow="Staff · Management"
        title="Testimonials"
        description="Approve reviews to publish them on the site."
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

      <div className="relative mt-4">
        <Search
          size={15}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
        />

        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search reviews by name or text"
          aria-label="Search reviews"
          className="w-full rounded-xl border border-white/10 bg-[#181818] py-3 pl-11 pr-11 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#d6a85f]/50"
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

      {loading && <AdminLoading label="Loading testimonials..." />}

      {!loading && error && (
        <Alert
          tone="error"
          title="Could not load testimonials"
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
              ? `No reviews match "${query}".`
              : filter === "all"
                ? "No reviews yet."
                : `No ${filter} reviews right now.`
          }
          onRetry={load}
        />
      )}

      {!loading && !error && shown.length > 0 && (
        <div className="mt-5 grid gap-3">
          {shown.map((item) => {
            const busy = busyId === item.id;
            const legacy = !item.user;

            return (
              <AdminPanel key={item.id}>
                <div className="flex items-start gap-3 sm:gap-4">
                  {item.photo ? (
                    <img
                      src={mediaUrl(item.photo)}
                      alt={`${item.customer_name}'s haircut`}
                      className="h-20 w-24 shrink-0 rounded-xl object-cover sm:h-24 sm:w-32"
                    />
                  ) : (
                    <span className="flex h-20 w-24 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#181818] font-serif text-2xl text-[#d6a85f] sm:h-24 sm:w-32">
                      {item.customer_name?.charAt(0)?.toUpperCase() || "?"}
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <p className="break-words font-semibold text-white">
                        {item.customer_name}
                      </p>

                      <StatusBadge
                        status={item.status}
                        kind="testimonial"
                      />
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <div className="flex gap-0.5 text-[#d6a85f]">
                        {Array.from({ length: item.rating }).map(
                          (_, i) => (
                            <Star
                              key={i}
                              size={12}
                              fill="currentColor"
                            />
                          )
                        )}
                      </div>

                      {legacy && (
                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-white/35">
                          Legacy · name unverified
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <p className="mt-4 break-words text-sm leading-7 text-white/70">
                  “{item.message}”
                </p>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                  {item.status === "pending" && (
                    <>
                      <AdminButton
                        tone="primary"
                        icon={Check}
                        onClick={() =>
                          run(item, approveTestimonial)
                        }
                        disabled={busy}
                      >
                        {busy ? "Working..." : "Approve"}
                      </AdminButton>

                      <AdminButton
                        icon={X}
                        onClick={() =>
                          run(item, rejectTestimonial)
                        }
                        disabled={busy}
                      >
                        Reject
                      </AdminButton>
                    </>
                  )}

                  <AdminButton
                    tone="danger"
                    icon={Trash2}
                    onClick={() => handleDelete(item)}
                    disabled={busy}
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
