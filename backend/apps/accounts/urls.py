from django.urls import path

from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    AdminAccountListView,
    CurrentAccountView,
    LoginView,
    PasswordChangeView,
    RegistrationView,
)

urlpatterns = [
    path(
        "customers/",
        AdminAccountListView.as_view(),
        name="admin-customer-list",
    ),
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

    path(
        "token/refresh/",
        TokenRefreshView.as_view(),
        name="token-refresh",
    ),

    path(
        "me/",
        CurrentAccountView.as_view(),
        name="account-me",
    ),

    path(
        "password/change/",
        PasswordChangeView.as_view(),
        name="password-change",
    ),
]
