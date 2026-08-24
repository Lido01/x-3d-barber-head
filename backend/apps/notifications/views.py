from rest_framework import viewsets

from .models import Notification
from .serializers import NotificationSerializer


class NotificationViewSet(
    viewsets.ReadOnlyModelViewSet
):
    """
    Read-only notification history.

    Notifications should normally be created
    through services.py rather than directly
    through the API.
    """

    queryset = Notification.objects.select_related(
        "booking",
        "booking__service",
    )

    serializer_class = NotificationSerializer