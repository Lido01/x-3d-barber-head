import { useMemo, useState } from "react";
import { Check, RefreshCw, Star, Trash2, X } from "lucide-react";

import Alert from "../../components/ui/Alert";
import {
  AdminButton,
  AdminChip,
  AdminConfirmButton,
  AdminEmpty,
  AdminFilterTabs,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
  AdminSearch,
  AdminStatus,
} from "../../components/admin/AdminUi";
import { EMPTY_LIST, invalidateQuery, useQuery } from "../../hooks/useQuery";
import { mediaUrl } from "../../services/api";
import { toArray } from "../../utils/toArray";
import {
  approveTestimonial,
  deleteTestimonial,
  listAllTestimonials,
  rejectTestimonial,
} from "../../services/testimonialsApi";

/**
 * Review moderation — GET /api/testimonials/testimonials/ (admin sees
 * every status). Approve pending reviews to publish them, reject or
 * delete unwanted ones.
 *
 * Every review now belongs to an account, so a review submitted before
 * accounts existed has `user: null` and its name came from a free-text
 * field. Those are marked "legacy, name unverified" rather than being
 * presented as if the name were checked - the moderator is judging
 * whether to publish, and that distinction is the whole point of the
 * gate.
 *
 * Rejecting now asks first, like deleting does. It used to be a single
 * tap on a card full of buttons, which is how a review disappears from
 * the queue without anyone having decided to remove it.
 */

/** Human labels. The raw status keys are for the API, not for a person. */
const FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

export default function AdminTestimonials() {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Scope "staff": moderators see pending and rejected too, the public
  // only ever sees approved. Sharing one key would publish a pending
  // review to the storefront before a human approved it.
  const {
    data,
    loading,
    error,
    isFetching: refreshing,
    refetch: load,
  } = useQuery("/testimonials/testimonials/", listAllTestimonials, {
    scope: "staff",
    staleMs: 30 * 1000,
    select: toArray,
  });

  const items = data || EMPTY_LIST;

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

  const run = async (item, action, { confirmFn } = {}) => {
    if (confirmFn && !confirmFn()) {
      return;
    }

    setBusyId(item.id);
    setActionError(null);

    try {
      await action(item.id);
      invalidateQuery("testimonials");
    } catch (apiError) {
      setActionError(apiError);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = (item) => run(item, deleteTestimonial);

  const activeLabel = FILTERS.find((option) => option.key === filter)?.label;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Staff · Management"
        title="Reviews"
        description="Approve reviews to publish them on the site."
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
        placeholder="Search reviews by name or text"
      />

      {actionError && (
        <Alert
          tone="error"
          title="Action failed"
          details={actionError.fieldErrors}
        >
          {actionError.message}
        </Alert>
      )}

      {loading && <AdminLoading label="Loading reviews..." />}

      {!loading && error && (
        <Alert
          tone="error"
          title="Could not load reviews"
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
              ? `No reviews match "${query}".`
              : filter === "all"
                ? "No reviews yet."
                : `No ${activeLabel?.toLowerCase()} reviews right now.`
          }
          onRetry={load}
        />
      )}

      {!loading && !error && shown.length > 0 && (
        <>
          <p className="text-xs text-console-muted">
            Showing {shown.length} of {items.length}
          </p>

          <ul className="grid gap-3">
            {shown.map((item) => {
              const busy = busyId === item.id;
              const legacy = !item.user;

              return (
                <li key={item.id}>
                  <AdminPanel>
                    <div className="flex items-start gap-3 sm:gap-4">
                      {item.photo ? (
                        <img
                          src={mediaUrl(item.photo)}
                          alt=""
                          loading="lazy"
                          className="h-20 w-24 shrink-0 rounded-xl object-cover sm:h-24 sm:w-32"
                        />
                      ) : (
                        <span className="flex h-20 w-24 shrink-0 items-center justify-center rounded-xl bg-console-sunken font-serif text-2xl text-console-accent sm:h-24 sm:w-32">
                          {item.customer_name?.charAt(0)?.toUpperCase() || "?"}
                        </span>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                          <p className="break-words font-semibold text-console-ink">
                            {item.customer_name}
                          </p>

                          <AdminStatus status={item.status} />
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                          <div
                            className="flex gap-0.5 text-console-accent"
                            aria-label={`${item.rating} out of 5`}
                          >
                            {Array.from({ length: item.rating }).map(
                              (unused, index) => (
                                <Star
                                  key={index}
                                  size={12}
                                  fill="currentColor"
                                />
                              )
                            )}
                          </div>

                          {legacy && (
                            <AdminChip>Legacy · name unverified</AdminChip>
                          )}
                        </div>
                      </div>
                    </div>

                    <p className="mt-4 break-words text-sm leading-7 text-console-body">
                      “{item.message}”
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2 border-t border-console-line pt-4">
                      {item.status === "pending" && (
                        <>
                          <AdminButton
                            tone="primary"
                            icon={Check}
                            loading={busy}
                            onClick={() => run(item, approveTestimonial)}
                          >
                            Approve
                          </AdminButton>

                          <AdminConfirmButton
                            icon={X}
                            loading={busy}
                            message={`Reject the review by ${item.customer_name}? It will not appear on the site, and there is no reason field on a review, so say why when you tell them.`}
                            onConfirm={() => run(item, rejectTestimonial)}
                          >
                            Reject
                          </AdminConfirmButton>
                        </>
                      )}

                      <AdminConfirmButton
                        icon={Trash2}
                        loading={busy}
                        message={`Delete the review by ${item.customer_name}? This cannot be undone.`}
                        onConfirm={() => handleDelete(item)}
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
