from drf_spectacular.utils import (
    extend_schema,
    extend_schema_view,
    OpenApiResponse,
)
from django.contrib.auth import get_user_model

from rest_framework import generics, permissions, status
from rest_framework.response import Response

from rest_framework_simplejwt.views import (
    TokenObtainPairView,
)

from .serializers import (
    AccountSerializer,
    AdminAccountSerializer,
    LoginResponseSerializer,
    LoginSerializer,
    PasswordChangeSerializer,
    RegistrationSerializer,
)


User = get_user_model()


@extend_schema(
    responses={200: AdminAccountSerializer(many=True)},
    description=(
        "List registered customer accounts for staff. "
        "Staff accounts are excluded and an optional `q` parameter searches "
        "the name, username, email and phone number."
    ),
)
class AdminAccountListView(generics.ListAPIView):
    """Staff-only, read-only customer directory for the mobile console."""

    serializer_class = AdminAccountSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        queryset = (
            User.objects.filter(is_staff=False)
            .select_related("profile")
            .order_by("-date_joined")
        )
        query = self.request.query_params.get("q", "").strip()

        if query:
            from django.db.models import Q

            queryset = queryset.filter(
                Q(username__icontains=query)
                | Q(email__icontains=query)
                | Q(first_name__icontains=query)
                | Q(last_name__icontains=query)
                | Q(profile__phone__icontains=query)
            )

        return queryset


@extend_schema(
    request=RegistrationSerializer,
    responses={
        201: AccountSerializer,
    },
    description=(
        "Register a new customer account. "
        "Returns the created account; the password "
        "fields are never echoed back. "
        "Call /api/accounts/login/ afterwards to obtain tokens."
    ),
)
class RegistrationView(generics.CreateAPIView):
    serializer_class = RegistrationSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(AccountSerializer(user).data, status=status.HTTP_201_CREATED)


@extend_schema_view(
    get=extend_schema(
        responses={
            200: AccountSerializer,
        },
        description=(
            "Return the authenticated user's account. "
            "Requires an `Authorization: Bearer <access>` header."
        ),
    ),
    patch=extend_schema(
        request=AccountSerializer,
        responses={
            200: AccountSerializer,
        },
        description=(
            "Update the authenticated user's email, name "
            "or phone number. `id` and `username` are read-only."
        ),
    ),
)
class CurrentAccountView(generics.RetrieveUpdateAPIView):
    serializer_class = AccountSerializer
    permission_classes = [permissions.IsAuthenticated]

    http_method_names = [
        "get",
        "patch",
        "head",
        "options",
    ]

    def get_object(self):
        return self.request.user


@extend_schema(
    request=LoginSerializer,
    responses={
        200: LoginResponseSerializer,
        401: OpenApiResponse(
            description="No active account found with the given credentials.",
        ),
    },
    description=(
        "Authenticate with username and password. "
        "Returns an access token, a refresh token and "
        "the account information."
    ),
)
class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer


@extend_schema(
    request=PasswordChangeSerializer,
    responses={
        200: OpenApiResponse(
            description="Password updated successfully.",
        ),
    },
    description=(
        "Change the authenticated user's password. "
        "Existing tokens stay valid until they expire."
    ),
)
class PasswordChangeView(generics.GenericAPIView):
    serializer_class = PasswordChangeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {"detail": "Password updated successfully."},
            status=status.HTTP_200_OK,
        )
