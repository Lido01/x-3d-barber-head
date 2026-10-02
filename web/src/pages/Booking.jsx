import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Check, ChevronDown } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import BarberPicker from "../components/booking/BarberPicker";
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
import { rememberBooking } from "../utils/bookingSession";
import {
  formatDate,
  formatDuration,
  formatPrice,
  formatTime,
  todayIsoDate,
} from "../utils/format";

const LABEL = "text-[10px] uppercase tracking-[0.25em] text-white/35";

const INPUT =
  "w-full  border border-white/10 bg-[#181818] px-4 py-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#d6a85f]/50";

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
  };

  const handleSelectDate = (event) => {
    setBookingDate(event.target.value);
    setStartTime("");
    setSlotGone(false);
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
        notes: notes.trim(),
      });

      rememberBooking(booking);

      // The slot just taken is no longer bookable. Dropping the cached
      // availability means going back to this date shows the truth
      // rather than a slot that has already gone.
      invalidateQuery("availability");

      navigate(`/payment/${booking.id}`, {
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
          <div>
            <h1 className="mt-5 font-serif text-6xl leading-[0.85] sm:text-7xl">
              Book your
              <br />
              <span className="italic text-[#d6a85f]">chair.</span>
            </h1>
          </div>

          <form
            onSubmit={handleSubmit}
            noValidate
            className="border border-white/10 bg-[#111] p-6 sm:p-8"
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

            {/* What is still needed, before anything is sent.
                The button below is disabled until this is empty; showing
                the list is what turns "nothing happens when I press the
                button" into something actionable. */}
            {outstanding.length > 0 && serviceId && (
              <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">
                  Still needed
                </p>

                <ul className="mt-3 space-y-2">
                  {outstanding.map((item) => (
                    <li key={item.key} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/15">
                        <ChevronDown
                          size={9}
                          className="-rotate-90 text-white/30"
                        />
                      </span>

                      <span className="text-xs leading-5 text-white/50">
                        {item.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-7 grid gap-8">
              <section aria-labelledby="booking-service-label">
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
                <FieldError message={fieldError("service")} />
              </section>

              {serviceId && (
                <>
                  <section aria-labelledby="booking-time-label">
                    <div className="flex items-center justify-between gap-3">
                      <label id="booking-time-label" className={LABEL}>
                        02 · Date &amp; time
                      </label>
                      {availability.loading && <Spinner size={13} />}
                    </div>

                    <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                      <div id="booking-field-booking_date">
                        <div className="relative">
                          <CalendarDays
                            size={17}
                            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#d6a85f]"
                          />
                          <input
                            id="booking-date"
                            aria-label="Booking date"
                            type="date"
                            value={bookingDate}
                            min={todayIsoDate()}
                            onChange={handleSelectDate}
                            onBlur={() => markTouched("booking_date")}
                            disabled={submitting}
                            className={`${INPUT} px-12`}
                          />
                        </div>
                        <FieldError message={fieldError("booking_date")} />
                      </div>

                      <div id="booking-field-start_time">
                        <TimeSlots
                          times={availability.times}
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

                  <section aria-labelledby="booking-details-label">
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

              <div>
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
                      Reserve and continue
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
                    keep, then pay.
                  </p>
                )}

                <p className="mt-4 text-center text-[10px] leading-5 text-white/25">
                  Your appointment stays pending until the shop verifies payment.
                </p>
              </div>
            </div>
          </form>
        </div>

        {selectedService && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#d6a85f]/20 bg-[#d6a85f]/[0.05] px-5 py-4 text-xs text-white/50">
            <span>{selectedService.name} · {formatPrice(selectedService.price)} · {formatDuration(selectedService.duration)}</span>
            <span>
              {bookingDate ? formatDate(bookingDate) : "Choose a date"}
              {startTime ? ` · ${formatTime(startTime)}` : ""}
              {barberId && selectedBarber ? ` · ${selectedBarber.name}` : " · Any available barber"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}