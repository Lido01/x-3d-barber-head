from rest_framework import (
    status,
    viewsets,
)
from rest_framework.decorators import action
from rest_framework.parsers import (
    FormParser,
    JSONParser,
    MultiPartParser,
)
from rest_framework.permissions import (
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


class PaymentViewSet(
    viewsets.ModelViewSet
):
    """
    Payment API.

    Customers can create and view payments.
    Verification and rejection are handled
    through dedicated business operations.
    """

    queryset = Payment.objects.select_related(
        "booking",
        "booking__service",
        "verified_by",
    )

    serializer_class = PaymentSerializer

    # permission_classes = [
    #     IsAuthenticated,
    # ]

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

    @extend_schema(
        request=PaymentSerializer,
        responses={
            201: PaymentSerializer,
        },
        description=(
            "Submit a payment and optional "
            "receipt screenshot. "
            "The payment starts as pending."
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

        payment = create_payment(
            **serializer.validated_data
        )

        output = self.get_serializer(
            payment
        )

        return Response(
            output.data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        request=None,
        responses={
            200: PaymentSerializer,
            400: OpenApiResponse(
                description="Payment cannot be verified.",
            ),
        },
        description=(
            "Verify a pending payment. "
            "The authenticated user becomes "
            "the verifier."
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

    @extend_schema(
        request={
            "application/json": {
                "type": "object",
                "properties": {
                    "reason": {
                        "type": "string",
                    }
                },
                "required": ["reason"],
            }
        },
        responses={
            200: PaymentSerializer,
        },
        description=(
            "Reject a pending payment."
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