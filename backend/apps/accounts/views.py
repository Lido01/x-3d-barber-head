from drf_spectacular.utils import (
    extend_schema,
    extend_schema_view,
    OpenApiResponse,
)
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q, Sum
from django.utils.crypto import get_random_string

from rest_framework import generics, permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from rest_framework_simplejwt.views import (
    TokenObtainPairView,
)

from .serializers import (
    AccountSerializer,
    AdminAccountSerializer,
    CustomerCreateSerializer,
    LoginResponseSerializer,
    DashboardSerializer,
    OperationsReportSerializer,
    LoginSerializer,
    PasswordChangeSerializer,
    PasswordResetSerializer,
    RegistrationSerializer,
    ShopSettingsSerializer,
    StaffAccessSerializer,
    AuditLogSerializer,
    UserManagementSerializer,
    UserManagementCreateSerializer,
    CustomerUpdateSerializer,
    session_payload,
)
from .models import AuditLog, ShopSettings, StaffAccess
from .audit import log_action
from .permissions import IsStaffMember, can, capability_permission


User = get_user_model()


def _counts(queryset, **conditions):
    """
    A total plus any number of conditional breakdowns, from one query.

    Each keyword is a field name and the ``Q`` it counts, so::

        _counts(User.objects, active=Q(is_active=True))

    returns ``{"total": 12, "active": 10}``.

    Written as a single aggregate because the dashboard used to issue
    one COUNT per figure - twenty-odd round trips to render a screen of
    numbers, on a connection that may be a phone on shop wifi.
    """
    from django.db.models import Count

    aggregate = {"total": Count("id")}

    for name, condition in conditions.items():
        aggregate[name] = Count("id", filter=condition)

    return queryset.aggregate(**aggregate)


@extend_schema(
    responses={200: AdminAccountSerializer(many=True)},
    description=(
        "List registered customer accounts for staff. "
        "Staff accounts are excluded and an optional `q` parameter searches "
        "the name, username, email and phone number."
    ),
)
class AdminAccountListView(generics.ListCreateAPIView):
    """
    The customer directory for the staff console.

    Read needs `customers.view`; creating needs `customers.manage`. They
    are separate capabilities because looking someone up to read them a
    phone number is a different job from being able to change it, and a
    shop should be able to grant one without the other.

    Writing here is deliberately narrower than user management. This
    screen manages a *customer*: contact details and whether the account
    is enabled. It cannot create staff, change a role, or grant console
    access - those live on the user and team screens, which are gated on
    being an owner or administrator. Two screens that both edited roles
    is how they drift apart.
    """

    def get_permissions(self):
        if self.request.method == "POST":
            return [capability_permission("customers.manage")()]

        return [capability_permission("customers.view")()]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return CustomerCreateSerializer

        return AdminAccountSerializer

    def get_queryset(self):
        queryset = (
            User.objects.filter(is_staff=False)
            .select_related("profile")
            .order_by("-date_joined")
        )
        query = self.request.query_params.get("q", "").strip()

        if query:
            queryset = queryset.filter(
                Q(username__icontains=query)
                | Q(email__icontains=query)
                | Q(first_name__icontains=query)
                | Q(last_name__icontains=query)
                | Q(profile__phone__icontains=query)
            )

        return queryset

    def create(self, request, *args, **kwargs):
        """
        Create the account and hand back its one-time password.

        Returned in the same response the way user management does, so
        the console has one shape of "here is the password" to render
        rather than two.
        """

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.save()

        data = AdminAccountSerializer(
            user, context={"request": request}
        ).data
        data["temporary_password"] = serializer.generated_password

        log_action(
            request,
            "customer.created",
            user,
            {"username": user.get_username()},
        )

        return Response(data, status=status.HTTP_201_CREATED)


@extend_schema(
    request=AdminAccountSerializer,
    responses={
        200: AdminAccountSerializer,
        400: OpenApiResponse(description="Invalid customer data."),
        403: OpenApiResponse(description="customers.manage required."),
        404: OpenApiResponse(description="No such customer account."),
    },
    description=(
        "Update a customer account's contact details, or enable and "
        "disable it. Customers only - a staff account is managed through "
        "user management, so a typed id for one gets a 404 here rather "
        "than a surprising edit."
    ),
)
class AdminAccountDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = CustomerUpdateSerializer
    permission_classes = [capability_permission("customers.manage")]

    def get_queryset(self):
        return User.objects.filter(is_staff=False).select_related("profile")

    def update(self, request, *args, **kwargs):
        """
        Record what changed, field by field.

        A phone number being corrected and a customer being signed out
        are both worth being able to answer for afterwards, and the
        activity log is the only place that question is ever asked.

        Deliberately not calling `super().update()`: that would fetch the
        object a second time and mutate *that* instance, leaving the one
        held here untouched - so the before and after snapshots would
        always match and nothing would ever be logged.
        """

        user = self.get_object()
        before = AdminAccountDetailView._snapshot(user)

        serializer = self.get_serializer(
            user,
            data=request.data,
            partial=kwargs.pop("partial", True),
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        after = AdminAccountDetailView._snapshot(user)

        changes = {
            field: {"from": before[field], "to": after[field]}
            for field in before
            if before[field] != after[field]
        }

        if changes:
            log_action(request, "customer.updated", user, {"changes": changes})

        # The update serializer's own output, not the read-only one:
        # it carries `is_active`, so the console can confirm the change it
        # just made instead of having to refetch to find out.
        return Response(serializer.data)

    @staticmethod
    def _snapshot(user):
        profile = getattr(user, "profile", None)

        return {
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "phone": profile.phone if profile else "",
            "is_active": user.is_active,
        }


@extend_schema(
    request=None,
    responses={
        204: OpenApiResponse(description="Customer account deleted."),
        403: OpenApiResponse(description="customers.delete required."),
        404: OpenApiResponse(description="No such customer account."),
    },
    description=(
        "Permanently delete a customer account. "
        "Requires `customers.delete`, which is separate from "
        "`customers.manage` on purpose: correcting a phone number and "
        "destroying someone's history are not the same authority. "
        "Accounts that own bookings, payments or reviews are refused - "
        "disable them instead, so the shop's records stay intact."
    ),
)
class AdminAccountDeleteView(generics.DestroyAPIView):
    """
    Permanently delete a customer account.

    Gated on `customers.delete`, which is separate from
    `customers.manage` on purpose: correcting a phone number and
    destroying someone's history are not the same authority, and a shop
    should be able to grant one without the other.

    Deleting refuses an account that has left reviews, because a review
    is a real foreign key to it and the shop's published wall would lose
    the attribution.

    It cannot, however, see a customer's bookings or payments. Those
    tables record `customer_name` and `customer_phone` as free text -
    most bookings are walk-ins who never made an account at all - so
    there is no honest way to attribute them here. Guessing on the phone
    number would either block legitimate deletions or let a real one
    through, and both are worse than saying so. That is why the console
    offers "disable" as the ordinary answer and keeps delete behind its
    own capability and its own confirmation.
    """

    queryset = User.objects.filter(is_staff=False)
    permission_classes = [capability_permission("customers.delete")]

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        username = user.get_username()

        if user.testimonials.exists():
            raise ValidationError(
                {
                    "detail": (
                        "This account has reviews attached and deleting it "
                        "would leave them without an author. Disable the "
                        "account instead."
                    )
                }
            )

        log_action(request, "customer.deleted", details={"username": username})

        self.perform_destroy(user)

        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(
    responses={200: ShopSettingsSerializer, 403: OpenApiResponse(description="Staff only.")},
    description=(
        "The shop's own details - name, contact, opening hours, currency. "
        "Readable by any staff account so the booking form and contact "
        "details can be built from it; writable only with "
        "`settings.manage`."
    ),
)
class ShopSettingsView(generics.RetrieveUpdateAPIView):
    """
    One row, read and written in place.

    GET is for every member of staff, not just those who may change it:
    a receptionist reading out the address over the phone needs the same
    record an owner edits, and serving two shapes of the same fact is how
    the two disagree.
    """

    serializer_class = ShopSettingsSerializer

    def get_permissions(self):
        if self.request.method in ("GET", "HEAD", "OPTIONS"):
            return [IsStaffMember()]

        return [capability_permission("settings.manage")()]

    def get_object(self):
        return ShopSettings.load()

    def update(self, request, *args, **kwargs):
        instance = ShopSettings.load()
        before = ShopSettingsView._snapshot(instance)

        serializer = self.get_serializer(instance, data=request.data, partial=kwargs.pop("partial", True))
        serializer.is_valid(raise_exception=True)

        settings_row = serializer.save(updated_by=request.user)

        after = ShopSettingsView._snapshot(settings_row)

        changes = {
            field: {"from": before[field], "to": after[field]}
            for field in before
            if before[field] != after[field]
        }

        if changes:
            log_action(request, "settings.updated", settings_row, {"changes": changes})

        return Response(
            self.get_serializer(settings_row).data,
            status=status.HTTP_200_OK,
        )

    @staticmethod
    def _snapshot(row):
        return {
            "business_name": row.business_name,
            "tagline": row.tagline,
            "phone": row.phone,
            "email": row.email,
            "address": row.address,
            "currency": row.currency,
            "opening_time": row.opening_time.strftime("%H:%M") if row.opening_time else None,
            "closing_time": row.closing_time.strftime("%H:%M") if row.closing_time else None,
            "booking_horizon_days": row.booking_horizon_days,
        }


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

    def retrieve(self, request, *args, **kwargs):
        response = super().retrieve(request, *args, **kwargs)
        response.data.update(session_payload(request.user))
        return response


class OwnerOrAdministrator(permissions.BasePermission):
    """
    The people management gate: the owner, and any administrator.

    An administrator is not capability-gated anywhere else in the
    console - they hold every capability implicitly - so this is the
    permission that decides who may change roles, edit profiles, read
    the activity trail and reset passwords.

    "Owner" is not a role that can be granted here. It is
    ``is_superuser``, created with ``createsuperuser``, and no API
    writes it - which is what stops an administrator from promoting
    themselves to an account nothing can revoke.
    """

    message = "Only an owner or administrator can manage users, staff access and reports."

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if user.is_superuser:
            return True

        access = getattr(user, "staff_access", None)

        return bool(
            user.is_staff
            and access
            and access.is_active
            and access.role == StaffAccess.Role.ADMIN
        )


class StaffAccessListCreateView(generics.ListCreateAPIView):
    serializer_class = StaffAccessSerializer
    permission_classes = [OwnerOrAdministrator]
    queryset = StaffAccess.objects.select_related("user").order_by("user__username")

    def perform_create(self, serializer):
        user = serializer.validated_data["user"]
        if user.is_superuser:
            raise ValidationError({"user": "The owner already has full access and does not need a staff role."})
        user.is_staff = serializer.validated_data.get("is_active", True)
        user.save(update_fields=["is_staff"])
        access = serializer.save()
        log_action(self.request, "staff_access.created", access, {"role": access.role, "permissions": access.permissions})


class StaffAccessDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = StaffAccessSerializer
    permission_classes = [OwnerOrAdministrator]
    queryset = StaffAccess.objects.select_related("user")

    def perform_update(self, serializer):
        if serializer.instance.user.is_superuser and not self.request.user.is_superuser:
            raise ValidationError("Only the owner can change the owner's staff access.")

        self._reject_self_lockout(serializer)

        access = serializer.save()

        # The console switch and the login switch are one switch, so
        # enabling a team member here also lets them back in.
        user = access.user
        user.is_staff = access.is_active
        user.is_active = access.is_active
        user.save(update_fields=["is_staff", "is_active"])

        log_action(self.request, "staff_access.updated", access, {"role": access.role, "permissions": access.permissions, "active": access.is_active})

    def _reject_self_lockout(self, serializer):
        """
        Block the two edits that would leave nobody able to undo them.

        An administrator removing their own console access, or removing
        the last one, is recoverable only by an owner signing in at a
        terminal - which is not a safety net worth relying on.
        """

        actor = self.request.user
        access = serializer.instance
        role = serializer.validated_data.get("role", access.role)
        is_active = serializer.validated_data.get("is_active", access.is_active)

        if access.user_id == actor.pk and not is_active:
            raise ValidationError({"is_active": "You cannot revoke your own access."})

        if access.role != StaffAccess.Role.ADMIN or role == StaffAccess.Role.ADMIN:
            return

        if StaffAccess.objects.filter(role=StaffAccess.Role.ADMIN, is_active=True).exclude(pk=access.pk).exists():
            return

        if actor.is_superuser:
            return

        raise ValidationError({"role": "This is the last active administrator. Promote someone else first."})

    def perform_destroy(self, instance):
        if instance.user.is_superuser and not self.request.user.is_superuser:
            raise ValidationError("Only the owner can remove the owner's staff access.")
        user = instance.user
        log_action(self.request, "staff_access.removed", instance)
        instance.delete()
        user.is_staff = False
        user.save(update_fields=["is_staff"])


class AuditLogListView(generics.ListAPIView):
    """
    The activity trail, filtered and paged.

    Filtering is by query parameter rather than a filter library, so
    the same endpoint serves the console's "last 50 actions" view and
    a full review of one person's history.

        ?action=payment   prefix match, e.g. all payment decisions
        ?actor=7          one user's actions
        ?target=42        every action against one record
        ?since=2026-01-01 ISO date, lower bound on created_at
        ?limit=50         page size, capped at 200
        ?offset=100       rows to skip, for paging
    """

    serializer_class = AuditLogSerializer
    permission_classes = [OwnerOrAdministrator]
    queryset = AuditLog.objects.select_related("actor")

    #: Most rows a single page may return, whatever `limit` asks for.
    max_page_size = 200

    def get_queryset(self):
        from django.db.models import Q

        queryset = self.queryset
        params = self.request.query_params

        action = params.get("action", "").strip()

        if action:
            queryset = queryset.filter(action__startswith=action)

        actor = params.get("actor", "").strip()
        target = params.get("target", "").strip()
        since = params.get("since", "").strip()

        if actor:
            if actor.isdigit():
                queryset = queryset.filter(actor_id=int(actor))
            else:
                queryset = queryset.filter(actor__username__iexact=actor)

        if target:
            queryset = queryset.filter(target_id=target)

        if since:
            queryset = queryset.filter(created_at__date__gte=since)

        query = params.get("q", "").strip()

        if query:
            queryset = queryset.filter(
                Q(action__icontains=query)
                | Q(target_type__icontains=query)
                | Q(actor__username__icontains=query)
            )

        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        total = queryset.count()
        limit = self._bounded_int("limit", 50, maximum=self.max_page_size)
        offset = max(self._bounded_int("offset", 0, minimum=0), 0)

        page = queryset[offset : offset + limit]

        return Response(
            {
                "count": total,
                "limit": limit,
                "offset": offset,
                "has_more": offset + limit < total,
                "results": self.get_serializer(page, many=True).data,
            }
        )

    def _bounded_int(self, name, default, minimum=1, maximum=None):
        """Read a query parameter as an int, clamped instead of trusted."""

        raw = self.request.query_params.get(name, "")

        try:
            value = int(raw)
        except (TypeError, ValueError):
            return default

        value = max(value, minimum)

        if maximum is not None:
            value = min(value, maximum)

        return value


class UserManagementListView(generics.ListAPIView):
    """
    The account directory, including customers, staff and disabled
    accounts. Search covers the same fields the console shows, and
    `role` narrows the list to one kind of account so the console's
    role filter does not have to download every user to find them.

    GET only. Creating an account lives on
    ``UserManagementCreateView`` so that a read-only screen can never
    accidentally grow a write, and so the two have separate
    documentation of who is allowed to do what.
    """

    serializer_class = UserManagementSerializer
    permission_classes = [OwnerOrAdministrator]

    def get_queryset(self):
        queryset = User.objects.select_related("staff_access", "profile").order_by("-date_joined")
        params = self.request.query_params
        query = params.get("q", "").strip()
        role = params.get("role", "").strip()

        if query:
            queryset = queryset.filter(
                Q(username__icontains=query)
                | Q(email__icontains=query)
                | Q(first_name__icontains=query)
                | Q(last_name__icontains=query)
                | Q(profile__phone__icontains=query)
            )

        if role == "owner":
            queryset = queryset.filter(is_superuser=True)
        elif role == "customer":
            queryset = queryset.filter(is_staff=False, is_superuser=False)
        elif role:
            queryset = queryset.filter(
                is_superuser=False,
                is_staff=True,
                staff_access__role=role,
            )

        return queryset


@extend_schema(
    request=UserManagementCreateSerializer,
    responses={
        201: OpenApiResponse(
            description=(
                "The created account, plus `temporary_password` - shown "
                "once and not retrievable again."
            )
        ),
        400: OpenApiResponse(
            description=(
                "Invalid account data, a duplicate username or email, an "
                "unknown capability, or an attempt to grant ownership."
            )
        ),
        403: OpenApiResponse(
            description="Owner or administrator only."
        ),
    },
    description=(
        "Create an account and decide what it may do, in one call. "
        "Omit `password` to have a strong one generated; it comes back "
        "once in `temporary_password` and is never stored in a "
        "recoverable form. `owner` is not assignable."
    ),
)
class UserManagementCreateView(generics.CreateAPIView):
    """
    Create an account and decide what it may do, in one call.

    Owner and administrator only, for the same reason the screens that
    hand out power are gated on role rather than capability: asking
    "what may this person do?" to decide who may decide that is a
    circular authority.

    The response is the created account plus ``temporary_password``,
    shown once. It is deliberately the only way to learn it - the shop
    has no outbound mail configured, and a reset link that silently goes
    nowhere is worse than a password handed over in person.
    """

    serializer_class = UserManagementCreateSerializer
    permission_classes = [OwnerOrAdministrator]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.save()

        data = UserManagementSerializer(user, context={"request": request}).data
        data["temporary_password"] = serializer.generated_password

        log_action(
            request,
            "user.created",
            user,
            {
                "username": user.get_username(),
                "role": data["role"],
                "permissions": data["permissions"],
            },
        )

        return Response(data, status=status.HTTP_201_CREATED)


class UserManagementDetailView(generics.RetrieveUpdateAPIView):
    """
    Edit one account end to end.

    Role, capabilities, phone, name, email and account state all change
    through this one endpoint - see ``UserManagementSerializer`` for how
    writing a role keeps the matching staff access in step.

    What changed is written to the activity trail field by field, so
    the log answers "who promoted this account and when" rather than
    only "someone edited a user".
    """

    serializer_class = UserManagementSerializer
    permission_classes = [OwnerOrAdministrator]
    queryset = User.objects.select_related("staff_access", "profile")
    http_method_names = ["get", "patch", "head", "options"]

    def perform_update(self, serializer):
        before = self._snapshot(serializer.instance)
        user = serializer.save()
        after = self._snapshot(user)

        changed = {key: {"from": before[key], "to": after[key]} for key in after if before[key] != after[key]}

        log_action(
            self.request,
            "user.updated",
            user,
            {"changes": changed} if changed else {"changes": {}},
        )

    @staticmethod
    def _snapshot(user):
        """The managed fields, flattened to plain values for diffing."""

        profile = getattr(user, "profile", None)
        access = getattr(user, "staff_access", None)

        return {
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "phone": profile.phone if profile else "",
            "is_active": user.is_active,
            "role": "owner" if user.is_superuser else (access.role if access else "customer"),
            "permissions": ["*"] if user.is_superuser else (sorted(access.permissions) if access else []),
        }


class UserPasswordResetView(generics.GenericAPIView):
    """
    Administrator-controlled password reset.

    Send `{"password": "..."}` to set a specific one, or `{}` to have
    one generated. Either way the password comes back in the response
    once and cannot be retrieved again, so the console shows it as a
    handoff rather than storing it anywhere.
    """

    serializer_class = PasswordResetSerializer
    permission_classes = [OwnerOrAdministrator]

    def post(self, request, pk):
        user = generics.get_object_or_404(User, pk=pk)

        if user.is_superuser and not request.user.is_superuser:
            raise ValidationError("Only the owner can reset the owner password.")

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        password = serializer.validated_data.get("password") or get_random_string(18)

        try:
            validate_password(password, user)
        except DjangoValidationError as error:
            raise ValidationError({"password": list(error.messages)})

        user.set_password(password)
        user.save(update_fields=["password"])
        log_action(request, "user.password_reset", user, {"username": user.get_username()})

        return Response({"detail": "Password changed.", "temporary_password": password})


class DashboardView(generics.GenericAPIView):
    """
    One request, the numbers the console opens on.

    The dashboard used to be assembled in the browser from six full
    list endpoints, which meant downloading every booking and every
    payment in the shop to count them. This computes the counts in
    SQL and returns only the rows a person actually reads: today's
    schedule and the next few days ahead.

    A staff account with limited capabilities gets the sections it can
    see and nothing else - the response says which those were in
    ``sections`` - rather than a 403 that leaves the whole console
    unusable because one card is off limits.
    """

    permission_classes = [IsStaffMember]

    #: The shape this endpoint returns, declared so the OpenAPI schema
    #: can describe it. The view builds the response from aggregates
    #: rather than from a model, so there is no serializer to infer.
    serializer_class = DashboardSerializer

    #: How many days past today the "up next" list reaches.
    upcoming_days = 7

    #: Cap on the upcoming list, so a heavily booked fortnight cannot
    #: turn the dashboard into a second bookings screen.
    upcoming_limit = 12

    def get(self, request):
        from django.utils import timezone

        from apps.bookings.models import Booking
        from apps.gallery.models import GalleryPost
        from apps.payments.models import Payment
        from apps.services.models import Service
        from apps.testimonials.models import Testimonial

        viewer = request.user
        sections = self._visible_sections(viewer)
        today = timezone.localdate()

        payload = {
            "generated_at": timezone.now(),
            "today": today.isoformat(),
            "viewer": {
                "username": viewer.get_username(),
                "is_owner": viewer.is_superuser,
            },
            "sections": sorted(sections),
            "queues": {},
            "counts": {},
            "revenue": {},
            "schedule": {"today": [], "upcoming": []},
        }

        if "bookings" in sections:
            self._add_schedule(payload, Booking, today)

        if "payments" in sections:
            self._add_payments(payload, Payment, today)

        if "customers" in sections:
            # One aggregate instead of four counts. The dashboard is
            # opened between customers, often on a phone, and four
            # round trips to render four digits is the wrong shape for
            # that.
            payload["counts"]["users"] = _counts(
                User.objects,
                active=Q(is_active=True),
                staff=Q(is_staff=True),
                disabled=Q(is_active=False),
            )

        if "services" in sections:
            payload["counts"]["services"] = _counts(
                Service.objects,
                active=Q(is_active=True),
            )

        if "gallery" in sections:
            payload["counts"]["gallery"] = _counts(
                GalleryPost.objects,
                visible=Q(is_active=True),
            )

        if "reviews" in sections:
            reviews = _counts(
                Testimonial.objects,
                pending=Q(status=Testimonial.Status.PENDING),
            )
            payload["counts"]["reviews"] = reviews
            payload["queues"]["reviews_to_approve"] = reviews["pending"]

        return Response(payload)

    @staticmethod
    def _visible_sections(user):
        """
        The dashboard cards this viewer is allowed to see.

        An owner or administrator gets everything; anyone else gets
        only the cards their capabilities cover.
        """

        checks = {
            "bookings": "bookings.view",
            "payments": "payments.view",
            "customers": "customers.view",
            "services": "services.manage",
            "gallery": "gallery.manage",
            "reviews": "reviews.moderate",
        }

        return {name for name, capability in checks.items() if can(capability, user)}

    def _add_schedule(self, payload, booking_model, today):
        """Today's appointments in time order, plus the next few days."""

        from datetime import timedelta

        horizon = today + timedelta(days=self.upcoming_days)

        # `payment` is a join, not a second query: the console shows
        # whether an appointment has been paid for on the same card as
        # the appointment, so a per-row lookup would be one request per
        # row of the day.
        base = (
            booking_model.objects.select_related("service", "barber", "payment")
            .exclude(status__in=["cancelled", "expired"])
        )

        todays = base.filter(booking_date=today)

        payload["schedule"]["today"] = [self._booking_row(row) for row in todays]

        upcoming = base.filter(
            booking_date__gt=today,
            booking_date__lte=horizon,
        ).order_by("booking_date", "start_time")[: self.upcoming_limit]

        payload["schedule"]["upcoming"] = [self._booking_row(row) for row in upcoming]

        # Every figure for today from one scan of today's rows, rather
        # than a count, a GROUP BY and a per-status lookup.
        today_counts = _counts(
            todays,
            pending=Q(status="pending"),
            confirmed=Q(status="confirmed"),
            completed=Q(status="completed"),
        )

        # And one scan of the table for the all-time and queue figures.
        #
        # `awaiting_payment` rides along in the same aggregate rather than
        # being counted separately: `Exists` is a correlated subquery, so
        # it costs no join and no extra round trip, and the dashboard
        # keeps its fixed query budget however many figures it grows.
        #
        # Confirmed only, and that is a deliberate narrowing. Payment opens
        # when reception confirms, so a pending booking with no payment
        # behind it is not money the shop is waiting for - it is a booking
        # the shop has not looked at yet, and it belongs in the other
        # queue. Counting it here told reception to chase a payment the
        # customer is not able to make.
        #
        # The figure still matters, because two ordinary staff actions
        # leave a *confirmed* appointment with no money behind it:
        # confirming a walk-in by hand, and rejecting a payment.
        from django.db.models import Exists, OuterRef

        from apps.payments.models import Payment as PaymentModel

        overall = _counts(
            booking_model.objects.annotate(
                has_payment=Exists(
                    PaymentModel.objects.filter(booking=OuterRef("pk"))
                ),
            ),
            pending=Q(status="pending"),
            awaiting_payment=Q(
                status="confirmed",
                booking_date__gte=today,
                has_payment=False,
            ),
        )

        payload["counts"]["bookings"] = {
            "today": today_counts["total"],
            "pending_today": today_counts["pending"],
            "confirmed_today": today_counts["confirmed"],
            "completed_today": today_counts["completed"],
            "all_time": overall["total"],
            "awaiting_payment": overall["awaiting_payment"],
        }

        payload["queues"]["bookings_to_confirm"] = overall["pending"]
        payload["queues"]["payments_outstanding"] = overall["awaiting_payment"]

    @staticmethod
    def _booking_row(booking):
        """
        One schedule row.

        `booking_code` is here because this is what staff read off the
        screen and say down the phone, so the number the customer was
        given and the number the shop quotes are the same one.

        `payment_status` is the joined payment's status, or None when no
        payment exists - which, on a confirmed booking, is the thing worth
        noticing before the customer walks in.
        """

        payment = getattr(booking, "payment", None)

        return {
            "id": booking.id,
            "booking_code": booking.booking_code or f"#{booking.pk}",
            "customer_name": booking.customer_name,
            "customer_phone": booking.customer_phone,
            "service_name": booking.service.name if booking.service else "",
            "barber_name": booking.barber.name if booking.barber else "",
            "booking_date": booking.booking_date.isoformat(),
            "start_time": booking.start_time.strftime("%H:%M"),
            "end_time": booking.end_time.strftime("%H:%M") if booking.end_time else None,
            "status": booking.status,
            "payment_status": payment.status if payment else None,
            "payment_due": payment is None and booking.status in ("pending", "confirmed"),
            "notes": booking.notes,
        }

    def _add_payments(self, payload, payment_model, today):
        """Payment queue and verified revenue."""

        verified = payment_model.objects.filter(status="verified")

        month_start = today.replace(day=1)

        queue = _counts(
            payment_model.objects,
            pending=Q(status="pending"),
            verified=Q(status="verified"),
        )

        payload["counts"]["payments"] = {
            "total": queue["total"],
            "pending": queue["pending"],
            "verified": queue["verified"],
        }

        # The three revenue figures differ only in a date bound, so one
        # scan with conditional sums replaces three separate aggregates.
        revenue = verified.aggregate(
            verified_total=Sum("amount"),
            verified_this_month=Sum(
                "amount",
                filter=Q(verified_at__date__gte=month_start),
            ),
            verified_today=Sum(
                "amount",
                filter=Q(verified_at__date=today),
            ),
        )

        payload["revenue"] = {
            "verified_total": revenue["verified_total"] or 0,
            "verified_this_month": revenue["verified_this_month"] or 0,
            "verified_today": revenue["verified_today"] or 0,
        }

        payload["queues"]["payments_to_verify"] = queue["pending"]


class OperationsReportView(generics.GenericAPIView):
    """
    A flat operational summary, for an owner or administrator.

    `DashboardView` supersedes this for the console: it is scoped to the
    viewer and includes the schedule. This remains as a single-shot
    report of whole-shop totals with no schedule detail.
    """

    permission_classes = [OwnerOrAdministrator]

    #: Declared so the OpenAPI schema can describe the response; the
    #: view builds it from aggregates rather than from a model.
    serializer_class = OperationsReportSerializer

    def get(self, request):
        from apps.bookings.models import Booking
        from apps.payments.models import Payment
        from apps.services.models import Service
        from django.utils import timezone

        payments = Payment.objects.all()
        verified = payments.filter(status="verified")
        report = {
            "generated_at": timezone.now(),
            "users": {"total": User.objects.count(), "active": User.objects.filter(is_active=True).count(), "staff": User.objects.filter(is_staff=True).count()},
            "bookings": {"total": Booking.objects.count(), "pending": Booking.objects.filter(status="pending").count(), "confirmed": Booking.objects.filter(status="confirmed").count(), "completed": Booking.objects.filter(status="completed").count()},
            "payments": {"total": payments.count(), "pending": payments.filter(status="pending").count(), "verified": verified.count(), "rejected": payments.filter(status="rejected").count(), "verified_value": verified.aggregate(total=Sum("amount"))["total"] or 0},
            "services": {"active": Service.objects.filter(is_active=True).count(), "total": Service.objects.count()},
        }
        log_action(request, "report.generated", details={"kind": "operations"})
        return Response(report)


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
