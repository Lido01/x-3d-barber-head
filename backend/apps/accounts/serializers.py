from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from .models import AccountProfile

User = get_user_model()


class AccountSerializer(serializers.ModelSerializer):
    phone = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "phone"]
        read_only_fields = fields

    def get_phone(self, user):
        profile = getattr(user, "profile", None)
        return profile.phone if profile else ""


class RegistrationSerializer(serializers.ModelSerializer):
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["username", "email", "first_name", "last_name", "phone", "password", "password_confirm"]
        extra_kwargs = {"email": {"required": True}}

    def validate(self, attrs):
        if attrs["password"] != attrs.pop("password_confirm"):
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        phone = validated_data.pop("phone", "")
        password = validated_data.pop("password")
        user = User.objects.create_user(password=password, **validated_data)
        AccountProfile.objects.create(user=user, phone=phone)
        return user
