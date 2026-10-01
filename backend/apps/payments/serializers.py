from rest_framework import serializers

from apps.bookings.models import Booking

from .services import create_payment

from .models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    # Declared explicitly rather than inherited, because the OneToOne on
    # `booking` carries a uniqueness check and the message DRF generates
    # for it - "payment with this booking already exists." - tells a
    # customer holding a phone what nothing about what to do next. The
    # check itself is kept: it is the one that stops the second row at
    # the edge, before a request can begin.
    booking = serializers.PrimaryKeyRelatedField(
        queryset=Booking.objects.all(),
        error_messages={
            "unique": (
                "A payment has already been sent for this booking and "
                "is still waiting to be checked. Please wait for the shop "
                "to verify it rather than sending another."
            ),
            "does_not_exist": (
                "We could not match that to a booking. Please check the "
                "booking and try again."
            ),
        },
    )

    booking_customer = serializers.CharField(
        source="booking.customer_name",
        read_only=True,
    )

    booking_service = serializers.CharField(
        source="booking.service.name",
        read_only=True,
    )

    booking_code = serializers.CharField(
        source="booking.booking_code",
        read_only=True,
    )

    class Meta:
        model = Payment

        fields = [
            "id",
            "booking",
            "booking_code",
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
            "booking_code",
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
        if not value:
            return value

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

    def validate(self, attrs):
        """
        Require something the shop can actually check the money against.

        A payment with neither a screenshot nor a transaction reference
        is an assertion, not evidence: the verifier is asked to trust that
        money arrived, with nothing to compare it to and no way to tell a
        genuine slip from a typo. The receipt is optional because a bank
        transfer has no screenshot, and the reference is optional because
        someone paying in cash at the counter has no transfer at all.

        One of the two is enough. Both together are better - a
        reference lets the shop match it to the bank and a picture lets
        them read the amount - which is what the copy on the payment
        screen asks for.
        """

        attrs = super().validate(attrs)

        receipt = attrs.get("receipt")
        reference = (attrs.get("transaction_reference") or "").strip()

        if receipt is None and not reference:
            raise serializers.ValidationError(
                {
                    "transaction_reference": (
                        "To pay for this booking, send us either a "
                        "screenshot of the transfer or the transaction "
                        "reference (TIN) from it - we cannot verify a "
                        "payment we have nothing to check it against. "
                        "Add one of the two below and submit again."
                    )
                }
            )

        return attrs

    def create(self, validated_data):
        return create_payment(
            **validated_data
        )