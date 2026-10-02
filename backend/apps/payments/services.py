from django.db import transaction
from django.utils import timezone
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
    Create a customer payment, or correct one the shop could not accept.

    Customers do not need an account.
    Every new payment starts as PENDING.

    A booking takes exactly one payment, and that is enforced here rather
    than left to the unique constraint. A second submit on the same
    booking - a double tap, a refresh mid-upload - would otherwise reach
    the database and surface as a 500, which tells a customer handing over
    money that it is in a state nobody can explain.

    The three existing states each need a different answer:

      verified  Refuse. There is nothing left to send.
      pending   Refuse, and say it is waiting. Sending another would be
                two claims on one appointment, and the shop would have no
                way to tell which one is real.
      rejected  **Accept, and replace it.** This is the case that matters:
                a rejected payment is almost always an illegible
                screenshot or a mistyped reference - something the
                customer can fix. Refusing to let them try again left
                them with an appointment they had paid for and no way to
                prove it, with nothing to do but telephone the shop. The
                row is updated in place rather than replaced, so the
                one-payment-per-booking rule holds, the payment id the
                customer was given stays valid, and the submission the
                shop already rejected is not silently deleted.

    `replaced_a_rejected_payment` is set on the returned object so the
    view can record that a resubmission happened.
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
                        "payment checked. There is nothing more to send."
                    ]
                }
            )

        if existing.status == Payment.Status.PENDING:
            raise ValidationError(
                {
                    "booking": [
                        "A payment has already been sent for this booking "
                        "and is still waiting to be checked. Please wait "
                        "for the shop rather than sending another."
                    ]
                }
            )

        return _replace_rejected_payment(
            existing,
            amount=amount,
            method=method,
            transaction_reference=transaction_reference,
            receipt=receipt,
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
                    "This appointment has already been completed. Please "
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


def _replace_rejected_payment(
    payment,
    *,
    amount,
    method,
    transaction_reference,
    receipt,
):
    """
    Overwrite a rejected payment with the customer's corrected one.

    In place, so the payment id survives: the customer's confirmation page,
    their booking history and the shop's own queue all refer to that id,
    and replacing the row would break every one of those links for a
    change that is really the same payment, corrected.
    """

    if amount <= 0:
        raise ValidationError(
            {
                "amount": [
                    "Payment amount must be greater than zero."
                ]
            }
        )

    if receipt is not None:
        # The screenshot the shop could not read is not worth keeping -
        # it is the reason this submission is being replaced.
        if payment.receipt:
            payment.receipt.delete(save=False)

        payment.receipt = receipt

    payment.amount = amount
    payment.method = method

    if transaction_reference:
        payment.transaction_reference = transaction_reference

    payment.status = Payment.Status.PENDING
    payment.rejection_reason = ""
    payment.verified_by = None
    payment.verified_at = None

    payment.save(
        update_fields=[
            "amount",
            "method",
            "transaction_reference",
            "receipt",
            "status",
            "rejection_reason",
            "verified_by",
            "verified_at",
            "updated_at",
        ]
    )

    payment.replaced_a_rejected_payment = True

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

    `verified_at` is stamped here rather than being left to default,
    because two things depend on it being right and neither was: the
    console's "revenue today" and "revenue this month" both group verified
    payments by this date, so a verified payment with no timestamp on it
    was real money that appeared in no total at all.
    """

    if payment.status != Payment.Status.PENDING:
        raise ValidationError(
            {
                "status": [
                    "Only payments still waiting to be checked can be "
                    "accepted."
                    + (
                        f" This one is already "
                        f"{payment.status}."
                        if payment.status != Payment.Status.PENDING
                        else ""
                    )
                ]
            }
        )

    payment.status = Payment.Status.VERIFIED
    payment.verified_by = verified_by
    payment.verified_at = timezone.now()

    payment.save(
        update_fields=[
            "status",
            "verified_by",
            "verified_at",
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