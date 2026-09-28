import {
  CreditCard,
  Images,
  LayoutDashboard,
  MessageSquareQuote,
  Scissors,
  UserRound,
  Users,
} from "lucide-react";

/**
 * The staff console's section list.
 *
 * One source for three surfaces - the desktop sidebar, the mobile drawer
 * and the mobile tab bar - so a new admin screen cannot appear in one
 * and be missing from another. `end` marks the routes that must match
 * exactly, otherwise `/admin` would stay highlighted on every child.
 */
export const ADMIN_NAV = [
  { label: "Overview", to: "/admin", icon: LayoutDashboard, end: true },
  { label: "Bookings", to: "/admin/bookings", icon: Users },
  { label: "Customers", to: "/admin/customers", icon: UserRound },
  { label: "Payments", to: "/admin/payments", icon: CreditCard },
  { label: "Services", to: "/admin/services", icon: Scissors },
  { label: "Gallery", to: "/admin/gallery", icon: Images },
  {
    label: "Reviews",
    to: "/admin/testimonials",
    icon: MessageSquareQuote,
  },
];

/** Which section a pathname belongs to. */
export function activeAdminSection(pathname) {
  return ADMIN_NAV.find((item) =>
    item.end
      ? pathname === item.to
      : pathname.startsWith(item.to)
  );
}
