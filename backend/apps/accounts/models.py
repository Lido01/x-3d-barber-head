from datetime import time

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class ShopSettings(models.Model):
    """
    The shop's own details, in one row.

    A singleton: there is exactly one of these and it is created on first
    read, so nothing has to handle "the settings row does not exist yet".
    That matters because these values are read by the booking form and
    the public contact details, which must never 500 just because an
    owner has not opened the settings screen.

    Everything here is a fact about the shop that used to be hardcoded in
    the markup. Making it editable is the difference between a settings
    screen that shows a form and one that actually changes the business.
    """

    business_name = models.CharField(max_length=120, default="NOIR Barbers")
    tagline = models.CharField(max_length=200, blank=True)

    phone = models.CharField(max_length=40, blank=True)
    email = models.EmailField(blank=True)
    address = models.CharField(max_length=250, blank=True)

    #: IANA-ish name used for display, not for arithmetic. Prices are
    #: still stored as plain decimals; this is what they are labelled
    #: with, so a shop can be in Birr or not without a migration.
    currency = models.CharField(max_length=8, default="ETB")

    #: When the chair is available. The booking form already had these
    #: as settings, so they live with the rest of the shop's facts
    #: rather than staying in settings.py where the console could not
    #: reach them.
    opening_time = models.TimeField(default=time(9, 0))
    closing_time = models.TimeField(default=time(21, 0))

    #: How far ahead a customer may book. Zero means no limit, which is
    #: the existing behaviour.
    booking_horizon_days = models.PositiveSmallIntegerField(
        default=60,
        validators=[MinValueValidator(0), MaxValueValidator(730)],
    )

    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="settings_changes",
    )

    class Meta:
        verbose_name_plural = "Shop settings"

    def __str__(self):
        return self.business_name

    @classmethod
    def load(cls):
        """
        The one row, created on first read.

        `get_or_create` rather than assuming a migration seeded it: a
        fresh database and a seeded one then behave identically, and the
        storefront cannot fail on a missing row.
        """

        instance, _ = cls.objects.get_or_create(pk=1)

        return instance


class AccountProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    phone = models.CharField(max_length=30, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.user.get_username()


class StaffAccess(models.Model):
    """Role and explicit capabilities for a non-owner staff account."""

    class Role(models.TextChoices):
        ADMIN = "admin", "Administrator"
        RECEPTION = "reception", "Reception"
        STAFF = "staff", "Staff"

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="staff_access")
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.STAFF)
    permissions = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.get_username()} ({self.get_role_display()})"


class AuditLog(models.Model):
    """Immutable record of privileged activity for owner review."""

    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="audit_actions")
    action = models.CharField(max_length=100)
    target_type = models.CharField(max_length=80, blank=True)
    target_id = models.CharField(max_length=80, blank=True)
    details = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.action} by {self.actor or 'system'}"
