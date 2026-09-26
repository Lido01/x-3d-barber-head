"""Business logic for the services API."""

from django.shortcuts import get_object_or_404

from .models import HaircutStyle, Service


class ServiceService:
    """Encapsulates business logic for barber services."""

    @staticmethod
    def list_active():
        return (
            Service.objects
            .filter(is_active=True)
            .prefetch_related(
                "styles"
            )
        )

    @staticmethod
    def list_all():
        return Service.objects.prefetch_related("styles")

    @staticmethod
    def get_active(service_id):
        return get_object_or_404(
            Service.objects
            .filter(is_active=True)
            .prefetch_related("styles"),
            pk=service_id,
        )

    @staticmethod
    def get(service_id):
        return get_object_or_404(
            Service.objects
            .prefetch_related("styles"),
            pk=service_id,
        )

    @staticmethod
    def create(**validated_data):
        return Service.objects.create(
            **validated_data
        )

    @staticmethod
    def update(
        service,
        **validated_data
    ):
        for field, value in validated_data.items():
            setattr(
                service,
                field,
                value,
            )

        service.save()

        return service

    @staticmethod
    def delete(service):
        service.delete()


class HaircutStyleService:
    """Business logic for haircut styles."""

    @staticmethod
    def list_for_service(service):
        return HaircutStyle.objects.filter(
            service=service,
            is_active=True,
        )

    @staticmethod
    def get(style_id):
        return get_object_or_404(
            HaircutStyle,
            pk=style_id,
        )

    @staticmethod
    def get_for_service(
        service,
        style_id,
    ):
        return get_object_or_404(
            HaircutStyle,
            pk=style_id,
            service=service,
        )

    @staticmethod
    def create(
        *,
        service,
        **validated_data
    ):
        return HaircutStyle.objects.create(
            service=service,
            **validated_data
        )

    @staticmethod
    def update(
        style,
        **validated_data
    ):
        for field, value in validated_data.items():
            setattr(
                style,
                field,
                value,
            )

        style.save()

        return style

    @staticmethod
    def delete(style):
        style.delete()