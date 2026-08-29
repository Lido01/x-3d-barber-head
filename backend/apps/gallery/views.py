from rest_framework import status, viewsets
from rest_framework.parsers import (
    FormParser,
    MultiPartParser,
    JSONParser,
)
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from drf_spectacular.utils import (
    extend_schema,
    OpenApiResponse,
)

from .models import GalleryPost
from .serializers import GalleryPostSerializer
from .services import (
    create_gallery_post,
    update_gallery_post,
)


class GalleryPostViewSet(viewsets.ModelViewSet):
    """
    Gallery API.

    Customers can view active gallery posts.
    Gallery posts can be created and managed
    through the API.
    """

    serializer_class = GalleryPostSerializer

    parser_classes = [
        MultiPartParser,
        FormParser,
        JSONParser,
    ]

    permission_classes = [
        IsAuthenticated,
    ]

    http_method_names = [
        "get",
        "post",
        "put",
        "patch",
        "delete",
        "head",
        "options",
    ]

    def get_queryset(self):
        """
        Customers only receive active gallery posts.
        """

        return GalleryPost.objects.filter(
            is_active=True
        )

    @extend_schema(
        request=GalleryPostSerializer,
        responses={
            201: GalleryPostSerializer,
        },
        description=(
            "Create a gallery post with a haircut "
            "photo and optional style information."
        ),
    )
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        gallery_post = create_gallery_post(
            **serializer.validated_data
        )

        output = self.get_serializer(
            gallery_post
        )

        return Response(
            output.data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        request=GalleryPostSerializer,
        responses={
            200: GalleryPostSerializer,
        },
        description="Update a gallery post.",
    )
    def update(
        self,
        request,
        *args,
        **kwargs,
    ):
        partial = kwargs.pop(
            "partial",
            False,
        )

        gallery_post = self.get_object()

        serializer = self.get_serializer(
            gallery_post,
            data=request.data,
            partial=partial,
        )

        serializer.is_valid(
            raise_exception=True
        )

        gallery_post = update_gallery_post(
            gallery_post,
            **serializer.validated_data,
        )

        output = self.get_serializer(
            gallery_post
        )

        return Response(output.data)

    @extend_schema(
        request=GalleryPostSerializer,
        responses={
            200: GalleryPostSerializer,
        },
        description="Partially update a gallery post.",
    )
    def partial_update(
        self,
        request,
        *args,
        **kwargs,
    ):
        kwargs["partial"] = True

        return self.update(
            request,
            *args,
            **kwargs,
        )

    @extend_schema(
        responses={
            204: OpenApiResponse(
                description="Gallery post deleted."
            ),
        },
        description="Delete a gallery post.",
    )
    def destroy(
        self,
        request,
        *args,
        **kwargs,
    ):
        gallery_post = self.get_object()

        gallery_post.delete()

        return Response(
            status=status.HTTP_204_NO_CONTENT
        )