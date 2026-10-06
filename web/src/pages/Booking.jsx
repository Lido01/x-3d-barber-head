import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  Globe,
  MessageCircleQuestion,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import BarberPicker from "../components/booking/BarberPicker";
import EthiopianCalendar from "../components/booking/EthiopianCalendar";
import EthiopianDayStrip from "../components/booking/EthiopianDayStrip";
import { NeedPicker, StylePicker } from "../components/booking/NeedPicker";
import ServicePicker from "../components/booking/ServicePicker";
import TimeSlots from "../components/booking/TimeSlots";
import Alert from "../components/ui/Alert";
import FieldError from "../components/ui/FieldError";
import Spinner from "../components/ui/Spinner";
import { useAvailability } from "../hooks/useAvailability";
import { invalidateQuery } from "../hooks/useQuery";
import { useBarbers } from "../hooks/useBarbers";
import { useServices } from "../hooks/useServices";
import { createBooking } from "../services/bookingApi";
import { openAiChat, setAiBookingContext } from "../utils/aiChat";
import { rememberBooking } from "../utils/bookingSession";
import { isPassedSlot } from "../utils/bookingWindow";
import {
  formatEthiopianDate,
  formatEthiopianTime,
  formatEthiopianWeekday,
  shiftIsoDate,
} from "../utils/ethiopianDate";
import {
  formatDuration,
  formatPrice,
  todayIsoDate,
} from "../utils/format";

const LABEL = "text-[10px] uppercase tracking-[0.25em] text-white/35";

const INPUT =
  "w-full  border border-white/10 bg-[#181818] px-4 py-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#d6a85f]/50";

/**
 * How far ahead the day strip runs.
 *
 * Fourteen, because that is `AVAILABILITY_LOOKAHEAD_DAYS` in
 * `bookings.services` - the window the availability endpoint searches when
 * it is asked "when can I come in?". Matching it means the strip cannot
 * offer a day beyond the one the server will look at, which would end with
 * a customer choosing a tile and being told, after the fact, that the shop
 * does not take bookings that far ahead.
 */
const BOOKING_HORIZON_DAYS = 14;

/**
 * Everything that has to be true before a booking can be made.
 *
 * Returned as a list rather than a bag of strings so the form can show a
 * checklist - "two things left" - rather than making someone press
 * Reserve, be refused, and read a message about a field they had already
 * filled in three scrolls up.
 *
 * The order is the order the customer fills the form in, so the first
 * thing listed is the first thing they need to do.
 */
function checklist({ serviceId, bookingDate, startTime, name, phone, notes }) {
  const items = [];
  const today = todayIsoDate();

  if (!serviceId) {
    items.push({
      key: "service",
      label: "Choose a service",
      error: "service",
    });
  }

  if (!bookingDate) {
    items.push({
      key: "booking_date",
      label: "Pick a date",
      error: "booking_date",
    });
  } else if (bookingDate < today) {
    items.push({
      key: "booking_date",
      label: "Pick today or a later date - that one has passed",
      error: "booking_date",
    });
  }

  if (!startTime) {
    items.push({
      key: "start_time",
      label: "Pick an available time",
      error: "start_time",
    });
  } else if (isPassedSlot(bookingDate, startTime)) {
    /*
     * A date being today is not enough for a time inside it to still be
     * bookable. The morning is free in the diary at four in the afternoon,
     * so without this the form offers a slot that has gone and then
     * refuses it on submit - which is a worse answer than saying so while
     * the time is still on screen. The server agrees; see
     * utils/bookingWindow.js for why the same rule is applied twice.
     */
    items.push({
      key: "start_time",
      label: "That time has already passed today - pick a later one",
      error: "start_time",
    });
  }

  if (!name.trim()) {
    items.push({
      key: "customer_name",
      label: "Add your name",
      error: "customer_name",
    });
  }

  if (!phone.trim()) {
    items.push({
      key: "customer_phone",
      label: "Add your phone number",
      error: "customer_phone",
    });
  } else if (phone.replace(/\D/g, "").length < 9) {
    items.push({
      key: "customer_phone",
      label: "That phone number looks incomplete",
      error: "customer_phone",
    });
  }

  // A note longer than the column fits is not an error, but it is
  // something the customer should trim before the shop reads it.
  if (notes.length > 500) {
    items.push({
      key: "notes",
      label: `Your note is ${notes.length} characters - please shorten it`,
      error: "notes",
    });
  }

  return items;
}

/** Per-field messages, checked as the customer types away from a field. */
function fieldMessage(field, values) {
  const item = checklist(values).find((entry) => entry.error === field);

  return item?.label || null;
}

export default function Booking() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    services,
    loading: servicesLoading,
    error: servicesError,
    reload: reloadServices,
  } = useServices();
  const barbers = useBarbers();

  const [serviceId, setServiceId] = useState("");
  const [bookingDate, setBookingDate] = useState(todayIsoDate());
  const [barberId, setBarberId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  /**
   * The style the customer asked for, as a name.
   *
   * Kept apart from `notes` on purpose. The appointment books a *service*
   * — the API has no style on it and the availability arithmetic knows
   * nothing about one — so the style travels as a line the barber reads at
   * the chair. Mixing it into the same textarea would make the customer's
   * own words and a field the form wrote indistinguishable, and there is
   * no way to take the style back out without editing their sentence.
   */
  const [styleName, setStyleName] = useState("");
const [touched, setTouched] = useState({});
const [submitAttempted, setSubmitAttempted] = useState(false);
const [slotGone, setSlotGone] = useState(false);
const [apiError, setApiError] = useState(null);
const [submitting, setSubmitting] = useState(false);
const inFlight = useRef(false);

  const availability = useAvailability({ serviceId, bookingDate, barberId });
  const selectedService = useMemo(
    () => services.find((item) => String(item.id) === String(serviceId)) || null,
    [services, serviceId]
  );
  const selectedBarber = useMemo(
    () => barbers.barbers.find((item) => String(item.id) === String(barberId)) || null,
    [barbers.barbers, barberId]
  );

  const values = { serviceId, bookingDate, startTime, name, phone, notes };
  const outstanding = checklist(values);
  const ready = outstanding.length === 0;
  const hasContact = Boolean(name.trim() && phone.trim());

  const step = !serviceId ? 1 : !startTime || !hasContact ? 2 : 3;
  const stepCopy = !serviceId
    ? "Choose a service to get started."
    : !startTime
      ? "Pick a date and time that works for you."
      : !hasContact
        ? "Add your name and phone to finish."
        : "Review the details and reserve the chair.";

  /**
   * Publish what has been chosen so the AI assistant can answer about
   * *this* booking rather than asking the customer to repeat it.
   *
   * Set on every change and cleared on the way out, so leaving /booking
   * does not leave the assistant quoting a service from three pages ago.
   */
  useEffect(() => {
    setAiBookingContext({
      customerName: name,
      customerPhone: phone,
      serviceId: serviceId || null,
      bookingDate,
      startTime,
    });

    return () => setAiBookingContext(null);
  }, [name, phone, serviceId, bookingDate, startTime]);

  /** The note actually sent: their words, then the style, if any. */
  const composedNotes = useMemo(() => {
    const own = notes.trim();
    const style = styleName
      ? `Style requested: ${styleName}`
      : "";

    return [own, style].filter(Boolean).join("\n");
  }, [notes, styleName]);

  useEffect(() => {
    if (services.length === 0 || serviceId) {
      return;
    }

    const requested = searchParams.get("service");
    const requestedService = services.find(
      (item) => String(item.id) === String(requested)
    );
    const defaultService =
      services.find((item) => item.name === "Signature Haircut") || services[0];
    const firstService = requestedService || defaultService;

    if (firstService) {
      setServiceId(String(firstService.id));
    }
  }, [searchParams, services, serviceId]);

  // A slot can be taken between the list arriving and the customer
  // pressing Reserve. Drop the selection rather than let them submit a
  // time that is known to be gone.
  useEffect(() => {
    if (!startTime || availability.loading) {
      return;
    }

    if (!availability.times.includes(startTime)) {
      setStartTime("");
    }
  }, [availability.times, availability.loading, startTime]);

  // Clear the "that slot has gone" line as soon as another time is chosen,
  // rather than leaving it under a freshly picked slot.
  useEffect(() => {
    setSlotGone(false);
  }, [startTime]);

  const markTouched = (field) =>
    setTouched((state) => ({ ...state, [field]: true }));

  /**
   * Where a field's message comes from, in order of authority:
   *
   *   1. What the backend just said. Never overridden.
   *   2. The slot-disappeared check, which only applies to the one field.
   *   3. The live checklist - but only once the field has been left, or
   *      once Reserve has been pressed. Showing a red line under an
   *      untouched empty input is how a form starts shouting at someone
   *      who has not done anything wrong yet.
   */
  const fieldError = (field) => {
    const fromApi = apiError?.fieldErrors?.[field];

    if (fromApi) {
      return fromApi;
    }

    if (field === "start_time" && slotGone) {
      return "That time is no longer on the list. Please choose another.";
    }

    const live = fieldMessage(field, values);

    if (!live) {
      return null;
    }

    return submitAttempted || touched[field] ? live : null;
  };

  const unmappedErrors = useMemo(() => {
    if (!apiError?.fieldErrors) {
      return null;
    }

    const known = [
      "service",
      "barber",
      "booking_date",
      "start_time",
      "customer_name",
      "customer_phone",
      "notes",
    ];
    const rest = Object.entries(apiError.fieldErrors).filter(
      ([key]) => !known.includes(key)
    );

    return rest.length > 0 ? Object.fromEntries(rest) : null;
  }, [apiError]);

  const handleSelectService = (service) => {
    setServiceId(String(service.id));
    setStartTime("");
    setSlotGone(false);

    // A style belongs to the service it was chosen under. Switching
    // service keeps a "High Fade" selected under a beard sculpt, which
    // would then be written into the barber's note as though it were
    // asked for.
    setStyleName("");
  };

  /**
 * Take a day from whichever control offered it.
 *
 * Three controls write the same one value and they do not agree on how:
 * the day strip and the month grid hand over a plain `YYYY-MM-DD` string,
 * the folded-away Gregorian `<input type="date">` hands over a change
 * event. Both shapes arrive here rather than each control keeping its own
 * setter, so "picking a day" clears the chosen time and the stale-slot
 * message in exactly one place - which is what stops the grid leaving a
 * 09:00 selected from another date while the picker underneath has moved.
 */
const handleSelectDate = (picked) => {
  const iso =
    typeof picked === "string" ? picked : picked?.target?.value || "";

  if (!iso) {
    return;
  }

  setBookingDate(iso);
  setStartTime("");
  setSlotGone(false);
  markTouched("booking_date");
};

  /**
   * Take the next free date the backend offered, and its first time.
   *
   * The whole booking moves - date and time together - because a customer
   * told "nothing free on the 14th" who then has to go and re-pick a date
   * and a time separately is being handed the work the shop already had
   * the answer to.
   */
  const handlePickSuggested = ({ date, time }) => {
    if (date) {
      setBookingDate(date);
    }

    setStartTime(time || "");
    setSlotGone(false);
  };

  const handleSelectBarber = (value) => {
    setBarberId(value ? String(value) : "");
    setStartTime("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (inFlight.current) {
      return;
    }

    // Everything checked again here, not just on the disabled button:
    // a disabled control is a guard rail, not a guarantee, and the form
    // must never send a booking it already knows is incomplete.
    const remaining = checklist(values);

    setSubmitAttempted(true);
    setApiError(null);

    if (remaining.length > 0) {
      // Put the first missing thing on screen rather than at the bottom
      // of a long form.
      document
        .getElementById(`booking-field-${remaining[0].error}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });

      return;
    }

    // The chosen slot must still be one the backend is offering. The
    // list is a snapshot; this is the last cheap check before asking for
    // a slot that may have gone while the form was open.
    if (
      !availability.loading &&
      !availability.error &&
      !availability.times.includes(startTime)
    ) {
      setSlotGone(true);
      availability.reload();

      return;
    }

    inFlight.current = true;
    setSubmitting(true);

    try {
      const booking = await createBooking({
        customerName: name.trim(),
        customerPhone: phone.trim(),
        serviceId,
        barberId,
        bookingDate,
        startTime,
        notes: composedNotes,
      });

      rememberBooking(booking);

      // The slot just taken is no longer bookable. Dropping the cached
      // availability means going back to this date shows the truth rather
      // than a slot that has already gone.
      invalidateQuery("availability");

      // The confirmation page, not the payment form.
      //
      // Payment opens once reception confirms, so at this moment there is
      // nothing to pay for and a form would be asking for money against a
      // chair nobody has agreed to. The confirmation page says so, polls,
      // and opens the form itself the moment the shop confirms - so the
      // customer can leave the tab open and watch it happen.
      navigate(`/booking/success/${booking.id}`, {
        replace: true,
        state: { booking },
      });
    } catch (error) {
      setApiError(error);

      if (error?.fieldErrors?.start_time) {
        setStartTime("");
        availability.reload();
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090909] px-5 pb-24 pt-32 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1200px]">
        <div className="mt-12 grid gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
          <div className="min-w-0">
            <h4 className="mt-5 font-serif text-6xl leading-[0.85] sm:text-7xl">
              Book a chair
            </h4>
          </div>

          <form
            onSubmit={handleSubmit}
            noValidate
            className="min-w-0 border border-white/10 bg-[#111] p-6 sm:p-8"
          >
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
              <div>
                <p className="mt-2 text-sm text-white/65">{stepCopy}</p>
              </div>
              <div className="flex items-center gap-2" aria-label={`Step ${step} of 3`}>
                {[1, 2, 3].map((number) => (
                  <span
                    key={number}
                    className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition ${
                      step >= number
                        ? "border-[#d6a85f] bg-[#d6a85f] text-black"
                        : "border-white/15 text-white/35"
                    }`}
                  >
                    {number}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-7 grid gap-8">
              {/*
                Every child of this grid is `min-w-0`, and that is the whole
                fix for the page being swipeable sideways.

                A grid item's automatic minimum size is its min-content
                width, and a *block* box in normal flow has no automatic
                minimum of zero just because it scrolls - that exemption
                only applies to the grid or flex item itself. So the
                fourteen-day strip and the chip rows, which are hundreds of
                pixels wider than a phone, propagated their content width up
                through their sections, through the form and out to the
                viewport. `min-w-0` on the items lets the sections shrink,
                and the scrollers inside them do the scrolling.
              */}
              {/* The need first, the catalogue second.
                  On a phone the `<select>` is a dropdown that has to be
                  opened and read before anyone can tell whether the shop
                  does what they came for. These chips answer "I want a
                  sharp one" in one tap, and they are built from the
                  services the API actually returned — so a chip can never
                  offer something the shop does not sell. */}
              {services.length > 0 && !servicesLoading && !servicesError && (
                <NeedPicker
                  services={services}
                  selectedId={serviceId}
                  onPick={handleSelectService}
                />
              )}

              <section aria-labelledby="booking-service-label" className="min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <label id="booking-service-label" className={LABEL}>
                    01 · Choose your service
                  </label>
                  {services.length > 0 && (
                    <span className="text-[10px] text-white/30">
                      {services.length} options
                    </span>
                  )}
                </div>
                <div className="mt-4">
                  <ServicePicker
                    services={services}
                    loading={servicesLoading}
                    error={servicesError}
                    onReload={reloadServices}
                    selectedId={serviceId}
                    onSelect={handleSelectService}
                    disabled={submitting}
                  />
                </div>

                <StylePicker
                  service={selectedService}
                  selectedName={styleName}
                  onSelect={setStyleName}
                />

                {/* Unsure which one? The assistant already knows what has
                    been picked on this form — the context above is
                    published for it — so this opens the chat with a
                    question about *this* service rather than a blank
                    panel. */}
                {selectedService && (
                  <button
                    type="button"
                    onClick={() =>
                      openAiChat(`Tell me more about the ${selectedService.name} service.`)
                    }
                    className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-xs font-semibold text-white/50 transition hover:border-[#d6a85f]/50 hover:text-[#d6a85f]"
                  >
                    <MessageCircleQuestion size={14} />
                    Not sure? Ask the assistant about this service
                  </button>
                )}

                <FieldError message={fieldError("service")} />
              </section>

              {serviceId && (
                <>
                  <section aria-labelledby="booking-time-label" className="min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <label id="booking-time-label" className={LABEL}>
                        02 · Date &amp; time
                      </label>
                      {availability.loading && <Spinner size={13} />}
                    </div>

                    <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                      {/*
                        `min-w-0` on both columns, and it is load-bearing.

                        They are grid items, and a grid item's automatic
                        minimum size is its *min-content* width, which the
                        browser will not shrink below. The date column holds
                        a fourteen-day horizontal scroller and a seven-column
                        month grid, so its min-content is far wider than a
                        phone - and without this the whole page ends up as
                        wide as that content and the customer can swipe the
                        storefront sideways. `min-w-0` is what lets the
                        columns shrink and their inner scrollers do the
                        scrolling instead.
                      */}
                      <div id="booking-field-booking_date" className="min-w-0">
                        {/*
                          The row of days first, because it is the question
                          nearly everyone arrives with: "can I come
                          tomorrow". It starts at today, so there is no
                          dimmed-out fortnight of days the shop will refuse,
                          and it stops at the same fourteen days the
                          availability endpoint looks ahead - so every tile
                          on it is a day the shop can actually be booked.

                          The month grid stays underneath for the customer
                          who does want a specific date further out, and for
                          the plain question "what is the date of the 3rd".
                        */}
                        <EthiopianDayStrip
                          value={bookingDate}
                          onChange={handleSelectDate}
                          days={BOOKING_HORIZON_DAYS}
                        />

                        <details className="group mt-3">
                          <summary className="flex cursor-pointer list-none items-center gap-1.5 py-1 text-[11px] text-white/30 marker:hidden">
                            <CalendarDays size={11} />
                            Open the whole month
                          </summary>

                          <div className="mt-2">
                            <EthiopianCalendar
                              value={bookingDate}
                              onChange={handleSelectDate}
                            />
                          </div>
                        </details>

                        {/*
                          The Gregorian input stays, folded away, for anyone
                          keeping the other calendar. It is the same value
                          either way - the Ethiopian calendar is a different
                          view of one date, not a second date.
                        */}
                        <details className="group mt-2">
                          <summary className="flex cursor-pointer list-none items-center gap-1.5 py-1 text-[11px] text-white/30 marker:hidden">
                            <Globe size={11} />
                            Use the Gregorian date instead
                          </summary>

                          <input
                            type="date"
                            value={bookingDate}
                            min={todayIsoDate()}
                            max={shiftIsoDate(todayIsoDate(), BOOKING_HORIZON_DAYS - 1)}
                            onChange={handleSelectDate}
                            onBlur={() => markTouched("booking_date")}
                            disabled={submitting}
                            aria-label="Booking date (Gregorian)"
                            className={`${INPUT} mt-2 text-sm`}
                          />
                        </details>

                        <FieldError message={fieldError("booking_date")} />
                      </div>

                      <div id="booking-field-start_time" className="min-w-0">
                        <TimeSlots
                          times={availability.times}
                          date={bookingDate}
                          loading={availability.loading}
                          error={availability.error}
                          isEmpty={availability.isEmpty}
                          onReload={availability.reload}
                          isRefreshing={availability.isFetching}
                          reason={availability.reason}
                          window={availability.window}
                          onPickDate={handlePickSuggested}
                          onPickService={() =>
                            document
                              .getElementById("booking-service-label")
                              ?.scrollIntoView({ behavior: "smooth", block: "center" })
                          }
                          selectedTime={startTime}
                          onSelect={(value) => {
                            setStartTime(value);
                            markTouched("start_time");
                          }}
                          needsService={!serviceId}
                          needsDate={!bookingDate}
                          disabled={submitting}
                        />
                        <FieldError message={fieldError("start_time")} />
                      </div>
                    </div>
                  </section>

                  <section aria-labelledby="booking-details-label" className="min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <label id="booking-details-label" className={LABEL}>
                        03 · Your details
                      </label>
                      <span className="text-[10px] text-white/30">
                        {hasContact ? "Ready to reserve" : "Name + phone required"}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div id="booking-field-customer_name">
                        <input
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          onBlur={() => markTouched("customer_name")}
                          placeholder="Your name"
                          autoComplete="name"
                          maxLength={120}
                          disabled={submitting}
                          aria-invalid={Boolean(fieldError("customer_name"))}
                          className={INPUT}
                        />
                        <FieldError message={fieldError("customer_name")} />
                      </div>
                      <div id="booking-field-customer_phone">
                        <input
                          value={phone}
                          onChange={(event) => setPhone(event.target.value)}
                          onBlur={() => markTouched("customer_phone")}
                          placeholder="Phone number"
                          type="tel"
                          autoComplete="tel"
                          inputMode="tel"
                          maxLength={30}
                          disabled={submitting}
                          aria-invalid={Boolean(fieldError("customer_phone"))}
                          className={INPUT}
                        />
                        <FieldError message={fieldError("customer_phone")} />
                      </div>
                    </div>

                    <details className="group mt-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                      <summary className="cursor-pointer list-none text-xs text-white/45 marker:hidden">
                        Add a note for your barber <span className="text-white/20">(optional)</span>
                      </summary>
                      <textarea
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        onBlur={() => markTouched("notes")}
                        placeholder="Anything we should know?"
                        rows={3}
                        disabled={submitting}
                        aria-invalid={Boolean(fieldError("notes"))}
                        className={`${INPUT} mt-3 resize-none`}
                      />
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <FieldError message={fieldError("notes")} />

                        {notes.length > 400 && (
                          <span className="text-[10px] text-white/30">
                            {notes.length} / 500
                          </span>
                        )}
                      </div>
                    </details>

                    {barbers.available && (
                      <details className="group mt-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs text-white/45 marker:hidden">
                          <span>Prefer a specific barber?</span>
                          <span className="text-[#d6a85f]">Optional</span>
                        </summary>
                        <div className="mt-3">
                          <BarberPicker
                            barbers={barbers.barbers}
                            selectedId={barberId}
                            onSelect={handleSelectBarber}
                            disabled={submitting}
                          />
                        </div>
                        <FieldError message={fieldError("barber")} />
                      </details>
                    )}

                    {selectedBarber && (
                      <p className="mt-3 text-xs text-[#d6a85f]">
                        Booking with {selectedBarber.name}.
                      </p>
                    )}
                  </section>
                </>
              )}

              {apiError && (
                <Alert
                  tone="error"
                  title={
                    apiError.isNetwork
                      ? "Cannot reach the shop"
                      : "We could not create your booking"
                  }
                  details={unmappedErrors}
                >
                  {apiError.message}
                </Alert>
              )}

              <div className="min-w-0">
                <button
                  type="submit"
                  disabled={submitting || !ready}
                  className="group flex w-full items-center justify-center gap-3 rounded-full bg-[#d6a85f] px-6 py-4 text-sm font-semibold text-black transition hover:bg-[#e5bd7a] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/25 border-t-black" />
                      Reserving your slot...
                    </>
                  ) : ready ? (
                    <>
                      Reserve the chair
                      <span className="transition-transform group-hover:translate-x-1">→</span>
                    </>
                  ) : (
                    <>
                      {outstanding.length} thing
                      {outstanding.length === 1 ? "" : "s"} left to finish
                    </>
                  )}
                </button>

                {ready && (
                  <p className="mt-4 flex items-center justify-center gap-2 text-center text-[10px] leading-5 text-white/25">
                    <Check size={11} />
                    Everything is filled in. You will get a booking code to
                    keep straight away.
                  </p>
                )}

                {/*
                  The order, stated before anyone commits to it. Payment
                  comes after confirmation, so "reserve" really does mean
                  reserve - nobody is asked for money on this screen.
                */}
                <p className="mt-4 text-center text-[10px] leading-5 text-white/25">
                  Reception confirms every booking by hand. You will get a code
                  to keep, and payment opens once they have confirmed — the
                  next page checks on its own, so there is nothing to do until
                  then.
                </p>
              </div>
            </div>
          </form>
        </div>

        {selectedService && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#d6a85f]/20 bg-[#d6a85f]/[0.05] px-5 py-4 text-xs text-white/50">
            <span>
              {selectedService.name}
              {styleName ? ` · ${styleName}` : ""} ·{" "}
              {formatPrice(selectedService.price)} ·{" "}
              {formatDuration(selectedService.duration)}
            </span>

            <span>
              {bookingDate ? formatEthiopianDate(bookingDate) : "Choose a date"}
              {bookingDate ? ` · ${formatEthiopianWeekday(bookingDate)}` : ""}
              {startTime ? ` · ${formatEthiopianTime(startTime)}` : ""}
              {barberId && selectedBarber ? ` · ${selectedBarber.name}` : " · Any available barber"}
            </span>
          </div>
        )}
      </div>

      {/*
        The mobile action bar.

        ## Why this exists

        On a phone this form is three screens tall: what you want, when
        you can come, and who you are. The Reserve button is at the very
        bottom of the last one, so a customer who has finished everything
        and is looking at their thumb has to scroll the entire form again
        to find out whether they are done — and, worse, cannot tell at all
        without scrolling, because the summary that tells them lives above
        this point too.

        Sticky rather than fixed, and it sits *inside* the page flow
        rather than floating over it, for two reasons. A fixed bar would
        fight the app bar that is already fixed at the bottom of a phone
        screen, and the fight is always won by whichever has the higher
        z-index — which is how you end up with one covering the other. And
        sticky is released automatically by the same `useModalOpen` signal
        that steps the app bar aside, so the two never need to know about
        each other.

        `lg:hidden`: from that breakpoint up the form fits in one screen
        beside the headline, the summary below it is already on screen, and
        a bar with the same information twice is just clutter.
      */}
      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)_+_5.75rem)] z-10 mt-4 lg:hidden">
        {selectedService && (
          <div className="mx-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0c0c0c]/95 px-3.5 py-3 shadow-[0_-10px_30px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">
                {selectedService.name}
                {styleName ? ` · ${styleName}` : ""}
              </p>
              <p className="mt-0.5 truncate text-[10px] text-white/40">
                {[
                  bookingDate ? formatEthiopianDate(bookingDate) : null,
                  startTime ? formatEthiopianTime(startTime) : null,
                  formatPrice(selectedService.price),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !ready}
              aria-label={
                ready
                  ? "Reserve the chair"
                  : `${outstanding.length} things still needed`
              }
              className="shrink-0 rounded-full bg-[#d6a85f] px-4 py-3 text-xs font-semibold text-black transition hover:bg-[#e5bd7a] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? "Wait..."
                : ready
                  ? "Reserve"
                  : `${outstanding.length} left`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}