from rest_framework.routers import DefaultRouter

from .views import AIAgentViewSet, QuickAnswerViewSet


router = DefaultRouter()

router.register(
    "ai-agent",
    AIAgentViewSet,
    basename="ai-agent",
)

router.register(
    "quick-answers",
    QuickAnswerViewSet,
    basename="quick-answers",
)

urlpatterns = router.urls
