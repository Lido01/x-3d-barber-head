import { Navigate, useLocation } from "react-router-dom";

import Spinner from "./ui/Spinner";
import { useAdminAuth } from "../context/AdminAuthContext";

/**
 * Route guard for staff-only screens.
 *
 * Customer-facing booking and payment routes are deliberately NOT
 * wrapped in this - they must stay open to anonymous visitors.
 */
export default function RequireAdmin({ children }) {
  const { isAuthenticated, isChecking } = useAdminAuth();
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

  return children;
}
