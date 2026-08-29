from rest_framework import serializers

from .models import Service, HaircutStyle

class HaircutStyleSerializer(serializers.ModelSerializer):
    """
    Serializer for individual haircut styles.

    The service is read-only because the service is determined
    from the URL when creating a style.
    """

    class Meta:
        model = HaircutStyle

        fields = [
            "id",
            "service",
            "name",
            "description",
            "image",
            "is_active",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "service",
            "created_at",
            "updated_at",
        ]

    def validate_name(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Style name cannot be empty."
            )

        return value

    def validate_image(self, value):
        if value:
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


class ServiceSerializer(serializers.ModelSerializer):
    """
    Serializer for barber services.

    Customers receive only active haircut styles.
    """

    styles = serializers.SerializerMethodField()

    class Meta:
        model = Service

        fields = [
            "id",
            "name",
            "description",
            "price",
            "duration",
            "image",
            "styles",
            "is_active",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "styles",
            "created_at",
            "updated_at",
        ]

    def get_styles(self, obj):
        """
        Return only active haircut styles.

        Inactive styles remain in the database for admin
        management but are hidden from customers.
        """

        styles = obj.styles.filter(
            is_active=True
        )

        return HaircutStyleSerializer(
            styles,
            many=True,
            context=self.context,
        ).data

    def validate_name(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Service name cannot be empty."
            )

        return value

    def validate_image(self, value):
        if value:
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

    def validate_price(self, value):
        if value < 0:
            raise serializers.ValidationError(
                "Price cannot be negative."
            )

        return value

    def validate_duration(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                "Duration must be greater than 0 minutes."
            )

        return value