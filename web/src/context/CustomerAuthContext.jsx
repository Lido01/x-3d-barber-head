import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getCurrentAccount,
  login as loginRequest,
  register as registerRequest,
} from "../services/authApi";
import { clearCache } from "../services/queryCache";
import { customerTokens } from "../utils/tokenStore";

/**
 * Customer session.
 *
 * Separate from AdminAuthContext on purpose: the two audiences hold
 * different tokens, and a customer signing in must never be handed the
 * staff console, nor a staff sign-out log them out of the storefront.
 *
 * Why a customer has an account at all: a review is attributed to a
 * real person, so submitting one needs a token. Everything else on the
 * site — browsing, booking, paying — stays open, and this context is
 * never required to render it.
 *
 * Unlike the staff sign-in there is no staff-access probe here. A
 * customer is any registered account, and /accounts/me/ is exactly the
 * endpoint that proves the token still works.
 */

const CustomerAuthContext = createContext(null);

export const CUSTOMER_SCOPE = "customer";

export function CustomerAuthProvider({ children }) {
  const [account, setAccount] = useState(null);

  // "checking" until a stored token has been validated.
  const [status, setStatus] = useState(() =>
    customerTokens.getAccessToken() ? "checking" : "anonymous"
  );

  // Revalidate a token left in sessionStorage after a refresh.
  useEffect(() => {
    if (status !== "checking") {
      return undefined;
    }

    let active = true;

    getCurrentAccount({ authScope: CUSTOMER_SCOPE })
      .then((data) => {
        if (active) {
          if (data.staff_role) {
            customerTokens.clearTokens();
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
          customerTokens.clearTokens();
          setAccount(null);
          setStatus("anonymous");
        }
      });

    return () => {
      active = false;
    };
  }, [status]);

  const adopt = useCallback((data) => {
    customerTokens.setTokens({
      access: data.access,
      refresh: data.refresh,
    });

    setAccount(data.user || null);
    setStatus("authenticated");

    return data;
  }, []);

  const signIn = useCallback(
    async ({ username, password }) => {
      const data = await loginRequest({
        username: username.trim(),
        password,
      });

      // if (data.user?.staff_role) {
      //   throw {
      //     status: 403,
      //     message: "This is a staff account. Please use the Staff & Owner sign-in.",
      //     fieldErrors: {},
      //     isNetwork: false,
      //     isServer: false,
      //     staffLogin: true,
      //   };
      // }

      return adopt(data);
    },
    [adopt]
  );

  /**
   * Create an account, then sign straight in.
   *
   * Register returns the account but no tokens, so the extra login
   * call is what makes the customer land on the review form already
   * signed in instead of being asked to type their password twice.
   */
  const signUp = useCallback(
    async ({ username, email, password, passwordConfirm, firstName, lastName, phone }) => {
      await registerRequest({
        username,
        email,
        password,
        passwordConfirm,
        firstName,
        lastName,
        phone,
      });

      return loginRequest({
        username: username.trim(),
        password,
      }).then(adopt);
    },
    [adopt]
  );

  const signOut = useCallback(() => {
    customerTokens.clearTokens();
    // Drops the cached "my reviews" list, which belongs to the account
    // that just left rather than to whoever signs in next.
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
      signUp,
      signOut,
    }),
    [account, status, signIn, signUp, signOut]
  );

  return (
    <CustomerAuthContext.Provider value={value}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext);

  if (!context) {
    throw new Error(
      "useCustomerAuth must be used inside <CustomerAuthProvider>"
    );
  }

  return context;
}

/**
 * The name to show for the signed-in customer.
 *
 * Registration only asks for a username, so most accounts have no real
 * name on them. Reviews fall back to the username server-side, and the
 * UI does the same rather than rendering a blank.
 */
export function customerDisplayName(account) {
  if (!account) {
    return "";
  }

  const fullName = `${account.first_name || ""} ${
    account.last_name || ""
  }`.trim();

  return fullName || account.username || "";
}
