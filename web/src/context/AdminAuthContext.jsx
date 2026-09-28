import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { getCurrentAccount, login as loginRequest } from "../services/authApi";
import { listBookings } from "../services/bookingApi";
import { adminTokens } from "../utils/tokenStore";

/**
 * Admin/staff session for the payment verification screen.
 *
 * Customers never enter this context - the public booking and payment
 * flow sends no credentials at all.
 *
 * Staff-ness is not in the login response (AccountSerializer returns
 * id/username/email/name/phone, no is_staff), so it is confirmed
 * against an endpoint that actually requires IsAdminUser. That keeps a
 * non-staff account from reaching a screen where every action 403s.
 */

const AdminAuthContext = createContext(null);

async function hasStaffAccess() {
  try {
    await listBookings();
    return true;
  } catch (error) {
    if (error?.status === 401 || error?.status === 403) {
      return false;
    }

    // Network or server trouble: don't claim the account is invalid.
    throw error;
  }
}

export function AdminAuthProvider({ children }) {
  const [account, setAccount] = useState(null);

  // "checking" until a stored token has been validated.
  const [status, setStatus] = useState(() =>
    adminTokens.getAccessToken() ? "checking" : "anonymous"
  );

  // Revalidate a token left in sessionStorage after a refresh.
  useEffect(() => {
    if (status !== "checking") {
      return;
    }

    let active = true;

    getCurrentAccount()
      .then((data) => {
        if (active) {
          setAccount(data);
          setStatus("authenticated");
        }
      })
      .catch(() => {
        if (active) {
          adminTokens.clearTokens();
          setAccount(null);
          setStatus("anonymous");
        }
      });

    return () => {
      active = false;
    };
  }, [status]);

  const signIn = useCallback(async ({ username, password }) => {
    const data = await loginRequest({ username, password });

    adminTokens.setTokens({
      access: data.access,
      refresh: data.refresh,
    });

    const staff = await hasStaffAccess();

    if (!staff) {
      adminTokens.clearTokens();

      throw {
        status: 403,
        message:
          "This account does not have staff access. Ask an administrator to grant it.",
        fieldErrors: {},
        isNetwork: false,
        isServer: false,
      };
    }

    setAccount(data.user || null);
    setStatus("authenticated");

    return data;
  }, []);

  const signOut = useCallback(() => {
    adminTokens.clearTokens();
    setAccount(null);
    setStatus("anonymous");
  }, []);

  const value = useMemo(
    () => ({
      account,
      status,
      isAuthenticated: status === "authenticated",
      isChecking: status === "checking",
      signIn,
      signOut,
    }),
    [account, status, signIn, signOut]
  );

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);

  if (!context) {
    throw new Error("useAdminAuth must be used inside <AdminAuthProvider>");
  }

  return context;
}
