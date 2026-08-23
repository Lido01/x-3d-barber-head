from rest_framework import generics, permissions, status
from rest_framework.response import Response

from .serializers import AccountSerializer, RegistrationSerializer

from rest_framework_simplejwt.views import (
    TokenObtainPairView,
)

from .serializers import LoginSerializer



class RegistrationView(generics.CreateAPIView):
    serializer_class = RegistrationSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(AccountSerializer(user).data, status=status.HTTP_201_CREATED)


class CurrentAccountView(generics.RetrieveAPIView):
    serializer_class = AccountSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer