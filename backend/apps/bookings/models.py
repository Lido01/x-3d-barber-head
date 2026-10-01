from django.conf import settings
from django.db import models
import re

from apps.services.models import Service

#: Every customer-facing booking reference starts with this, so a code is
#: recognisable in a screenshot or a phone call even before it is read out.
BOOKING_CODE_PREFIX = "BK"

#: Minimum digits in a code. Zero-padded to this width so BK-0007 and
#: BK-3274 are both four characters and neither is "BK-7".
BOOKING_CODE_DIGITS = 4

#: How many trailing digits identify a subscriber. Ethiopian mobile numbers
#: are nine digits after the trunk zero, and the country code is optional in
#: practice - so this is the part that two spellings of one number agree on.
PHONE_SIGNATURE_DIGITS = 9


def reduce_phone(value):
    """
    Reduce a phone number to the digits that identify its subscriber.

        "0911 234 567"    -> "911234567"
        "+251911234567"   -> "911234567"
        "0911-234-567"    -> "911234567"

    Formatting, the country code and a trunk zero all vary between the
    number a customer types into the booking form and the number staff
    write on the booking card. None of those differences identify a
    different person, so none of them are kept.

    This is the value stored in `Booking.phone_normalised`, and it is what
    makes "show me every booking I have made" one indexed lookup. The
    alternative - filtering on the stored string - cannot work: no single
    SQL pattern matches all three spellings above at once.
    """

    digits = re.sub(r"\D", "", str(value or ""))

    if digits.startswith("251"):
        digits = digits[3:]

    return digits.lstrip("0")


def phone_signature(value):
    """
    The trailing digits two spellings of one number will agree on.

    Falls back to the whole reduced number when it is too short to have a
    nine-digit tail, so a landline is not reduced to nothing.
    """

    reduced = reduce_phone(value)

    if len(reduced) > PHONE_SIGNATURE_DIGITS:
        return reduced[-PHONE_SIGNATURE_DIGITS:]

    return reduced


def build_booking_code(value):
    """
    "27" -> "BK-0027".

    Derived from the primary key rather than drawn at random. That is a
    deliberate trade:

      * It can never collide, so there is no retry loop and no unique
        constraint violation under concurrent booking.
      * Staff already quote the row id ("booking 27"), so the code and
        the internal reference agree and cannot drift apart.
      * It is backfillable - a migration can give every existing row a
        code from its own id, with no guessing.

    The cost is that the code is guessable, which is why reading a
    booking by code additionally requires the phone number the booking
    was made with. See bookings.services.find_booking_by_code.
    """

    return f"{BOOKING_CODE_PREFIX}-{int(value):0{BOOKING_CODE_DIGITS}d}"


class Barber(models.Model):
    name = models.CharField(max_length=120)

    role = models.CharField(
        max_length=120,
        blank=True,
    )

    specialty = models.CharField(
        max_length=255,
        blank=True,
    )

    experience = models.CharField(
        max_length=60,
        blank=True,
    )

    bio = models.TextField(
        blank=True,
    )

    image = models.ImageField(
        upload_to="barbers/",
        blank=True,
        null=True,
    )

    phone = models.CharField(
        max_length=30,
        blank=True,
    )

    is_active = models.BooleanField(
        default=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Booking(models.Model):

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        CONFIRMED = "confirmed", "Confirmed"
        CANCELLED = "cancelled", "Cancelled"
        COMPLETED = "completed", "Completed"
        EXPIRED = "expired", "Expired"

    customer_name = models.CharField(
        max_length=120,
    )

    customer_phone = models.CharField(
        max_length=30,
    )

    booking_code = models.CharField(
        max_length=16,
        default="",
        unique=True,
        editable=False,
        help_text=(
            "Customer-facing reference, e.g. BK-3274. Derived from the "
            "primary key and assigned on first save."
        ),
    )

    phone_normalised = models.CharField(
        max_length=20,
        default="",
        blank=True,
        editable=False,
        db_index=True,
        help_text=(
            "customer_phone reduced to its significant digits. Indexes "
            "the customer's bookings so 'show me everything I booked' is "
            "one indexed lookup rather than a scan in Python."
        ),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="bookings",
        null=True,
        blank=True,
    )

    service = models.ForeignKey(
        Service,
        on_delete=models.PROTECT,
        related_name="bookings",
    )

    barber = models.ForeignKey(
        Barber,
        on_delete=models.PROTECT,
        related_name="bookings",
        null=True,
        blank=True,
    )

    booking_date = models.DateField()

    start_time = models.TimeField()

    end_time = models.TimeField(
        editable=False,
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )

    notes = models.TextField(
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = [
            "booking_date",
            "start_time",
        ]

        indexes = [
            models.Index(
                fields=[
                    "booking_date",
                    "start_time",
                ]
            ),
            models.Index(
                fields=[
                    "barber",
                    "booking_date",
                    "start_time",
                ]
            ),
        ]

        constraints = [
            models.CheckConstraint(
                condition=models.Q(
                    end_time__gt=models.F(
                        "start_time"
                    )
                ),
                name="booking_end_time_after_start_time",
            ),
        ]

    def save(self, *args, **kwargs):
        """
        Assign the derived fields on the way in.

        The booking code is built from the primary key, and the primary
        key does not exist until after the INSERT, so that one is
        necessarily a second statement. It is issued with
        QuerySet.update() rather than another save() so it cannot
        re-enter this method, and so it does not fire post_save twice for
        what the application considers one booking being created.

        Everything after the first insert leaves an assigned code alone:
        rescheduling or cancelling a booking must never change the number
        the customer was given.

        `phone_normalised` is different - it tracks `customer_phone`, and
        staff can correct a mistyped number on an existing booking, so it
        is recomputed whenever the number changes.
        """

        inserting = self._state.adding

        fields = kwargs.get("update_fields")
        narrowed = fields is not None and "customer_phone" not in fields

        if not inserting and not narrowed:
            self.phone_normalised = reduce_phone(self.customer_phone)

        super().save(*args, **kwargs)

        if inserting:
            self.phone_normalised = reduce_phone(self.customer_phone)

            if not self.booking_code:
                self.booking_code = build_booking_code(self.pk)

            # A single UPDATE for both derived columns: one write, and no
            # chance of the code being written without the phone key that
            # makes this booking findable.
            Booking.objects.filter(pk=self.pk).update(
                booking_code=self.booking_code,
                phone_normalised=self.phone_normalised,
            )

    def __str__(self):
        reference = self.booking_code or f"#{self.pk}"

        service = self.service.name if self.service_id else "no service"
        barber = self.barber.name if self.barber_id else "any barber"

        return (
            f"{reference} — {self.customer_name} — {service} — {barber} "
            f"({self.booking_date} {self.start_time:%H:%M})"
        )