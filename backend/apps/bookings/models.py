from django.db import models
from apps.services.models import Service


class Booking(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        CONFIRMED = "confirmed", "Confirmed"
        CANCELLED = "cancelled", "Cancelled"
        COMPLETED = "completed", "Completed"

    customer_name = models.CharField(max_length=120)
    customer_phone = models.CharField(max_length=30)
    service = models.ForeignKey(
        Service, on_delete=models.PROTECT, related_name="bookings"
    )
    booking_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField(editable=False)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["booking_date", "start_time"]
        indexes = [models.Index(fields=["booking_date", "start_time"])]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(end_time__gt=models.F("start_time")),
                name="booking_end_time_after_start_time",
            )
        ]

    def __str__(self):
        return f"{self.customer_name} — {self.service.name} ({self.booking_date} {self.start_time})"
