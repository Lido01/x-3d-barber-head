from rest_framework import serializers

from .models import Notification


class NotificationSerializer(
    serializers.ModelSerializer
):

    booking_customer = serializers.CharField(
        source="booking.customer_name",
        read_only=True,
    )

    class Meta:
        model = Notification

        fields = [
            "id",
            "booking",
            "booking_customer",
            "notification_type",
            "channel",
            "recipient",
            "subject",
            "message",
            "status",
            "error_message",
            "sent_at",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "booking_customer",
            "status",
            "error_message",
            "sent_at",
            "created_at",
        ]