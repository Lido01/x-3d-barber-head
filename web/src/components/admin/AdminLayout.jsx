import { useState } from "react";
import {
  CreditCard,
  Images,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareQuote,
  Scissors,
  Users,
  X,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";

import { useAdminAuth } from "../../context/AdminAuthContext";

/**
 * Layout for the staff dashboard.
 *
 * Renders a fixed sidebar (desktop) / drawer (mobile) with navigation
 * to every management screen, the signed-in account and sign out.
 */

const NAV = [
  {
    label: "Overview",
    to: "/admin",
    icon: LayoutDashboard,
    end: true,
  },
  {
    label: "Bookings",
    to: "/admin/bookings",
    icon: Users,
  },
  {
    label: "Payments",
    to: "/admin/payments",
    icon: CreditCard,
  },
  {
    label: "Services",
    to: "/admin/services",
    icon: Scissors,
  },
  {
    label: "Gallery",
    to: "/admin/gallery",
    icon: Images,
  },
  {
    label: "Testimonials",
    to: "/admin/testimonials",
    icon: MessageSquareQuote,
  },
];

export default function AdminLayout({ children }) {
  const navigate = useNavigate();
  const { account, signOut } = useAdminAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleSignOut = () => {
    signOut();
    navigate("/admin/login", { replace: true });
  };

  const SidebarContent = (
    <nav className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-6 py-7">
        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#181818]">
          <Scissors size={18} className="text-[#d6a85f]" />
        </span>
        <div className="leading-none">
          <p className="font-serif text-lg font-bold tracking-[0.12em] text-white">
            NOIR
          </p>
          <p className="mt-1 text-[8px] tracking-[0.3em] text-[#d6a85f]">
            STAFF CONSOLE
          </p>
        </div>
      </div>

      <div className="px-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <p className="text-[9px] uppercase tracking-[0.25em] text-white/35">
            Signed in
          </p>
          <p className="mt-1 truncate text-sm font-medium text-white">
            {account?.username || "Team member"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex-1 space-y-1 px-4">
        {NAV.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setDrawerOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition ${
                  isActive
                    ? "bg-[#d6a85f] text-black"
                    : "text-white/55 hover:bg-white/[0.05] hover:text-white"
                }`
              }
            >
              <Icon size={17} />
              {item.label}
            </NavLink>
          );
        })}
      </div>

      <div className="space-y-2 border-t border-white/10 px-4 py-5">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="w-full rounded-xl px-3.5 py-3 text-left text-sm font-medium text-white/55 transition hover:bg-white/[0.05] hover:text-white"
        >
          Back to website
        </button>

        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium text-white/55 transition hover:bg-[#e05a4f]/10 hover:text-[#e0776b]"
        >
          <LogOut size={17} />
          Sign out
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#090909]">
      {/* Fixed sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-white/10 bg-[#0d0d0d] lg:block">
        {SidebarContent}
      </aside>

      {/* Mobile top bar + drawer */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-label="Open menu"
        className="fixed left-4 top-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#0d0d0d] text-white lg:hidden"
      >
        <Menu size={20} />
      </button>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-white/10 bg-[#0d0d0d]">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/70 hover:text-white"
            >
              <X size={18} />
            </button>
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="lg:pl-64">
        <div className="px-5 pb-24 pt-24 sm:px-8 lg:px-10 lg:pt-10">
          {children}
        </div>
      </main>
    </div>
  );
}
