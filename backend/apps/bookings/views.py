from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from drf_spectacular.utils import (
    extend_schema,
    OpenApiParameter,
    OpenApiResponse,
    OpenApiTypes,
)

from .models import Booking
from .serializers import (
    AvailabilitySerializer,
    BookingSerializer,
)
from .services import (
    cancel_booking,
    create_booking,
    get_available_times,
    update_booking,
)


class BookingViewSet(viewsets.ModelViewSet):
    """
    API for creating and managing customer bookings.
    """

    queryset = Booking.objects.select_related("service")

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
    # CREATE BOOKING
    # ---------------------------------------------------------

    @extend_schema(
        request=BookingSerializer,
        responses={
            201: BookingSerializer,
        },
        description=(
            "Create a new booking. "
            "The end_time is calculated automatically "
            "from the selected service duration."
        ),
    )
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        booking = create_booking(
            **serializer.validated_data
        )

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
            "Update an existing booking. "
            "Business rules are handled inside services.py."
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

        booking = update_booking(
            booking,
            **serializer.validated_data,
        )

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
                description="Booking deleted successfully."
            ),
        },
        description="Permanently delete a booking.",
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
        },
        description=(
            "Cancel an existing booking. "
            "The booking is not deleted; its status becomes cancelled."
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
        ],
        responses={
            200: OpenApiResponse(
                description=(
                    "Available appointment times."
                ),
            ),
        },
        description=(
            "Return available appointment times "
            "for a service on a specific date."
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

        available_times = get_available_times(
            booking_date=booking_date,
            service=service,
        )

        return Response(
            {
                "service": service.name,
                "date": booking_date,
                "available_times": available_times,
            }
        )