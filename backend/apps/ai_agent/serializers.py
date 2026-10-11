from rest_framework import serializers

from .models import ChatMessage, QuickAnswer


class AIChatSerializer(serializers.Serializer):

    message = serializers.CharField(
        required=True,
        allow_blank=False,
    )

    session_id = serializers.UUIDField(
        required=False,
        allow_null=True,
    )

    customer_name = serializers.CharField(
        required=False,
        allow_blank=True,
    )

    customer_phone = serializers.CharField(
        required=False,
        allow_blank=True,
    )

    service_id = serializers.IntegerField(
        required=False,
        allow_null=True,
    )

    booking_date = serializers.DateField(
        required=False,
        allow_null=True,
    )

    start_time = serializers.TimeField(
        required=False,
        allow_null=True,
    )


class QuickAnswerSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuickAnswer
        fields = [
            "id",
            "question",
            "answer",
            "is_active",
            "sort_order",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ["id", "role", "text", "created_at"]
        read_only_fields = fields
