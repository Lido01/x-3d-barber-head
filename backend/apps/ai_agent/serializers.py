from rest_framework import serializers


class AIChatSerializer(serializers.Serializer):
    message = serializers.CharField(
        required=True,
        allow_blank=False,
        trim_whitespace=True,
    )

    customer_name = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=120,
    )

    customer_phone = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=30,
    )


class AIServiceRequestSerializer(serializers.Serializer):
    service_id = serializers.IntegerField(
        required=True,
        min_value=1,
    )


class AIAvailabilityRequestSerializer(serializers.Serializer):
    service_id = serializers.IntegerField(
        required=True,
        min_value=1,
    )

    booking_date = serializers.DateField(
        required=True,
    )


class AIBookingRequestSerializer(serializers.Serializer):
    customer_name = serializers.CharField(
        required=True,
        max_length=120,
    )

    customer_phone = serializers.CharField(
        required=True,
        max_length=30,
    )

    service_id = serializers.IntegerField(
        required=True,
        min_value=1,
    )

    booking_date = serializers.DateField(
        required=True,
    )

    start_time = serializers.TimeField(
        required=True,
    )

    notes = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )