import { Navigate, useLocation } from "react-router-dom";

import Spinner from "./ui/Spinner";
import { useAdminAuth } from "../context/AdminAuthContext";
import { canManagePeople, hasCapability } from "../utils/staffRole";

/**
 * Route guard for staff-only screens.
 *
 * Two checks, in order:
 *
 *   1. Is this a staff session at all? A customer or an anonymous
 *      visitor is sent to the staff sign-in, because nothing on the
 *      other side is theirs to see.
 *
 *   2. May this account be on this particular screen? The nav already
 *      hides a section the account has no capability for, so without
 *      this a staff member who bookmarked or typed a URL would land on
 *      a screen that renders and then 403s every request it makes.
 *      They are sent to the overview instead, which is scoped to what
 *      they can see.
 *
 * The people screens — user management, team access, the activity
 * trail — are checked by role rather than capability, matching the
 * API. They hand out power, so "which permissions does this person
 * hold" cannot be the thing that decides who may change them.
 *
 * Customer-facing booking and payment routes are deliberately NOT
 * wrapped in this - they must stay open to anonymous visitors.
 */
export default function RequireAdmin({ children, capability, peopleOnly = false }) {
  const { account, isAuthenticated, isChecking } = useAdminAuth();
  const location = useLocation();

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090909]">
        <Spinner label="Checking your session..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
    );
  }

  const allowed = peopleOnly
    ? canManagePeople(account)
    : !capability || hasCapability(account, capability);

  if (!allowed) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}
