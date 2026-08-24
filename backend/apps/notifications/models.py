from django.db import models

from apps.bookings.models import Booking


class Notification(models.Model):

    TYPE_CHOICES = [
        ("booking_confirmation", "Booking Confirmation"),
        ("booking_reminder", "Booking Reminder"),
        ("booking_cancelled", "Booking Cancelled"),
        ("payment_confirmation", "Payment Confirmation"),
    ]

    CHANNEL_CHOICES = [
        ("email", "Email"),
        ("sms", "SMS"),
    ]

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("sent", "Sent"),
        ("failed", "Failed"),
    ]

    booking = models.ForeignKey(
        Booking,
        on_delete=models.CASCADE,
        related_name="notifications",
    )

    notification_type = models.CharField(
        max_length=50,
        choices=TYPE_CHOICES,
    )

    channel = models.CharField(
        max_length=20,
        choices=CHANNEL_CHOICES,
    )

    recipient = models.CharField(
        max_length=255,
    )

    subject = models.CharField(
        max_length=255,
        blank=True,
    )

    message = models.TextField()

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending",
    )

    error_message = models.TextField(
        blank=True,
    )

    sent_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return (
            f"{self.notification_type} - "
            f"{self.channel} - "
            f"{self.booking}"
        )