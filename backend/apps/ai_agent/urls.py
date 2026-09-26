from rest_framework.routers import DefaultRouter

from .views import AIAgentViewSet


router = DefaultRouter()

router.register(
    "ai-agent",
    AIAgentViewSet,
    basename="ai-agent",
)

urlpatterns = router.urls
