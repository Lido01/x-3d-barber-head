from django.urls import path

from .views import CurrentAccountView, RegistrationView, LoginView

from django.urls import path


urlpatterns = [
    path(
        "register/",
        RegistrationView.as_view(),
        name="register",
    ),

    path(
        "login/",
        LoginView.as_view(),
        name="login",
    ),

    path("accounts/me/", CurrentAccountView.as_view(), name="account-me"),
]
