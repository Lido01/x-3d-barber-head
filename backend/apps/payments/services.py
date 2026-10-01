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

    A booking takes exactly one payment, and that is checked here rather
    than left to the unique constraint. A second submit on the same
    booking - a double tap, a refresh mid-upload, the customer trying
    twice because the first attempt looked like it had not landed - would
    otherwise reach the database and surface as a 500, which tells the
    customer their money is in a state nobody can explain. Saying "this
    booking is already covered" is both true and useful.
    """

    if booking is None:
        raise ValidationError(
            {
                "booking": [
                    "A valid booking is required."
                ]
            }
        )

    existing = (
        Payment.objects
        .select_for_update()
        .filter(booking=booking)
        .first()
    )

    if existing is not None:
        if existing.status == Payment.Status.VERIFIED:
            raise ValidationError(
                {
                    "booking": [
                        "This booking has already been paid and the "
                        "payment verified. There is nothing more to send."
                    ]
                }
            )

        if existing.status == Payment.Status.REJECTED:
            raise ValidationError(
                {
                    "booking": [
                        "The payment already sent for this booking was "
                        "rejected"
                        + (
                            f": {existing.rejection_reason}"
                            if existing.rejection_reason
                            else ""
                        )
                        + ". Please call the shop so it can be sorted out."
                    ]
                }
            )

        raise ValidationError(
            {
                "booking": [
                    "A payment has already been sent for this booking "
                    "and is still waiting to be checked. Please wait for "
                    "the shop to verify it rather than sending another."
                ]
            }
        )

    if booking.status == booking.Status.CANCELLED:
        raise ValidationError(
            {
                "booking": [
                    "This booking was cancelled, so there is nothing to "
                    "pay for. Please make a new booking."
                ]
            }
        )

    if booking.status == booking.Status.COMPLETED:
        raise ValidationError(
            {
                "booking": [
                    "This booking has already been completed. Please "
                    "call the shop if you believe money is still owed."
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