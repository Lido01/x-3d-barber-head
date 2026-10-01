from rest_framework import serializers

from apps.services.models import Service

from .models import Barber, Booking
from .services import (
    create_booking,
    find_bookings_by_code,
    update_booking,
)


class BookingSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(
        source="service.name",
        read_only=True,
    )

    barber_name = serializers.CharField(
        source="barber.name",
        read_only=True,
    )

    #: The state of the money behind this booking, or None if none has
    #: been sent.
    #:
    #: On the booking row rather than left to the client, because the two
    #: genuinely disagree: staff confirm a walk-in who will pay at the
    #: counter, and a payment can be rejected while the appointment is
    #: held. Both leave a live appointment with a confirmed badge and
    #: nothing paid behind it, which is exactly the thing worth noticing
    #: before the customer is in the chair.
    #:
    #: A join, not a query per row - which is why the viewset selects the
    #: payment in. Before this existed the console read `payment_status`,
    #: found it undefined, and silently showed every booking as though
    #: nothing had been paid.
    payment_status = serializers.SerializerMethodField()

    payment_due = serializers.SerializerMethodField()

    class Meta:
        model = Booking

        fields = [
            "id",
            "booking_code",
            "customer_name",
            "customer_phone",
            "service",
            "service_name",
            "barber",
            "barber_name",
            "booking_date",
            "start_time",
            "end_time",
            "status",
            "payment_status",
            "payment_due",
            "notes",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            # Server-assigned and permanent: it is the reference the
            # customer quotes back to the shop, so nothing in the API can
            # set it and nothing can change it.
            "booking_code",
            "end_time",
            "status",
            "payment_status",
            "payment_due",
            "created_at",
            "updated_at",
            "service_name",
            "barber_name",
        ]

    def _payment(self, booking):
        """The joined payment, or None. Never triggers a query."""
        return getattr(booking, "payment", None)

    def get_payment_status(self, booking):
        payment = self._payment(booking)

        return payment.status if payment is not None else None

    def get_payment_due(self, booking):
        """
        Whether the shop is still waiting on money.

        True for a live appointment with nothing behind it. False once a
        payment exists at all - including a rejected one, which is not
        "nothing sent" but is handled by payment_status rather than by
        pretending money is still outstanding.
        """

        if self._payment(booking) is not None:
            return False

        return booking.status in [
            Booking.Status.PENDING,
            Booking.Status.CONFIRMED,
        ]

    def validate_service(self, service):
        if not service.is_active:
            raise serializers.ValidationError(
                "This service is not available. "
                "Please choose another service from the list."
            )

        return service

    def validate_barber(self, barber):
        if not barber.is_active:
            raise serializers.ValidationError(
                f"{barber.name} is not taking bookings right now. "
                "Please choose another barber, or leave it to the shop "
                "to pick whoever is free."
            )

        return barber

    def create(self, validated_data):
        """
        Send booking creation to the business layer.
        """

        try:
            return create_booking(
                customer_name=validated_data.get(
                    "customer_name"
                ),
                customer_phone=validated_data.get(
                    "customer_phone"
                ),
                service=validated_data.get(
                    "service"
                ),
                barber=validated_data.get(
                    "barber"
                ),
                booking_date=validated_data.get(
                    "booking_date"
                ),
                start_time=validated_data.get(
                    "start_time"
                ),
                notes=validated_data.get(
                    "notes",
                    "",
                ),
                user=validated_data.get(
                    "user"
                ),
            )

        except serializers.ValidationError:
            raise

        except Exception as exc:
            raise serializers.ValidationError(
                {
                    "detail": str(exc)
                }
            )

    def update(self, instance, validated_data):
        """
        Send booking updates to the business layer.
        """

        try:
            return update_booking(
                instance,
                customer_name=validated_data.get(
                    "customer_name"
                ),
                customer_phone=validated_data.get(
                    "customer_phone"
                ),
                service=validated_data.get(
                    "service"
                ),
                barber=validated_data.get(
                    "barber"
                ),
                booking_date=validated_data.get(
                    "booking_date"
                ),
                start_time=validated_data.get(
                    "start_time"
                ),
                notes=validated_data.get(
                    "notes"
                ),
            )

        except serializers.ValidationError:
            raise

        except Exception as exc:
            raise serializers.ValidationError(
                {
                    "detail": str(exc)
                }
            )


class AvailabilitySerializer(serializers.Serializer):
    """
    The query behind the time picker.

    Only the inputs are validated here. Whether the date has anything
    bookable, and if not why, is an answer rather than a mistake, so it
    comes back as a 200 from bookings.services.get_availability_report
    rather than as a validation failure here.
    """

    service = serializers.PrimaryKeyRelatedField(
        queryset=Service.objects.filter(
            is_active=True
        ),
        error_messages={
            "does_not_exist": (
                "That service is not being offered right now. "
                "Please choose another service from the list."
            ),
        },
    )

    booking_date = serializers.DateField(
        error_messages={
            "invalid": (
                "That is not a date we can read. "
                "Please pick a date from the calendar."
            ),
        },
    )

    barber = serializers.PrimaryKeyRelatedField(
        queryset=Barber.objects.filter(
            is_active=True
        ),
        required=False,
        allow_null=True,
        error_messages={
            "does_not_exist": (
                "That barber is not taking bookings right now. "
                "Please choose another barber, or leave this unselected "
                "and let the shop pick whoever is free."
            ),
        },
    )


class BookingLookupSerializer(serializers.Serializer):
    """
    A customer proving a booking is theirs, and asking for their history.

    Both fields are checked here only for presence and shape; the match
    itself, and the deliberate refusal to say which half was wrong, is
    bookings.services.find_bookings_by_code.
    """

    code = serializers.CharField(
        max_length=32,
        error_messages={
            "required": "Please enter your booking code.",
            "blank": "Please enter your booking code.",
        },
    )

    phone = serializers.CharField(
        max_length=32,
        error_messages={
            "required": (
                "Please enter the phone number you booked with, so we "
                "can match it to your booking."
            ),
            "blank": (
                "Please enter the phone number you booked with, so we "
                "can match it to your booking."
            ),
        },
    )

    def validate(self, attrs):
        bookings, anchor = find_bookings_by_code(
            code=attrs["code"],
            phone=attrs["phone"],
        )

        attrs["bookings"] = bookings
        attrs["matched_code"] = anchor.booking_code

        return attrs


class BarberSerializer(serializers.ModelSerializer):
    class Meta:
        model = Barber

        fields = [
            "id",
            "name",
            "role",
            "specialty",
            "experience",
            "bio",
            "image",
            "phone",
            "is_active",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]