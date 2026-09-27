import { useEffect, useRef, useState } from "react";
import { ExternalLink, LogOut, Menu, Scissors, X } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import { useAdminAuth } from "../../context/AdminAuthContext";
import { ADMIN_NAV, activeAdminSection } from "./adminNav";

/**
 * Staff console shell.
 *
 * Three navigation surfaces, because a phone and a desktop want
 * different things:
 *
 *   >= lg   fixed 256px sidebar, always visible
 *   < lg    a compact sticky header showing the current section, plus a
 *           fixed bottom tab bar with all six sections one thumb-reach
 *           away, plus a drawer for the account and sign-out actions
 *
 * The bottom tab bar is the reason a phone admin can actually work a
 * shift: hopping between payments, bookings and reviews is one tap
 * instead of opening a menu first. The drawer keeps the two rare
 * actions (back to site, sign out) out of the tab bar, where they would
 * crowd out a section.
 *
 * Body scroll is locked while the drawer is open, Escape closes it, and
 * focus moves to the close button and returns to the trigger - a modal
 * the keyboard can escape from should not trap it either.
 */
export default function AdminLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { account, signOut } = useAdminAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const closeButtonRef = useRef(null);

  const currentItem = activeAdminSection(location.pathname);

  // Close the drawer whenever the route changes, so a link tapped
  // inside it does not leave it hanging over the new screen.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

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

  const brand = (
    <div className="flex items-center gap-3 px-4 py-5 sm:px-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#181818]">
        <Scissors size={16} className="text-[#d6a85f]" />
      </span>

      <div className="leading-none">
        <p className="font-serif text-base font-bold tracking-[0.12em] text-white">
          NOIR
        </p>
        <p className="mt-1 text-[8px] tracking-[0.3em] text-[#d6a85f]">
          STAFF CONSOLE
        </p>
      </div>
    </div>
  );

  const sidebarLinks = (
    <div className="space-y-1 px-3">
      {ADMIN_NAV.map((item) => {
        const Icon = item.icon;

        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition ${
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
  );

  const accountBlock = (
    <div className="space-y-2 border-t border-white/10 px-3 py-4">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <p className="text-[9px] uppercase tracking-[0.25em] text-white/35">
          Signed in
        </p>
        <p className="mt-1 truncate text-sm font-medium text-white">
          {account?.username || "Team member"}
        </p>
      </div>

      <button
        type="button"
        onClick={() => navigate("/")}
        className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-medium text-white/55 transition hover:bg-white/[0.05] hover:text-white"
      >
        <ExternalLink size={17} />
        Back to website
      </button>

      <button
        type="button"
        onClick={handleSignOut}
        className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium text-white/55 transition hover:bg-[#e05a4f]/10 hover:text-[#e0776b]"
      >
        <LogOut size={17} />
        Sign out
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#090909]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col overflow-y-auto border-r border-white/10 bg-[#0d0d0d] lg:flex">
        {brand}

        <p className="px-6 pb-2 text-[9px] uppercase tracking-[0.25em] text-white/25">
          Manage shop
        </p>

        {sidebarLinks}

        <div className="flex-1" />

        {accountBlock}
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-white/10 bg-[#0d0d0d]/95 px-3 backdrop-blur sm:px-4 lg:hidden">
        <div className="flex min-w-0 items-center gap-2">
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
            <p className="truncate text-[9px] uppercase tracking-[0.25em] text-[#d6a85f]">
              Staff
            </p>
            <p className="mt-0.5 truncate text-sm font-medium text-white">
              {currentItem?.label || "Overview"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open admin menu"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-xs font-semibold text-[#d6a85f]"
        >
          {(account?.username || "N").charAt(0).toUpperCase()}
        </button>
      </header>

      {/* Mobile drawer - a bottom sheet, so it opens under the thumb
          rather than across the top of the screen. */}
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
            className="absolute inset-x-0 bottom-0 flex max-h-[85svh] flex-col overflow-hidden rounded-t-3xl border-t border-white/10 bg-[#0d0d0d] pb-[env(safe-area-inset-bottom)] shadow-2xl"
          >
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close admin menu"
              className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-white/70 transition hover:border-[#d6a85f]/40 hover:text-white"
            >
              <X size={18} />
            </button>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {brand}

              <p className="px-6 pb-2 text-[9px] uppercase tracking-[0.25em] text-white/25">
                Manage shop
              </p>

              {sidebarLinks}

              {accountBlock}
            </div>
          </aside>
        </div>
      )}

      {/* Content. pb clears the fixed tab bar on a phone. */}
      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-[1600px] px-4 pb-28 pt-5 sm:px-6 sm:pt-8 lg:px-10 lg:pb-16 lg:pt-10">
          {children}
        </div>
      </main>

      {/* Mobile tab bar */}
      <nav
        aria-label="Admin sections"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0d0d0d]/97 backdrop-blur-xl lg:hidden"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <ul className="no-scrollbar flex overflow-x-auto">
          {ADMIN_NAV.map((item) => {
            const Icon = item.icon;

            return (
              <li key={item.to} className="min-w-0 flex-1">
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex min-h-14 min-w-16 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-medium transition-colors ${
                      isActive
                        ? "text-[#d6a85f]"
                        : "text-white/45 active:text-white/80"
                    }`
                  }
                >
                  <Icon size={18} />
                  <span className="max-w-full truncate">
                    {item.label}
                  </span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
