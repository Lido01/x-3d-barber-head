from rest_framework import viewsets
from .models import Service
from .serializers import ServiceSerializer


class ServiceViewSet(viewsets.ModelViewSet):
    queryset = Service.objects.all()
    serializer_class = ServiceSerializer

    def get_queryset(self):
        queryset = Service.objects.all()

        if self.request.method == "GET":
            queryset = queryset.filter(is_active=True)

        return queryset