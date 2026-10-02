from rest_framework import status, viewsets
from django.utils.timezone import localdate
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import (
    AllowAny,
    IsAuthenticated,
    IsAdminUser,
)
from rest_framework.response import Response

from drf_spectacular.utils import (
    extend_schema,
    OpenApiResponse,
    OpenApiParameter,
    OpenApiTypes,
)

from .models import Booking, Barber
from .serializers import (
    AvailabilitySerializer,
    BarberSerializer,
    BookingLookupSerializer,
    BookingSerializer,
)
from .services import (
    cancel_booking,
    complete_booking,
    confirm_booking,
    get_availability_report,
    list_bookings_for_user,
)
from apps.accounts.permissions import capability_permission
from apps.accounts.audit import log_action


def payment_state(booking):
    """
    The payment attached to a booking, or None.

    Payment is a OneToOne, so this is a join and not a second query -
    which is what lets the booking list and the dashboard show whether
    money has arrived without turning into one request per row.
    """

    existing = getattr(booking, "payment", None)

    return existing


def booking_payload(booking, payment=None):
    """
    One booking as the customer is allowed to see it, plus its money state.

    One shape for the lookup, the history list and the success page, so
    the three cannot disagree about what a customer's own booking looks
    like. `payment_state` is spelled out as its own field rather than left
    for the client to infer from a nested object, because "do I still owe
    money" is the question the whole screen exists to answer.

    The payments serializer is imported here rather than at the top of the
    module: apps.payments.services already imports bookings.services, so a
    module-level import would make the two apps depend on each other's
    import order.
    """

    from apps.payments.serializers import PaymentSerializer

    if payment is None:
        payment = payment_state(booking)

    return {
        "booking": BookingSerializer(booking).data,
        "payment": (
            PaymentSerializer(payment).data if payment is not None else None
        ),
        # Whether the shop is still waiting on money for this appointment.
        # Drives the pay call to action on the customer's own screens and
        # the outstanding figure on the staff ones.
        "payment_due": (
            payment is None
            and booking.status
            in [
                Booking.Status.PENDING,
                Booking.Status.CONFIRMED,
            ]
        ),
        # A rejected payment is not "nothing sent" - money was sent and
        # the shop could not match it. A booking with one of these needs a
        # phone call, not a fresh upload, and the customer is told so.
        "payment_rejected": (
            payment is not None
            and payment.status == "rejected"
        ),
    }


def booking_history_payload(bookings, matched_code):
    """
    Everything one customer has booked, newest first, with a summary.

    The summary is here rather than counted in the browser: the interface
    needs to say "3 bookings, 1 still to pay", and counting rows the
    browser already has is the kind of figure that quietly disagrees with
    a filter the customer applied.
    """

    today = localdate()

    rows = [booking_payload(booking) for booking in bookings]

    return {
        "bookings": rows,
        "matched_code": matched_code,
        "totals": {
            "all": len(rows),
            "upcoming": sum(
                1
                for row in rows
                if row["booking"]["booking_date"] >= today.isoformat()
                and row["booking"]["status"]
                not in [
                    Booking.Status.CANCELLED,
                    Booking.Status.COMPLETED,
                ]
            ),
            "awaiting_payment": sum(
                1 for row in rows if row["payment_due"]
            ),
            "awaiting_response": sum(
                1
                for row in rows
                if row["payment"] is not None
                and row["payment"]["status"] == "pending"
            ),
        },
    }


class BookingViewSet(viewsets.ModelViewSet):
    """
    API for customer bookings.

    Public users can:
        - check availability
        - create a booking

    Admin/staff users can:
        - view bookings
        - update bookings
        - cancel bookings
        - delete bookings
    """

    queryset = Booking.objects.select_related(
        "service",
        "barber",
        # The payment is shown on the same cards as the booking, and this
        # is a join rather than a query per row.
        "payment",
    )

    serializer_class = BookingSerializer

    http_method_names = [
        "get",
        "post",
        "put",
        "patch",
        "delete",
        "head",
        "options",
    ]

    # ---------------------------------------------------------
    # PERMISSIONS
    # ---------------------------------------------------------

    def get_permissions(self):
        """
        Public:

            GET availability
            POST booking
            POST lookup

        Signed in, customer scope:

            GET mine

        Admin:

            GET bookings
            UPDATE bookings
            DELETE bookings
            CANCEL bookings
        """

        if self.action in [
            "create",
            "availability",
            "lookup",
        ]:
            return [
                AllowAny(),
            ]

        if self.action == "mine":
            return [
                IsAuthenticated(),
            ]

        capability = "bookings.view" if self.action in ["list", "retrieve"] else "bookings.manage"
        return [IsAuthenticated(), capability_permission(capability)()]

    # ---------------------------------------------------------
    # LOOK A BOOKING UP BY ITS CODE
    # ---------------------------------------------------------

    @extend_schema(
        request=BookingLookupSerializer,
        responses={
            200: OpenApiResponse(
                description=(
                    "Every booking made with that phone number, newest "
                    "first, each with its payment if one was submitted, "
                    "whether payment is still outstanding, and a summary "
                    "of the totals."
                ),
            ),
            400: OpenApiResponse(
                description=(
                    "The code and phone number do not match a booking."
                ),
            ),
        },
        description=(
            "Public booking lookup. The customer quotes the code from "
            "their confirmation together with the phone number the "
            "booking was made with, and gets back their whole history - "
            "so they can check whether the shop has verified a payment "
            "without needing an account. The code proves who is asking; "
            "the phone number is then the key to everything else they "
            "have booked."
        ),
    )
    @action(
        detail=False,
        methods=["post"],
        url_path="lookup",
    )
    def lookup(self, request):
        """
        Return one customer's booking history, to that customer.

        POST rather than GET, and deliberately: the phone number belongs
        in a request body, not in a URL that ends up in an access log, a
        browser history and a Referer header. It also keeps the endpoint
        out of any cache, which a GET carrying a credential should be.
        """

        serializer = BookingLookupSerializer(data=request.data)

        serializer.is_valid(raise_exception=True)

        return Response(
            booking_history_payload(
                serializer.validated_data["bookings"],
                serializer.validated_data["matched_code"],
            )
        )

    # ---------------------------------------------------------
    # A CUSTOMER'S OWN BOOKINGS
    # ---------------------------------------------------------

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="code",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Optional booking code to return on its own.",
            ),
        ],
        responses={
            200: BookingSerializer(many=True),
        },
        description=(
            "The signed-in customer's own bookings, newest first. Only "
            "bookings made while signed in are attached to the account - "
            "a guest booking has no account to attach to, and that one "
            "is found with the public lookup instead."
        ),
    )
    @action(
        detail=False,
        methods=["get"],
        url_path="mine",
    )
    def mine(self, request):
        """
        Return the caller's own bookings.

        Scoped by the token rather than by any id in the query string, so
        there is no parameter to change to reach someone else's.
        """

        return Response(
            BookingSerializer(
                list_bookings_for_user(request.user),
                many=True,
            ).data
        )

    # ---------------------------------------------------------
    # CREATE BOOKING
    # ---------------------------------------------------------

    @extend_schema(
        request=BookingSerializer,
        responses={
            201: BookingSerializer,
            400: OpenApiResponse(
                description="Invalid booking data.",
            ),
        },
        description=(
            "Public booking endpoint. "
            "Customers do not need an account. "
            "The booking service validates the "
            "barber, service, date and time."
        ),
    )
    def create(
        self,
        request,
        *args,
        **kwargs,
    ):
        """
        Create a public booking.

        The serializer calls bookings.services,
        so business logic stays outside the view.

        Booking does not require an account. When the caller happens to
        be signed in as a customer, the booking is attached to them so it
        turns up in "my bookings" without a lookup. Staff accounts are
        excluded: a member of staff booking through the public form is
        booking a chair for someone, not for themselves.
        """

        user = request.user

        attach = (
            user
            if (
                user
                and user.is_authenticated
                and not user.is_staff
            )
            else None
        )

        serializer = self.get_serializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        # save(user=...) merges the account into validated_data, which is
        # where BookingSerializer.create() reads it from.
        booking = (
            serializer.save(user=attach)
            if attach is not None
            else serializer.save()
        )

        output = self.get_serializer(
            booking
        )

        headers = self.get_success_headers(
            output.data
        )

        # A booking is unique for the slot it chose. A repeat submit from
        # the same phone number - a double tap, a retry, a second tab -
        # gets the booking that already exists back, and answers 200
        # rather than 201 because nothing was created. 201 would tell the
        # customer they had just made a second appointment and hand them
        # a code for it, which is the confusion this is here to prevent.
        reused = bool(getattr(booking, "already_booked", False))

        return Response(
            output.data,
            status=(
                status.HTTP_200_OK
                if reused
                else status.HTTP_201_CREATED
            ),
            headers=headers,
        )

    # ---------------------------------------------------------
    # UPDATE BOOKING
    # ---------------------------------------------------------

    @extend_schema(
        request=BookingSerializer,
        responses={
            200: BookingSerializer,
        },
        description=(
            "Admin-only booking update. "
            "Business rules are handled by "
            "bookings.services."
        ),
    )
    def update(
        self,
        request,
        *args,
        **kwargs,
    ):
        partial = kwargs.pop(
            "partial",
            False,
        )

        booking = self.get_object()

        serializer = self.get_serializer(
            booking,
            data=request.data,
            partial=partial,
        )

        serializer.is_valid(
            raise_exception=True
        )

        booking = serializer.save()
        log_action(request, "booking.updated", booking)

        output = self.get_serializer(
            booking
        )

        return Response(
            output.data
        )

    # ---------------------------------------------------------
    # DELETE BOOKING
    # ---------------------------------------------------------

    @extend_schema(
        responses={
            204: OpenApiResponse(
                description=(
                    "Booking deleted successfully."
                ),
            ),
        },
        description=(
            "Admin-only permanent deletion."
        ),
    )
    def destroy(
        self,
        request,
        *args,
        **kwargs,
    ):
        booking = self.get_object()

        log_action(request, "booking.deleted", booking)
        booking.delete()

        return Response(
            status=status.HTTP_204_NO_CONTENT
        )

    # ---------------------------------------------------------
    # CANCEL BOOKING
    # ---------------------------------------------------------

    @extend_schema(
        request=None,
        responses={
            200: BookingSerializer,
            400: OpenApiResponse(
                description=(
                    "Booking cannot be cancelled."
                ),
            ),
        },
        description=(
            "Admin-only cancellation. "
            "The booking remains in the database "
            "but becomes cancelled."
        ),
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="cancel",
    )
    def cancel(
        self,
        request,
        pk=None,
    ):
        booking = self.get_object()

        booking = cancel_booking(
            booking
        )
        log_action(request, "booking.cancelled", booking)

        return Response(
            self.get_serializer(
                booking
            ).data
        )

    # ---------------------------------------------------------
    # CONFIRM BOOKING
    # ---------------------------------------------------------

    @extend_schema(
        request=None,
        responses={
            200: BookingSerializer,
            400: OpenApiResponse(
                description=(
                    "Booking cannot be confirmed."
                ),
            ),
        },
        description=(
            "Admin-only confirmation. "
            "Verifying a payment already confirms its "
            "booking; this is for the case where a walk-in "
            "or a cash customer needs confirming on its own."
        ),
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="confirm",
    )
    def confirm(
        self,
        request,
        pk=None,
    ):
        booking = self.get_object()

        booking = confirm_booking(
            booking
        )
        log_action(request, "booking.confirmed", booking)

        return Response(
            self.get_serializer(
                booking
            ).data
        )

    # ---------------------------------------------------------
    # COMPLETE BOOKING
    # ---------------------------------------------------------

    @extend_schema(
        request=None,
        responses={
            200: BookingSerializer,
            400: OpenApiResponse(
                description=(
                    "Only a confirmed booking can be "
                    "completed."
                ),
            ),
        },
        description=(
            "Admin-only completion. Marks a confirmed "
            "appointment as served once the customer has "
            "left the chair."
        ),
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="complete",
    )
    def complete(
        self,
        request,
        pk=None,
    ):
        booking = self.get_object()

        booking = complete_booking(
            booking
        )
        log_action(request, "booking.completed", booking)

        return Response(
            self.get_serializer(
                booking
            ).data
        )

    # ---------------------------------------------------------
    # CHECK AVAILABILITY
    # ---------------------------------------------------------

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="service",
                type=OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                required=True,
                description=(
                    "ID of the active service."
                ),
            ),
            OpenApiParameter(
                name="booking_date",
                type=OpenApiTypes.DATE,
                location=OpenApiParameter.QUERY,
                required=True,
                description=(
                    "Date to check. "
                    "Format: YYYY-MM-DD."
                ),
            ),
            OpenApiParameter(
                name="barber",
                type=OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                required=False,
                description=(
                    "Optional barber ID. "
                    "If omitted, availability is "
                    "returned when at least one "
                    "active barber is available."
                ),
            ),
        ],
        responses={
            200: OpenApiResponse(
                description=(
                    "The available times, and - when there are none - "
                    "which of the several reasons applies and what to "
                    "do about it."
                ),
            ),
            400: OpenApiResponse(
                description=(
                    "The service, barber or date could not be read."
                ),
            ),
        },
        description=(
            "Public availability endpoint. "
            "No customer login is required."
        ),
    )
    @action(
        detail=False,
        methods=["get"],
        url_path="availability",
    )
    def availability(
        self,
        request,
    ):
        """
        The time picker, answered in full.

        A date with nothing bookable is still a 200. It carries an
        `availability` object naming which situation it is - no barber on
        duty, service longer than the opening hours, the date has passed,
        the service withdrawn, simply full - together with the next free
        times when there are any. That is what lets the booking form say
        something useful instead of "no times available".
        """

        serializer = AvailabilitySerializer(
            data=request.query_params
        )

        serializer.is_valid(
            raise_exception=True
        )

        report = get_availability_report(
            booking_date=serializer.validated_data[
                "booking_date"
            ],
            service=serializer.validated_data[
                "service"
            ],
            barber=serializer.validated_data.get(
                "barber"
            ),
        )

        response_data = {
            "service": serializer.validated_data["service"].name,
            "date": serializer.validated_data["booking_date"],
            **report,
        }

        barber = serializer.validated_data.get("barber")

        if barber is not None:
            response_data["barber"] = barber.name

        return Response(
            response_data
        )


class BarberViewSet(viewsets.ModelViewSet):
    """
    API for the barbers who work in the shop.

    Public customers can view active barbers.

    Admin/staff users can create, update and delete barbers, and control
    whether they are shown to customers.
    """

    serializer_class = BarberSerializer

    parser_classes = [
        MultiPartParser,
        FormParser,
        JSONParser,
    ]

    def get_permissions(self):
        """
        Public:
            GET barbers

        Admin:
            POST
            PUT
            PATCH
            DELETE
        """

        if self.action in [
            "list",
            "retrieve",
        ]:
            return [AllowAny()]

        return [capability_permission("services.manage")()]

    def get_queryset(self):
        queryset = Barber.objects.all()

        if self.request.user.is_authenticated and self.request.user.is_staff:
            return queryset

        return queryset.filter(
            is_active=True
        )

    def perform_create(self, serializer):
        barber = serializer.save()
        log_action(self.request, "barber.created", barber, {"name": barber.name})

    def perform_update(self, serializer):
        barber = serializer.save()
        log_action(self.request, "barber.updated", barber, {"fields": sorted(serializer.validated_data.keys()), "active": barber.is_active})

    def perform_destroy(self, instance):
        # A booking protects its barber, so this raises before the row
        # goes; capturing the name first means the log still records
        # which barber an owner tried to remove.
        name = instance.name

        log_action(self.request, "barber.deleted", details={"name": name})

        instance.delete()
