from rest_framework import status, viewsets
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
    BookingSerializer,
)
from .services import (
    cancel_booking,
    get_available_times,
)


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

        Admin:

            GET bookings
            UPDATE bookings
            DELETE bookings
            CANCEL bookings
        """

        if self.action in [
            "create",
            "availability",
        ]:
            return [
                AllowAny(),
            ]

        return [
            IsAuthenticated(),
            IsAdminUser(),
        ]

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
        """

        serializer = self.get_serializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        booking = serializer.save()

        output = self.get_serializer(
            booking
        )

        headers = self.get_success_headers(
            output.data
        )

        return Response(
            output.data,
            status=status.HTTP_201_CREATED,
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
                    "Available appointment times."
                ),
            ),
            400: OpenApiResponse(
                description=(
                    "Invalid service, barber or date."
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
        serializer = AvailabilitySerializer(
            data=request.query_params
        )

        serializer.is_valid(
            raise_exception=True
        )

        service = serializer.validated_data[
            "service"
        ]

        booking_date = serializer.validated_data[
            "booking_date"
        ]

        barber = serializer.validated_data.get(
            "barber"
        )

        available_times = get_available_times(
            booking_date=booking_date,
            service=service,
            barber=barber,
        )

        response_data = {
            "service": service.name,
            "date": booking_date,
            "available_times": available_times,
        }

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

        return [IsAdminUser()]

    def get_queryset(self):
        queryset = Barber.objects.all()

        if self.request.user.is_authenticated and self.request.user.is_staff:
            return queryset

        return queryset.filter(
            is_active=True
        )
