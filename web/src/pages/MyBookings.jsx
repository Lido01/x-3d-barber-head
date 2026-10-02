import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  CircleDollarSign,
  Clock3,
  History,
  RefreshCw,
  Search,
  Ticket,
} from "lucide-react";
import { Link } from "react-router-dom";

import Alert from "../components/ui/Alert";
import FieldError from "../components/ui/FieldError";
import Spinner from "../components/ui/Spinner";
import BookingHistoryCard, {
  useExpandedBooking,
} from "../components/booking/BookingHistoryCard";
import { useBookingLookup } from "../hooks/useBookingLookup";
import {
  isCompleteBookingCode,
  normaliseBookingCode,
} from "../utils/bookingCode";
import { prefersReducedMotion } from "../utils/scroll";
import { rememberedBookings } from "../utils/bookingSession";
import { formatDate, formatTime } from "../utils/format";

/**
 * "My bookings" — the whole history, without an account.
 *
 * Booking here needs no login, so there is nothing to sign into and no
 * history sitting behind one. What the customer is given instead is a
 * code, and this is where that code is spent. The code plus the phone
 * number the booking was made with is the proof of ownership.
 *
 * One code returns *every* booking made with that number, not just the
 * one it belongs to. Someone who wants to check what they have booked
 * over the last year should not have to dig out a separate code for each
 * appointment they ever made - they have one of the codes, and the phone
 * number is on all of them.
 *
 * Every row carries its own booking code, its own status and its own
 * payment, receipt screenshot included, because the three questions a
 * customer has about a past booking are always the same three: what was
 * it, did it happen, and did I pay for it. Rows that still need something
 * open themselves, so the two that need attention are never buried under
 * thirty that do not.
 *
 * Two ways in, because two situations arrive here:
 *
 *   - "I made a booking here minutes ago and lost the tab." The codes
 *     booked in this browser are listed, and picking one fills the form
 *     in, phone number included.
 *   - "I am on my phone and the booking was made weeks ago." The form is
 *     all there is. Nothing is assumed about this device.
 */

const LABEL = "text-[10px] uppercase tracking-[0.25em] text-white/35";

/*
 * `text-base` below `sm` on purpose: iOS Safari zooms the viewport on
 * focus for any control under 16px, and a form that jumps to 150% while
 * someone types a phone number into it is unusable one-handed.
 */
const INPUT =
  "w-full min-w-0 border border-white/10 bg-[#181818] px-4 py-4 text-base text-white outline-none transition placeholder:text-white/25 focus:border-[#d6a85f]/50 sm:text-sm";

function validate({ code, phone }) {
  const errors = {};
  const digits = phone.replace(/\D/g, "");

  if (!code.trim()) {
    errors.code = "Please enter your booking code, e.g. BK-3274.";
  } else if (!isCompleteBookingCode(code)) {
    errors.code = "That code looks incomplete. It looks like BK-3274.";
  }

  if (!phone.trim()) {
    errors.phone =
      "Please enter the phone number you booked with, so we can match it to your booking.";
  } else if (digits.length < 9) {
    errors.phone = "That phone number looks incomplete.";
  }

  return errors;
}

export default function MyBookings() {
  const {
    bookings,
    totals,
    matchedCode,
    loading,
    error,
    find,
    refresh,
    isFinal,
  } = useBookingLookup();

  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [localErrors, setLocalErrors] = useState({});
  const { toggle, isExpanded } = useExpandedBooking();

  // The codes from this browser, read once per visit. They are a
  // convenience list of what to type, not a status to display: the status
  // on screen always comes from the lookup below. Read once on purpose -
  // this is session storage, and re-reading it on every render would
  // churn identity on the list for no benefit.
  const [known] = useState(() => rememberedBookings());

  // Where the history list is, so the outstanding-payment banner can put
  // the customer in front of it in one tap instead of leaving them to
  // scroll a list of thirty bookings to find the two that need them.
  const listRef = useRef(null);

  useEffect(() => {
    if (!matchedCode) {
      return;
    }

    setCode(normaliseBookingCode(matchedCode));
  }, [matchedCode]);

  const handleSubmit = (event) => {
    event.preventDefault();

    const errors = validate({ code, phone });

    setLocalErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    void find({ code: normaliseBookingCode(code), phone: phone.trim() });
  };

  const openRemembered = (entry) => {
    setCode(normaliseBookingCode(entry.code));
    setPhone(entry.phone);
    setLocalErrors({});

    if (entry.code && entry.phone) {
      void find({ code: entry.code, phone: entry.phone });
    }
  };

  const summary = [
    {
      key: "all",
      label: "Booked in total",
      value: totals?.all ?? bookings.length,
      icon: History,
      tone: "plain",
    },
    {
      key: "upcoming",
      label: "Still to come",
      value: totals?.upcoming ?? 0,
      icon: CalendarClock,
      tone: "plain",
    },
    {
      key: "awaiting_payment",
      label: "To pay",
      value: totals?.awaiting_payment ?? 0,
      icon: CircleDollarSign,
      tone: "warn",
    },
    {
      key: "awaiting_response",
      label: "With the shop",
      value: totals?.awaiting_response ?? 0,
      icon: Clock3,
      tone: "plain",
    },
  ];

  const hasHistory = bookings.length > 0;
  const dueCount = totals?.awaiting_payment ?? 0;

  const jumpToOutstanding = () =>
    listRef.current?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });

  return (
    <div className="min-h-screen bg-[#090909] px-5 pb-24 pt-32 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1000px]">
        <div className="max-w-2xl">
          <p className="text-[10px] uppercase tracking-[0.35em] text-[#d6a85f]">
            My bookings
          </p>

          <h1 className="mt-5 font-serif text-5xl leading-[0.9] sm:text-6xl">
            Every booking
            <br />
            <span className="italic text-[#d6a85f]">you have made.</span>
          </h1>

          <p className="mt-6 text-sm leading-7 text-white/45">
            You do not need an account. Enter any one booking code together
            with the phone number you booked with, and this page will show
            every appointment you have made at the shop - what it was for,
            whether it happened, and the payment you sent for it.
          </p>
        </div>

        {/* --- the code ------------------------------------------ */}
        <div className="mt-10 border border-white/10 bg-[#111] p-6 sm:p-8">
          <form onSubmit={handleSubmit} noValidate className="grid gap-5">
            <div>
              <label className={LABEL} htmlFor="lookup-code">
                <Ticket size={12} className="mr-1.5 inline align-[-1px]" />
                Any one booking code
              </label>

              <input
                id="lookup-code"
                value={code}
                onChange={(event) =>
                  setCode(normaliseBookingCode(event.target.value))
                }
                placeholder="BK-3274"
                autoComplete="off"
                inputMode="numeric"
                aria-invalid={Boolean(localErrors.code)}
                className={`${INPUT} mt-3 font-serif text-lg tracking-[0.15em]`}
              />

              <FieldError message={localErrors.code} />
            </div>

            <div>
              <label className={LABEL} htmlFor="lookup-phone">
                Phone number you booked with
              </label>

              <input
                id="lookup-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="0911 234 567"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                aria-invalid={Boolean(localErrors.phone)}
                className={`${INPUT} mt-3`}
              />

              <FieldError message={localErrors.phone} />
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#d6a85f] px-6 py-3.5 text-sm font-semibold text-black transition hover:bg-[#e5bd7a] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/25 border-t-black" />
                    Looking it up...
                  </>
                ) : (
                  <>
                    <Search size={15} />
                    Show my bookings
                    <span className="transition-transform group-hover:translate-x-0.5">
                      →
                    </span>
                  </>
                )}
              </button>

              <p className="mt-3 text-[11px] leading-5 text-white/30">
                One code is enough. We use it to check the phone number is
                yours, and the phone number to find everything else you have
                booked.
              </p>
            </div>
          </form>

          {/* --- booked on this device --------------------------- */}
          {known.length > 0 && !hasHistory && (
            <div className="mt-7 border-t border-white/10 pt-6">
              <div className="flex items-center gap-2">
                <History size={13} className="text-[#d6a85f]" />

                <p className={LABEL}>Booked in this browser</p>
              </div>

              <ul className="mt-4 space-y-2">
                {known.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => openRemembered(entry)}
                      className="group flex w-full items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3 text-left transition hover:border-[#d6a85f]/40 hover:bg-white/[0.04]"
                    >
                      <span className="min-w-0">
                        <code className="block font-serif text-sm tracking-[0.1em] text-white">
                          {entry.code || `#${entry.id}`}
                        </code>

                        <span className="mt-0.5 block truncate text-[11px] text-white/40">
                          {entry.booking?.service_name || "Service"} ·{" "}
                          {formatDate(entry.booking?.booking_date)} at{" "}
                          {formatTime(entry.booking?.start_time)}
                        </span>
                      </span>

                      <ArrowRight
                        size={14}
                        className="shrink-0 text-white/25 transition-transform group-hover:translate-x-0.5 group-hover:text-[#d6a85f]"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* --- what came back ------------------------------------ */}
        {error && (
          <Alert
            tone="error"
            title="We could not find that booking"
            details={error.fieldErrors}
            className="mt-8"
          >
            {error.message}
          </Alert>
        )}

        {loading && !hasHistory && (
          <div className="mt-8 flex justify-center rounded-2xl border border-white/10 bg-[#111] py-12">
            <Spinner label="Checking with the shop..." />
          </div>
        )}

        {hasHistory && (
          <div className="mt-10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">
                  Booked under
                </p>

                <code className="mt-1 block font-serif text-2xl tracking-[0.1em] text-white">
                  {matchedCode}
                </code>
              </div>

              <button
                type="button"
                onClick={() => void refresh()}
                disabled={loading}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/60 transition hover:border-[#d6a85f]/50 hover:text-white disabled:opacity-50"
              >
                <RefreshCw
                  size={11}
                  className={loading ? "animate-spin" : undefined}
                />
                Check for updates
              </button>
            </div>

            {/* The four questions this page answers, answered first so the
                list below is read with them in mind rather than scanned
                for them. */}
            <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {summary.map((item) => {
                const Icon = item.icon;
                const flagged = item.tone === "warn" && item.value > 0;

                return (
                  <div
                    key={item.key}
                    className={`rounded-xl border p-4 ${
                      flagged
                        ? "border-[#d6a85f]/30 bg-[#d6a85f]/[0.06]"
                        : "border-white/10 bg-white/[0.02]"
                    }`}
                  >
                    <Icon
                      size={14}
                      className={flagged ? "text-[#d6a85f]" : "text-white/30"}
                    />

                    <dd className="mt-3 font-serif text-3xl leading-none text-white">
                      {item.value}
                    </dd>

                    <dt className="mt-1.5 text-[10px] uppercase tracking-[0.15em] text-white/40">
                      {item.label}
                    </dt>
                  </div>
                );
              })}
            </dl>

            {/* Outstanding money, said once at the top and put within one
                tap of the booking it belongs to. Someone opening this page
                on a phone is most often here to settle a bill, and a
                "to pay" figure with the booking forty rows down is a fact
                they have to go and find rather than a thing they can do. */}
            {dueCount > 0 && (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#d6a85f]/30 bg-[#d6a85f]/[0.06] px-5 py-4">
                <div className="flex min-w-0 gap-3">
                  <CircleDollarSign
                    size={18}
                    className="mt-0.5 shrink-0 text-[#d6a85f]"
                  />

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">
                      {dueCount === 1
                        ? "1 booking is waiting to be paid"
                        : `${dueCount} bookings are waiting to be paid`}
                    </p>

                    <p className="mt-0.5 text-[11px] leading-5 text-white/45">
                      Each one opens its own payment form — a screenshot of
                      your transfer or the TIN number is enough.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={jumpToOutstanding}
                  className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full bg-[#d6a85f] px-5 py-2.5 text-xs font-semibold text-black transition hover:bg-[#e5bd7a]"
                >
                  Pay now
                  <ArrowRight size={13} />
                </button>
              </div>
            )}

            <ul ref={listRef} className="mt-6 grid scroll-mt-28 gap-3">
              {bookings.map((row) => (
                <BookingHistoryCard
                  key={row.booking.id}
                  booking={row.booking}
                  payment={row.payment}
                  paymentDue={row.payment_due}
                  paymentRejected={row.payment_rejected}
                  expanded={isExpanded(row.booking.id)}
                  onToggle={() => toggle(row.booking.id)}
                  // A payment sent from inside the card has to be reflected
                  // in the row behind it: the tile above still reads "to
                  // pay" and the card would keep offering the form until
                  // the next poll. The lookup is deliberately not on the
                  // GET cache, so it is asked again here.
                  onPaid={() => void refresh()}
                />
              ))}
            </ul>

            {!isFinal && (
              <p className="mt-5 flex items-center gap-2 text-[11px] text-white/30">
                <Clock3 size={12} />
                This page checks the shop&apos;s answer for you. You do not
                need to come back or refresh it.
              </p>
            )}
          </div>
        )}

        {/* --- nothing found yet -------------------------------- */}
        {!hasHistory && !loading && !error && (
          <div className="mt-10 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
            <p className="text-sm font-semibold text-white/70">
              Nothing to show yet
            </p>

            <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-white/40">
              Every booking gets a code the moment it is made, shown on the
              confirmation page and sent with your payment. If you have not
              booked, there is nothing to look up yet.
            </p>

            <Link
              to="/booking"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#d6a85f] px-5 py-3 text-xs font-semibold text-black transition hover:bg-[#e5bd7a]"
            >
              Book a chair
              <span>→</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}