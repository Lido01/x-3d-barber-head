from rest_framework import status, viewsets
from rest_framework.parsers import (
    FormParser,
    MultiPartParser,
    JSONParser,
)
from rest_framework.permissions import AllowAny, IsAdminUser
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
from apps.accounts.permissions import capability_permission
from apps.accounts.audit import log_action


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

    http_method_names = [
        "get",
        "post",
        "put",
        "patch",
        "delete",
        "head",
        "options",
    ]

    def get_permissions(self):
        """
        Public customers can view active gallery posts.

        Only admin/staff users can create, update or delete them.
        """

        if self.action in [
            "list",
            "retrieve",
        ]:
            return [AllowAny()]

        return [capability_permission("gallery.manage")()]

    def get_queryset(self):
        """
        Customers only receive active gallery posts.
        """

        queryset = GalleryPost.objects.all()

        if self.request.user.is_authenticated and self.request.user.is_staff:
            return queryset

        return queryset.filter(
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

        log_action(request, "gallery_post.created", gallery_post, {"title": gallery_post.title})

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

        log_action(request, "gallery_post.updated", gallery_post, {"fields": sorted(serializer.validated_data.keys())})

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

        title = gallery_post.title

        gallery_post.delete()

        log_action(request, "gallery_post.deleted", details={"title": title})

        return Response(
            status=status.HTTP_204_NO_CONTENT
        )
