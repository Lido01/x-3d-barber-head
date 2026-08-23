from django.contrib.auth import get_user_model
from django.db import transaction

from rest_framework import serializers
from rest_framework_simplejwt.serializers import (
    TokenObtainPairSerializer,
)

from .models import AccountProfile


User = get_user_model()


class AccountSerializer(serializers.ModelSerializer):
    """
    Serializer used for returning the authenticated user's
    account information.
    """

    phone = serializers.SerializerMethodField()

    class Meta:
        model = User

        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "phone",
        ]

        read_only_fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "phone",
        ]

    def get_phone(self, user):
        profile = getattr(
            user,
            "profile",
            None,
        )

        if profile:
            return profile.phone or ""

        return ""


class RegistrationSerializer(serializers.ModelSerializer):
    """
    Serializer used to register a new customer account.
    """

    phone = serializers.CharField(
        max_length=30,
        required=False,
        allow_blank=True,
    )

    password = serializers.CharField(
        write_only=True,
        min_length=8,
    )

    password_confirm = serializers.CharField(
        write_only=True,
    )

    class Meta:
        model = User

        fields = [
            "username",
            "email",
            "first_name",
            "last_name",
            "phone",
            "password",
            "password_confirm",
        ]

        extra_kwargs = {
            "email": {
                "required": True,
            },
            "username": {
                "required": True,
            },
        }

    def validate_email(self, value):
        """
        Normalize the email and prevent duplicate accounts.
        """

        value = value.strip().lower()

        if User.objects.filter(
            email__iexact=value
        ).exists():
            raise serializers.ValidationError(
                "An account with this email already exists."
            )

        return value

    def validate_username(self, value):
        """
        Prevent duplicate usernames.
        """

        value = value.strip()

        if User.objects.filter(
            username__iexact=value
        ).exists():
            raise serializers.ValidationError(
                "This username is already taken."
            )

        return value

    def validate(self, attrs):
        """
        Make sure both passwords match.
        """

        password = attrs.get("password")
        password_confirm = attrs.get(
            "password_confirm"
        )

        if password != password_confirm:
            raise serializers.ValidationError({
                "password_confirm": (
                    "Passwords do not match."
                )
            })

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        """
        Create the User and AccountProfile
        as one database transaction.
        """

        phone = validated_data.pop(
            "phone",
            "",
        )

        validated_data.pop(
            "password_confirm"
        )

        password = validated_data.pop(
            "password"
        )

        user = User.objects.create_user(
            password=password,
            **validated_data,
        )

        AccountProfile.objects.create(
            user=user,
            phone=phone,
        )

        return user

class LoginSerializer(TokenObtainPairSerializer):
    """
    Login serializer that returns JWT tokens
    together with basic account information.
    """

    def validate(self, attrs):
        data = super().validate(attrs)

        data["user"] = AccountSerializer(
            self.user
        ).data

        return data