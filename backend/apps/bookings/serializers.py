from rest_framework import serializers

from apps.services.models import Service

from .models import Barber, Booking
from .services import (
    create_booking,
    find_booking_by_code,
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

    #: Whether the pay form may be opened for this booking *right now*.
    #:
    #: Deliberately a separate flag from `payment_due`, because the two
    #: answer different questions and conflating them is what produced the
    #: bug this fixes:
    #:
    #:   payment_due   money is still owed on a live appointment
    #:   payment_open  money may be sent this minute
    #:
    #: A booking awaiting confirmation owes money but cannot be paid yet -
    #: reception confirms the chair first, then payment opens. The console
    #: wants the first (whose bill is unsettled); the customer interface
    #: wants the second (whether to show a form or a waiting notice).
    #: Reading one where the other was meant produced a pay button for an
    #: appointment the shop had not yet agreed to.
    payment_open = serializers.SerializerMethodField()

    #: True when this request did not create anything, because the same
    #: phone number already held this slot. Set on the instance by
    #: `create_booking` and read back here, so the customer can be told
    #: they have not just booked a second appointment rather than being
    #: handed a new code and left to wonder why the shop has two.
    #:
    #: False on every row that came from anywhere else - a list, a detail
    #: read, the lookup - because nothing sets it there. It describes one
    #: response, not a property of the booking.
    already_booked = serializers.SerializerMethodField()

    class Meta:
        model = Booking

        # Declaring `validators` at all opts this serializer out of the
        # uniqueness validator DRF would otherwise generate from the model's
        # unique_live_booking_per_barber_slot constraint.
        #
        # Declining it is deliberate, for two reasons that both come down to
        # what the customer is told:
        #
        #   1. The generated validator's message names database columns -
        #      "The fields barber, booking_date, start_time must make a
        #      unique set" - to someone booking a haircut. bookings.services
        #      already refuses a taken slot in words a customer can act on,
        #      including the free times either side of it.
        #   2. Giving the covered fields `default=None` makes DRF run
        #      validate_barber(None) on every booking that left the barber
        #      unselected, which is most of them.
        #
        # The constraint itself still applies. It is the database refusing
        # the insert, caught in create_booking and answered with the same
        # words as the check above it.
        validators = []

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
            "payment_open",
            "already_booked",
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
            "payment_open",
            "already_booked",
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

    def get_payment_open(self, booking):
        """
        Whether this booking can be paid this minute.

        Read from payments.services so the field the customer interface
        renders and the rule the endpoint enforces are literally the same
        code. A frontend that re-derived this would be one status change
        away from offering a form the server refuses.
        """

        from apps.payments.services import payment_is_open

        return payment_is_open(booking, self._payment(booking))

    def get_already_booked(self, booking):
        """Whether this response handed back a booking that already existed."""

        return bool(getattr(booking, "already_booked", False))

    def validate_service(self, service):
        if not service.is_active:
            raise serializers.ValidationError(
                "This service is not available. "
                "Please choose another service from the list."
            )

        return service

    def validate_barber(self, barber):
        # None is a real input, not a mistake. Leaving the barber unselected
        # is how most bookings are made, and it is the shop's job to pick
        # whoever is free.
        #
        # It also arrives here legitimately on its own: DRF turns the
        # model's unique_live_booking_per_barber_slot constraint into a
        # UniqueTogetherValidator, which puts `default=None` on every
        # field the constraint covers. A field with a default is one DRF
        # validates even when the request left it out, so this runs with
        # None for a booking that never mentioned a barber at all.
        if barber is None:
            return barber

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
    A customer proving a booking is theirs, and asking for it.

    Both fields are checked here only for presence and shape; the match
    itself, the deliberate refusal to say which half was wrong, and the
    single-booking rule are all
    bookings.services.find_booking_by_code.

    The code is not a way to look a customer up - it names one booking.
    Someone who has booked twice on the same number has a code for each.
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
        attrs["booking"] = find_booking_by_code(
            code=attrs["code"],
            phone=attrs["phone"],
        )

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


class AdminBookingSerializer(BookingSerializer):
    """
    A booking with its payment attached, for the staff console.

    The console's job is to answer "what is the state of this
    appointment", and that is one question with two halves: the chair and
    the money. It used to take two screens and two requests to answer it -
    the bookings list carried only a status word, so deciding a payment
    meant leaving the booking, opening the payment queue, and matching rows
    by eye on a booking id nobody had asked for.

    Here the whole record arrives on the booking: amount, method, the
    transaction reference, the receipt image, who verified it and when, or
    the reason it was rejected. Verify and reject are therefore decisions
    made on the booking, where the appointment they affect is on screen,
    rather than on a separate queue that has lost the context.

    Used only for `list` and `retrieve`, both of which already require
    `bookings.view`. The payment is joined by the viewset's
    `select_related("payment")`, so a screen full of bookings costs the
    same one query it did when the payment was a single word - the
    difference is the detail now travels with it.
    """

    payment = serializers.SerializerMethodField()

    class Meta(BookingSerializer.Meta):
        fields = BookingSerializer.Meta.fields + ["payment"]

        read_only_fields = BookingSerializer.Meta.read_only_fields + [
            "payment",
        ]

    def get_payment(self, booking):
        payment = self._payment(booking)

        if payment is None:
            return None

        # Deferred for the same reason booking_payload defers it: the
        # payments app imports bookings.services, so a module-level import
        # here would make the two apps depend on each other's import order.
        from apps.payments.serializers import PaymentSerializer

        return PaymentSerializer(payment).data