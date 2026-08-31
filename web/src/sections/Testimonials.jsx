import { useEffect, useRef, useState } from "react";
import { Camera, Star, X } from "lucide-react";

import Alert from "../components/ui/Alert";
import FieldError from "../components/ui/FieldError";
import Spinner from "../components/ui/Spinner";
import { useTestimonials } from "../hooks/useTestimonials";
import { submitTestimonial } from "../services/testimonialsApi";
import { mediaUrl } from "../services/api";
import Reveal from "../components/Reveal";
import ParallaxSection from "../components/ParallaxSection";

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
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const photoInput = useRef(null);
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
        photo,
      });
      setSubmitted(true);
      setName("");
      setMessage("");
      setRating(5);
      clearPhoto();
    } catch (apiError) {
      setFormError(apiError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ParallaxSection
      image="/media/testimonials/photo_2024-11-06_13-33-59.jpg"
      overlay="from-black/95 via-black/75 to-black/95"
      contentClassName="py-20 sm:py-24"
    >
      <div className="grid gap-14 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <Reveal className="max-w-xl">
            <p className="text-[10px] uppercase tracking-[.35em] text-[#d6a85f]">
              Client notes
            </p>
            <h2 className="mt-4 font-serif text-5xl leading-none sm:text-6xl">
              Good looks,
              <br />
              <span className="italic text-[#d6a85f]">better stories.</span>
            </h2>
          </Reveal>

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
              {testimonials.map((item, index) => (
                <Reveal
                  key={item.id}
                  delay={index * 90}
                  className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[.025]"
                >
                  <div className="flex-1 p-6 sm:p-7">
                    <div className="flex gap-1 text-[#d6a85f]">
                      {Array.from({ length: item.rating }).map((_, i) => (
                        <Star key={i} size={13} fill="currentColor" />
                      ))}
                    </div>
                    <p className="mt-4 text-sm leading-7 text-white/75">
                      “{item.message}”
                    </p>
                  </div>

                  <div className="flex items-center gap-3 border-t border-white/10 px-6 py-4">
                    {item.photo ? (
                      <img
                        src={mediaUrl(item.photo)}
                        alt={item.customer_name}
                        className="h-11 w-11 rounded-full border border-white/10 object-cover"
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#d6a85f]/15 font-serif text-lg text-[#d6a85f]">
                        {item.customer_name?.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div>
                      <p className="font-semibold">{item.customer_name}</p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-[.2em] text-white/35">
                        {item.customer_phone ? "Customer visit" : "Verified visit"}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          )}
        </div>

        {/* ---------- leave a review ---------- */}
        <Reveal className="lg:pt-16" delay={120}>
          <div className="rounded-[2rem] border border-white/10 bg-black/55 p-6 backdrop-blur-md sm:p-8">
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

                {/* optional photo */}
                <div className="mt-4">
                  {photoPreview ? (
                    <div className="relative overflow-hidden rounded-xl border border-white/10">
                      <img
                        src={photoPreview}
                        alt="Your cut preview"
                        className="h-36 w-full object-cover"
                      />

                      <button
                        type="button"
                        onClick={clearPhoto}
                        disabled={submitting}
                        aria-label="Remove photo"
                        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white transition hover:bg-black"
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
                      Add a photo of your cut (optional)
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
                <FieldError message={formError?.fieldErrors?.photo} />

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
        </Reveal>
      </div>
    </ParallaxSection>
  );
}
