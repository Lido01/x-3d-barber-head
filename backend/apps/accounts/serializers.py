from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction

from rest_framework import serializers
from rest_framework_simplejwt.serializers import (
    TokenObtainPairSerializer,
)

from .models import AccountProfile


User = get_user_model()


PASSWORD_STYLE = {
    "input_type": "password",
}


class AccountSerializer(serializers.ModelSerializer):
    """
    Serializer used for reading and updating the
    authenticated user's account information.
    """

    phone = serializers.CharField(
        max_length=30,
        required=False,
        allow_blank=True,
    )

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
        ]

    def to_representation(self, user):
        """
        Read `phone` from the related AccountProfile,
        falling back to an empty string when the
        profile has not been created yet.
        """

        data = super().to_representation(user)

        profile = getattr(
            user,
            "profile",
            None,
        )

        data["phone"] = (
            profile.phone if profile else ""
        )

        return data

    def validate_email(self, value):
        """
        Normalize the email and prevent it from
        colliding with another account.
        """

        value = value.strip().lower()

        duplicates = User.objects.filter(
            email__iexact=value
        )

        if self.instance is not None:
            duplicates = duplicates.exclude(
                pk=self.instance.pk
            )

        if duplicates.exists():
            raise serializers.ValidationError(
                "An account with this email already exists."
            )

        return value

    @transaction.atomic
    def update(self, instance, validated_data):
        """
        Update the User fields and the phone number
        stored on the AccountProfile.
        """

        phone = validated_data.pop(
            "phone",
            None,
        )

        for field, value in validated_data.items():
            setattr(instance, field, value)

        instance.save()

        if phone is not None:
            profile, _ = AccountProfile.objects.update_or_create(
                user=instance,
                defaults={
                    "phone": phone,
                },
            )

            # Refresh the cached relation so the response
            # reflects the new phone number.
            instance.profile = profile

        return instance


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
        trim_whitespace=False,
        style=PASSWORD_STYLE,
    )

    password_confirm = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
        style=PASSWORD_STYLE,
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
                "allow_blank": False,
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
        Make sure both passwords match and that the
        password satisfies AUTH_PASSWORD_VALIDATORS.
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

        candidate = User(
            username=attrs.get("username", ""),
            email=attrs.get("email", ""),
            first_name=attrs.get("first_name", ""),
            last_name=attrs.get("last_name", ""),
        )

        try:
            validate_password(
                password,
                candidate,
            )
        except DjangoValidationError as error:
            raise serializers.ValidationError({
                "password": list(error.messages)
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

        # The post_save signal already created an empty profile
        # and cached it on `user`, so update that row and refresh
        # the cached relation for the response representation.
        profile, _ = AccountProfile.objects.update_or_create(
            user=user,
            defaults={
                "phone": phone,
            },
        )

        user.profile = profile

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


class LoginResponseSerializer(serializers.Serializer):
    """
    Documents the login response body.

    LoginSerializer builds its payload inside `validate()`,
    which drf-spectacular cannot introspect, so this
    serializer is referenced by the schema instead.
    """

    access = serializers.CharField(
        read_only=True,
    )

    refresh = serializers.CharField(
        read_only=True,
    )

    user = AccountSerializer(
        read_only=True,
    )


class PasswordChangeSerializer(serializers.Serializer):
    """
    Serializer used to change the authenticated
    user's password.
    """

    current_password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
        style=PASSWORD_STYLE,
    )

    new_password = serializers.CharField(
        write_only=True,
        min_length=8,
        trim_whitespace=False,
        style=PASSWORD_STYLE,
    )

    new_password_confirm = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
        style=PASSWORD_STYLE,
    )

    def validate_current_password(self, value):
        user = self.context["request"].user

        if not user.check_password(value):
            raise serializers.ValidationError(
                "Current password is incorrect."
            )

        return value

    def validate(self, attrs):
        new_password = attrs.get("new_password")

        if new_password != attrs.get(
            "new_password_confirm"
        ):
            raise serializers.ValidationError({
                "new_password_confirm": (
                    "Passwords do not match."
                )
            })

        user = self.context["request"].user

        try:
            validate_password(
                new_password,
                user,
            )
        except DjangoValidationError as error:
            raise serializers.ValidationError({
                "new_password": list(error.messages)
            })

        return attrs

    def save(self, **kwargs):
        user = self.context["request"].user

        user.set_password(
            self.validated_data["new_password"]
        )

        user.save(
            update_fields=["password"]
        )

        return user
