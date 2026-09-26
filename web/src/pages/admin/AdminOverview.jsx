import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CreditCard,
  Images,
  MessageSquareQuote,
  Scissors,
  Users,
} from "lucide-react";

import Alert from "../../components/ui/Alert";
import Spinner from "../../components/ui/Spinner";
import { listBookings } from "../../services/bookingApi";
import { listPayments } from "../../services/paymentApi";
import { listAllServices } from "../../services/servicesApi";
import { listGalleryPosts } from "../../services/galleryApi";
import { listAllTestimonials } from "../../services/testimonialsApi";

/**
 * Dashboard overview — aggregate counts pulled live from the API with
 * quick links into each management screen.
 */

async function loadSection(loader) {
  try {
    const data = await loader();
    return Array.isArray(data) ? data : data?.results || [];
  } catch {
    return null;
  }
}

export default function AdminOverview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    Promise.all([
      loadSection(listBookings),
      loadSection(listPayments),
      loadSection(listAllServices),
      loadSection(() => listGalleryPosts({ requiresAuth: true })),
      loadSection(listAllTestimonials),
    ]).then(([bookings, payments, services, gallery, testimonials]) => {
      if (!active) {
        return;
      }

      if (bookings === null) {
        setError({
          message: "Some sections could not be loaded.",
          fieldErrors: {},
        });
        setData({ bookings: [], payments: [], services: [], gallery: [], testimonials: [] });
        return;
      }

      setData({ bookings, payments, services, gallery, testimonials });
      setError(null);
    });

    return () => {
      active = false;
    };
  }, []);

  const stats = data
    ? [
        {
          label: "Bookings",
          to: "/admin/bookings",
          icon: Users,
          count: data.bookings.length,
          sub: `${data.bookings.filter((b) => b.status === "pending").length} pending`,
        },
        {
          label: "Payments",
          to: "/admin/payments",
          icon: CreditCard,
          count: data.payments.length,
          sub: `${data.payments.filter((p) => p.status === "pending").length} to verify`,
        },
        {
          label: "Services",
          to: "/admin/services",
          icon: Scissors,
          count: data.services.length,
          sub: "live on the site",
        },
        {
          label: "Gallery",
          to: "/admin/gallery",
          icon: Images,
          count: data.gallery.length,
          sub: `${data.gallery.filter((g) => g.is_active).length} visible`,
        },
        {
          label: "Testimonials",
          to: "/admin/testimonials",
          icon: MessageSquareQuote,
          count: data.testimonials.length,
          sub: `${data.testimonials.filter((t) => t.status === "pending").length} pending`,
        },
      ]
    : [];

  return (
    <div>
      <div>
        <p className="text-[10px] uppercase tracking-[0.35em] text-[#d6a85f]">
          Staff console
        </p>
        <h1 className="mt-4 font-serif text-4xl leading-none sm:text-5xl">
          Overview
        </h1>
        <p className="mt-3 text-xs text-white/35">
          A live snapshot of the shop, straight from the API.
        </p>
      </div>

      {error && (
        <Alert tone="error" title="Something went wrong" className="mt-6">
          {error.message}
        </Alert>
      )}

      {!data && !error && (
        <div className="mt-8 flex items-center justify-center rounded-2xl border border-white/10 bg-[#111] py-24">
          <Spinner label="Loading the dashboard..." />
        </div>
      )}

      {data && (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {stats.map((stat) => {
              const Icon = stat.icon;

              return (
                <Link
                  key={stat.label}
                  to={stat.to}
                  className="group rounded-2xl border border-white/10 bg-[#111] p-6 transition hover:border-[#d6a85f]/40"
                >
                  <div className="flex items-start justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#181818]">
                      <Icon size={18} className="text-[#d6a85f]" />
                    </span>
                    <ArrowRight
                      size={17}
                      className="text-white/25 transition group-hover:translate-x-1 group-hover:text-[#d6a85f]"
                    />
                  </div>
                  <p className="mt-6 font-serif text-5xl text-white">
                    {stat.count}
                  </p>
                  <p className="mt-2 text-sm font-medium text-white/75">
                    {stat.label}
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.15em] text-white/30">
                    {stat.sub}
                  </p>
                </Link>
              );
            })}
          </div>

          <div className="mt-8 rounded-2xl border border-white/10 bg-[#111] p-6">
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#d6a85f]">
              Quick actions
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {[
                { label: "Verify payments", to: "/admin/payments" },
                { label: "Confirm bookings", to: "/admin/bookings" },
                { label: "Add a service", to: "/admin/services" },
                { label: "Add gallery post", to: "/admin/gallery" },
                { label: "Review testimonials", to: "/admin/testimonials" },
              ].map((action) => (
                <Link
                  key={action.to + action.label}
                  to={action.to}
                  className="rounded-full border border-white/15 px-4 py-2.5 text-xs font-semibold text-white/70 transition hover:border-[#d6a85f]/50 hover:text-white"
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
