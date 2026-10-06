import re

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from drf_spectacular.utils import (
    extend_schema,
    OpenApiResponse,
)

from apps.accounts.audit import log_action
from apps.accounts.permissions import capability_permission

from .agent import BarberBookingAgent
from .models import ChatMessage, ChatSession, QuickAnswer
from .serializers import (
    AIChatSerializer,
    ChatMessageSerializer,
    QuickAnswerSerializer,
)

# How many earlier turns are sent to the AI provider with each message.
HISTORY_LIMIT = 12

_WORD_RE = re.compile(r"[a-z0-9']+")


def _words(text):
    return set(_WORD_RE.findall((text or "").lower()))


def match_quick_answer(message):
    """
    Find a saved question that fits the customer's message.

    A direct hit (either text contains the other, after normalising)
    wins. Otherwise the saved question whose word overlap with the
    message is strongest - but only when at least half of its words
    appear, so unrelated messages never get a canned answer.
    """

    message_words = _words(message)

    if not message_words:
        return None

    normalised = (message or "").strip().lower()

    best = None
    best_ratio = 0.0

    for answer in QuickAnswer.objects.filter(is_active=True):
        question = answer.question.strip().lower()

        if not question:
            continue

        if normalised in question or question in normalised:
            return answer

        question_words = _words(question)

        if not question_words:
            continue

        overlap = len(message_words & question_words)
        ratio = overlap / len(question_words)

        if ratio > best_ratio:
            best = answer
            best_ratio = ratio

    if best_ratio >= 0.5:
        return best

    return None


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

        session = None

        if data.get("session_id"):
            session = ChatSession.objects.filter(
                session_id=data["session_id"]
            ).first()

        if session is None:
            session = ChatSession.objects.create()

        history = list(
            session.messages
            .order_by("-created_at", "-id")
            .values("role", "text")[:HISTORY_LIMIT]
        )
        history.reverse()

        ChatMessage.objects.create(
            session=session,
            role=ChatMessage.Role.CUSTOMER,
            text=data["message"],
        )

        try:
            quick = match_quick_answer(data["message"])

            if quick is not None:
                reply = quick.answer
                used_quick_answer = True
            else:
                agent = BarberBookingAgent(
                    state=state,
                    history=history,
                )

                result = agent.process(data["message"])
                reply = result["message"]
                used_quick_answer = False

            ChatMessage.objects.create(
                session=session,
                role=ChatMessage.Role.ASSISTANT,
                text=reply,
            )

            session.save(update_fields=["last_message_at"])

            return Response(
                {
                    "success": True,
                    "message": reply,
                    "state": state,
                    "session_id": str(session.session_id),
                    "quick_answer": used_quick_answer,
                },
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
        except Exception:

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

    @extend_schema(
        request=None,
        responses={200: ChatMessageSerializer(many=True)},
        description=(
            "Read the messages of a chat session. Requires the "
            "session's UUID, which only the customer who started it "
            "has."
        ),
    )
    @action(
        detail=False,
        methods=["get"],
        url_path="session",
    )
    def session_history(self, request):
        session_id = request.query_params.get("session_id")

        if not session_id:
            return Response(
                {"detail": "session_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        session = ChatSession.objects.filter(
            session_id=session_id
        ).first()

        if session is None:
            return Response(
                {"detail": "Session not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            ChatMessageSerializer(
                session.messages.all(),
                many=True,
            ).data
        )


class QuickAnswerViewSet(viewsets.ModelViewSet):
    """
    Saved quick questions and answers.

    Public: read the active ones (the assistant and the help screen
    both read these).

    Staff with the ``ai.manage`` capability: create, update, delete -
    the admin screen for managing the assistant's saved answers.
    """

    serializer_class = QuickAnswerSerializer

    def get_queryset(self):
        user = self.request.user

        if user.is_authenticated and user.is_staff:
            return QuickAnswer.objects.all()

        return QuickAnswer.objects.filter(is_active=True)

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [AllowAny()]

        return [capability_permission("ai.manage")()]

    def perform_create(self, serializer):
        answer = serializer.save()
        log_action(
            self.request,
            "quick_answer.created",
            answer,
            {"question": answer.question},
        )

    def perform_update(self, serializer):
        answer = serializer.save()
        log_action(
            self.request,
            "quick_answer.updated",
            answer,
            {"question": answer.question},
        )

    def perform_destroy(self, instance):
        question = instance.question
        instance.delete()
        log_action(
            self.request,
            "quick_answer.deleted",
            details={"question": question},
        )
