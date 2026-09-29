import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Clock3, Scissors } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import BarberPicker from "../components/booking/BarberPicker";
import ServicePicker from "../components/booking/ServicePicker";
import TimeSlots from "../components/booking/TimeSlots";
import Alert from "../components/ui/Alert";
import FieldError from "../components/ui/FieldError";
import Spinner from "../components/ui/Spinner";
import { useAvailability } from "../hooks/useAvailability";
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

function validate({ serviceId, bookingDate, startTime, name, phone }) {
  const errors = {};

  if (!serviceId) {
    errors.service = "Please choose a service.";
  }

  if (!bookingDate) {
    errors.booking_date = "Please choose a date.";
  } else if (bookingDate < todayIsoDate()) {
    errors.booking_date = "Please choose today or a future date.";
  }

  if (!startTime) {
    errors.start_time = "Please choose an available time.";
  }

  if (!name.trim()) {
    errors.customer_name = "Please enter your name.";
  }

  const digits = phone.replace(/\D/g, "");

  if (!phone.trim()) {
    errors.customer_phone = "Please enter your phone number.";
  } else if (digits.length < 9) {
    errors.customer_phone = "Please enter a complete phone number.";
  }

  return errors;
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
  const [localErrors, setLocalErrors] = useState({});
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

  useEffect(() => {
    if (!startTime || availability.loading) {
      return;
    }

    if (!availability.times.includes(startTime)) {
      setStartTime("");
    }
  }, [availability.times, availability.loading, startTime]);

  const fieldError = (field) =>
    localErrors[field] || apiError?.fieldErrors?.[field] || null;

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
    setLocalErrors((errors) => ({ ...errors, service: undefined }));
  };

  const handleSelectDate = (event) => {
    setBookingDate(event.target.value);
    setStartTime("");
    setLocalErrors((errors) => ({ ...errors, booking_date: undefined }));
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

    const errors = validate({ serviceId, bookingDate, startTime, name, phone });
    setLocalErrors(errors);
    setApiError(null);

    if (Object.keys(errors).length > 0) {
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
            <p className="text-[10px] uppercase tracking-[0.35em] text-[#d6a85f]">
              Reservations
            </p>
            <h1 className="mt-5 font-serif text-6xl leading-[0.85] sm:text-7xl">
              Book your
              <br />
              <span className="italic text-[#d6a85f]">chair.</span>
            </h1>
            <p className="mt-8 max-w-md text-sm leading-7 text-white/45">
              Three quick steps. Live availability. No account needed.
            </p>

            <div className="mt-10 space-y-5 border-t border-white/10 pt-7">
              <div className="flex gap-4">
                <Scissors size={17} className="mt-1" />
                <div>
                  <p className="mt-1 text-xs text-white/35">
                    Every service includes a clear price and time.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <Clock3 size={17} className="mt-1" />
                <div>
                  <p className="mt-1 text-xs text-white/35">
                    Choose only from slots the backend confirms.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            noValidate
            className="border border-white/10 bg-[#111] p-6 sm:p-8"
          >
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-[#d6a85f]">
                  Quick booking
                </p>
                <p className="mt-2 text-sm text-white/65">{stepCopy}</p>
              </div>
              <div className="flex items-center gap-2" aria-label={`Step ${step} of 3`}>
                {[1, 2, 3].map((number) => (
                  <span
                    key={number}
                    className={`flex h-8 w-8 items-center justify-center  border text-xs font-semibold transition ${
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
                      <div>
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
                            disabled={submitting}
                            className={`${INPUT} px-12`}
                          />
                        </div>
                        <FieldError message={fieldError("booking_date")} />
                      </div>

                      <div>
                        <TimeSlots
                          times={availability.times}
                          loading={availability.loading}
                          error={availability.error}
                          isEmpty={availability.isEmpty}
                          onReload={availability.reload}
                          selectedTime={startTime}
                          onSelect={setStartTime}
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
                      <div>
                        <input
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          placeholder="Your name"
                          autoComplete="name"
                          maxLength={120}
                          disabled={submitting}
                          aria-invalid={Boolean(fieldError("customer_name"))}
                          className={INPUT}
                        />
                        <FieldError message={fieldError("customer_name")} />
                      </div>
                      <div>
                        <input
                          value={phone}
                          onChange={(event) => setPhone(event.target.value)}
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

                    <details className="group mt-3  border border-white/10 bg-white/[0.02] px-4 py-3">
                      <summary className="cursor-pointer list-none text-xs text-white/45 marker:hidden">
                        Add a note for your barber <span className="text-white/20">(optional)</span>
                      </summary>
                      <textarea
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder="Anything we should know?"
                        rows={3}
                        disabled={submitting}
                        className={`${INPUT} mt-3 resize-none`}
                      />
                      <FieldError message={fieldError("notes")} />
                    </details>

                    {barbers.available && (
                      <details className="group mt-3  border border-white/10 bg-white/[0.02] px-4 py-3">
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
                  disabled={submitting}
                  className="group flex w-full items-center justify-center gap-3  bg-[#d6a85f] px-6 py-4 text-sm font-semibold text-black transition hover:bg-[#e5bd7a] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <span className="h-4 w-4 animate-spin  border-2 border-black/25 border-t-black" />
                      Reserving your slot...
                    </>
                  ) : (
                    <>
                      Reserve and continue
                      <span className="transition-transform group-hover:translate-x-1">→</span>
                    </>
                  )}
                </button>
                <p className="mt-4 text-center text-[10px] leading-5 text-white/25">
                  Your appointment stays pending until the shop verifies payment.
                </p>
              </div>
            </div>
          </form>
        </div>

        {selectedService && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3  border border-[#d6a85f]/20 bg-[#d6a85f]/[0.05] px-5 py-4 text-xs text-white/50">
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
