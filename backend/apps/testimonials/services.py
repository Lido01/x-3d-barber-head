from rest_framework.exceptions import ValidationError

from .models import Testimonial


def create_testimonial(
    *,
    customer_name,
    customer_phone="",
    message,
    rating=5,
    photo=None,
):
    return Testimonial.objects.create(
        customer_name=customer_name,
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