from django.db import transaction
from django.utils import timezone

from .models import Payment


def create_payment(
    *,
    booking,
    amount,
    method,
    transaction_reference="",
    receipt=None,
):
    """
    Create a new pending payment.
    """

    if hasattr(booking, "payment"):
        raise ValueError(
            "This booking already has a payment."
        )

    if amount <= 0:
        raise ValueError(
            "Payment amount must be greater than zero."
        )

    payment = Payment.objects.create(
        booking=booking,
        amount=amount,
        method=method,
        transaction_reference=transaction_reference,
        receipt=receipt,
        status="pending",
    )

    return payment


@transaction.atomic
def verify_payment(
    *,
    payment,
    verified_by,
):
    """
    Verify a pending payment.
    """

    if payment.status != "pending":
        raise ValueError(
            "Only pending payments can be verified."
        )

    payment.status = "verified"
    payment.verified_by = verified_by
    payment.verified_at = timezone.now()
    payment.rejection_reason = ""

    payment.save(
        update_fields=[
            "status",
            "verified_by",
            "verified_at",
            "rejection_reason",
            "updated_at",
        ]
    )

    booking = payment.booking

    if hasattr(booking, "status"):
        booking.status = "confirmed"
        booking.save(
            update_fields=[
                "status",
            ]
        )

    return payment


@transaction.atomic
def reject_payment(
    *,
    payment,
    reason,
):
    """
    Reject a pending payment.
    """

    if payment.status != "pending":
        raise ValueError(
            "Only pending payments can be rejected."
        )

    if not reason.strip():
        raise ValueError(
            "A rejection reason is required."
        )

    payment.status = "rejected"
    payment.rejection_reason = reason.strip()
    payment.verified_by = None
    payment.verified_at = None

    payment.save(
        update_fields=[
            "status",
            "rejection_reason",
            "verified_by",
            "verified_at",
            "updated_at",
        ]
    )

    return payment