import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CreditCard,
  Images,
  MessageSquareQuote,
  Scissors,
  UserRound,
  Users,
} from "lucide-react";

import Alert from "../../components/ui/Alert";
import {
  AdminButton,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
} from "../../components/admin/AdminUi";
import { listBookings } from "../../services/bookingApi";
import { listPayments } from "../../services/paymentApi";
import { listAllServices } from "../../services/servicesApi";
import { listGalleryPosts } from "../../services/galleryApi";
import { listAllTestimonials } from "../../services/testimonialsApi";
import { listRegisteredCustomers } from "../../services/authApi";

/**
 * Dashboard overview — aggregate counts pulled live from the API with
 * quick links into each management screen.
 *
 * On a phone this is the screen a barber checks between customers, so
 * the stat cards are two per row with a count that fits at any width,
 * and the work still to do is called out as a number on the card rather
 * than a separate list someone has to cross-reference.
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
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);

    const [bookings, payments, services, gallery, testimonials, customers] =
      await Promise.all([
        loadSection(listBookings),
        loadSection(listPayments),
        loadSection(listAllServices),
        loadSection(() => listGalleryPosts({ requiresAuth: true })),
        loadSection(listAllTestimonials),
        loadSection(listRegisteredCustomers),
      ]);

    setRefreshing(false);

    // Only the booking list failing means the dashboard itself is
    // unusable; the rest degrade to empty counts.
    if (bookings === null) {
      setError({
        message: "Some sections could not be loaded.",
        fieldErrors: {},
      });
      setData({
        bookings: [],
        payments: [],
        services: [],
        gallery: [],
        testimonials: [],
        customers: [],
      });
      return;
    }

    setData({ bookings, payments, services, gallery, testimonials, customers });
    setError(null);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
          label: "Customers",
          to: "/admin/customers",
          icon: UserRound,
          count: data.customers.length,
          sub: "registered accounts",
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
      <AdminPageHeader
        eyebrow="Staff console"
        title="Overview"
        description="A live snapshot of the shop, straight from the API."
        actions={
          <AdminButton onClick={load} disabled={refreshing}>
            {refreshing ? "Refreshing..." : "Refresh"}
          </AdminButton>
        }
      />

      {error && (
        <Alert tone="error" title="Something went wrong" className="mt-6">
          {error.message}
        </Alert>
      )}

      {!data && !error && <AdminLoading label="Loading the dashboard..." />}

      {data && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {stats.map((stat) => {
              const Icon = stat.icon;

              return (
                <Link
                  key={stat.label}
                  to={stat.to}
                  className="group min-w-0 rounded-2xl border border-white/10 bg-[#111] p-4 transition hover:border-[#d6a85f]/40 sm:p-6"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#181818]">
                      <Icon
                        size={17}
                        className="text-[#d6a85f]"
                      />
                    </span>
                    <ArrowRight
                      size={16}
                      className="mt-1 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-[#d6a85f]"
                    />
                  </div>

                  {/* clamp keeps a four-figure count from pushing the
                      card taller than its neighbour on a 360px screen */}
                  <p className="mt-4 font-serif text-4xl leading-none text-white sm:mt-6 sm:text-5xl">
                    {stat.count}
                  </p>

                  <p className="mt-2 truncate text-sm font-medium text-white/75">
                    {stat.label}
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-white/30">
                    {stat.sub}
                  </p>
                </Link>
              );
            })}
          </div>

          <AdminPanel className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-[#d6a85f]">
                  Needs attention
                </p>
                <p className="mt-2 text-sm text-white/55">
                  Work through the live queue from your phone.
                </p>
              </div>
              <span className="rounded-full border border-[#d6a85f]/25 bg-[#d6a85f]/10 px-3 py-1.5 text-xs font-semibold text-[#d6a85f]">
                {data.bookings.filter((b) => b.status === "pending").length + data.payments.filter((p) => p.status === "pending").length + data.testimonials.filter((t) => t.status === "pending").length}
              </span>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {[
                {
                  label: "Bookings to confirm",
                  count: data.bookings.filter((b) => b.status === "pending").length,
                  to: "/admin/bookings",
                },
                {
                  label: "Payments to verify",
                  count: data.payments.filter((p) => p.status === "pending").length,
                  to: "/admin/payments",
                },
                {
                  label: "Reviews to approve",
                  count: data.testimonials.filter((t) => t.status === "pending").length,
                  to: "/admin/testimonials",
                },
              ].map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left transition hover:border-[#d6a85f]/40"
                >
                  <span className="text-xs text-white/65">{item.label}</span>
                  <span className="font-serif text-2xl leading-none text-white">{item.count}</span>
                </Link>
              ))}
            </div>
          </AdminPanel>

          <AdminPanel className="mt-3">
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#d6a85f]">
              Quick actions
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { label: "Verify payments", to: "/admin/payments" },
                { label: "Confirm bookings", to: "/admin/bookings" },
                { label: "View customers", to: "/admin/customers" },
                { label: "Add a service", to: "/admin/services" },
                { label: "Add gallery post", to: "/admin/gallery" },
                { label: "Review testimonials", to: "/admin/testimonials" },
              ].map((action) => (
                <Link
                  key={action.to + action.label}
                  to={action.to}
                  className="inline-flex min-h-10 items-center rounded-full border border-white/15 px-4 py-2.5 text-xs font-semibold text-white/70 transition hover:border-[#d6a85f]/50 hover:text-white"
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </AdminPanel>
        </>
      )}
    </div>
  );
}
