"""Business logic for the services API."""

from django.shortcuts import get_object_or_404

from .models import Service

class ServiceService:
    """Encapsulates database operations for barber services."""

    @staticmethod
    def list_active():
        return Service.objects.filter(is_active=True)

    @staticmethod
    def get_active(service_id):
        return get_object_or_404(ServiceService.list_active(), pk=service_id)

    @staticmethod
    def get(service_id):
        return get_object_or_404(Service, pk=service_id)

    @staticmethod
    def create(**validated_data):
        return Service.objects.create(**validated_data)

    @staticmethod
    def update(service, **validated_data):
        for field, value in validated_data.items():
            setattr(service, field, value)
        service.save()
        return service

    @staticmethod
    def delete(service):
        service.delete()
