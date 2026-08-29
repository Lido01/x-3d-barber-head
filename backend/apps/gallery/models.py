from django.db import models


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