import { useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  LogOut,
  Menu,
  Scissors,
  Settings,
  UserRound,
  X,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import { ThemeToggle } from "./AdminUi";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { visibleAdminNav, activeAdminSection } from "./adminNav";
import { staffRoleLabel } from "../../utils/staffRole";

/**
 * Staff console shell.
 *
 * Two navigation surfaces, because a phone and a desktop want different
 * things:
 *
 *   >= lg   fixed sidebar, always visible
 *   < lg    a compact sticky header showing the current section, and a
 *           bottom sheet holding every section plus the account actions
 *
 * The bottom tab bar that used to sit under both is gone. Ten sections
 * across a 360px screen is 36px per tab, which is below what a thumb can
 * hit reliably, and "Users" next to "Admins" is not a distinction anyone
 * can make at that size. It also permanently ate the bottom of every
 * phone screen, which is where the last card of a list lives.
 *
 * The drawer replaces it properly: it opens under the thumb, shows every
 * section with its label, and holds nothing that is only reachable from
 * there.
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
    <div className="flex items-center gap-3 px-4 py-4 sm:px-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-console-accent text-console-on-accent">
        <Scissors size={17} />
      </span>

      <div className="min-w-0 leading-none">
        <p className="font-serif text-base font-bold tracking-[0.12em] text-console-ink">
          NOIR
        </p>
        <p className="mt-1 text-[8px] font-semibold uppercase tracking-[0.25em] text-console-accent">
          {staffRoleLabel(account?.staff_role)} console
        </p>
      </div>
    </div>
  );

  const visibleNav = visibleAdminNav(account);

  /** Sections, with a leading rule marking the active one. */
  const navLinks = (onNavigate) => (
    <nav aria-label="Admin sections" className="space-y-0.5 px-3">
      {visibleNav.map((item) => {
        const Icon = item.icon;

        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex min-h-12 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "bg-console-accent-soft font-semibold text-console-accent-strong"
                  : "text-console-body hover:bg-console-sunken hover:text-console-ink"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`h-5 w-1 shrink-0 rounded-full transition ${
                    isActive ? "bg-console-accent" : "bg-transparent"
                  }`}
                />
                <Icon size={17} className="shrink-0" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );

  /**
   * Settings sits outside the capability-filtered section list, so it is
   * its own link. It is readable by any staff account - a receptionist
   * looking up the address is not asking for anything privileged - and
   * the screen itself decides what may be edited.
   */
  const settingsLink = (onNavigate) => (
    <nav aria-label="Console settings" className="mt-1 space-y-0.5 px-3">
      <NavLink
        to="/admin/settings"
        onClick={onNavigate}
        className={({ isActive }) =>
          `flex min-h-12 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
            isActive
              ? "bg-console-accent-soft font-semibold text-console-accent-strong"
              : "text-console-body hover:bg-console-sunken hover:text-console-ink"
          }`
        }
      >
        {({ isActive }) => (
          <>
            <span
              className={`h-5 w-1 shrink-0 rounded-full ${
                isActive ? "bg-console-accent" : "bg-transparent"
              }`}
            />
            <Settings size={17} className="shrink-0" />
            Settings
          </>
        )}
      </NavLink>
    </nav>
  );

  const accountBlock = (
    <div className="space-y-1 border-t border-console-line px-3 py-3">
      <NavLink
        to="/admin/profile"
        className="block rounded-xl bg-console-sunken px-3.5 py-2.5 transition hover:bg-console-line"
      >
        <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-console-muted">
          Signed in
        </p>

        <span className="mt-0.5 flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-sm font-medium text-console-ink">
            {account?.username || "Team member"}
          </span>

          {/* The way to your own details and your password. In the block
              rather than in the section list above because it is not a
              section of the shop - it is the person looking at it. */}
          <UserRound size={15} className="shrink-0 text-console-accent" />
        </span>
      </NavLink>

      <button
        type="button"
        onClick={() => navigate("/")}
        className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium text-console-body transition hover:bg-console-sunken hover:text-console-ink"
      >
        <ExternalLink size={17} />
        Back to website
      </button>

      <button
        type="button"
        onClick={handleSignOut}
        className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-console-body transition hover:bg-console-bad-soft hover:text-console-bad"
      >
        <LogOut size={17} />
        Sign out
      </button>
    </div>
  );

  return (
    <div className="min-h-[var(--viewport-height)] bg-console text-console-ink">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col overflow-y-auto border-r border-console-line bg-console-raised lg:flex">
        {brand}

        <p className="px-6 pb-2 pt-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-console-faint">
          Manage shop
        </p>

        {navLinks()}

        <div className="flex-1" />

        {/* A desktop has room for the theme switch and settings in the
            bar, so on a phone they only exist in the drawer. */}
        <div className="border-t border-console-line pt-2">
          {settingsLink()}
        </div>

        {accountBlock}
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-console-line bg-console-raised/95 px-3 backdrop-blur sm:px-4 lg:hidden">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open admin menu"
          aria-expanded={drawerOpen}
          aria-controls="admin-navigation-drawer"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-console-line text-console-body transition hover:border-console-accent hover:text-console-accent-strong"
        >
          <Menu size={19} />
        </button>

        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-[9px] font-semibold uppercase tracking-[0.2em] text-console-accent">
            {staffRoleLabel(account?.staff_role)}
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-console-ink">
            {currentItem?.label || "Overview"}
          </p>
        </div>

        {/* Your own details and password, one tap away rather than three
            taps into the drawer. On a phone that matters, because the
            console is mostly used on one. */}
        <NavLink
          to="/admin/profile"
          aria-label="Your profile"
          title="Your profile"
          className={({ isActive }) =>
            `flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${
              isActive
                ? "border-console-accent text-console-accent-strong"
                : "border-console-line text-console-body hover:border-console-accent hover:text-console-accent-strong"
            }`
          }
        >
          <UserRound size={17} />
        </NavLink>

        <ThemeToggle compact />
      </header>

      {/* Mobile drawer - a bottom sheet, so it opens under the thumb
          rather than across the top of the screen. */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close admin menu"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-console-ink/40"
          />

          <aside
            id="admin-navigation-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Admin navigation"
            className="absolute inset-x-0 bottom-0 flex max-h-[85svh] flex-col overflow-hidden rounded-t-2xl border-t border-console-line bg-console-raised pb-[env(safe-area-inset-bottom)] shadow-2xl"
          >
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close admin menu"
              className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-xl border border-console-line text-console-body transition hover:border-console-accent hover:text-console-accent-strong"
            >
              <X size={18} />
            </button>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
              {brand}

              <p className="px-6 pb-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-console-faint">
                Manage shop
              </p>

              {navLinks(() => setDrawerOpen(false))}

              <div className="mt-1 border-t border-console-line pt-2">
                {settingsLink(() => setDrawerOpen(false))}
              </div>

              {accountBlock}
            </div>
          </aside>
        </div>
      )}

      {/* Content. No bottom bar to clear any more, so the last card of a
          list is reachable with a plain bottom margin.
          A <div>, not a <main>: App.jsx already renders the page's single
          <main id="main-content"> landmark around every route, and nesting
          a second one is invalid - screen readers announce the landmark
          list with a duplicate and no way to tell them apart. */}
      <div className="lg:pl-64">
        <div className="mx-auto w-full max-w-[1500px] px-4 pb-10 pt-5 sm:px-6 sm:pt-7 lg:px-8 lg:pb-12">
          {children}
        </div>
      </div>
    </div>
  );
}
