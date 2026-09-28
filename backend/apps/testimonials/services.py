"""
Business rules for customer testimonials.

Reviews are attributed to a real account: `user` records who wrote it
and `customer_name` is derived from that account rather than trusted
from the request body. The column is still stored (and still rendered)
so an approved review keeps saying who it is by even if the account is
later removed - on_delete=SET_NULL would otherwise blank the wall.
"""

from .models import Testimonial


def resolve_reviewer_name(user):
    """
    The name to publish for a reviewer.

    Prefers the account's real name, falls back to the username, and
    finally to an empty string so the view can reject it.
    """

    if user is None:
        return ""

    full_name = (
        f"{user.first_name} {user.last_name}"
    ).strip()

    return full_name or user.get_username()


def create_testimonial(
    *,
    user,
    message,
    rating=5,
    photo=None,
    customer_phone="",
):
    """
    Create a review owned by `user`, held pending until staff approve it.
    """

    return Testimonial.objects.create(
        user=user,
        customer_name=resolve_reviewer_name(
            user
        ),
        customer_phone=customer_phone,
        message=message,
        rating=rating,
        photo=photo,
        status=Testimonial.Status.PENDING,
    )


def approve_testimonial(testimonial):
    if testimonial.status == Testimonial.Status.APPROVED:
        return testimonial

    testimonial.status = Testimonial.Status.APPROVED

    testimonial.save(
        update_fields=[
            "status",
            "updated_at",
        ]
    )

    return testimonial


def reject_testimonial(testimonial):
    if testimonial.status == Testimonial.Status.REJECTED:
        return testimonial

    testimonial.status = Testimonial.Status.REJECTED

    testimonial.save(
        update_fields=[
            "status",
            "updated_at",
        ]
    )

    return testimonial
