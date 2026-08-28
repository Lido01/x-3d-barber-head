import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CalendarDays, Clock3, Scissors } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

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
import { formatDuration, formatPrice, todayIsoDate } from "../utils/format";

/**
 * Public booking flow. No account, no login, no token.
 *
 *   service -> date -> time (from Django) -> barber -> details
 *
 * Availability and every business rule stay on the server; the checks
 * here only exist to catch obvious mistakes before a round trip.
 */

const LABEL =
  "text-[10px] uppercase tracking-[0.25em] text-white/35";

const INPUT =
  "w-full rounded-xl border border-white/10 bg-[#181818] px-4 py-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#d6a85f]/50";

/** Cheap pre-flight checks. Django remains the authority. */
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
  const [bookingDate, setBookingDate] = useState("");
  const [barberId, setBarberId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const [localErrors, setLocalErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Belt and braces against a double click creating two bookings.
  const inFlight = useRef(false);

  const availability = useAvailability({
    serviceId,
    bookingDate,
    barberId,
  });

  const selectedService = useMemo(
    () => services.find((item) => String(item.id) === String(serviceId)) || null,
    [services, serviceId]
  );

  // Preselect ?service=<id> when arriving from the services page.
  useEffect(() => {
    const requested = searchParams.get("service");

    if (!requested || serviceId || services.length === 0) {
      return;
    }

    if (services.some((item) => String(item.id) === String(requested))) {
      setServiceId(requested);
    }
  }, [searchParams, services, serviceId]);

  // A slot only means something for the service/date/barber it was
  // fetched for, so drop it as soon as it is no longer on offer.
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

  /** Backend field errors that have no matching input on this screen. */
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

    const errors = validate({
      serviceId,
      bookingDate,
      startTime,
      name,
      phone,
    });

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

      // A rejected time usually means somebody just took it - pull the
      // fresh list so the customer sees reality.
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
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/40 hover:text-white"
        >
          <ArrowLeft size={14} />
          Back home
        </Link>

        <div className="mt-12 grid gap-12 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
          {/* ---------------- editorial column ---------------- */}
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
              Choose your service, date and time. No account needed — just
              your name and phone number.
            </p>

            <div className="mt-10 space-y-5 border-t border-white/10 pt-7">
              <div className="flex gap-4">
                <Scissors size={17} className="mt-1 text-[#d6a85f]" />

                <div>
                  <p className="text-sm font-medium">Precision grooming</p>

                  <p className="mt-1 text-xs text-white/35">
                    Every appointment is tailored to you.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <Clock3 size={17} className="mt-1 text-[#d6a85f]" />

                <div>
                  <p className="text-sm font-medium">Live availability</p>

                  <p className="mt-1 text-xs text-white/35">
                    Times come straight from the shop's schedule.
                  </p>
                </div>
              </div>
            </div>

            {selectedService && (
              <div className="mt-8 rounded-2xl border border-[#d6a85f]/25 bg-[#d6a85f]/[0.06] p-5">
                <p className={LABEL}>Selected</p>

                <p className="mt-2 text-sm font-medium text-white">
                  {selectedService.name}
                </p>

                <div className="mt-3 flex items-center justify-between text-xs text-white/50">
                  <span>{formatPrice(selectedService.price)}</span>
                  <span>{formatDuration(selectedService.duration)}</span>
                </div>
              </div>
            )}
          </div>

          {/* ---------------- form column ---------------- */}
          <form
            onSubmit={handleSubmit}
            noValidate
            className="rounded-[2rem] border border-white/10 bg-[#111] p-6 sm:p-8"
          >
            <div className="grid gap-8">
              {/* 01 service */}
              <div>
                <label className={LABEL}>01 · Select service</label>

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
              </div>

              {/* 02 date */}
              <div>
                <label className={LABEL} htmlFor="booking-date">
                  02 · Choose date
                </label>

                <div className="relative mt-4">
                  <CalendarDays
                    size={17}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#d6a85f]"
                  />

                  <input
                    id="booking-date"
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

              {/* 03 time */}
              <div>
                <div className="flex items-center justify-between gap-3">
                  <label className={LABEL}>03 · Choose time</label>

                  {availability.loading && <Spinner size={13} />}
                </div>

                <div className="mt-4">
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
                </div>

                <FieldError message={fieldError("start_time")} />
              </div>

              {/* 04 barber */}
              {barbers.available && (
                <div>
                  <label className={LABEL}>04 · Choose barber</label>

                  <div className="mt-4">
                    <BarberPicker
                      barbers={barbers.barbers}
                      selectedId={barberId}
                      onSelect={handleSelectBarber}
                      disabled={submitting}
                    />
                  </div>

                  <FieldError message={fieldError("barber")} />
                </div>
              )}

              {/* 05 details */}
              <div>
                <label className={LABEL}>
                  {barbers.available ? "05" : "04"} · Your details
                </label>

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

                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Notes for your barber (optional)"
                  rows={3}
                  disabled={submitting}
                  className={`${INPUT} mt-3 resize-none`}
                />

                <FieldError message={fieldError("notes")} />
              </div>

              {/* general errors */}
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
                  className="group flex w-full items-center justify-center gap-3 rounded-full bg-[#d6a85f] px-6 py-4 text-sm font-semibold text-black transition hover:bg-[#e5bd7a] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/25 border-t-black" />
                      Creating booking...
                    </>
                  ) : (
                    <>
                      Continue to payment
                      <span className="transition-transform group-hover:translate-x-1">
                        →
                      </span>
                    </>
                  )}
                </button>

                <p className="mt-4 text-center text-[10px] leading-5 text-white/25">
                  Your appointment is held as pending until the shop verifies
                  your payment.
                </p>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
