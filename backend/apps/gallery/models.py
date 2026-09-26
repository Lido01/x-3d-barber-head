from django.db import models

from apps.services.models import Service


class GalleryPost(models.Model):
    title = models.CharField(max_length=150)
    description = models.TextField(blank=True)

    image = models.ImageField(
        upload_to="gallery/"
    )

    style_name = models.CharField(
        max_length=100,
        blank=True
    )

    service = models.ForeignKey(
        Service,
        on_delete=models.SET_NULL,
        related_name="gallery_posts",
        null=True,
        blank=True,
    )

    is_active = models.BooleanField(
        default=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title