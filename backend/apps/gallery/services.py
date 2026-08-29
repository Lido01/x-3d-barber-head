from .models import GalleryPost


def create_gallery_post(
    *,
    title,
    description="",
    image,
    style_name="",
    is_active=True,
):
    return GalleryPost.objects.create(
        title=title,
        description=description,
        image=image,
        style_name=style_name,
        is_active=is_active,
    )


def update_gallery_post(
    gallery_post,
    *,
    title=None,
    description=None,
    image=None,
    style_name=None,
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

    if is_active is not None:
        gallery_post.is_active = is_active

    gallery_post.save()

    return gallery_post