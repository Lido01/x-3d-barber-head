from rest_framework import serializers

from .models import GalleryPost


class GalleryPostSerializer(serializers.ModelSerializer):
    class Meta:
        model = GalleryPost
        fields = [
            "id",
            "title",
            "description",
            "image",
            "style_name",
            "is_active",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]

    def validate_image(self, value):
        allowed_types = [
            "image/jpeg",
            "image/png",
            "image/webp",
        ]

        if value.content_type not in allowed_types:
            raise serializers.ValidationError(
                "Image must be JPG, PNG, or WebP."
            )

        max_size = 5 * 1024 * 1024

        if value.size > max_size:
            raise serializers.ValidationError(
                "Image must be 5MB or smaller."
            )

        return value