from django.conf import settings
from django.db import models

from apps.bookings.models import Booking


class Payment(models.Model):

    METHOD_CHOICES = [
        ("telebirr", "Telebirr"),
        ("bank_transfer", "Bank Transfer"),
        ("cbe", "CBE"),
        ("other", "Other"),
    ]

    # Modern TextChoices approach matching the expectations of services.py
    # Value strings are lowercase to safely preserve existing database entries
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        VERIFIED = "verified", "Verified"
        REJECTED = "rejected", "Rejected"

    booking = models.OneToOneField(
        Booking,
        on_delete=models.CASCADE,
        related_name="payment",
    )

    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
    )

    method = models.CharField(
        max_length=30,
        choices=METHOD_CHOICES,
    )

    transaction_reference = models.CharField(
        max_length=255,
        blank=True,
    )

    receipt = models.ImageField(
        upload_to="payment_receipts/",
        blank=True,
        null=True,
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,  # Points to the new TextChoices inner class
        default=Status.PENDING,
    )

    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="verified_payments",
    )

    verified_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    rejection_reason = models.TextField(
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

        # The verification screen opens on `pending` and works down that
        # queue, and the dashboard counts by status. Both are the same
        # question, so the index is built for it.
        indexes = [
            models.Index(
                fields=["status", "-created_at"],
                name="payment_status_created_idx",
            ),
        ]

    def __str__(self):
        return (
            f"Payment #{self.id} - "
            f"Booking #{self.booking_id} - "
            f"{self.amount}"
        )
