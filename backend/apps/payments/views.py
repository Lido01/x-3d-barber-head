from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import (
    FormParser,
    JSONParser,
    MultiPartParser,
)
from rest_framework.permissions import (
    AllowAny,
    IsAuthenticated,
)
from rest_framework.response import Response

from drf_spectacular.utils import (
    extend_schema,
    OpenApiResponse,
)

from .models import Payment
from .serializers import PaymentSerializer
from .services import (
    create_payment,
    reject_payment,
    verify_payment,
)
from apps.bookings.models import Booking
from apps.bookings.services import require_customer_booking
from apps.accounts.permissions import capability_permission
from apps.accounts.audit import log_action


class PaymentViewSet(viewsets.ModelViewSet):
    """
    Payment API.

    Public customers can submit payments and receipts
    without creating an account.

    Admin/staff users can verify or reject payments.
    """

    queryset = Payment.objects.select_related(
        "booking",
        "booking__service",
        "verified_by",
    )

    serializer_class = PaymentSerializer

    # Supports:
    # - image/file uploads
    # - normal form data
    # - JSON requests
    parser_classes = [
        MultiPartParser,
        FormParser,
        JSONParser,
    ]

    http_method_names = [
        "get",
        "post",
        "head",
        "options",
    ]

    # =========================================================
    # PERMISSIONS
    # =========================================================

    def get_permissions(self):
        """
        Public customers:
            POST payment
            GET one payment by id
            GET the payment for a booking

        Staff:
            GET the list of every payment      (payments.view)
            POST verify                       (payments.verify)
            POST reject                       (payments.verify)

        The list is deliberately not public: it is every customer's
        payment in the shop, transaction reference and receipt image
        included. A customer checking their own payment reads it back
        through `by_booking`, which is scoped to the one booking rather
        than enumerating rows.
        """

        if self.action == "list":
            return [IsAuthenticated(), capability_permission("payments.view")()]

        if self.action in ["verify", "reject"]:
            return [IsAuthenticated(), capability_permission("payments.verify")()]

        return [
            AllowAny(),
        ]

    # =========================================================
    # PAYMENT FOR A BOOKING
    # =========================================================

    @staticmethod
    def _customer_booking(request, booking):
        """
        Require the code and phone that prove this booking is theirs.

        Delegated to bookings.services so this and the booking status
        endpoint are literally the same check. They used to be two copies
        of it in two apps, which is one refactor away from one of them
        quietly accepting a booking code on its own.
        """

        from apps.bookings.services import normalise_booking_code

        return require_customer_booking(
            booking,
            code=normalise_booking_code(
                request.headers.get("X-Booking-Code", "")
            ),
            phone=request.headers.get("X-Booking-Phone", ""),
        )

    @extend_schema(
        request=None,
        responses={
            200: PaymentSerializer,
            404: OpenApiResponse(
                description="No payment has been submitted for this booking.",
            ),
        },
        description=(
            "The payment attached to one booking. "
            "Public, because the customer flow is unauthenticated: "
            "someone who has just paid needs to see whether their "
            "receipt was verified, and they only ever learn about one "
            "booking at a time from their own confirmation."
        ),
    )
    @action(
        detail=False,
        methods=["get"],
        url_path="by-booking/(?P<booking_id>[^/.]+)",
    )
    def by_booking(
        self,
        request,
        booking_id=None,
    ):
        """
        Return the single payment for a booking, or 404 if none.

        `booking` is a OneToOneField, so this can only ever match one
        row - there is no list to leak here, and no way to walk the
        shop's payments by changing the id.
        """

        booking = generics.get_object_or_404(Booking, pk=booking_id)
        self._customer_booking(request, booking)
        payment = generics.get_object_or_404(
            Payment.objects.select_related("booking", "booking__service", "verified_by"),
            booking=booking,
        )

        return Response(
            self.get_serializer(payment).data
        )

    # =========================================================
    # CREATE PAYMENT
    # =========================================================

    @extend_schema(
        request={
            "multipart/form-data": PaymentSerializer,
        },
        responses={
            201: PaymentSerializer,
            400: OpenApiResponse(
                description="Invalid payment data.",
            ),
        },
        description=(
            "Public payment submission. "
            "Customers do not need an account.\n\n"
            "The booking must already be confirmed by reception - the "
            "shop confirms the appointment first and opens payment "
            "second, so a booking still awaiting confirmation is refused "
            "with a 400 rather than taking money for a chair nobody has "
            "agreed to.\n\n"
            "Submit payment information and optionally "
            "upload a receipt screenshot."
        ),
    )
    def create(
        self,
        request,
        *args,
        **kwargs,
    ):
        """
        Take a customer's payment for a confirmed booking.

        The serializer calls payments.services.create_payment, so the
        confirmation gate, the one-payment-per-booking rule and the
        correction path for a rejected payment all live in one place
        rather than being spread across this view.
        """
        serializer = self.get_serializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        payment = serializer.save()

        # A payment that corrected one the shop had already rejected is a
        # different event from a first submission, and the activity log is
        # the only place that difference survives - the row looks the
        # same either way, apart from its updated_at.
        if getattr(payment, "replaced_a_rejected_payment", False):
            log_action(
                request,
                "payment.resubmitted",
                payment,
                {
                    "amount": str(payment.amount),
                    "booking_code": payment.booking.booking_code,
                },
            )

        output = self.get_serializer(
            payment
        )

        return Response(
            output.data,
            status=status.HTTP_201_CREATED,
        )

    # =========================================================
    # VERIFY PAYMENT
    # =========================================================

    @extend_schema(
        request=None,
        responses={
            200: PaymentSerializer,
            400: OpenApiResponse(
                description=(
                    "Payment cannot be verified."
                ),
            ),
            401: OpenApiResponse(
                description=(
                    "Authentication is required."
                ),
            ),
            403: OpenApiResponse(
                description=(
                    "Admin/staff permission required."
                ),
            ),
        },
        description=(
            "Admin/staff only. "
            "Verify a pending payment. "
            "The authenticated admin becomes the verifier."
        ),
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="verify",
    )
    def verify(
        self,
        request,
        pk=None,
    ):
        payment = self.get_object()

        payment = verify_payment(
            payment=payment,
            verified_by=request.user,
        )
        log_action(request, "payment.verified", payment, {"amount": str(payment.amount)})

        return Response(
            self.get_serializer(
                payment
            ).data
        )

    # =========================================================
    # REJECT PAYMENT
    # =========================================================

    @extend_schema(
        request={
            "application/json": {
                "type": "object",
                "properties": {
                    "reason": {
                        "type": "string",
                        "description": (
                            "Reason why the payment was rejected."
                        ),
                    }
                },
                "required": [
                    "reason",
                ],
            }
        },
        responses={
            200: PaymentSerializer,
            400: OpenApiResponse(
                description=(
                    "Payment cannot be rejected."
                ),
            ),
            401: OpenApiResponse(
                description=(
                    "Authentication is required."
                ),
            ),
            403: OpenApiResponse(
                description=(
                    "Admin/staff permission required."
                ),
            ),
        },
        description=(
            "Admin/staff only. "
            "Reject a pending payment and provide a reason."
        ),
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="reject",
    )
    def reject(
        self,
        request,
        pk=None,
    ):
        payment = self.get_object()

        reason = request.data.get(
            "reason",
            "",
        )

        payment = reject_payment(
            payment=payment,
            reason=reason,
        )
        log_action(request, "payment.rejected", payment, {"reason": reason, "amount": str(payment.amount)})

        return Response(
            self.get_serializer(
                payment
            ).data
        )
