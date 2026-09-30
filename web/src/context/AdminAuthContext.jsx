import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { getCurrentAccount, login as loginRequest } from "../services/authApi";
import { clearCache } from "../services/queryCache";
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
          if (!data.staff_role) {
            adminTokens.clearTokens();
            setAccount(null);
            setStatus("anonymous");
            return;
          }
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

    if (!data.user?.staff_role) {
      adminTokens.clearTokens();

      throw {
        status: 403,
        message:
          "This is a customer account. Use Customer sign-in, or ask the owner to grant staff access.",
        fieldErrors: {},
        isNetwork: false,
        isServer: false,
      };
    }

    // Anything cached during a previous session was fetched with the
    // previous account's permissions. Starting clean here is what stops
    // a second barber signing in on a shared machine from seeing a
    // screen the first one was allowed to open.
    clearCache();

    setAccount(data.user);
    setStatus("authenticated");

    return data;
  }, []);

  const signOut = useCallback(() => {
    adminTokens.clearTokens();
    clearCache();
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
