import axios from "axios";

import { normaliseApiError } from "../utils/apiError";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "../utils/adminToken";


const ROOT = (
  import.meta.env.VITE_API_BASE_URL || "http://10.240.41.114"
).replace(/\/+$/, "");

/** Absolute root of the Django server, e.g. for media URLs. */
export const API_ROOT = ROOT;

const api = axios.create({
  baseURL: `${ROOT}/api`,
  timeout: 20000,

  // Accept is safe to pin. Content-Type is deliberately NOT set:
  // Axios picks application/json for plain objects and lets the
  // browser attach the multipart boundary for FormData uploads.
  headers: {
    Accept: "application/json",
  },
});

// -----------------------------------------------------------------
// REQUEST: attach admin credentials only where they are required
// -----------------------------------------------------------------

api.interceptors.request.use((config) => {
  if (config.requiresAuth) {
    const token = getAccessToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  return config;
});

// -----------------------------------------------------------------
// RESPONSE: refresh an expired admin token once, then normalise
// -----------------------------------------------------------------

let refreshInFlight = null;

async function refreshAccessToken() {
  const refresh = getRefreshToken();

  if (!refresh) {
    return null;
  }

  // Collapse parallel 401s into a single refresh request.
  refreshInFlight =
    refreshInFlight ||
    axios
      .post(`${ROOT}/api/accounts/token/refresh/`, { refresh })
      .then((response) => {
        const access = response.data?.access;

        if (access) {
          setTokens({ access });
        }

        return access || null;
      })
      .catch(() => {
        clearTokens();
        return null;
      })
      .finally(() => {
        refreshInFlight = null;
      });

  return refreshInFlight;
}

api.interceptors.response.use(
  (response) => response,

  async (error) => {
    const config = error.config || {};

    const canRetry =
      error.response?.status === 401 &&
      config.requiresAuth &&
      !config.__retried &&
      getRefreshToken();

    if (canRetry) {
      const access = await refreshAccessToken();

      if (access) {
        config.__retried = true;
        return api(config);
      }

      clearTokens();
    }

    return Promise.reject(normaliseApiError(error));
  }
);

/**
 * Resolve a media path returned by Django (`/media/...`) into an
 * absolute URL. Already-absolute URLs pass through untouched.
 */
export function mediaUrl(path) {
  if (!path) {
    return null;
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${ROOT}${path.startsWith("/") ? "" : "/"}${path}`;
}

export default api;
