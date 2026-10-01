/**
 * Normalises every error shape the Django/DRF API can return into
 * one predictable object, so components never have to guess.
 *
 * DRF speaks in several dialects:
 *
 *   { "booking_date": ["Booking dates in the past are not allowed."] }
 *   { "detail": "Authentication credentials were not provided." }
 *   { "non_field_errors": ["..."] }
 *   { "amount": "Must be greater than zero." }
 *   [ "Something went wrong." ]
 *   "<!DOCTYPE html> ..."            (unhandled 500)
 *
 * And one of its keys is not an error at all. `availability` is a
 * structured description of *why* a slot is unavailable - which situation
 * it is, and what to try instead - travelling beside the field message.
 * It is pulled out into `reason` rather than being lumped in with the
 * field errors, because a component needs to branch on it: an offer of
 * the next free times is a different thing to render than "the barber is
 * busy then, try 11:30".
 */

/** Field names that carry a general message rather than a field error. */
const GENERAL_KEYS = [
  "detail",
  "non_field_errors",
  "error",
  "errors",
  "message",
];

/**
 * Keys that describe a situation rather than complaining about a value.
 *
 * Split out so they cannot end up rendered as "availability: {...}".
 */
const REASON_KEYS = ["availability"];

const STATUS_MESSAGES = {
  400: "Please check the highlighted fields and try again.",
  401: "Your session has expired. Please sign in again.",
  403: "You do not have permission to do this.",
  404: "We could not find what you were looking for.",
  409: "That slot was just taken. Please pick another time.",
  429: "Too many attempts. Please wait a moment and try again.",
  500: "The server ran into an error. Please try again shortly.",
  502: "The server is unreachable right now. Please try again shortly.",
  503: "The server is temporarily unavailable. Please try again shortly.",
};

/** Flatten ["a", "b"] / "a" / {x: "a"} down to a single readable string. */
function toMessage(value) {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(toMessage).filter(Boolean).join(" ");
  }

  if (typeof value === "object") {
    return Object.values(value).map(toMessage).filter(Boolean).join(" ");
  }

  return String(value);
}

/**
 * @typedef  {object} ApiError
 * @property {number|null} status       HTTP status, null when the request never landed.
 * @property {string}      message      Sentence safe to show to a customer.
 * @property {object}      fieldErrors  { fieldName: "message" } for inline display.
 * @property {object|null} reason       Structured explanation, when the API sent one.
 * @property {boolean}     isNetwork    Server unreachable / CORS / offline.
 * @property {boolean}     isServer     5xx.
 * @property {*}           data         Raw response body, for logging.
 */

/** @returns {ApiError} */
export function normaliseApiError(error) {
  // --- request never reached the server -------------------------
  if (!error?.response) {
    const cancelled =
      error?.code === "ERR_CANCELED" || error?.name === "CanceledError";

    return {
      status: null,
      message: cancelled
        ? "Request cancelled."
        : "Cannot reach the server. Check that the backend is running and that this origin is allowed by CORS.",
      fieldErrors: {},
      reason: null,
      isNetwork: !cancelled,
      isServer: false,
      isCancelled: cancelled,
      data: null,
    };
  }

  const { status, data } = error.response;
  const fieldErrors = {};
  const generalParts = [];
  let reason = null;

  if (data && typeof data === "object" && !Array.isArray(data)) {
    for (const [key, value] of Object.entries(data)) {
      if (REASON_KEYS.includes(key)) {
        reason = value && typeof value === "object" ? value : null;
      } else if (GENERAL_KEYS.includes(key)) {
        generalParts.push(toMessage(value));
      } else {
        const message = toMessage(value);

        if (message) {
          fieldErrors[key] = message;
        }
      }
    }
  } else if (Array.isArray(data)) {
    generalParts.push(toMessage(data));
  } else if (typeof data === "string" && !data.trim().startsWith("<")) {
    // Ignore HTML error pages - they are never customer-readable.
    generalParts.push(data);
  }

  // Prefer the backend's own words; fall back to a status sentence.
  let message = generalParts.filter(Boolean).join(" ").trim();

  if (!message) {
    // A structured reason carries a sentence written for the customer and
    // is a better answer than a generic status message.
    const firstField = Object.entries(fieldErrors)[0];

    message =
      reason?.message ||
      (status === 400 && firstField ? firstField[1] : "") ||
      STATUS_MESSAGES[status] ||
      `Request failed with status ${status}.`;
  }

  return {
    status,
    message,
    fieldErrors,
    reason,
    isNetwork: false,
    isServer: status >= 500,
    isCancelled: false,
    data,
  };
}

/**
 * True when the error carries an inline message for `field`.
 * Lets a form decide between inline and banner placement.
 */
export function hasFieldError(apiError, field) {
  return Boolean(apiError?.fieldErrors?.[field]);
}
