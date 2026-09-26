from rest_framework import serializers

from apps.services.models import Service

from .models import Barber, Booking
from .services import (
    create_booking,
    update_booking,
)


class BookingSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(
        source="service.name",
        read_only=True,
    )

    barber_name = serializers.CharField(
        source="barber.name",
        read_only=True,
    )

    class Meta:
        model = Booking

        fields = [
            "id",
            "customer_name",
            "customer_phone",
            "service",
            "service_name",
            "barber",
            "barber_name",
            "booking_date",
            "start_time",
            "end_time",
            "status",
            "notes",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "end_time",
            "status",
            "created_at",
            "updated_at",
            "service_name",
            "barber_name",
        ]

    def validate_service(self, service):
        if not service.is_active:
            raise serializers.ValidationError(
                "This service is not available."
            )

        return service

    def validate_barber(self, barber):
        if not barber.is_active:
            raise serializers.ValidationError(
                "This barber is not currently available."
            )

        return barber

    def create(self, validated_data):
        """
        Send booking creation to the business layer.
        """

        try:
            return create_booking(
                customer_name=validated_data.get(
                    "customer_name"
                ),
                customer_phone=validated_data.get(
                    "customer_phone"
                ),
                service=validated_data.get(
                    "service"
                ),
                barber=validated_data.get(
                    "barber"
                ),
                booking_date=validated_data.get(
                    "booking_date"
                ),
                start_time=validated_data.get(
                    "start_time"
                ),
                notes=validated_data.get(
                    "notes",
                    "",
                ),
            )

        except serializers.ValidationError:
            raise

        except Exception as exc:
            raise serializers.ValidationError(
                {
                    "detail": str(exc)
                }
            )

    def update(self, instance, validated_data):
        """
        Send booking updates to the business layer.
        """

        try:
            return update_booking(
                instance,
                customer_name=validated_data.get(
                    "customer_name"
                ),
                customer_phone=validated_data.get(
                    "customer_phone"
                ),
                service=validated_data.get(
                    "service"
                ),
                barber=validated_data.get(
                    "barber"
                ),
                booking_date=validated_data.get(
                    "booking_date"
                ),
                start_time=validated_data.get(
                    "start_time"
                ),
                notes=validated_data.get(
                    "notes"
                ),
            )

        except serializers.ValidationError:
            raise

        except Exception as exc:
            raise serializers.ValidationError(
                {
                    "detail": str(exc)
                }
            )


class AvailabilitySerializer(serializers.Serializer):
    service = serializers.PrimaryKeyRelatedField(
        queryset=Service.objects.filter(
            is_active=True
        )
    )

    booking_date = serializers.DateField()
    
    barber = serializers.PrimaryKeyRelatedField(
        queryset=Barber.objects.filter(
            is_active=True
        ),
        required=False,
        allow_null=True,
    )


class BarberSerializer(serializers.ModelSerializer):
    class Meta:
        model = Barber

        fields = [
            "id",
            "name",
            "role",
            "specialty",
            "experience",
            "bio",
            "image",
            "phone",
            "is_active",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]

