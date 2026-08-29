from rest_framework import serializers

from .models import Testimonial


class TestimonialSerializer(serializers.ModelSerializer):

    class Meta:
        model = Testimonial

        fields = [
            "id",
            "customer_name",
            "customer_phone",
            "message",
            "rating",
            "photo",
            "status",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "status",
            "created_at",
            "updated_at",
        ]

    def validate_rating(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError(
                "Rating must be between 1 and 5."
            )

        return value

    def validate_photo(self, value):
        if value:
            allowed_types = [
                "image/jpeg",
                "image/png",
                "image/webp",
            ]

            if value.content_type not in allowed_types:
                raise serializers.ValidationError(
                    "Photo must be JPG, PNG, or WebP."
                )

            max_size = 5 * 1024 * 1024

            if value.size > max_size:
                raise serializers.ValidationError(
                    "Photo must be 5MB or smaller."
                )

        return value