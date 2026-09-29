from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
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

from .models import Testimonial
from .serializers import TestimonialSerializer
from .services import (
    approve_testimonial,
    create_testimonial,
    reject_testimonial,
    resolve_reviewer_name,
)
from apps.accounts.permissions import capability_permission
from apps.accounts.audit import log_action


class TestimonialViewSet(viewsets.ModelViewSet):

    serializer_class = TestimonialSerializer

    parser_classes = [
        MultiPartParser,
        FormParser,
        JSONParser,
    ]

    http_method_names = [
        "get",
        "post",
        "delete",
        "head",
        "options",
    ]

    def get_queryset(self):
        """
        Who sees what:

        anonymous
            approved reviews only - the public wall

        signed-in customer
            approved reviews, so the wall renders the same as it does
            for a visitor who has not signed in

        staff
            every review in every state, which is what the moderation
            screen needs
        """

        queryset = Testimonial.objects.select_related(
            "user"
        )

        if self.request.user.is_authenticated and self.request.user.is_staff:
            return queryset

        return queryset.filter(
            status=Testimonial.Status.APPROVED
        )

    def get_permissions(self):
        """
        Public (AllowAny):
            - GET approved reviews
            - GET /mine/ requires a token, see below

        Signed-in customer:
            - POST a review
            - GET their own reviews

        Admin:
            - approve
            - reject
            - delete
        """

        if self.action in [
            "approve",
            "reject",
            "destroy",
        ]:
            return [capability_permission("reviews.moderate")()]

        if self.action in [
            "create",
            "mine",
        ]:
            return [
                IsAuthenticated()
            ]

        return [
            AllowAny()
        ]

    # ---------------------------------------------------------
    # CREATE TESTIMONIAL
    # ---------------------------------------------------------

    @extend_schema(
        request=TestimonialSerializer,
        responses={
            201: TestimonialSerializer,
            401: OpenApiResponse(
                description=(
                    "Sign in or create an account first. "
                    "Reviews are attributed to a real customer."
                ),
            ),
        },
        description=(
            "Submit a testimonial. "
            "Requires an `Authorization: Bearer <access>` "
            "header: a review is tied to the account that wrote it, "
            "and the published name comes from that account rather "
            "than the request body. "
            "New testimonials are created with "
            "pending status and require admin approval."
        ),
    )
    def create(
        self,
        request,
        *args,
        **kwargs,
    ):
        """
        Create a review owned by the signed-in customer.
        """

        serializer = self.get_serializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        if not resolve_reviewer_name(
            request.user
        ):
            raise ValidationError(
                {
                    "customer_name": [
                        "Add your name to your account "
                        "before leaving a review."
                    ]
                }
            )

        testimonial = create_testimonial(
            user=request.user,
            **serializer.validated_data
        )

        output = self.get_serializer(
            testimonial
        )

        return Response(
            output.data,
            status=status.HTTP_201_CREATED,
        )

    # ---------------------------------------------------------
    # MY REVIEWS
    # ---------------------------------------------------------

    @extend_schema(
        request=None,
        responses={
            200: TestimonialSerializer,
            401: OpenApiResponse(
                description="Authentication required.",
            ),
        },
        description=(
            "List the signed-in customer's own reviews, "
            "in every state, so they can see whether a review is "
            "still pending or has been approved. "
            "Only ever returns rows owned by the caller."
        ),
    )
    @action(
        detail=False,
        methods=["get"],
        url_path="mine",
    )
    def mine(
        self,
        request,
    ):
        # Deliberately not get_queryset(): the wall filter would hide
        # the caller's own pending and rejected reviews, which are
        # exactly the rows they are asking about.
        queryset = (
            Testimonial.objects
            .filter(user=request.user)
            .select_related("user")
        )

        serializer = self.get_serializer(
            queryset,
            many=True,
        )

        return Response(
            serializer.data
        )

    # ---------------------------------------------------------
    # APPROVE TESTIMONIAL
    # ---------------------------------------------------------

    @extend_schema(
        request=None,
        responses={
            200: TestimonialSerializer,
            403: OpenApiResponse(
                description="Admin permission required.",
            ),
        },
        description=(
            "Admin only. Approve a pending testimonial."
        ),
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="approve",
    )
    def approve(
        self,
        request,
        pk=None,
    ):
        testimonial = self.get_object()

        testimonial = approve_testimonial(
            testimonial
        )

        log_action(request, "testimonial.approved", testimonial, {"customer": testimonial.customer_name, "rating": testimonial.rating})

        return Response(
            self.get_serializer(
                testimonial
            ).data
        )

    # ---------------------------------------------------------
    # REJECT TESTIMONIAL
    # ---------------------------------------------------------

    @extend_schema(
        request=None,
        responses={
            200: TestimonialSerializer,
            403: OpenApiResponse(
                description="Admin permission required.",
            ),
        },
        description=(
            "Admin only. Reject a pending testimonial."
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
        testimonial = self.get_object()

        testimonial = reject_testimonial(
            testimonial
        )

        log_action(request, "testimonial.rejected", testimonial, {"customer": testimonial.customer_name, "rating": testimonial.rating})

        return Response(
            self.get_serializer(
                testimonial
            ).data
        )
    
    @extend_schema(
        request=None,
        responses={
            204: OpenApiResponse(
                description="Testimonial permanently deleted."
            ),
            403: OpenApiResponse(
                description="Admin permission required."
            ),
        },
        description=(
            "Admin only. Permanently delete a testimonial "
            "from the database."
        ),
    )
    def destroy(
        self,
        request,
        *args,
        **kwargs,
    ):
        testimonial = self.get_object()

        name = testimonial.customer_name

        testimonial.delete()

        log_action(request, "testimonial.deleted", details={"customer": name})

        return Response(
            status=status.HTTP_204_NO_CONTENT
        )
