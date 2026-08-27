from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import (
    FormParser,
    JSONParser,
    MultiPartParser,
)
from rest_framework.permissions import (
    AllowAny,
    IsAdminUser,
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
            GET payment

        Admin/staff:
            POST verify
            POST reject
        """

        if self.action in [
            "verify",
            "reject",
        ]:
            return [
                IsAuthenticated(),
                IsAdminUser(),
            ]

        return [
            AllowAny(),
        ]

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
            "Customers do not need an account. "
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
        serializer = self.get_serializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        payment = serializer.save()

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

        return Response(
            self.get_serializer(
                payment
            ).data
        )