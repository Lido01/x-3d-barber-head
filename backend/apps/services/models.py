from django.db import models


class Service(models.Model):
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    duration = models.PositiveIntegerField(
        help_text="Duration in minutes"
    )
    image = models.ImageField(
        upload_to="services/",
        blank=True,
        null=True
    )
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

        # Every public list read filters on is_active and orders by name.
        # A composite index lets SQLite satisfy both from one structure
        # instead of filtering after reading the whole table, which is
        # what happens the moment a shop has more than a screenful of
        # services.
        indexes = [
            models.Index(
                fields=["is_active", "name"],
                name="service_active_name_idx",
            ),
        ]

    def __str__(self):
        return self.name
    
class HaircutStyle(models.Model):
    service = models.ForeignKey(
        Service,
        on_delete=models.CASCADE,
        related_name="styles",
    )

    name = models.CharField(
        max_length=120,
    )

    description = models.TextField(
        blank=True,
    )

    image = models.ImageField(
        upload_to="haircut_styles/",
        blank=True,
        null=True,
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

        # The public list prefetches active styles for every service at
        # once, keyed on this pair, so the index has to match that query
        # rather than just the foreign key.
        indexes = [
            models.Index(
                fields=["service", "is_active"],
                name="style_service_active_idx",
            ),
        ]

    def __str__(self):
        return f"{self.service.name} - {self.name}"