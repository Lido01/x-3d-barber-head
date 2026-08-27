from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.bookings.services import confirm_booking
from .models import Payment


@transaction.atomic
def create_payment(
    *,
    booking,
    amount,
    method,
    transaction_reference="",
    receipt=None,
):
    """
    Create a customer payment.

    Customers do not need an account.
    Every new payment starts as PENDING.
    """

    if booking is None:
        raise ValidationError(
            {
                "booking": [
                    "A valid booking is required."
                ]
            }
        )

    if booking.status == booking.Status.CANCELLED:
        raise ValidationError(
            {
                "booking": [
                    "Cannot pay for a cancelled booking."
                ]
            }
        )

    if booking.status == booking.Status.COMPLETED:
        raise ValidationError(
            {
                "booking": [
                    "This booking has already been completed."
                ]
            }
        )

    if amount <= 0:
        raise ValidationError(
            {
                "amount": [
                    "Payment amount must be greater than zero."
                ]
            }
        )

    payment = Payment.objects.create(
        booking=booking,
        amount=amount,
        method=method,
        transaction_reference=transaction_reference,
        receipt=receipt,
        status=Payment.Status.PENDING,
    )

    return payment


@transaction.atomic
def verify_payment(
    *,
    payment,
    verified_by,
):
    """
    Admin verifies a pending payment.

    Once payment is verified,
    the related booking becomes CONFIRMED.
    """

    if payment.status != Payment.Status.PENDING:
        raise ValidationError(
            {
                "status": [
                    "Only pending payments can be verified."
                ]
            }
        )

    payment.status = Payment.Status.VERIFIED
    payment.verified_by = verified_by

    payment.save(
        update_fields=[
            "status",
            "verified_by",
            "updated_at",
        ]
    )

    # Confirm the booking after successful payment verification.
    confirm_booking(
        payment.booking
    )

    return payment


@transaction.atomic
def reject_payment(
    *,
    payment,
    reason,
):
    """
    Admin rejects a pending payment.
    """

    if payment.status != Payment.Status.PENDING:
        raise ValidationError(
            {
                "status": [
                    "Only pending payments can be rejected."
                ]
            }
        )

    reason = reason.strip()

    if not reason:
        raise ValidationError(
            {
                "reason": [
                    "A rejection reason is required."
                ]
            }
        )

    payment.status = Payment.Status.REJECTED
    payment.rejection_reason = reason

    payment.save(
        update_fields=[
            "status",
            "rejection_reason",
            "updated_at",
        ]
    )

    return payment