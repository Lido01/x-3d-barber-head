import { useEffect, useRef, useState } from "react";
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
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import { useAdminAuth } from "../../context/AdminAuthContext";

const NAV = [
  { label: "Overview", to: "/admin", icon: LayoutDashboard, end: true },
  { label: "Bookings", to: "/admin/bookings", icon: Users },
  { label: "Payments", to: "/admin/payments", icon: CreditCard },
  { label: "Services", to: "/admin/services", icon: Scissors },
  { label: "Gallery", to: "/admin/gallery", icon: Images },
  { label: "Testimonials", to: "/admin/testimonials", icon: MessageSquareQuote },
];

export default function AdminLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { account, signOut } = useAdminAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const closeButtonRef = useRef(null);
  const currentItem = NAV.find((item) =>
    item.end
      ? location.pathname === item.to
      : location.pathname.startsWith(item.to)
  );

  useEffect(() => {
    if (!drawerOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setDrawerOpen(false);
      }
    };
    const previousOverflow = document.body.style.overflow;
    const menuButton = menuButtonRef.current;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      menuButton?.focus();
    };
  }, [drawerOpen]);

  const handleSignOut = () => {
    signOut();
    navigate("/admin/login", { replace: true });
  };

  const sidebarContent = (
    <nav className="flex min-h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-6 sm:px-6">
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

      <div className="mt-5 flex-1 space-y-1 px-4">
        <p className="px-3 pb-2 text-[9px] uppercase tracking-[0.25em] text-white/25">
          Manage shop
        </p>
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
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 overflow-y-auto border-r border-white/10 bg-[#0d0d0d] lg:block">
        {sidebarContent}
      </aside>

      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/10 bg-[#0d0d0d]/95 px-4 backdrop-blur sm:px-6 lg:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open admin menu"
            aria-expanded={drawerOpen}
            aria-controls="admin-navigation-drawer"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white/75 transition hover:border-[#d6a85f]/40 hover:text-white"
          >
            <Menu size={19} />
          </button>
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-[0.25em] text-[#d6a85f]">
              Admin workspace
            </p>
            <p className="mt-1 truncate text-sm font-medium text-white">
              {currentItem?.label || "Overview"}
            </p>
          </div>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-xs font-semibold text-[#d6a85f]">
          {(account?.username || "N").charAt(0).toUpperCase()}
        </div>
      </header>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close admin menu"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/75"
          />
          <aside
            id="admin-navigation-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Admin navigation"
            className="absolute inset-y-0 left-0 flex w-[min(86vw,20rem)] flex-col overflow-hidden border-r border-white/10 bg-[#0d0d0d] shadow-2xl"
          >
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close admin menu"
              className="absolute right-3 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-white/70 transition hover:border-[#d6a85f]/40 hover:text-white"
            >
              <X size={18} />
            </button>
            <div className="min-h-0 flex-1 overflow-y-auto">{sidebarContent}</div>
          </aside>
        </div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto max-w-[1600px] px-4 pb-24 pt-6 sm:px-6 sm:pt-8 lg:px-10 lg:pt-10">
          {children}
        </div>
      </main>
    </div>
  );
}
