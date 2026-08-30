from rest_framework.routers import DefaultRouter

from .views import BarberViewSet, BookingViewSet


router = DefaultRouter()

router.register(
    "bookings",
    BookingViewSet,
    basename="booking",
)

router.register(
    "barbers",
    BarberViewSet,
    basename="barber",
)

urlpatterns = router.urls
