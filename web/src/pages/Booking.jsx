import { useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  Scissors,
} from "lucide-react";
import { Link } from "react-router-dom";

const services = [
  "Signature Cut",
  "Fade + Beard",
  "Royal Groom",
];

const barbers = [
  "Any available barber",
  "Alex Tesfaye",
  "Mikael Daniel",
  "Samuel Bekele",
];

const times = [
  "09:00",
  "10:30",
  "12:00",
  "14:00",
  "15:30",
  "17:00",
  "18:30",
  "20:00",
];

export default function Booking() {
  const [service, setService] = useState(services[0]);
  const [barber, setBarber] = useState(barbers[0]);
  const [time, setTime] = useState(times[0]);

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
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] text-[#d6a85f]">
              Reservations
            </p>

            <h1 className="mt-5 font-serif text-6xl leading-[0.85] sm:text-7xl">
              Book your
              <br />
              <span className="italic text-[#d6a85f]">
                chair.
              </span>
            </h1>

            <p className="mt-8 max-w-md text-sm leading-7 text-white/45">
              Choose your service, barber and preferred time. We'll
              take care of the rest.
            </p>

            <div className="mt-10 space-y-5 border-t border-white/10 pt-7">
              <div className="flex gap-4">
                <Scissors
                  size={17}
                  className="mt-1 text-[#d6a85f]"
                />

                <div>
                  <p className="text-sm font-medium">
                    Precision grooming
                  </p>

                  <p className="mt-1 text-xs text-white/35">
                    Every appointment is tailored to you.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <Clock3
                  size={17}
                  className="mt-1 text-[#d6a85f]"
                />

                <div>
                  <p className="text-sm font-medium">
                    Open daily
                  </p>

                  <p className="mt-1 text-xs text-white/35">
                    09:00 — 21:00
                  </p>
                </div>
              </div>
            </div>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              alert("Booking UI ready — connect your backend next.");
            }}
            className="rounded-[2rem] border border-white/10 bg-[#111] p-6 sm:p-8"
          >
            <div className="grid gap-8">
              {/* Service */}
              <div>
                <label className="text-[10px] uppercase tracking-[0.25em] text-white/35">
                  01 · Select service
                </label>

                <div className="mt-4 grid gap-2">
                  {services.map((item) => (
                    <button
                      type="button"
                      key={item}
                      onClick={() => setService(item)}
                      className={`flex items-center justify-between rounded-xl border p-4 text-left text-sm transition ${
                        service === item
                          ? "border-[#d6a85f]/50 bg-[#d6a85f]/10 text-white"
                          : "border-white/10 bg-white/[0.02] text-white/50 hover:bg-white/[0.05]"
                      }`}
                    >
                      {item}

                      {service === item && (
                        <Check
                          size={16}
                          className="text-[#d6a85f]"
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Barber */}
              <div>
                <label className="text-[10px] uppercase tracking-[0.25em] text-white/35">
                  02 · Choose barber
                </label>

                <select
                  value={barber}
                  onChange={(event) => setBarber(event.target.value)}
                  className="mt-4 w-full appearance-none rounded-xl border border-white/10 bg-[#181818] px-4 py-4 text-sm text-white outline-none transition focus:border-[#d6a85f]/50"
                >
                  {barbers.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="text-[10px] uppercase tracking-[0.25em] text-white/35">
                  03 · Choose date
                </label>

                <div className="relative mt-4">
                  <CalendarDays
                    size={17}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#d6a85f]"
                  />

                  <input
                    type="date"
                    className="w-full rounded-xl border border-white/10 bg-[#181818] px-12 py-4 text-sm text-white outline-none focus:border-[#d6a85f]/50"
                  />
                </div>
              </div>

              {/* Time */}
              <div>
                <label className="text-[10px] uppercase tracking-[0.25em] text-white/35">
                  04 · Choose time
                </label>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {times.map((item) => (
                    <button
                      type="button"
                      key={item}
                      onClick={() => setTime(item)}
                      className={`rounded-xl border px-3 py-3 text-xs transition ${
                        time === item
                          ? "border-[#d6a85f]/50 bg-[#d6a85f]/10 text-[#d6a85f]"
                          : "border-white/10 text-white/40 hover:bg-white/[0.05]"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              {/* Customer */}
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  placeholder="Your name"
                  className="rounded-xl border border-white/10 bg-[#181818] px-4 py-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#d6a85f]/50"
                />

                <input
                  placeholder="Phone number"
                  className="rounded-xl border border-white/10 bg-[#181818] px-4 py-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#d6a85f]/50"
                />
              </div>

              <button
                type="submit"
                className="group flex w-full items-center justify-center gap-3 rounded-full bg-[#d6a85f] px-6 py-4 text-sm font-semibold text-black transition hover:bg-[#e5bd7a]"
              >
                Confirm Appointment

                <span className="transition-transform group-hover:translate-x-1">
                  →
                </span>
              </button>

              <p className="text-center text-[10px] leading-5 text-white/25">
                Your appointment will be confirmed after connecting
                this form to the booking backend.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}