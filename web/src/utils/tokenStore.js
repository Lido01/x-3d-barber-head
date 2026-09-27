/**
 * Token storage, namespaced per audience.
 *
 * The staff console and the customer account area are separate sessions
 * that happen to live in the same tab, so they get separate keys. A
 * staff member who is also a customer, or a shared shop tablet, must not
 * have signing in as one overwrite the other's tokens.
 *
 * sessionStorage, not localStorage: the session survives a refresh but
 * dies with the tab, which is what a phone browser user expects when
 * they switch apps and come back to a signed-in console.
 *
 * Every read and write is wrapped: Safari private mode and storage-
 * blocked WebViews throw on access, and losing the session is a far
 * better outcome than a blank screen.
 */

function createTokenStore(prefix) {
  const ACCESS_KEY = `noir.${prefix}.access`;
  const REFRESH_KEY = `noir.${prefix}.refresh`;

  function read(key) {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function write(key, value) {
    try {
      if (value) {
        sessionStorage.setItem(key, value);
      } else {
        sessionStorage.removeItem(key);
      }
    } catch {
      // Non-fatal: the session simply will not survive a refresh.
    }
  }

  return {
    getAccessToken() {
      return read(ACCESS_KEY);
    },

    getRefreshToken() {
      return read(REFRESH_KEY);
    },

    setTokens({ access, refresh }) {
      write(ACCESS_KEY, access ?? null);

      if (refresh !== undefined) {
        write(REFRESH_KEY, refresh);
      }
    },

    clearTokens() {
      write(ACCESS_KEY, null);
      write(REFRESH_KEY, null);
    },
  };
}

/** Staff console session. */
export const adminTokens = createTokenStore("admin");

/** Customer account session. */
export const customerTokens = createTokenStore("customer");

/**
 * Resolve the store for a request's `authScope`.
 *
 * `authScope: "customer"` reads and refreshes the customer session;
 * anything else falls back to the staff session, which keeps every
 * existing `requiresAuth: true` call on the admin API behaving exactly
 * as it did before the customer area existed.
 */
export function tokensForScope(authScope) {
  return authScope === "customer" ? customerTokens : adminTokens;
}
