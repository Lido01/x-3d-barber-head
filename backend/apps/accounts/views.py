from drf_spectacular.utils import (
    extend_schema,
    extend_schema_view,
    OpenApiResponse,
)
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Sum
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
    LoginResponseSerializer,
    DashboardSerializer,
    OperationsReportSerializer,
    LoginSerializer,
    PasswordChangeSerializer,
    PasswordResetSerializer,
    RegistrationSerializer,
    StaffAccessSerializer,
    AuditLogSerializer,
    UserManagementSerializer,
    session_payload,
)
from .models import AuditLog, StaffAccess
from .audit import log_action
from .permissions import IsStaffMember, can, capability_permission


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
    permission_classes = [capability_permission("customers.view")]

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
    """

    serializer_class = UserManagementSerializer
    permission_classes = [OwnerOrAdministrator]

    def get_queryset(self):
        from django.db.models import Q

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
            payload["counts"]["users"] = {
                "total": User.objects.count(),
                "active": User.objects.filter(is_active=True).count(),
                "staff": User.objects.filter(is_staff=True).count(),
                "disabled": User.objects.filter(is_active=False).count(),
            }

        if "services" in sections:
            payload["counts"]["services"] = {
                "total": Service.objects.count(),
                "active": Service.objects.filter(is_active=True).count(),
            }

        if "gallery" in sections:
            payload["counts"]["gallery"] = {
                "total": GalleryPost.objects.count(),
                "visible": GalleryPost.objects.filter(is_active=True).count(),
            }

        if "reviews" in sections:
            pending_reviews = Testimonial.objects.filter(status="pending").count()
            payload["counts"]["reviews"] = {"total": Testimonial.objects.count(), "pending": pending_reviews}
            payload["queues"]["reviews_to_approve"] = pending_reviews

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

        from django.db.models import Count

        horizon = today + timedelta(days=self.upcoming_days)

        base = (
            booking_model.objects.select_related("service", "barber")
            .exclude(status__in=["cancelled", "expired"])
        )

        todays = base.filter(booking_date=today)

        payload["schedule"]["today"] = [self._booking_row(row) for row in todays]

        upcoming = base.filter(
            booking_date__gt=today,
            booking_date__lte=horizon,
        ).order_by("booking_date", "start_time")[: self.upcoming_limit]

        payload["schedule"]["upcoming"] = [self._booking_row(row) for row in upcoming]

        by_status = dict(todays.values_list("status").annotate(total=Count("id")))

        pending_total = base.filter(status="pending").count()

        payload["counts"]["bookings"] = {
            "today": todays.count(),
            "pending_today": by_status.get("pending", 0),
            "confirmed_today": by_status.get("confirmed", 0),
            "completed_today": by_status.get("completed", 0),
            "all_time": booking_model.objects.count(),
        }

        payload["queues"]["bookings_to_confirm"] = pending_total

    @staticmethod
    def _booking_row(booking):
        return {
            "id": booking.id,
            "customer_name": booking.customer_name,
            "customer_phone": booking.customer_phone,
            "service_name": booking.service.name if booking.service else "",
            "barber_name": booking.barber.name if booking.barber else "",
            "booking_date": booking.booking_date.isoformat(),
            "start_time": booking.start_time.strftime("%H:%M"),
            "end_time": booking.end_time.strftime("%H:%M") if booking.end_time else None,
            "status": booking.status,
            "notes": booking.notes,
        }

    def _add_payments(self, payload, payment_model, today):
        """Payment queue and verified revenue."""

        from django.db.models import Sum

        verified = payment_model.objects.filter(status="verified")

        month_start = today.replace(day=1)

        payload["counts"]["payments"] = {
            "total": payment_model.objects.count(),
            "pending": payment_model.objects.filter(status="pending").count(),
            "verified": verified.count(),
        }

        payload["revenue"] = {
            "verified_total": verified.aggregate(total=Sum("amount"))["total"] or 0,
            "verified_this_month": verified.filter(
                verified_at__date__gte=month_start
            ).aggregate(total=Sum("amount"))["total"]
            or 0,
            "verified_today": verified.filter(
                verified_at__date=today
            ).aggregate(total=Sum("amount"))["total"]
            or 0,
        }

        payload["queues"]["payments_to_verify"] = payment_model.objects.filter(status="pending").count()


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
