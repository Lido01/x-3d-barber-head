from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.bookings.models import Booking
from apps.bookings.services import confirm_booking
from .models import Payment


def payment_gate_message(booking):
    """
    Why this booking cannot take a payment, in the customer's words.

    One function rather than a message at each call site, so the answer to
    "why is there no pay form here" is the same sentence wherever the
    customer meets it. It names the actual status rather than saying "not
    confirmed", because cancelled, completed and still-waiting are three
    different problems and only one of them is fixed by waiting.
    """

    if booking.status == Booking.Status.CANCELLED:
        return (
            "This booking was cancelled, so there is nothing to pay for. "
            "Please make a new booking."
        )

    if booking.status == Booking.Status.COMPLETED:
        return (
            "This appointment has already been completed. Please call the "
            "shop if you believe money is still owed."
        )

    if booking.status == Booking.Status.EXPIRED:
        return (
            "This booking has expired, so it is no longer held for you. "
            "Please make a new booking."
        )

    return (
        "The shop has not confirmed this appointment yet, so payment is "
        "not open. Reception confirms every booking, and the moment they "
        "do you will be able to pay here - this page checks on its own, "
        "so there is nothing else to do."
    )


def booking_takes_payment(booking):
    """
    Whether this booking is one money can be taken for at all.

    Payment opens when reception confirms the appointment, and not
    before. The shop takes money for chairs it has agreed to hold, not for
    requests it has not looked at yet: the other way round, the payment
    queue fills with claims against slots nobody promised, and the customer
    is asked for money before anyone has decided whether the appointment
    can happen.

    So the order is fixed and it is the shop's:

        requested  ->  confirmed  ->  paid  ->  checked

    Confirmed and paid are still separate. Staff confirm walk-ins who pay
    at the counter, so a confirmed booking with nothing behind it is an
    ordinary state - it is just one where payment is *open* rather than one
    where payment is *impossible*.
    """

    return (
        booking is not None
        and booking.status == Booking.Status.CONFIRMED
    )


def payment_is_open(booking, payment=None):
    """
    Whether a customer may send money for this booking right now.

    The single definition of "you can pay this now", read by the booking
    serializer, by the customer lookup payload and by the console - so
    those three cannot drift into three different answers to one question.

    A rejected payment leaves the booking open: the customer still owes the
    money, and a clearer screenshot or a corrected reference is exactly
    what settles it.

    `payment` is passed in wherever it has already been joined, so this
    never becomes a query per row behind a field name that reads like
    arithmetic.
    """

    if not booking_takes_payment(booking):
        return False

    if payment is None:
        payment = getattr(booking, "payment", None)

    return payment is None or payment.status == Payment.Status.REJECTED


def booking_money_state(booking):
    """
    The money behind a booking, as one answer.

    Read by the customer lookup payload, by the live status endpoint and by
    the console, so "what is the state of the money on this booking" has
    one definition rather than three that drift the first time the rule
    changes.

    The three booleans are deliberately not collapsible:

      payment_due       money is still owed on a live appointment. The
                        console's "unpaid" badge and its outstanding queue.
      payment_open      the customer may send money this minute. A booking
                        awaiting confirmation owes money and cannot be
                        paid yet, and this is what stops a pay form being
                        offered for a chair nobody has agreed to.
      payment_rejected  money was sent and the shop could not match it.
                        Not "nothing sent" - a booking with one of these
                        needs a corrected screenshot or a phone call, not
                        a fresh form.

    :returns: dict with `payment` plus the three flags above.
    """

    payment = getattr(booking, "payment", None)

    return {
        "payment": payment,
        "payment_due": (
            payment is None
            and booking.status
            in [
                Booking.Status.PENDING,
                Booking.Status.CONFIRMED,
            ]
        ),
        "payment_open": payment_is_open(booking, payment),
        "payment_rejected": (
            payment is not None
            and payment.status == Payment.Status.REJECTED
        ),
    }


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

    The booking must already be CONFIRMED. Reception confirms the
    appointment first and payment opens second - see `payment_is_open`,
    which is the same rule the interface reads, so the pay form and the
    endpoint cannot disagree about which bookings are payable.

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

    # First, and before anything about an existing payment: the booking has
    # to be one the shop has actually agreed to before money is taken for
    # it. A cancelled, completed or expired booking can never be paid, and
    # a booking still waiting on reception cannot be paid yet.
    if not booking_takes_payment(booking):
        raise ValidationError(
            {
                "booking": [
                    payment_gate_message(booking)
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
    Staff accepts a pending payment after matching it against the bank.

    Verification is the last step, not the first. The booking was already
    confirmed by reception before payment was ever open, so by the time a
    payment exists here the appointment is settled and only the money is
    unproven.

    Confirming the booking afterwards is therefore a no-op in the normal
    flow, and it is kept deliberately: payments created before reception
    confirmed first are already on file, and refusing to accept one of
    those would leave real money stranded against a booking the shop had
    already promised. `confirm_booking` is idempotent, so running it on
    every verification costs nothing and covers both.

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

    # Idempotent, and the reason is in the docstring: any payment that
    # predates "reception confirms first" still gets its booking settled
    # rather than being un-accept-able.
    confirm_booking(payment.booking)

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