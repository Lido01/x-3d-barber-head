from rest_framework import serializers

from .models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    booking_customer = serializers.CharField(
        source="booking.customer_name",
        read_only=True,
    )

    booking_service = serializers.CharField(
        source="booking.service.name",
        read_only=True,
    )

    class Meta:
        model = Payment

        fields = [
            "id",
            "booking",
            "booking_customer",
            "booking_service",
            "amount",
            "method",
            "transaction_reference",
            "receipt",
            "status",
            "verified_by",
            "verified_at",
            "rejection_reason",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "booking_customer",
            "booking_service",
            "status",
            "verified_by",
            "verified_at",
            "rejection_reason",
            "created_at",
            "updated_at",
        ]

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                "Payment amount must be greater than zero."
            )

        return value

    def validate_receipt(self, value):
        if value:

            allowed_types = [
                "image/jpeg",
                "image/png",
                "image/webp",
            ]

            if value.content_type not in allowed_types:
                raise serializers.ValidationError(
                    "Receipt must be JPG, PNG, or WebP."
                )

            max_size = 5 * 1024 * 1024

            if value.size > max_size:
                raise serializers.ValidationError(
                    "Receipt image must be 5MB or smaller."
                )

        return value