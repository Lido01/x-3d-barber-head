import { Navigate, useLocation } from "react-router-dom";

import Spinner from "./ui/Spinner";
import { useCustomerAuth } from "../context/CustomerAuthContext";

/**
 * Gate for screens that need a customer session.
 *
 * Sends a signed-out visitor to /login carrying the path they wanted in
 * router state, so signing in returns them there instead of dumping
 * them on the homepage. While a stored token is being revalidated it
 * shows a spinner rather than bouncing to the login screen and back,
 * which on a phone reads as the app flashing and losing your place.
 */
export default function RequireCustomer({ children }) {
  const location = useLocation();
  const { isAuthenticated, isChecking } = useCustomerAuth();

  if (isChecking) {
    return (
      <div className="flex min-h-[var(--viewport-height)] items-center justify-center bg-[#090909]">
        <Spinner label="Checking your session..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return children;
}
