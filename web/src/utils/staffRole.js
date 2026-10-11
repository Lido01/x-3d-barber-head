/**
 * Staff roles and capabilities.
 *
 * The backend is the authority: the session it returns already carries
 * the account's *effective* capabilities, and an owner or administrator
 * holds all of them whether or not they are listed on the record. So
 * the checks here are about two things only - reading a role for a
 * label, and knowing who counts as unlimited - rather than
 * reimplementing the permission rules and drifting from them.
 */

const ROLE_LABELS = {
  owner: "Owner",
  admin: "Administrator",
  reception: "Reception",
  staff: "Staff",
  customer: "Customer",
};

/** Roles that hold every capability without it being listed. */
const UNLIMITED_ROLES = ["owner", "admin"];

/**
 * Every capability the API accepts, in the order the console shows
 * them. Mirrors CAPABILITY_CATALOG in apps/accounts/permissions.py -
 * the API rejects anything not on its own list, so a capability
 * missing here would be one no admin could ever grant.
 *
 * The customer capabilities are three rather than one on purpose.
 * Reading a customer's number to answer the phone, correcting it, and
 * destroying the account are three different amounts of trust, and a
 * shop should be able to hand out the first two without the third.
 */
export const CAPABILITIES = [
  { value: "bookings.view", label: "View bookings" },
  { value: "bookings.manage", label: "Manage bookings" },
  { value: "payments.view", label: "View payments" },
  { value: "payments.verify", label: "Verify payments" },
  { value: "customers.view", label: "View customers" },
  { value: "customers.manage", label: "Edit & add customers" },
  { value: "customers.delete", label: "Delete customer accounts" },
  { value: "services.manage", label: "Manage services & barbers" },
  { value: "gallery.manage", label: "Manage gallery" },
  { value: "reviews.moderate", label: "Moderate reviews" },
  { value: "settings.manage", label: "Change shop settings" },
  { value: "ai.manage", label: "Manage AI assistant" },
];

/** Roles an administrator can assign from the console. */
export const ASSIGNABLE_ROLES = [
  { value: "customer", label: "Customer" },
  { value: "reception", label: "Reception" },
  { value: "staff", label: "Staff" },
  { value: "admin", label: "Administrator" },
];

export function staffRoleLabel(role) {
  return ROLE_LABELS[role] || "Staff";
}

export function staffDashboardPath(role) {
  return `/admin/dashboard/${role || "staff"}`;
}

/** True for the owner and any administrator. */
export function isUnlimited(account) {
  if (!account) {
    return false;
  }

  return (
    UNLIMITED_ROLES.includes(account.staff_role) ||
    account.is_unlimited === true ||
    account.permissions?.includes("*")
  );
}

/**
 * Whether an account holds a capability.
 *
 * Unlimited accounts pass without consulting the list, which is what
 * makes an administrator able to reach every screen.
 */
export function hasCapability(account, capability) {
  if (!account || !capability) {
    return false;
  }

  return isUnlimited(account) || account.permissions?.includes(capability);
}

/**
 * Whether an account may reach the people-management screens.
 *
 * These are gated on role rather than capability: user management,
 * team access and the activity trail are the screens that hand out
 * power, so "which capabilities does this person hold" is exactly the
 * question they must not be asked.
 */
export function canManagePeople(account) {
  return UNLIMITED_ROLES.includes(account?.staff_role);
}
