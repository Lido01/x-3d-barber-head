from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from drf_spectacular.utils import (
    extend_schema,
    OpenApiResponse,
)

from .agent import BarberBookingAgent
from .serializers import AIChatSerializer


class AIAgentViewSet(viewsets.ViewSet):
    """
    Public AI barber booking assistant.

    Customers do not need an account.
    """

    permission_classes = [
        AllowAny,
    ]

    @extend_schema(
        request=AIChatSerializer,
        responses={
            200: OpenApiResponse(
                description="AI assistant response."
            ),
            400: OpenApiResponse(
                description="Invalid request."
            ),
            500: OpenApiResponse(
                description="AI provider configuration/error."
            ),
        },
        description=(
            "Chat with the AI barber booking assistant. "
            "Customers do not need to register or log in."
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

        data = serializer.validated_data

        state = {
            "customer_name": data.get(
                "customer_name",
                "",
            ),
            "customer_phone": data.get(
                "customer_phone",
                "",
            ),
            "service_id": data.get(
                "service_id",
            ),
            "booking_date": (
                str(data["booking_date"])
                if data.get("booking_date")
                else None
            ),
            "start_time": (
                str(data["start_time"])
                if data.get("start_time")
                else None
            ),
        }

        try:

            agent = BarberBookingAgent(
                state=state
            )

            result = agent.process(
                data["message"]
            )

            return Response(
                result,
                status=status.HTTP_200_OK,
            )

        except RuntimeError as exc:

            return Response(
                {
                    "success": False,
                    "error": str(exc),
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        except Exception as exc:

            return Response(
                {
                    "success": False,
                    "error": (
                        "The AI assistant is temporarily "
                        "unavailable."
                    ),
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
