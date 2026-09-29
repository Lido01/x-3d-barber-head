import {
  CreditCard,
  Images,
  LayoutDashboard,
  MessageSquareQuote,
  Scissors,
  UserRound,
  Users,
  ShieldCheck,
  ClipboardList,
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
  { label: "Bookings", to: "/admin/bookings", icon: Users, capability: "bookings.view" },
  { label: "Customers", to: "/admin/customers", icon: UserRound, capability: "customers.view" },
  { label: "Users", to: "/admin/users", icon: Users, peopleOnly: true },
  { label: "Team", to: "/admin/team", icon: ShieldCheck, peopleOnly: true },
  { label: "Activity", to: "/admin/activity", icon: ClipboardList, peopleOnly: true },
  { label: "Payments", to: "/admin/payments", icon: CreditCard, capability: "payments.view" },
  { label: "Services", to: "/admin/services", icon: Scissors, capability: "services.manage" },
  { label: "Gallery", to: "/admin/gallery", icon: Images, capability: "gallery.manage" },
  {
    label: "Reviews",
    to: "/admin/testimonials",
    icon: MessageSquareQuote, capability: "reviews.moderate",
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

/** Which section a pathname belongs to. */
export function activeAdminSection(pathname) {
  return ADMIN_NAV.find((item) =>
    item.end
      ? pathname === item.to
      : pathname.startsWith(item.to)
  );
}
