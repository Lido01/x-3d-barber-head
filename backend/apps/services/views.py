from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import (
    JSONParser,
    FormParser,
    MultiPartParser,
)
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response

from drf_spectacular.utils import (
    extend_schema,
    OpenApiResponse,
)

from .serializers import (
    HaircutStyleSerializer,
    ServiceSerializer,
)
from .services import (
    HaircutStyleService,
    ServiceService,
)
from apps.accounts.permissions import capability_permission
from apps.accounts.audit import log_action


class ServiceViewSet(viewsets.ViewSet):
    """
    API for barber services and their haircut styles.

    Public customers can:
        - View active services
        - View an active service
        - View active haircut styles

    Admin users can:
        - Create services
        - Update services
        - Delete services
        - Create haircut styles
        - Update haircut styles
        - Delete haircut styles
    """

    parser_classes = [
        MultiPartParser,
        FormParser,
        JSONParser,
    ]

    # ---------------------------------------------------------
    # PERMISSIONS
    # ---------------------------------------------------------

    def get_permissions(self):
        """
        Public:
            GET services
            GET service details
            GET styles

        Admin:
            POST
            PUT
            PATCH
            DELETE
        """

        if self.action in [
            "create",
            "update",
            "partial_update",
            "destroy",
            "create_style",
            "update_style",
            "partial_update_style",
            "destroy_style",
        ]:
            return [capability_permission("services.manage")()]

        return [AllowAny()]

    # ---------------------------------------------------------
    # SERVICES
    # ---------------------------------------------------------

    @extend_schema(
        responses={200: ServiceSerializer(many=True)},
        description=(
            "Return active services publicly and all services to staff. "
            "Each service includes its active haircut styles."
        ),
    )
    def list(self, request):
        if request.user.is_authenticated and request.user.is_staff:
            services = ServiceService.list_all()
        else:
            services = ServiceService.list_active()

        serializer = ServiceSerializer(
            services,
            many=True,
            context={"request": request},
        )

        return Response(serializer.data)

    @extend_schema(
        request=ServiceSerializer,
        responses={
            201: ServiceSerializer,
            400: OpenApiResponse(
                description="Invalid service data."
            ),
            403: OpenApiResponse(
                description="Admin permission required."
            ),
        },
        description=(
            "Admin only. Create a new barber service."
        ),
    )
    def create(self, request):
        serializer = ServiceSerializer(
            data=request.data,
            context={"request": request},
        )

        serializer.is_valid(
            raise_exception=True
        )

        service = ServiceService.create(
            **serializer.validated_data
        )

        log_action(request, "service.created", service, {"name": service.name, "price": str(service.price)})

        output = ServiceSerializer(
            service,
            context={"request": request},
        )

        return Response(
            output.data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        responses={
            200: ServiceSerializer,
            404: OpenApiResponse(
                description="Service not found or inactive."
            ),
        },
        description=(
            "Return details for one active barber service "
            "including its active haircut styles."
        ),
    )
    def retrieve(
        self,
        request,
        pk=None,
    ):
        service = ServiceService.get_active(pk)

        serializer = ServiceSerializer(
            service,
            context={"request": request},
        )

        return Response(serializer.data)

    @extend_schema(
        request=ServiceSerializer,
        responses={
            200: ServiceSerializer,
            400: OpenApiResponse(
                description="Invalid service data."
            ),
            403: OpenApiResponse(
                description="Admin permission required."
            ),
        },
        description=(
            "Admin only. Replace all editable fields "
            "of a service."
        ),
    )
    def update(
        self,
        request,
        pk=None,
    ):
        service = ServiceService.get(pk)

        serializer = ServiceSerializer(
            service,
            data=request.data,
            context={"request": request},
        )

        serializer.is_valid(
            raise_exception=True
        )

        service = ServiceService.update(
            service,
            **serializer.validated_data
        )

        log_action(request, "service.updated", service, {"fields": sorted(serializer.validated_data.keys())})

        output = ServiceSerializer(
            service,
            context={"request": request},
        )

        return Response(output.data)

    @extend_schema(
        request=ServiceSerializer,
        responses={
            200: ServiceSerializer,
            400: OpenApiResponse(
                description="Invalid service data."
            ),
            403: OpenApiResponse(
                description="Admin permission required."
            ),
        },
        description=(
            "Admin only. Partially update a service."
        ),
    )
    def partial_update(
        self,
        request,
        pk=None,
    ):
        service = ServiceService.get(pk)

        serializer = ServiceSerializer(
            service,
            data=request.data,
            partial=True,
            context={"request": request},
        )

        serializer.is_valid(
            raise_exception=True
        )

        service = ServiceService.update(
            service,
            **serializer.validated_data
        )

        log_action(request, "service.updated", service, {"fields": sorted(serializer.validated_data.keys())})

        output = ServiceSerializer(
            service,
            context={"request": request},
        )

        return Response(output.data)

    @extend_schema(
        responses={
            204: OpenApiResponse(
                description="Service deleted successfully."
            ),
            403: OpenApiResponse(
                description="Admin permission required."
            ),
        },
        description=(
            "Admin only. Permanently delete a service "
            "and its related haircut styles."
        ),
    )
    def destroy(
        self,
        request,
        pk=None,
    ):
        service = ServiceService.get(pk)

        # Captured before the delete, when the row still has a name to
        # put in the log.
        name = service.name

        ServiceService.delete(service)

        log_action(request, "service.deleted", details={"name": name})

        return Response(
            status=status.HTTP_204_NO_CONTENT
        )

    # ---------------------------------------------------------
    # HAIRCUT STYLES
    # ---------------------------------------------------------

    @extend_schema(
        responses={
            200: HaircutStyleSerializer(many=True),
        },
        description=(
            "Return all active haircut styles "
            "belonging to this service."
        ),
    )
    @action(
        detail=True,
        methods=["get"],
        url_path="styles",
    )
    def styles(
        self,
        request,
        pk=None,
    ):
        service = ServiceService.get_active(pk)

        styles = HaircutStyleService.list_for_service(
            service
        )

        serializer = HaircutStyleSerializer(
            styles,
            many=True,
            context={"request": request},
        )

        return Response(serializer.data)
    
    @extend_schema(
        request=HaircutStyleSerializer,
        responses={
            201: HaircutStyleSerializer,
            400: OpenApiResponse(
                description="Invalid haircut style data."
            ),
            403: OpenApiResponse(
                description="Admin permission required."
            ),
        },
        description=(
            "Admin only. Create a haircut style "
            "for this service."
        ),
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="styles/create",
    )
    def create_style(
        self,
        request,
        pk=None,
    ):
        service = ServiceService.get(pk)

        serializer = HaircutStyleSerializer(
            data=request.data,
            context={"request": request},
        )

        serializer.is_valid(
            raise_exception=True
        )

        validated_data = serializer.validated_data.copy()

        # Service is determined by the URL.
        validated_data.pop("service", None)

        style = HaircutStyleService.create(
            service=service,
            **validated_data
        )

        log_action(request, "haircut_style.created", style, {"name": style.name, "service": service.name})

        output = HaircutStyleSerializer(
            style,
            context={"request": request},
        )

        return Response(
            output.data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        request=HaircutStyleSerializer,
        responses={
            200: HaircutStyleSerializer,
            403: OpenApiResponse(
                description="Admin permission required."
            ),
        },
        description=(
            "Admin only. Replace a haircut style."
        ),
    )
    @action(
        detail=True,
        methods=["put"],
        url_path="styles/(?P<style_id>[^/.]+)",
    )
    def update_style(
        self,
        request,
        pk=None,
        style_id=None,
    ):
        service = ServiceService.get(pk)

        style = HaircutStyleService.get_for_service(
            service,
            style_id,
        )

        serializer = HaircutStyleSerializer(
            style,
            data=request.data,
            context={"request": request},
        )

        serializer.is_valid(
            raise_exception=True
        )

        style = HaircutStyleService.update(
            style,
            **serializer.validated_data
        )

        log_action(request, "haircut_style.updated", style, {"fields": sorted(serializer.validated_data.keys())})

        output = HaircutStyleSerializer(
            style,
            context={"request": request},
        )

        return Response(output.data)

    @extend_schema(
        request=HaircutStyleSerializer,
        responses={
            200: HaircutStyleSerializer,
            403: OpenApiResponse(
                description="Admin permission required."
            ),
        },
        description=(
            "Admin only. Partially update a haircut style."
        ),
    )
    @action(
        detail=True,
        methods=["patch"],
        url_path="styles/(?P<style_id>[^/.]+)",
    )
    def partial_update_style(
        self,
        request,
        pk=None,
        style_id=None,
    ):
        service = ServiceService.get(pk)

        style = HaircutStyleService.get_for_service(
            service,
            style_id,
        )

        serializer = HaircutStyleSerializer(
            style,
            data=request.data,
            partial=True,
            context={"request": request},
        )

        serializer.is_valid(
            raise_exception=True
        )

        style = HaircutStyleService.update(
            style,
            **serializer.validated_data
        )

        log_action(request, "haircut_style.updated", style, {"fields": sorted(serializer.validated_data.keys())})

        output = HaircutStyleSerializer(
            style,
            context={"request": request},
        )

        return Response(output.data)

    @extend_schema(
        responses={
            204: OpenApiResponse(
                description="Haircut style deleted successfully."
            ),
            403: OpenApiResponse(
                description="Admin permission required."
            ),
        },
        description=(
            "Admin only. Permanently delete a haircut style."
        ),
    )
    @action(
        detail=True,
        methods=["delete"],
        url_path="styles/(?P<style_id>[^/.]+)",
    )
    def destroy_style(
        self,
        request,
        pk=None,
        style_id=None,
    ):
        service = ServiceService.get(pk)

        style = HaircutStyleService.get_for_service(
            service,
            style_id,
        )

        name = style.name

        HaircutStyleService.delete(style)

        log_action(request, "haircut_style.deleted", details={"name": name, "service": service.name})

        return Response(
            status=status.HTTP_204_NO_CONTENT
        )
