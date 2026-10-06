import {
  CalendarCheck,
  CreditCard,
  Images,
  LayoutDashboard,
  MessageCircleQuestion,
  MessageSquareQuote,
  Scissors,
  UserRound,
  UserCog,
  ShieldCheck,
  ClipboardList,
  BarChart3,
} from "lucide-react";

import { canManagePeople, hasCapability } from "../../utils/staffRole";

/**
 * The staff console's section list.
 *
 * One source for three surfaces - the desktop sidebar, the mobile drawer
 * and the mobile tab bar - so a new admin screen cannot appear in one
 * and be missing from another. `end` marks the routes that must match
 * exactly, otherwise `/admin` would stay highlighted on every child.
 *
 * Every icon is distinct. Bookings and Users used to share one, which
 * is invisible on a desktop sidebar and actively misleading in a tab
 * bar where the person is recognising shapes rather than reading labels.
 *
 * Two kinds of gate, and the difference matters:
 *
 *   capability  this section is about a job - payments, bookings,
 *               reviews. A receptionist who cannot verify payments
 *               does not see the payments screen.
 *
 *   peopleOnly  this section hands out power - user management, team
 *               access, the activity trail. Gating those on a
 *               capability would ask "what may this person do?" to
 *               decide who may change what people can do, so they are
 *               gated on role instead: the owner and administrators.
 */
export const ADMIN_NAV = [
  { label: "Overview", to: "/admin", icon: LayoutDashboard, end: true },
  {
    label: "Bookings",
    to: "/admin/bookings",
    icon: CalendarCheck,
    capability: "bookings.view",
  },
  {
    label: "Customers",
    to: "/admin/customers",
    icon: UserRound,
    capability: "customers.view",
  },
  { label: "Users", to: "/admin/users", icon: UserCog, peopleOnly: true },
  { label: "Team", to: "/admin/team", icon: ShieldCheck, peopleOnly: true },
  { label: "Activity", to: "/admin/activity", icon: ClipboardList, peopleOnly: true },
  {
    label: "Payments",
    to: "/admin/payments",
    icon: CreditCard,
    capability: "payments.view",
  },
  {
    label: "Services",
    to: "/admin/services",
    icon: Scissors,
    capability: "services.manage",
  },
  {
    label: "Gallery",
    to: "/admin/gallery",
    icon: Images,
    capability: "gallery.manage",
  },
  {
    label: "Reviews",
    to: "/admin/testimonials",
    icon: MessageSquareQuote,
    capability: "reviews.moderate",
  },
  {
    label: "Quick answers",
    to: "/admin/quick-answers",
    icon: MessageCircleQuestion,
    capability: "ai.manage",
  },
  /*
   * Reports is gated on `payments.view` rather than on people management.
   *
   * A report is mostly money and volume, and the dashboard endpoint scopes
   * itself to the caller, so the screen itself works for any account that
   * may see revenue - a receptionist gets the volume figures and no money
   * ones. Gating it on people management instead would have hidden it from
   * exactly the person most likely to want to know how busy the week is.
   * The whole-shop half is a separate problem and is dealt with inside the
   * screen, which only requests it from an owner or administrator.
   */
  {
    label: "Reports",
    to: "/admin/reports",
    icon: BarChart3,
    capability: "payments.view",
  },
];

/** The sections one account is allowed to see. */
export function visibleAdminNav(account) {
  return ADMIN_NAV.filter((item) => {
    if (item.peopleOnly) {
      return canManagePeople(account);
    }

    if (item.capability) {
      return hasCapability(account, item.capability);
    }

    return true;
  });
}

/**
 * The console's screens that are not capability-filtered sections.
 *
 * Settings and your own profile are reachable by every staff account and
 * are not "a job", so they stay out of the section list — but they still
 * need a name in the mobile header, which reads the active route to say
 * where you are. Without this they were announced as "Overview", which is
 * how a barber ends up on their own profile page believing they had been
 * sent to the dashboard.
 */
const STANDALONE_ROUTES = [
  { label: "Settings", to: "/admin/settings" },
  { label: "Profile", to: "/admin/profile" },
];

/** Which section a pathname belongs to, or which standalone screen. */
export function activeAdminSection(pathname) {
  return (
    ADMIN_NAV.find((item) =>
      item.end
        ? pathname === item.to
        : pathname.startsWith(item.to)
    ) ||
    STANDALONE_ROUTES.find((item) => pathname.startsWith(item.to)) ||
    null
  );
}
