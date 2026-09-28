from django.conf import settings
from django.db import models


class Testimonial(models.Model):

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="testimonials",
        null=True,
        blank=True,
    )

    customer_name = models.CharField(
        max_length=120
    )

    customer_phone = models.CharField(
        max_length=30,
        blank=True,
    )

    message = models.TextField()

    rating = models.PositiveSmallIntegerField(
        default=5
    )

    photo = models.ImageField(
        upload_to="testimonials/",
        blank=True,
        null=True,
    )

    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.PENDING,
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        ordering = ["-created_at"]

        indexes = [
            models.Index(
                fields=[
                    "user",
                    "status",
                ]
            ),
        ]

    def __str__(self):
        return f"{self.customer_name} - {self.rating}/5"