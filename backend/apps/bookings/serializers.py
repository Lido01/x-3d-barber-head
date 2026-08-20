from rest_framework import serializers

from apps.services.models import Service
from .models import Booking


class BookingSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source="service.name", read_only=True)

    class Meta:
        model = Booking
        fields = [
            "id", "customer_name", "customer_phone", "service", "service_name",
            "booking_date", "start_time", "end_time", "status", "notes",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "end_time", "status", "created_at", "updated_at", "service_name",
        ]

    def validate_service(self, service):
        if not service.is_active:
            raise serializers.ValidationError("This service is not available for booking.")
        return service


class AvailabilitySerializer(serializers.Serializer):
    service = serializers.PrimaryKeyRelatedField(queryset=Service.objects.filter(is_active=True))
    booking_date = serializers.DateField()
