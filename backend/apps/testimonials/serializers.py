from rest_framework import serializers

from .models import Testimonial


class TestimonialSerializer(serializers.ModelSerializer):
    """
    Reading a review, and writing one on behalf of a signed-in customer.

    `customer_name` is derived from the account in the view, so it is
    not something the client can set. `user` is exposed so the
    storefront can tell "this review is yours" apart from the wall, and
    so a customer can recognise their own review in the admin screen.
    """

    class Meta:
        model = Testimonial

        fields = [
            "id",
            "user",
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
            "user",
            "customer_name",
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

    def validate_message(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Please share your experience."
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
