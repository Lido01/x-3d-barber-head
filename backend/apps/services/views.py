from rest_framework import status, viewsets
from rest_framework.response import Response

from .serializers import ServiceSerializer
from .services import ServiceService


class ServiceViewSet(viewsets.ViewSet):
    """Public CRUD API for barber services.

    Only active services are returned to customers. Write endpoints remain
    available for the current unauthenticated development setup.
    """
    serializer_class = ServiceSerializer

    def list(self, request):
        services = ServiceService.list_active()
        return Response(ServiceSerializer(services, many=True).data)

    def create(self, request):
        serializer = ServiceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        service = ServiceService.create(**serializer.validated_data)
        return Response(ServiceSerializer(service).data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, pk=None):
        service = ServiceService.get_active(pk)
        return Response(ServiceSerializer(service).data)

    def update(self, request, pk=None):
        service = ServiceService.get(pk)
        serializer = ServiceSerializer(service, data=request.data)
        serializer.is_valid(raise_exception=True)
        service = ServiceService.update(service, **serializer.validated_data)
        return Response(ServiceSerializer(service).data)

    def partial_update(self, request, pk=None):
        service = ServiceService.get(pk)
        serializer = ServiceSerializer(service, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        service = ServiceService.update(service, **serializer.validated_data)
        return Response(ServiceSerializer(service).data)

    def destroy(self, request, pk=None):
        service = ServiceService.get(pk)
        ServiceService.delete(service)
        return Response(status=status.HTTP_204_NO_CONTENT)
