from django.conf import settings
from django.db import models


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
