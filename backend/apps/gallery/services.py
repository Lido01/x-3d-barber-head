from .models import GalleryPost


_UNSET = object()


def create_gallery_post(
    *,
    title,
    description="",
    image,
    style_name="",
    service=None,
    is_active=True,
):
    return GalleryPost.objects.create(
        title=title,
        description=description,
        image=image,
        style_name=style_name,
        service=service,
        is_active=is_active,
    )


def update_gallery_post(
    gallery_post,
    *,
    title=None,
    description=None,
    image=None,
    style_name=None,
    service=_UNSET,
    is_active=None,
):
    if title is not None:
        gallery_post.title = title

    if description is not None:
        gallery_post.description = description

    if image is not None:
        gallery_post.image = image

    if style_name is not None:
        gallery_post.style_name = style_name

    if service is not _UNSET:
        gallery_post.service = service

    if is_active is not None:
        gallery_post.is_active = is_active

    gallery_post.save()

    return gallery_post