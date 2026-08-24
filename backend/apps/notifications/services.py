from django.utils import timezone

from .models import Notification


def create_notification(
    *,
    booking,
    notification_type,
    channel,
    recipient,
    subject="",
    message="",
):
    """
    Create a pending notification.
    """

    return Notification.objects.create(
        booking=booking,
        notification_type=notification_type,
        channel=channel,
        recipient=recipient,
        subject=subject,
        message=message,
        status="pending",
    )


def mark_notification_sent(notification):
    """
    Mark a notification as successfully sent.
    """

    notification.status = "sent"
    notification.sent_at = timezone.now()
    notification.error_message = ""

    notification.save(
        update_fields=[
            "status",
            "sent_at",
            "error_message",
            "updated_at",
        ]
    )

    return notification


def mark_notification_failed(
    notification,
    error_message,
):
    """
    Mark a notification as failed.
    """

    notification.status = "failed"
    notification.error_message = str(
        error_message
    )

    notification.save(
        update_fields=[
            "status",
            "error_message",
            "updated_at",
        ]
    )

    return notification


def create_booking_confirmation(
    *,
    booking,
    channel,
    recipient,
):
    """
    Create a booking confirmation notification.
    """

    service = booking.service

    subject = "Your booking is confirmed"

    message = (
        f"Hello {booking.customer_name},\n\n"
        f"Your booking has been confirmed.\n\n"
        f"Service: {service.name}\n"
        f"Date: {booking.booking_date}\n"
        f"Time: {booking.start_time} - "
        f"{booking.end_time}\n"
        f"Price: {service.price}\n\n"
        f"Thank you!"
    )

    return create_notification(
        booking=booking,
        notification_type="booking_confirmation",
        channel=channel,
        recipient=recipient,
        subject=subject,
        message=message,
    )