from rest_framework.routers import DefaultRouter

from .views import GalleryPostViewSet


router = DefaultRouter()

router.register(
    "gallery",
    GalleryPostViewSet,
    basename="gallery",
)

urlpatterns = router.urls