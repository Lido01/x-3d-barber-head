from django.urls import path

from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    AdminAccountListView,
    CurrentAccountView,
    LoginView,
    PasswordChangeView,
    RegistrationView,
    StaffAccessListCreateView,
    StaffAccessDetailView,
    AuditLogListView,
    DashboardView,
    UserManagementListView,
    UserManagementDetailView,
    UserPasswordResetView,
    OperationsReportView,
)

urlpatterns = [
    path(
        "customers/",
        AdminAccountListView.as_view(),
        name="admin-customer-list",
    ),
    path("staff/", StaffAccessListCreateView.as_view(), name="staff-access-list"),
    path("staff/<int:pk>/", StaffAccessDetailView.as_view(), name="staff-access-detail"),
    path("audit-logs/", AuditLogListView.as_view(), name="audit-log-list"),
    path("users/", UserManagementListView.as_view(), name="user-management-list"),
    path("users/<int:pk>/", UserManagementDetailView.as_view(), name="user-management-detail"),
    path("users/<int:pk>/password/", UserPasswordResetView.as_view(), name="user-password-reset"),
    path("reports/dashboard/", DashboardView.as_view(), name="dashboard"),
    path("reports/operations/", OperationsReportView.as_view(), name="operations-report"),
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
