import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, LogIn, Star, UserPlus, X } from "lucide-react";

import Alert from "../components/ui/Alert";
import FieldError from "../components/ui/FieldError";
import Spinner from "../components/ui/Spinner";
import {
  customerDisplayName,
  useCustomerAuth,
} from "../context/CustomerAuthContext";
import { useTestimonials } from "../hooks/useTestimonials";
import { submitTestimonial } from "../services/testimonialsApi";
import { mediaUrl } from "../services/api";
import Reveal from "../components/Reveal";
import ParallaxSection from "../components/ParallaxSection";
import { useLanguage } from "../i18n/LanguageContext";
import { getTranslatedQuote } from "../i18n/translatedTestimonials";

const INPUT =
  "w-full  border border-white/10 bg-[#181818] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#d6a85f]/50";

/**
 * Customer testimonials — fed by GET /api/testimonials/testimonials/
 * (approved only).
 *
 * Reading the wall is open to everyone. Writing is not: a review is
 * attributed to a real customer, so POST /api/testimonials/testimonials/
 * needs a customer token and 401s without one. A visitor who taps the
 * form is therefore shown a sign-in / register prompt instead of a name
 * field - the name comes from their account, so there is nothing for
 * them to type and nothing for them to get wrong.
 *
 * Reviews are written by customers, so the language they were typed in is
 * not something we control. Seeded reviews have a translation on file, so on
 * Amharic/Oromo we lead with the translation and keep the guest's own English
 * underneath it. Anything without a translation on file stays in English
 * rather than being hidden or invented.
 */
export default function Testimonials() {
  const { testimonials, loading, error, reload } = useTestimonials();
  const { t, locale, language } = useLanguage();
  const {
    account,
    isAuthenticated: signedIn,
    isChecking: checkingSession,
    signOut,
  } = useCustomerAuth();

  // submission form state
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const photoInput = useRef(null);
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const displayName = customerDisplayName(account);

  // Revoke the object URL when the component unmounts.
  useEffect(
    () => () => {
      if (photoPreview && photoPreview.startsWith("blob:")) {
        URL.revokeObjectURL(photoPreview);
      }
    },
    [photoPreview]
  );

  const handlePhotoPick = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (photoPreview && photoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(photoPreview);
    }

    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const clearPhoto = () => {
    if (photoPreview && photoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(photoPreview);
    }

    setPhoto(null);
    setPhotoPreview(null);
    if (photoInput.current) {
      photoInput.current.value = "";
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setFormError(null);

    if (!message.trim()) {
      setFormError({ message: t("testimonials.form.messageRequired"), fieldErrors: {} });
      return;
    }

    setSubmitting(true);

    try {
      await submitTestimonial({
        message: message.trim(),
        rating,
        photo,
      });
      setSubmitted(true);
      setMessage("");
      setRating(5);
      clearPhoto();
    } catch (apiError) {
      setFormError(apiError);
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * What the right-hand panel shows.
   *
   * While a stored token is being revalidated we must not flash the
   * sign-in prompt at someone who is actually signed in, and we must not
   * show the form to someone who is not.
   */
  function reviewPanel() {
    if (checkingSession) {
      return (
        <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] py-16">
          <Spinner label={t("testimonials.loading")} />
        </div>
      );
    }

    if (!signedIn) {
      return <SignInPrompt />;
    }

    if (submitted) {
      return (
        <div className="py-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center  bg-[#5fb98a]/15 text-2xl text-[#7fcfa4]">
            ✓
          </div>
          <h3 className="mt-5 font-serif text-2xl">{t("testimonials.form.thanksTitle")}</h3>
          <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-white/50">
            {t("testimonials.form.thanksBody")}
          </p>
          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className="mt-6 text-xs uppercase tracking-[.2em] text-[#d6a85f] transition hover:text-[#e5bd7a]"
          >
            {t("testimonials.form.writeAnother")}
          </button>
        </div>
      );
    }

    return (
      <form onSubmit={handleSubmit} noValidate>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="mt-1 font-serif text-3xl">{t("testimonials.form.rateTitle")}</h3>

          <button
            type="button"
            onClick={signOut}
            className="text-[11px] uppercase tracking-[0.15em] text-white/30 transition hover:text-white/70"
          >
            {t("account.signOut")}
          </button>
        </div>

        <p className="mt-2 text-xs text-white/45">
          {t("testimonials.form.postingAs", { name: displayName })}
        </p>

        <div className="mt-4 flex gap-1.5">
          {[1, 2, 3, 4, 5].map((value) => {
            const filled = value <= (hover || rating);

            return (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                onMouseEnter={() => setHover(value)}
                onMouseLeave={() => setHover(0)}
                aria-label={t(
                  value === 1
                    ? "testimonials.rating.one"
                    : "testimonials.rating.many",
                  { count: value }
                )}
                aria-pressed={value === rating}
                className="p-0.5 transition-transform hover:scale-110"
              >
              </button>
            );
          })}
        </div>

        <div className="mt-6">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={t("testimonials.form.messagePlaceholder")}
            rows={3}
            maxLength={1000}
            disabled={submitting}
            className={`${INPUT} resize-none`}
          />
        </div>

        {/* optional photo */}
        <div className="mt-4">
          {photoPreview ? (
            <div className="relative overflow-hidden rounded-2xl border border-white/10">
              <img
                src={photoPreview}
                alt={t("testimonials.form.previewAlt")}
                className="h-36 w-full object-cover"
              />

              <button
                type="button"
                onClick={clearPhoto}
                disabled={submitting}
                aria-label={t("testimonials.form.removePhoto")}
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center  bg-black/70 text-white transition hover:bg-black"
              >
                <X size={15} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => photoInput.current?.click()}
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-4 text-xs text-white/40 transition hover:border-[#d6a85f]/40 hover:text-white/70"
            >
              <Camera size={16} className="text-[#d6a85f]" />
              {t("testimonials.form.addPhoto")}
            </button>
          )}

          <input
            ref={photoInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePhotoPick}
            className="hidden"
          />
        </div>

        {formError && (
          <Alert
            tone="error"
            title={t("testimonials.form.errorTitle")}
            details={formError.fieldErrors}
            className="mt-4"
          >
            {formError.message}
          </Alert>
        )}

        <FieldError message={formError?.fieldErrors?.customer_name} />
        <FieldError message={formError?.fieldErrors?.message} />
        <FieldError message={formError?.fieldErrors?.rating} />
        <FieldError message={formError?.fieldErrors?.photo} />

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 flex w-full items-center justify-center  bg-[#d6a85f] px-6 py-3.5 text-sm font-semibold text-black transition hover:bg-[#e5bd7a] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <Spinner size={15} label={t("testimonials.form.submitting")} />
          ) : (
            t("testimonials.form.submit")
          )}
        </button>

        <p className="mt-4 text-center text-[10px] leading-5 text-white/25">
          {t("testimonials.form.approvalNote")}
        </p>
      </form>
    );
  }

  return (
    <ParallaxSection
      image="/media/testimonials/demo-adonay.jpg"
      overlay="from-black/95 via-black/75 to-black/95"
      contentClassName="py-12 sm:py-14"
    >
      <div className="grid gap-14 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <Reveal className="max-w-xl">
            <h2 className="mt-4 font-serif text-4xl leading-[1.05] sm:text-6xl">
              {t("testimonials.titleLead")}
              <br />
              <span className="italic text-[#d6a85f]">{t("testimonials.titleAccent")}</span>
            </h2>
          </Reveal>

          {loading && (
            <div className="mt-12 flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] py-16">
              <Spinner label={t("testimonials.loading")} />
            </div>
          )}

          {!loading && error && (
            <Alert
              tone="error"
              title={t("testimonials.errorTitle")}
              details={error.fieldErrors}
              onRetry={reload}
              className="mt-12"
            >
              {error.message}
            </Alert>
          )}

          {!loading && !error && testimonials.length === 0 && (
            <Alert tone="info" title={t("testimonials.emptyTitle")} className="mt-12">
              {t("testimonials.emptyBody")}
            </Alert>
          )}

          {!loading && !error && testimonials.length > 0 && (
            <div className="mt-12 grid gap-5 sm:grid-cols-2">
              {testimonials.map((item, index) => (
                <TestimonialCard
                  key={item.id}
                  item={item}
                  delay={index * 90}
                  t={t}
                  locale={locale}
                  languageName={language.native}
                />
              ))}
            </div>
          )}
        </div>

        {/* ---------- leave a review ---------- */}
        <Reveal className="lg:pt-16" delay={120}>
          <div className="rounded-2xl border border-white/10 bg-black/55 p-6 backdrop-blur-md sm:p-8">
            {reviewPanel()}
          </div>
        </Reveal>
      </div>
    </ParallaxSection>
  );
}

/**
 * Shown in place of the form when nobody is signed in.
 *
 * Both paths carry `from` so signing in or registering drops the
 * customer back on the homepage with the review form ready, rather than
 * stranding them on a page they did not ask for.
 */
function SignInPrompt() {
  const { t } = useLanguage();
  const state = { from: "/#testimonials" };

  return (
    <div className="py-4 text-center sm:py-6">
      <span className="mx-auto flex h-12 w-12 items-center justify-center  border border-white/10 bg-white/[0.04]">
        <LogIn size={19} className="text-[#d6a85f]" />
      </span>

      <h3 className="mt-5 font-serif text-2xl">
        {t("testimonials.form.signInTitle")}
      </h3>

      <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-white/50">
        {t("testimonials.form.signInBody")}
      </p>

      <div className="mt-7 grid gap-2.5">
        <Link
          to="/login"
          state={state}
          className="flex w-full items-center justify-center gap-2.5  bg-[#d6a85f] px-6 py-3.5 text-sm font-semibold text-black transition hover:bg-[#e5bd7a]"
        >
          <LogIn size={15} />
          {t("testimonials.form.signInCta")}
        </Link>

        <Link
          to="/register"
          state={state}
          className="flex w-full items-center justify-center gap-2.5  border border-white/15 px-6 py-3.5 text-sm font-semibold text-white/70 transition hover:border-[#d6a85f]/50 hover:text-white"
        >
          <UserPlus size={15} />
          {t("testimonials.form.registerCta")}
        </Link>
      </div>
    </div>
  );
}

/**
 * One review card.
 *
 * On Amharic/Oromo, if we hold a translation of this review we show it as the
 * headline and keep the guest's original English underneath in a smaller,
 * quieter style, tagged with the language it came from. That way a visitor who
 * reads Ethiopic gets the review in their language and nobody's original words
 * are hidden away.
 */
function TestimonialCard({ item, delay, t, locale, languageName }) {
  const translation = getTranslatedQuote(item.message, locale);
  const showOriginal = Boolean(translation) && item.message;

  return (
    <Reveal
      delay={delay}
      className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[.025]"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[#1a1a1a]">
        {item.photo ? (
          <img
            src={mediaUrl(item.photo)}
            alt={t("testimonials.photoAlt", { name: item.customer_name })}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-[#38332b] via-[#1b1b1b] to-[#0b0b0b]">
            <span className="font-serif text-5xl text-[#d6a85f]/50">
              {(item.customer_name || "N").charAt(0).toUpperCase()}
            </span>
            <span className="mt-3 text-[10px] uppercase tracking-[0.25em] text-white/35">
              {t("testimonials.finishedAt")}
            </span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />
      </div>

      <div className="p-5 sm:p-6">
        <p className="mt-4 text-sm leading-7 text-white/75">
          “{translation || item.message}”
        </p>

        {showOriginal && (
          <p className="mt-3 border-l-2 border-[#d6a85f]/30 pl-3 text-[13px] italic leading-6 text-white/40">
            “{item.message}”
          </p>
        )}

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
          <p className="font-semibold">{item.customer_name}</p>
          <p className="text-[10px] uppercase tracking-[.2em] text-white/35">
            {item.customer_phone
              ? t("testimonials.customerVisit")
              : t("testimonials.noirGuest")}
          </p>
        </div>

        {showOriginal && (
          <p className="mt-3 text-[10px] leading-4 text-white/25">
            {t("testimonials.originalText")} · {languageName}
          </p>
        )}
      </div>
    </Reveal>
  );
}
