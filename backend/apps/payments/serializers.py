from rest_framework import serializers

from apps.bookings.models import Booking
from apps.bookings.services import normalise_booking_code, phone_matches

from .services import (
    booking_takes_payment,
    create_payment,
    payment_gate_message,
)

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

    #: The appointment behind the money, in full.
    #:
    #: Deciding a payment means answering "is this the right money for
    #: this appointment", and a queue that showed only an amount, a method
    #: and a reference made that impossible to do without also opening the
    #: booking - at which point the verifier is looking at two screens to
    #: check that they describe the same thing. So the appointment travels
    #: with the payment: which one, when, for what, and whether reception
    #: has confirmed it yet.
    #:
    #: `booking_status` in particular is what makes the "confirm, then
    #: pay" sequence auditable from the payment queue alone. A pending
    #: booking on a payment row means this money was taken before the shop
    #: agreed the chair, and it should not have been possible.
    booking_status = serializers.CharField(
        source="booking.status",
        read_only=True,
    )

    booking_date = serializers.DateField(
        source="booking.booking_date",
        read_only=True,
    )

    booking_start_time = serializers.TimeField(
        source="booking.start_time",
        read_only=True,
    )

    booking_barber = serializers.CharField(
        source="booking.barber.name",
        read_only=True,
        default=None,
    )

    booking_reference = serializers.CharField(
        write_only=True,
        required=True,
        max_length=32,
        error_messages={
            "required": "Please enter the booking code for this payment.",
            "blank": "Please enter the booking code for this payment.",
        },
    )

    booking_phone = serializers.CharField(
        write_only=True,
        required=True,
        max_length=32,
        error_messages={
            "required": "Please enter the phone number used for this booking.",
            "blank": "Please enter the phone number used for this booking.",
        },
    )

    class Meta:
        model = Payment

        fields = [
            "id",
            "booking",
            "booking_code",
            "booking_status",
            "booking_date",
            "booking_start_time",
            "booking_barber",
            "booking_reference",
            "booking_phone",
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
            "booking_status",
            "booking_date",
            "booking_start_time",
            "booking_barber",
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
        Three gates, in the order the customer can act on them.

        1. Is this payment for a booking they can prove they made?
        2. Has reception confirmed that booking? Payment opens second, so
           until they have, there is nothing to pay for.
        3. Is there anything the shop can check the money against?

        That order is the whole point of putting it here rather than only
        in `create_payment`. A payment with neither a screenshot nor a
        transaction reference is an assertion, not evidence: the verifier
        is asked to trust that money arrived, with nothing to compare it
        to and no way to tell a genuine slip from a typo. But that
        complaint is worthless to someone whose booking has not been
        confirmed - they would fix it, submit, and be refused for the same
        reason wearing a different message.

        The receipt is optional because a bank transfer has no screenshot,
        and the reference is optional because someone paying in cash at the
        counter has no transfer at all. One of the two is enough. Both
        together are better - a reference lets the shop match it to the
        bank and a picture lets them read the amount - which is what the
        copy on the payment screen asks for.
        """

        attrs = super().validate(attrs)

        booking = attrs.get("booking")
        reference = normalise_booking_code(attrs.get("booking_reference"))
        phone = attrs.get("booking_phone")

        if (
            booking is None
            or not reference
            or booking.booking_code != reference
            or not phone_matches(booking.customer_phone, phone)
        ):
            raise serializers.ValidationError(
                {
                    "booking_reference": (
                        "We could not match that booking code and phone"
                    )
                }
            )

        # Payment opens when reception confirms, so that is checked before
        # anything about the evidence.
        #
        # Order matters for what the customer reads. Told "add a
        # screenshot" first, they add one, are refused again, and are now
        # holding a screenshot for a booking that was never payable. The
        # first refusal has to name the real blocker, and it has to be the
        # same sentence `create_payment` would have used - both read
        # payments.services rather than each carrying a copy.
        if not booking_takes_payment(booking):
            raise serializers.ValidationError(
                {"booking": [payment_gate_message(booking)]}
            )

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
        validated_data.pop("booking_reference", None)
        validated_data.pop("booking_phone", None)

        return create_payment(
            **validated_data
        )