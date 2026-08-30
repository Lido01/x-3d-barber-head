from django.db import models

from apps.services.models import Service


class Barber(models.Model):
    name = models.CharField(max_length=120)

    role = models.CharField(
        max_length=120,
        blank=True,
    )

    specialty = models.CharField(
        max_length=255,
        blank=True,
    )

    experience = models.CharField(
        max_length=60,
        blank=True,
    )

    image = models.ImageField(
        upload_to="barbers/",
        blank=True,
        null=True,
    )

    phone = models.CharField(
        max_length=30,
        blank=True,
    )

    is_active = models.BooleanField(
        default=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Booking(models.Model):

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        CONFIRMED = "confirmed", "Confirmed"
        CANCELLED = "cancelled", "Cancelled"
        COMPLETED = "completed", "Completed"
        EXPIRED = "expired", "Expired"

    customer_name = models.CharField(
        max_length=120,
    )

    customer_phone = models.CharField(
        max_length=30,
    )

    service = models.ForeignKey(
        Service,
        on_delete=models.PROTECT,
        related_name="bookings",
    )

    barber = models.ForeignKey(
        Barber,
        on_delete=models.PROTECT,
        related_name="bookings",
        null=True,
        blank=True,
    )

    booking_date = models.DateField()

    start_time = models.TimeField()

    end_time = models.TimeField(
        editable=False,
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )

    notes = models.TextField(
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = [
            "booking_date",
            "start_time",
        ]

        indexes = [
            models.Index(
                fields=[
                    "booking_date",
                    "start_time",
                ]
            ),
            models.Index(
                fields=[
                    "barber",
                    "booking_date",
                    "start_time",
                ]
            ),
        ]

        constraints = [
            models.CheckConstraint(
                condition=models.Q(
                    end_time__gt=models.F(
                        "start_time"
                    )
                ),
                name="booking_end_time_after_start_time",
            ),
        ]

    def __str__(self):
        return (
            f"{self.customer_name} — "
            f"{self.service.name} — " if self.service else "Service: #{self.id} — "
            f"{self.barber.name} " if self.barber else "Barber: #{self.id} "
            f"({self.booking_date} "
            f"{self.start_time})"
        )