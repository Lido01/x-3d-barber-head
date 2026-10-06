import api from "./api";

/**
 * The AI booking assistant — /api/ai-agent/chat/
 *
 *   POST /api/ai-agent/chat/   { message, ...booking context }
 *
 * ## Public on purpose
 *
 * The endpoint takes `AllowAny`. Booking and paying never require an
 * account, and an assistant you have to sign in to ask about a haircut is
 * an assistant nobody asks. So this module deliberately sends no
 * `requiresAuth`, and no token is read for it.
 *
 * ## What the caller may send
 *
 * Everything except `message` is optional context the assistant uses to
 * stop asking questions the customer has already answered on the booking
 * form:
 *
 *   customer_name  what they typed into the name field
 *   customer_phone what they typed into the phone field
 *   service_id     the service they have chosen
 *   booking_date   the day they have picked
 *   start_time     the slot they have picked
 *
 * Sending blanks rather than omitting them is deliberate: the assistant
 * is told the shape every time, and an empty string is a truthful "not
 * yet" where an absent key reads as "never asked".
 *
 * ## The reply
 *
 * 200 with `{ success, message, state }`, where `message` is the text to
 * show and `state` is the assistant's own read of the conversation. A
 * provider failure comes back as a 500 carrying `error`, which
 * `normaliseApiError` turns into the standard error object - so the
 * widget renders one failure state rather than one per provider error
 * shape.
 */

/** Kept short: the widget shows a typing indicator, not a timeout. */
const CHAT_TIMEOUT = 45000;

export function chatWithAgent({
  message,
  sessionId = null,
  customerName = "",
  customerPhone = "",
  serviceId = null,
  bookingDate = null,
  startTime = null,
} = {}) {
  const payload = {
    message: (message || "").trim(),
    customer_name: customerName || "",
    customer_phone: customerPhone || "",
  };

  if (sessionId) {
    payload.session_id = sessionId;
  }

  // Only send what there is. `service_id: null` would clear the
  // assistant's memory of a service the customer already picked.
  if (serviceId !== null && serviceId !== undefined && serviceId !== "") {
    payload.service_id = Number(serviceId);
  }

  if (bookingDate) {
    payload.booking_date = bookingDate;
  }

  if (startTime) {
    // The endpoint's TimeField reads "HH:MM"; the booking form keeps
    // slots in that shape already.
    payload.start_time = String(startTime).slice(0, 5);
  }

  return api
    .post("/ai-agent/chat/", payload, { timeout: CHAT_TIMEOUT })
    .then((response) => {
      const data = response.data || {};

      // A 200 can still carry `success: false` if the view caught the
      // provider error, so this is read from the body rather than trusted
      // from the status code.
      if (data.success === false) {
        // Thrown in the same shape `normaliseApiError` produces, so the
        // widget has one failure branch rather than one per way the
        // assistant can fail.
        throw {
          status: 500,
          message: data.error || "The assistant could not answer.",
          fieldErrors: {},
          reason: null,
          isNetwork: false,
          isServer: true,
          isCancelled: false,
          data,
        };
      }

      return {
        message: data.message || "",
        state: data.state || null,
        sessionId: data.session_id || null,
        quickAnswer: Boolean(data.quick_answer),
      };
    });
}