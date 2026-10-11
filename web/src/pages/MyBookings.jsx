import { useEffect, useState } from "react";
import { Clock3, Search, Ticket } from "lucide-react";
import { Link } from "react-router-dom";

import Alert from "../components/ui/Alert";
import FieldError from "../components/ui/FieldError";
import BookingLookupPanel from "../components/booking/BookingLookupPanel";
import BookingSheet from "../components/booking/BookingSheet";
import { useBookingLookup } from "../hooks/useBookingLookup";
import {
  isCompleteBookingCode,
  normaliseBookingCode,
} from "../utils/bookingCode";

/**
 * Open one booking, with its booking ID and phone number.
 *
 * ## The whole page is two fields
 *
 * That is the design, not a simplification of one. A booking is identified
 * by its own booking ID, and that ID is given to the customer the moment they
 * book - printed at the top of the confirmation with a button to copy it, and
 * read out to them by staff on the phone. Here they put that ID and the phone
 * number they booked with, and they get that appointment.
 *
 * Nothing else is asked for and nothing else is offered:
 *
 *   - **no list.** Returning "everything on this phone number" made the ID
 *     identify the customer rather than the booking, so someone checking
 *     whether one appointment was paid opened a list of however many they
 *     had and read whichever row they recognised. If they walked away
 *     satisfied after reading the wrong one, the ID had identified nothing.
 *   - **no saved bookings.** A list of what this browser has seen is a
 *     history, and a history on a page whose whole promise is "this is your
 *     one booking" is the same confusion in a different shape. It also does
 *     not work: the booking that matters is usually made on another device.
 *
 * Someone who has booked three times has three booking IDs. Any of them opens
 * its own appointment. That is what makes them worth keeping.
 *
 * ## Why the answer is a sheet
 *
 * The page is one job: take a booking ID and a phone number. Once both are
 * given and accepted that job is finished, and what comes back is not a new
 * destination - it is the answer to the question just asked. So it opens over
 * the form rather than replacing it, which keeps the ID they typed visible
 * behind it and leaves nothing to navigate back to.
 *
 * On a phone the sheet is pinned to the bottom with room for the home
 * indicator; from `sm` up it becomes a centred dialog. See
 * components/booking/BookingSheet.
 */

const LABEL = "text-[10px] uppercase tracking-[0.25em] text-white/35";

/*
 * `text-base` below `sm` on purpose: iOS Safari zooms the viewport on focus
 * for any control under 16px, and a form that jumps to 150% while someone
 * types a phone number into it is unusable one-handed.
 */
const INPUT =
  "w-full min-w-0 border border-white/10 bg-[#181818] px-4 py-4 text-base text-white outline-none transition placeholder:text-white/25 focus:border-[#d6a85f]/50 sm:text-sm";

function validate({ code, phone }) {
  const errors = {};
  const digits = phone.replace(/\D/g, "");

  if (!code.trim()) {
    errors.code = "Please enter your booking ID, e.g. BK-3274.";
  } else if (!isCompleteBookingCode(code)) {
    errors.code = "That booking ID looks incomplete. It looks like BK-3274.";
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
    booking,
    payment,
    paymentDue,
    paymentOpen,
    paymentRejected,
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

  /**
   * The sheet opens as soon as there is something to put in it.
   *
   * Keyed on the matched booking ID rather than on a boolean, so closing it
   * and then opening a different booking reopens it, while a refresh from
   * inside the sheet - or the polling that runs while reception confirms -
   * does not slam it shut in the customer's face.
   */
  const [dismissedCode, setDismissedCode] = useState(null);

  const sheetOpen = Boolean(booking) && matchedCode !== dismissedCode;

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

    setDismissedCode(null);

    void find({ code: normaliseBookingCode(code), phone: phone.trim() });
  };

  return (
    <div className="min-h-screen bg-[#090909] px-5 pb-24 pt-32 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[900px]">
        <div className="max-w-2xl">
          <h1 className="mt-5 font-serif text-5xl leading-[0.9] sm:text-6xl">
            Open your
            <br />
            <span className="italic text-[#d6a85f]">booking.</span>
          </h1>
        </div>

        {/* --- the two fields ------------------------------------ */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="mt-10 border border-white/10 bg-[#111] p-6 sm:p-8"
        >
          <div className="grid gap-5">
            <div>
              <label className={LABEL} htmlFor="lookup-code">
                <Ticket size={12} className="mr-1.5 inline align-[-1px]" />
                Your booking ID
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
                className="group inline-flex min-h-[52px] w-full items-center justify-center gap-2  bg-[#d6a85f] px-6 py-3.5 text-sm font-semibold text-black transition hover:bg-[#e5bd7a] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin  border-2 border-black/25 border-t-black" />
                    Opening your booking...
                  </>
                ) : (
                  <>
                    <Search size={15} />
                    Open my booking
                    <span className="transition-transform group-hover:translate-x-0.5">
                      →
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* --- what came back ------------------------------------ */}
        {error && (
          <Alert
            tone="error"
            title="We could not open that booking"
            details={error.fieldErrors}
            className="mt-8"
          >
            {error.message}
          </Alert>
        )}

        {loading && !booking && (
          <div className="mt-8 flex justify-center border border-white/10 bg-[#111] py-12">
            <p className="text-sm text-white/40">Checking with the shop...</p>
          </div>
        )}

        {/* --- the answer ---------------------------------------- */}
        <BookingSheet
          open={sheetOpen}
          onClose={() => setDismissedCode(matchedCode)}
          eyebrow="Your booking"
          title={matchedCode}
          description="The appointment this booking ID names."
        >
          <BookingLookupPanel
            booking={booking}
            payment={payment}
            paymentDue={paymentDue}
            paymentOpen={paymentOpen}
            paymentRejected={paymentRejected}
            loading={loading}
            onRefresh={refresh}
            onPaid={refresh}
          />

          <p className="mt-4 flex items-center gap-2 text-[11px] text-white/30">
            <Clock3 size={12} />
            {isFinal
              ? "Nothing here is still waiting on the shop."
              : "This checks the shop's answer for you. You do not need to come back or refresh it."}
          </p>
        </BookingSheet>
      </div>
    </div>
  );
}