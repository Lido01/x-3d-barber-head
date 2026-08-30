import { useState } from "react";
import { Star } from "lucide-react";

import Alert from "../components/ui/Alert";
import FieldError from "../components/ui/FieldError";
import Spinner from "../components/ui/Spinner";
import { useTestimonials } from "../hooks/useTestimonials";
import { submitTestimonial } from "../services/testimonialsApi";

const INPUT =
  "w-full rounded-xl border border-white/10 bg-[#181818] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#d6a85f]/50";

/**
 * Customer testimonials — fed by GET /api/testimonials/testimonials/
 * (approved only). Customers can also leave a review which is held
 * pending until an admin approves it.
 */
export default function Testimonials() {
  const { testimonials, loading, error, reload } = useTestimonials();

  // submission form state
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setFormError(null);

    if (!name.trim()) {
      setFormError({ message: "Please tell us your name.", fieldErrors: {} });
      return;
    }

    if (!message.trim()) {
      setFormError({ message: "Please share your experience.", fieldErrors: {} });
      return;
    }

    setSubmitting(true);

    try {
      await submitTestimonial({
        customerName: name.trim(),
        message: message.trim(),
        rating,
      });
      setSubmitted(true);
      setName("");
      setMessage("");
      setRating(5);
    } catch (apiError) {
      setFormError(apiError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="border-y border-white/10 bg-[#0d0d0d] px-5 py-20 sm:px-8 sm:py-28 lg:px-10">
      <div className="mx-auto grid max-w-[1440px] gap-14 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="max-w-xl">
            <p className="text-[10px] uppercase tracking-[.35em] text-[#d6a85f]">
              Client notes
            </p>
            <h2 className="mt-4 font-serif text-5xl leading-none sm:text-6xl">
              Good looks,
              <br />
              <span className="italic text-[#d6a85f]">better stories.</span>
            </h2>
          </div>

          {loading && (
            <div className="mt-12 flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] py-16">
              <Spinner label="Loading reviews..." />
            </div>
          )}

          {!loading && error && (
            <Alert
              tone="error"
              title="Could not load reviews"
              details={error.fieldErrors}
              onRetry={reload}
              className="mt-12"
            >
              {error.message}
            </Alert>
          )}

          {!loading && !error && testimonials.length === 0 && (
            <Alert tone="info" title="No reviews yet" className="mt-12">
              Be the first to leave a note about your visit.
            </Alert>
          )}

          {!loading && !error && testimonials.length > 0 && (
            <div className="mt-12 grid gap-4 lg:grid-cols-2">
              {testimonials.map((item) => (
                <article
                  key={item.id}
                  className="border border-white/10 bg-white/[.025] p-6 sm:p-7"
                >
                  <div className="flex gap-1 text-[#d6a85f]">
                    {Array.from({ length: item.rating }).map((_, i) => (
                      <Star key={i} size={13} fill="currentColor" />
                    ))}
                  </div>
                  <p className="mt-4 text-sm leading-7 text-white/75">
                    “{item.message}”
                  </p>
                  <div className="mt-6 border-t border-white/10 pt-4">
                    <p className="font-semibold">{item.customer_name}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[.2em] text-white/35">
                      {item.customer_phone ? "Customer visit" : "Verified visit"}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {/* ---------- leave a review ---------- */}
        <div className="lg:pt-16">
          <div className="rounded-[2rem] border border-white/10 bg-[#111] p-6 sm:p-8">
            {submitted ? (
              <div className="py-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#5fb98a]/15 text-2xl text-[#7fcfa4]">
                  ✓
                </div>
                <h3 className="mt-5 font-serif text-2xl">Thank you!</h3>
                <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-white/50">
                  Your review is with the shop and will appear here once it's
                  approved.
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="mt-6 text-xs uppercase tracking-[.2em] text-[#d6a85f] transition hover:text-[#e5bd7a]"
                >
                  Write another
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <p className="text-[10px] uppercase tracking-[.3em] text-[#d6a85f]">
                  Leave a note
                </p>
                <h3 className="mt-3 font-serif text-3xl">Rate your visit.</h3>

                <div className="mt-6 flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRating(value)}
                      onMouseEnter={() => setHover(value)}
                      onMouseLeave={() => setHover(0)}
                      aria-label={`${value} star${value > 1 ? "s" : ""}`}
                      className="transition"
                    >
                      <Star
                        size={22}
                        className={
                          (hover || rating) >= value
                            ? "text-[#d6a85f]"
                            : "text-white/15"
                        }
                        fill={(hover || rating) >= value ? "currentColor" : "none"}
                      />
                    </button>
                  ))}
                </div>

                <div className="mt-6 grid gap-4">
                  <div>
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Your name"
                      maxLength={120}
                      disabled={submitting}
                      className={INPUT}
                    />
                  </div>

                  <div>
                    <textarea
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      placeholder="What was your experience like?"
                      rows={3}
                      maxLength={1000}
                      disabled={submitting}
                      className={`${INPUT} resize-none`}
                    />
                  </div>
                </div>

                {formError && (
                  <Alert
                    tone="error"
                    title="We couldn't save your review"
                    details={formError.fieldErrors}
                    className="mt-4"
                  >
                    {formError.message}
                  </Alert>
                )}

                <FieldError message={formError?.fieldErrors?.customer_name} />
                <FieldError message={formError?.fieldErrors?.message} />
                <FieldError message={formError?.fieldErrors?.rating} />

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-6 flex w-full items-center justify-center rounded-full bg-[#d6a85f] px-6 py-3.5 text-sm font-semibold text-black transition hover:bg-[#e5bd7a] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <Spinner size={15} label="Submitting..." />
                  ) : (
                    "Submit review"
                  )}
                </button>

                <p className="mt-4 text-center text-[10px] leading-5 text-white/25">
                  Reviews are shown only after the shop approves them.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
