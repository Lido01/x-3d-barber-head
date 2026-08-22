from django.urls import path

from .views import CurrentAccountView, RegistrationView

urlpatterns = [
    path("accounts/register/", RegistrationView.as_view(), name="account-register"),
    path("accounts/me/", CurrentAccountView.as_view(), name="account-me"),
]
