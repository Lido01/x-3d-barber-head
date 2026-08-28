/**
 * Admin access token storage.
 *
 * Kept in sessionStorage so the tab-local admin session survives a
 * refresh but dies with the tab. Customers never touch this - the
 * public booking and payment flow sends no Authorization header.
 */

const ACCESS_KEY = "noir.admin.access";
const REFRESH_KEY = "noir.admin.refresh";

function read(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    // Private mode / storage disabled.
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

export function getAccessToken() {
  return read(ACCESS_KEY);
}

export function getRefreshToken() {
  return read(REFRESH_KEY);
}

export function setTokens({ access, refresh }) {
  write(ACCESS_KEY, access ?? null);

  if (refresh !== undefined) {
    write(REFRESH_KEY, refresh);
  }
}

export function clearTokens() {
  write(ACCESS_KEY, null);
  write(REFRESH_KEY, null);
}
