import { useCallback, useEffect, useState } from "react";
import { LogOut, RefreshCw, Star } from "lucide-react";

import AuthShell from "../components/account/AuthShell";
import StatusBadge from "../components/StatusBadge";
import Alert from "../components/ui/Alert";
import Spinner from "../components/ui/Spinner";
import {
  customerDisplayName,
  useCustomerAuth,
} from "../context/CustomerAuthContext";
import { useLanguage } from "../i18n/LanguageContext";
import { mediaUrl } from "../services/api";
import { listMyTestimonials } from "../services/testimonialsApi";
import { formatDate } from "../utils/format";

/**
 * Customer account — /account
 *
 * The one thing a customer comes here for is checking on a review they
 * already wrote: /testimonials/testimonials/mine/ returns their rows in
 * every state, so "pending" and "rejected" are visible rather than a
 * silent wait. Rejections carry no reason on the API, so the copy says
 * the shop declined it rather than inventing a cause.
 */
export default function Account() {
  const { t } = useLanguage();
  const { account, signOut } = useCustomerAuth();

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    return listMyTestimonials()
      .then((data) => {
        setReviews(Array.isArray(data) ? data : data?.results || []);
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

  const name = customerDisplayName(account);

  return (
    <AuthShell
      eyebrow={t("account.eyebrow")}
      title={t("account.title")}
      lead={t("account.lead")}
      footer={
        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center justify-center gap-2.5  border border-white/15 px-6 py-4 text-sm font-semibold text-white/70 transition hover:border-[#e05a4f]/40 hover:text-[#e0776b]"
        >
          <LogOut size={15} />
          {t("account.signOut")}
        </button>
      }
    >
      <section className=" border border-white/10 bg-[#111] p-5">
        <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">
          {t("account.signedInAs")}
        </p>

        <p className="mt-2 break-words font-serif text-2xl text-white">
          {name}
        </p>

        {account?.email && (
          <p className="mt-1 break-all text-sm text-white/40">
            {account.email}
          </p>
        )}
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif text-xl text-white">
            {t("account.myReviews")}
          </h2>

          <button
            type="button"
            onClick={load}
            aria-label={t("common.retry")}
            className="flex h-10 w-10 items-center justify-center  border border-white/15 text-white/60 transition hover:border-[#d6a85f]/50 hover:text-white"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {loading && (
          <div className="mt-4 flex items-center justify-center  border border-white/10 bg-[#111] py-14">
            <Spinner label={t("account.loadingReviews")} />
          </div>
        )}

        {!loading && error && (
          <Alert
            tone="error"
            title={t("account.reviewsErrorTitle")}
            details={error.fieldErrors}
            onRetry={load}
            className="mt-4"
          >
            {error.message}
          </Alert>
        )}

        {!loading && !error && reviews.length === 0 && (
          <Alert
            tone="info"
            title={t("account.noReviewsTitle")}
            className="mt-4"
          >
            {t("account.noReviewsBody")}
          </Alert>
        )}

        {!loading && !error && reviews.length > 0 && (
          <ul className="mt-4 grid gap-3">
            {reviews.map((review) => (
              <li
                key={review.id}
                className=" border border-white/10 bg-[#111] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <StatusBadge
                    status={review.status}
                    kind="testimonial"
                  />
                </div>

                <p className="mt-3 text-sm leading-6 text-white/70">
                  “{review.message}”
                </p>

                {review.photo && (
                  <img
                    src={mediaUrl(review.photo)}
                    alt={t("account.reviewPhotoAlt")}
                    loading="lazy"
                    className="mt-3 h-28 w-full  object-cover"
                  />
                )}

                <p className="mt-3 text-[11px] text-white/30">
                  {formatDate(review.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AuthShell>
  );
}
