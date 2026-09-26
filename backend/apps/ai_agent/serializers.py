from rest_framework import serializers


class AIChatSerializer(serializers.Serializer):

    message = serializers.CharField(
        required=True,
        allow_blank=False,
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