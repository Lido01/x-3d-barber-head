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
)


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
        Public users see only approved testimonials.

        Admin users can see all testimonials,
        including pending and rejected ones.
        """

        queryset = Testimonial.objects.all()

        if self.request.user.is_authenticated and self.request.user.is_staff:
            return queryset

        return queryset.filter(
            status=Testimonial.Status.APPROVED
        )

    def get_permissions(self):
        """
        Public:
            - GET approved testimonials
            - POST testimonial

        Admin:
            - approve
            - reject
        """

        if self.action in [
            "approve",
            "reject",
            "destroy",
        ]:
            return [
                IsAdminUser()
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
        },
        description=(
            "Submit a testimonial. "
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
        serializer = self.get_serializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        testimonial = create_testimonial(
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

        testimonial.delete()

        return Response(
            status=status.HTTP_204_NO_CONTENT
        )