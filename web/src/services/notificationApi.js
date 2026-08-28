import api from "./api";

/**
 * Notifications — GET /api/notifications/notifications/
 *
 * Read-only on the backend (ReadOnlyModelViewSet). Email and SMS are
 * sent by Django only; React holds no SMTP or SMS credentials and
 * never dispatches a message itself.
 *
 * STATUS TODAY: no app writes to this table - notifications.services
 * exposes create_notification() but nothing in bookings or payments
 * calls it, so the endpoint returns an empty list. The client is
 * wired here for when the backend starts emitting notifications; no
 * customer-facing UI reads it yet, because inventing "notification
 * sent" messages from an empty feed would be fake.
 */

export function listNotifications({ bookingId, signal } = {}) {
  const params = {};

  if (bookingId) {
    params.booking = bookingId;
  }

  return api
    .get("/notifications/notifications/", { params, signal })
    .then((response) => {
      const data = response.data;
      return Array.isArray(data) ? data : data?.results || [];
    });
}
