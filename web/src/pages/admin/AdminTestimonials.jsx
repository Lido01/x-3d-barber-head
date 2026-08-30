import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, RefreshCw, Star, Trash2, X } from "lucide-react";

import Alert from "../../components/ui/Alert";
import Spinner from "../../components/ui/Spinner";
import StatusBadge from "../../components/StatusBadge";
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
 */

const FILTERS = ["all", "pending", "approved", "rejected"];

export default function AdminTestimonials() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("pending");
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    return listAllTestimonials()
      .then((data) => {
        setItems(Array.isArray(data) ? data : data?.results || []);
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
      return items;
    }

    return items.filter((item) => item.status === filter);
  }, [items, filter]);

  const countFor = (status) =>
    status === "all"
      ? items.length
      : items.filter((item) => item.status === status).length;

  const replaceRow = (updated) => {
    setItems((rows) =>
      rows.map((row) => (row.id === updated.id ? updated : row))
    );
  };

  const handleApprove = async (item) => {
    setBusyId(item.id);
    setActionError(null);

    try {
      replaceRow(await approveTestimonial(item.id));
    } catch (apiError) {
      setActionError(apiError);
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (item) => {
    setBusyId(item.id);
    setActionError(null);

    try {
      replaceRow(await rejectTestimonial(item.id));
    } catch (apiError) {
      setActionError(apiError);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete review by ${item.customer_name}?`)) {
      return;
    }

    setBusyId(item.id);
    setActionError(null);

    try {
      await deleteTestimonial(item.id);
      setItems((rows) => rows.filter((row) => row.id !== item.id));
    } catch (apiError) {
      setActionError(apiError);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-[#d6a85f]">
            Staff · Management
          </p>
          <h1 className="mt-4 font-serif text-4xl leading-none sm:text-5xl">
            Testimonials
          </h1>
          <p className="mt-3 text-xs text-white/35">
            Approve reviews to publish them on the site.
          </p>
        </div>

        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-xs font-semibold text-white/70 transition hover:border-[#d6a85f]/50 hover:text-white"
        >
          <RefreshCw size={13} /> Refresh
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
          <Spinner label="Loading testimonials..." />
        </div>
      )}

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
        <Alert tone="info" title="Nothing here" onRetry={load} className="mt-8">
          {filter === "all"
            ? "No reviews yet."
            : `No ${filter} reviews right now.`}
        </Alert>
      )}

      {!loading && !error && shown.length > 0 && (
        <div className="mt-8 grid gap-4">
          {shown.map((item) => {
            const busy = busyId === item.id;

            return (
              <article
                key={item.id}
                className="rounded-2xl border border-white/10 bg-[#111] p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-4">
                    {item.photo ? (
                      <img
                        src={mediaUrl(item.photo)}
                        alt={item.customer_name}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[#181818] font-serif text-lg text-[#d6a85f]">
                        {item.customer_name?.charAt(0)?.toUpperCase() || "?"}
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="font-semibold text-white">
                          {item.customer_name}
                        </p>
                        <StatusBadge status={item.status} kind="testimonial" />
                      </div>
                      <div className="mt-1 flex gap-0.5 text-[#d6a85f]">
                        {Array.from({ length: item.rating }).map((_, i) => (
                          <Star key={i} size={11} fill="currentColor" />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-7 text-white/70">
                  “{item.message}”
                </p>

                <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                  {item.status === "pending" && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleApprove(item)}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#d6a85f] px-4 py-2 text-[11px] font-semibold text-black transition hover:bg-[#e5bd7a] disabled:opacity-60"
                      >
                        <Check size={13} /> {busy ? "..." : "Approve"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(item)}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-[11px] font-semibold text-white/60 transition hover:text-white disabled:opacity-60"
                      >
                        <X size={13} /> Reject
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#e05a4f]/40 px-4 py-2 text-[11px] font-semibold text-[#e0776b] transition hover:bg-[#e05a4f]/10 disabled:opacity-60"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
