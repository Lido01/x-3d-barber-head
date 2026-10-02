"""
Adds the normalised phone number that makes a customer's history findable.

Added nullable, backfilled, then made non-nullable - the same three-step
shape as the booking code, and for the same reason: a column that must be
filled in cannot be added straight to a table that already has rows.

Why this column exists at all: "show me every booking I have made" needs
to match a phone number the customer types today against numbers stored
over years, written by whoever took the booking. Those two do not agree on
formatting - "0911 234 567" and "+251911234567" are the same person - and
no single SQL pattern matches every spelling at once. Storing the reduced
form turns the history query into one indexed equality, and makes it
correct rather than approximately correct.
"""

from django.db import migrations, models

from apps.bookings.models import reduce_phone


def backfill_phone_signatures(apps, schema_editor):
    """Reduce every stored phone number to its identifying digits."""

    Booking = apps.get_model("bookings", "Booking")

    for booking in Booking.objects.filter(phone_normalised="").iterator():
        Booking.objects.filter(pk=booking.pk).update(
            phone_normalised=reduce_phone(booking.customer_phone)
        )


def clear_phone_signatures(apps, schema_editor):
    """Undo the backfill. The column is dropped on the way back anyway."""

    Booking = apps.get_model("bookings", "Booking")

    Booking.objects.update(phone_normalised="")


class Migration(migrations.Migration):

    dependencies = [
        ("bookings", "0005_booking_booking_code_booking_user"),
    ]

    operations = [
        migrations.AddField(
            model_name="booking",
            name="phone_normalised",
            field=models.CharField(
                blank=True,
                db_index=True,
                default="",
                editable=False,
                help_text=(
                    "customer_phone reduced to its significant digits. "
                    "Indexes the customer's bookings so 'show me everything "
                    "I booked' is one indexed lookup rather than a scan in "
                    "Python."
                ),
                max_length=20,
            ),
        ),
        migrations.RunPython(
            backfill_phone_signatures,
            reverse_code=clear_phone_signatures,
        ),
    ]