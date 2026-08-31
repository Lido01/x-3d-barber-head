from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from drf_spectacular.utils import (
    extend_schema,
    OpenApiResponse,
)

from .serializers import (
    AIAvailabilityRequestSerializer,
    AIBookingRequestSerializer,
    AIChatSerializer,
    AIServiceRequestSerializer,
)
from .services import AIAgentService


class AIAgentViewSet(viewsets.ViewSet):
    """
    Public AI booking assistant API.

    Customers do not need an account to use the assistant.

    The AI agent can eventually:
    - understand customer messages
    - find services
    - show haircut styles
    - check availability
    - create bookings
    """

    permission_classes = [AllowAny]

    # ---------------------------------------------------------
    # CHAT
    # ---------------------------------------------------------

    @extend_schema(
        request=AIChatSerializer,
        responses={
            200: OpenApiResponse(
                description="AI assistant response."
            ),
        },
        description=(
            "Main public AI assistant endpoint. "
            "Natural-language understanding will be "
            "connected in the next step."
        ),
    )
    @action(
        detail=False,
        methods=["post"],
        url_path="chat",
    )
    def chat(self, request):
        serializer = AIChatSerializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        message = serializer.validated_data["message"]

        return Response(
            {
                "success": True,
                "message": (
                    "AI agent endpoint is working."
                ),
                "user_message": message,
                "next_step": (
                    "Connect the AI model to "
                    "the booking tools."
                ),
            }
        )

    # ---------------------------------------------------------
    # SERVICES
    # ---------------------------------------------------------

    @extend_schema(
        responses={
            200: OpenApiResponse(
                description="Available barber services."
            ),
        },
        description=(
            "Return all active barber services "
            "available to the AI assistant."
        ),
    )
    @action(
        detail=False,
        methods=["get"],
        url_path="services",
    )
    def services(self, request):
        return Response(
            AIAgentService.services()
        )

    # ---------------------------------------------------------
    # SERVICE DETAILS
    # ---------------------------------------------------------

    @extend_schema(
        request=AIServiceRequestSerializer,
        responses={
            200: OpenApiResponse(
                description="Service details."
            ),
        },
        description=(
            "Return details and haircut styles "
            "for a specific active service."
        ),
    )
    @action(
        detail=False,
        methods=["get"],
        url_path="service/(?P<service_id>[^/.]+)",
    )
    def service_details(
        self,
        request,
        service_id=None,
    ):
        result = AIAgentService.service_details(
            int(service_id)
        )

        if not result.get("success"):
            return Response(
                result,
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(result)

    # ---------------------------------------------------------
    # AVAILABILITY
    # ---------------------------------------------------------

    @extend_schema(
        request=AIAvailabilityRequestSerializer,
        responses={
            200: OpenApiResponse(
                description="Available appointment times."
            ),
        },
        description=(
            "Check available booking times "
            "for a service on a specific date."
        ),
    )
    @action(
        detail=False,
        methods=["post"],
        url_path="availability",
    )
    def availability(self, request):
        serializer = AIAvailabilityRequestSerializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        result = AIAgentService.availability(
            service_id=serializer.validated_data[
                "service_id"
            ],
            booking_date=serializer.validated_data[
                "booking_date"
            ],
        )

        return Response(result)

    # ---------------------------------------------------------
    # BOOKING
    # ---------------------------------------------------------

    @extend_schema(
        request=AIBookingRequestSerializer,
        responses={
            201: OpenApiResponse(
                description="Booking created."
            ),
        },
        description=(
            "Create a booking through the AI "
            "booking system. Customer login is "
            "not required."
        ),
    )
    @action(
        detail=False,
        methods=["post"],
        url_path="booking",
    )
    def booking(self, request):
        serializer = AIBookingRequestSerializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        result = AIAgentService.create_booking(
            **serializer.validated_data
        )

        return Response(
            result,
            status=status.HTTP_201_CREATED,
        )