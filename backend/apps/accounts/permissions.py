from rest_framework.permissions import BasePermission


#: Every capability a staff account can hold, as
#: ``(value, human label)``. The order is the order the staff console
#: renders them in, so a permission is not silently accepted here and
#: then missing from the picker that is supposed to grant it.
CAPABILITY_CATALOG = [
    ("bookings.view", "View bookings"),
    ("bookings.manage", "Manage bookings"),
    ("payments.view", "View payments"),
    ("payments.verify", "Verify payments"),
    ("customers.view", "View customers"),
    ("customers.manage", "Edit & add customers"),
    ("customers.delete", "Delete customer accounts"),
    ("services.manage", "Manage services & barbers"),
    ("gallery.manage", "Manage gallery"),
    ("reviews.moderate", "Moderate reviews"),
    ("settings.manage", "Change shop settings"),
]

CAPABILITIES = [value for value, _ in CAPABILITY_CATALOG]


def granted_capabilities(user):
    """
    The capabilities a user effectively holds.

    The owner and any active administrator hold every capability
    without it being listed on their record, so the answer is the
    complete set rather than a filtered one. A user with no active
    staff access holds none, whether or not ``is_staff`` is still set.
    """

    if not user or not user.is_authenticated:
        return []

    if user.is_superuser:
        return list(CAPABILITIES)

    access = getattr(user, "staff_access", None)

    if not user.is_staff or not access or not access.is_active:
        return []

    if access.role == "admin":
        return list(CAPABILITIES)

    return [item for item in access.permissions if item in CAPABILITIES]


def can(capability, user):
    """True when the user holds the named capability."""

    return capability in granted_capabilities(user)


class HasStaffCapability(BasePermission):
    """Owner/superuser has all access; other staff need the named capability."""

    capability = None

    def has_permission(self, request, view):
        return can(self.capability, request.user)


def capability_permission(capability):
    return type(
        f"Can{capability.title().replace('.', '')}",
        (HasStaffCapability,),
        {"capability": capability},
    )


class IsStaffMember(BasePermission):
    """Any signed-in staff account, whatever its individual capabilities.

    Used by screens that only need to be inside the console - the
    dashboard reports what the viewer is allowed to see and omits the
    rest, rather than refusing the whole request because one section
    happens to be off limits.
    """

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if user.is_superuser:
            return True

        access = getattr(user, "staff_access", None)

        return bool(user.is_staff and access and access.is_active)
