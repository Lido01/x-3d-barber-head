from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Booking
from .serializers import (
    BookingSerializer,
    AvailabilitySerializer,
)
from .services import (
    create_booking,
    get_available_times,
)


class BookingViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):

    queryset = Booking.objects.select_related(
        "service"
    )

    serializer_class = BookingSerializer

    def create(self, request, *args, **kwargs):

        serializer = self.get_serializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        booking = create_booking(
            customer_name=serializer.validated_data[
                "customer_name"
            ],
            customer_phone=serializer.validated_data[
                "customer_phone"
            ],
            service=serializer.validated_data[
                "service"
            ],
            booking_date=serializer.validated_data[
                "booking_date"
            ],
            start_time=serializer.validated_data[
                "start_time"
            ],
            notes=serializer.validated_data.get(
                "notes",
                "",
            ),
        )

        response_serializer = self.get_serializer(
            booking
        )

        return Response(
            response_serializer.data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=False,
        methods=["get"],
        url_path="availability",
    )
    def availability(self, request):

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

        return Response({
            "service": service.name,
            "date": booking_date,
            "available_times": available_times,
        })
