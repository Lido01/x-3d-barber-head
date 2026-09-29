from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction

from rest_framework import serializers
from rest_framework_simplejwt.serializers import (
    TokenObtainPairSerializer,
)

from .models import AccountProfile, AuditLog, StaffAccess
from .permissions import CAPABILITIES, CAPABILITY_CATALOG, granted_capabilities


User = get_user_model()


def session_payload(user):
    """
    The role and capabilities a signed-in account holds.

    The console needs to know both to decide which screens to render
    and which actions to offer, and the answer must be identical
    whether it arrives from the login response or from a later
    ``/me/`` revalidation - otherwise a page would render against one
    set of capabilities and then 403 against the other.

    ``permissions`` is the *effective* set: an administrator holds all
    of them whether or not they are listed on the record, so a client
    does not have to reimplement the owner's and admin's bypass rules.
    ``staff_role`` is null for a plain customer, which is how the staff
    console recognises an account that must not enter it at all.
    """

    if user.is_superuser:
        return {"staff_role": "owner", "permissions": ["*"], "is_unlimited": True}

    access = getattr(user, "staff_access", None)

    if not user.is_staff or not access or not access.is_active:
        return {"staff_role": None, "permissions": [], "is_unlimited": False}

    return {
        "staff_role": access.role,
        "permissions": granted_capabilities(user),
        "is_unlimited": access.role == StaffAccess.Role.ADMIN,
    }


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


class AdminAccountSerializer(AccountSerializer):
    """A safe, read-only customer record for the staff console."""

    full_name = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField(
        source="profile.created_at",
        read_only=True,
    )

    class Meta(AccountSerializer.Meta):
        fields = AccountSerializer.Meta.fields + [
            "full_name",
            "created_at",
        ]
        read_only_fields = fields

    def get_full_name(self, user) -> str:
        return user.get_full_name().strip()


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

        data["user"] = AccountSerializer(self.user).data
        data["user"].update(session_payload(self.user))

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


class StaffAccessSerializer(serializers.ModelSerializer):
    """
    A team member's console access.

    `user` takes an account id, so granting access is one call rather
    than "find the account, then create the access" - the two screens
    that grant access (team and user management) both use this.
    """
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = StaffAccess
        fields = ["id", "user", "username", "email", "full_name", "role", "permissions", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_full_name(self, obj) -> str:
        return obj.user.get_full_name().strip()

    def validate_permissions(self, value):
        unknown = set(value) - set(CAPABILITIES)
        if unknown:
            raise serializers.ValidationError(f"Unknown permissions: {', '.join(sorted(unknown))}")
        return value


class AuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = ["id", "actor", "actor_name", "action", "target_type", "target_id", "details", "ip_address", "created_at"]

    def get_actor_name(self, obj) -> str:
        return obj.actor.get_username() if obj.actor else "System"


class ManagedRoleField(serializers.ChoiceField):
    """
    An account's role, both read and written.

    The role does not live on the user row - it lives on the related
    ``StaffAccess`` - so a plain ``ChoiceField`` would find nothing to
    read and DRF would drop the field from the response entirely.
    Reading it here instead is what lets the same name be sent by the
    console and returned by the API.
    """

    def __init__(self, choices, **kwargs):
        kwargs.setdefault("required", False)
        super().__init__(choices=choices, **kwargs)

    def get_attribute(self, instance):
        if isinstance(instance, User):
            if instance.is_superuser:
                return "owner"

            access = getattr(instance, "staff_access", None)

            return access.role if access else UserManagementSerializer.BASE_ROLE

        return super().get_attribute(instance)


class ManagedPermissionsField(serializers.ListField):
    """
    The capabilities an account effectively holds.

    ``["*"]`` for the owner, the full catalog for an administrator
    (whose record may list none), and whatever is on the record
    otherwise - the same answer ``session_payload`` gives, so the
    console and the session never disagree about one account.
    """

    def __init__(self, **kwargs):
        kwargs.setdefault("required", False)
        super().__init__(child=serializers.ChoiceField(choices=CAPABILITY_CATALOG), **kwargs)

    def get_attribute(self, instance):
        if isinstance(instance, User):
            if instance.is_superuser:
                return ["*"]

            access = getattr(instance, "staff_access", None)

            return sorted(granted_capabilities(instance)) if access else []

        return super().get_attribute(instance)


class UserManagementSerializer(serializers.ModelSerializer):
    """
    The account record the staff console edits.

    One endpoint carries the whole of user management: the profile
    fields, the phone number, the account's state, and the role and
    capabilities that decide what that account is allowed to do.
    Writing ``role`` creates, changes or removes the matching
    ``StaffAccess`` row and keeps ``is_staff`` in step, so there is no
    second screen to remember when someone is promoted or demoted.

    ``role`` reads back as ``owner`` for a superuser, but ``owner`` is
    not a value that can be written - ownership is created with
    ``createsuperuser`` and is not something the console can hand out.

    Passwords and tokens are never exposed.
    """

    #: Roles that can be assigned from the console. ``owner`` is
    #: deliberately absent.
    ASSIGNABLE_ROLES = [
        ("customer", "Customer"),
        ("reception", "Reception"),
        ("staff", "Staff"),
        ("admin", "Administrator"),
    ]

    #: Role every account holds when it has no staff access.
    BASE_ROLE = "customer"

    phone = serializers.CharField(
        max_length=30,
        required=False,
        allow_blank=True,
    )

    role = ManagedRoleField(choices=ASSIGNABLE_ROLES)

    permissions = ManagedPermissionsField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "phone",
            "is_active",
            "is_staff",
            "is_superuser",
            "date_joined",
            "last_login",
            "role",
            "permissions",
        ]

        # `username` stays fixed: it is the login identity, and renaming
        # an account out from under the person using it invalidates the
        # idea of a stable handle. `is_staff` follows `role`, and
        # `is_superuser` is the owner's, and neither is set directly.
        read_only_fields = [
            "id",
            "username",
            "is_staff",
            "is_superuser",
            "date_joined",
            "last_login",
        ]

    def to_representation(self, user):
        data = super().to_representation(user)

        profile = getattr(user, "profile", None)

        data["phone"] = profile.phone if profile else ""

        return data

    # ------------------------------------------------------- validation

    def validate_email(self, value):
        value = (value or "").strip().lower()

        if not value:
            return value

        duplicates = User.objects.filter(email__iexact=value)

        if self.instance is not None:
            duplicates = duplicates.exclude(pk=self.instance.pk)

        if duplicates.exists():
            raise serializers.ValidationError(
                "An account with this email already exists."
            )

        return value

    def validate(self, attrs):
        """
        Refuse a change that would lock the shop out of its own console.

        Three cases, all of which leave nobody able to undo them:

          - editing the owner from a non-owner account
          - removing your own administrative role
          - removing the last remaining administrator
        """

        attrs = super().validate(attrs)

        actor = getattr(self.context.get("request"), "user", None)
        user = self.instance

        if user is None:
            return attrs

        is_owner_actor = bool(actor and actor.is_superuser)

        if user.is_superuser and not is_owner_actor:
            raise serializers.ValidationError(
                {"role": "Only the owner can change the owner account."}
            )

        next_role = attrs.get("role", self._current_role(user))
        next_active = attrs.get("is_active", user.is_active)

        if actor is not None and actor.pk == user.pk:
            if not next_active:
                raise serializers.ValidationError(
                    {"is_active": "You cannot deactivate your own account."}
                )

            if next_role != self._current_role(user) or "permissions" in attrs:
                raise serializers.ValidationError(
                    {"role": "You cannot change your own role or permissions."}
                )

        if self._drops_the_last_administrator(user, next_role, next_active):
            raise serializers.ValidationError(
                {
                    "role": (
                        "This is the last active administrator. "
                        "Promote someone else to administrator first."
                    )
                }
            )

        return attrs

    # ---------------------------------------------------------- helpers

    def _current_role(self, user):
        if user.is_superuser:
            return "owner"

        access = getattr(user, "staff_access", None)

        return access.role if access else self.BASE_ROLE

    def _drops_the_last_administrator(self, user, next_role, next_active):
        """
        True when applying this change would leave no way back into
        user management.

        Superusers do not count, because the owner is created outside
        the console and can always create another administrator.
        """

        if self._current_role(user) != StaffAccess.Role.ADMIN:
            return False

        if next_role == StaffAccess.Role.ADMIN and next_active:
            return False

        remaining = (
            StaffAccess.objects.filter(
                role=StaffAccess.Role.ADMIN,
                is_active=True,
            )
            .exclude(user=user)
            .exists()
        )

        return not remaining

    # ------------------------------------------------------------ write

    @transaction.atomic
    def update(self, instance, validated_data):
        # Whether staff access needs resyncing has to be decided before
        # the keys are popped out of it below.
        resync = bool({"role", "permissions", "is_active"} & validated_data.keys())

        phone = validated_data.pop("phone", None)
        role = validated_data.pop("role", None)
        permissions = validated_data.pop("permissions", None)

        for field, value in validated_data.items():
            setattr(instance, field, value)

        instance.save()

        if phone is not None:
            profile, _ = AccountProfile.objects.update_or_create(
                user=instance,
                defaults={"phone": phone},
            )

            # Refresh the cached relation so the response reflects it.
            instance.profile = profile

        if resync:
            self._sync_staff_access(
                instance,
                role=role,
                permissions=permissions,
            )

        return instance

    def _sync_staff_access(self, user, role=None, permissions=None):
        """
        Make the ``StaffAccess`` row match the account as it now is.

        `role` defaults to the role already on record, so sending only
        `permissions` to tighten a receptionist's access does not
        silently reset them to a default role. Writing the base role
        removes staff access altogether rather than keeping a dormant
        row behind, and `is_active` is mirrored either way - the
        account switch and the console switch are one switch, so the
        two screens cannot end up disagreeing about who is enabled.
        """

        access = getattr(user, "staff_access", None)
        current_role = access.role if access else self.BASE_ROLE
        next_role = role or current_role

        if next_role == self.BASE_ROLE:
            if access is not None:
                access.delete()

                # The relation was read above and is cached on the
                # instance, so without this the response would report
                # a role from a row that no longer exists.
                user._state.fields_cache.pop("staff_access", None)

            user.is_staff = False
            user.save(update_fields=["is_staff"])
            return

        access, _ = StaffAccess.objects.update_or_create(
            user=user,
            defaults={
                "role": next_role,
                "permissions": (
                    permissions
                    if permissions is not None
                    else (access.permissions if access else [])
                ),
                "is_active": user.is_active,
            },
        )

        user.is_staff = access.is_active
        user.save(update_fields=["is_staff"])
        user.staff_access = access


class OperationsReportSerializer(serializers.Serializer):
    """Documents the whole-shop operations report."""

    generated_at = serializers.DateTimeField(read_only=True)
    users = serializers.DictField(read_only=True)
    bookings = serializers.DictField(read_only=True)
    payments = serializers.DictField(read_only=True)
    services = serializers.DictField(read_only=True)


class DashboardBookingSerializer(serializers.Serializer):
    """One row on the day's schedule, flattened for the console."""

    id = serializers.IntegerField(read_only=True)
    customer_name = serializers.CharField(read_only=True)
    customer_phone = serializers.CharField(read_only=True)
    service_name = serializers.CharField(read_only=True)
    barber_name = serializers.CharField(read_only=True)
    booking_date = serializers.CharField(read_only=True)
    start_time = serializers.CharField(read_only=True)
    end_time = serializers.CharField(allow_null=True, read_only=True)
    status = serializers.CharField(read_only=True)
    notes = serializers.CharField(read_only=True)


class DashboardSerializer(serializers.Serializer):
    """
    Documents the dashboard response.

    The counts and sections are dictionaries keyed by the capability
    that produced them rather than fixed fields, because a limited
    account receives only the sections it is allowed to see. Modelling
    them as named fields would have the schema promise a receptionist a
    revenue figure the response deliberately omits.
    """

    generated_at = serializers.DateTimeField(read_only=True)
    today = serializers.CharField(read_only=True)
    sections = serializers.ListField(child=serializers.CharField(), read_only=True)
    queues = serializers.DictField(read_only=True)
    counts = serializers.DictField(read_only=True)
    revenue = serializers.DictField(read_only=True)
    schedule = serializers.SerializerMethodField()

    def get_schedule(self, obj) -> dict:
        return {
            "today": DashboardBookingSerializer(obj["today"], many=True).data,
            "upcoming": DashboardBookingSerializer(obj["upcoming"], many=True).data,
        }


class PasswordResetSerializer(serializers.Serializer):
    """
    An administrator setting another account's password.

    `password` is optional: leave it out and the view generates one and
    returns it in the response. It is shown exactly once, so the console
    treats it like a handoff to be read out loud rather than something
    to keep on screen.
    """

    password = serializers.CharField(
        required=False,
        allow_blank=True,
        trim_whitespace=False,
        style=PASSWORD_STYLE,
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
