from rest_framework import serializers
from apps.services.models import Service
from .models import Booking
# Import your business logic services
from .services import create_booking, update_booking

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
            raise serializers.ValidationError("This service is not available.")
        return service

    def create(self, validated_data):
        """Intercept standard save and use your workflows module."""
        try:
            return create_booking(
                customer_name=validated_data.get("customer_name"),
                customer_phone=validated_data.get("customer_phone"),
                service=validated_data.get("service"),
                booking_date=validated_data.get("booking_date"),
                start_time=validated_data.get("start_time"),
                notes=validated_data.get("notes", ""),
            )
        except serializers.ValidationError as e:
            raise e
        except Exception as e:
            # Catch standard Django/Python errors and format them for DRF
            raise serializers.ValidationError(detail=str(e))

    def update(self, instance, validated_data):
        """Intercept standard update and use your workflows module."""
        try:
            return update_booking(
                instance,
                customer_name=validated_data.get("customer_name"),
                customer_phone=validated_data.get("customer_phone"),
                service=validated_data.get("service"),
                booking_date=validated_data.get("booking_date"),
                start_time=validated_data.get("start_time"),
                notes=validated_data.get("notes"),
            )
        except serializers.ValidationError as e:
            raise e
        except Exception as e:
            raise serializers.ValidationError(detail=str(e))


class AvailabilitySerializer(serializers.Serializer):
    service = serializers.PrimaryKeyRelatedField(queryset=Service.objects.filter(is_active=True))
    booking_date = serializers.DateField()
