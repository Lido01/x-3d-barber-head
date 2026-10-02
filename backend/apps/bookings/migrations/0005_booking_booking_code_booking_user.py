"""
Adds the customer-facing booking code and the optional account link.

Two details here are not incidental.

**The column is added nullable, filled, and only then made non-null.**
A unique column cannot be added straight to a table that already has
rows: they would all hold the same default value and the ALTER would fail
on the first pair. So the sequence is add-nullable, backfill, tighten -
which also means there is no window in which the database holds two
bookings with the same code.

**Every existing booking is given a code derived from its own primary
key.** The backfill runs in the migration rather than in a management
command: leaving a shop's history without codes would mean customers with
bookings made before this existed could never look them up, and the code
is the only thing they have to identify a guest booking.
"""

from django.conf import settings
from django.db import migrations, models

import django.db.models.deletion

from apps.bookings.models import build_booking_code


def backfill_booking_codes(apps, schema_editor):
    """Give every existing booking the code its row id implies."""

    Booking = apps.get_model("bookings", "Booking")

    for booking in Booking.objects.filter(booking_code__isnull=True).iterator():
        # Assigned per row rather than in one UPDATE, so no two rows
        # briefly hold the same code while the unique index exists.
        Booking.objects.filter(pk=booking.pk).update(
            booking_code=build_booking_code(booking.pk)
        )


def clear_booking_codes(apps, schema_editor):
    """Undo the backfill. Dropping the field removes the codes anyway."""

    Booking = apps.get_model("bookings", "Booking")

    Booking.objects.update(booking_code=None)


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("bookings", "0004_barber_bio"),
    ]

    operations = [
        migrations.AddField(
            model_name="booking",
            name="booking_code",
            field=models.CharField(
                default=None,
                editable=False,
                help_text=(
                    "Customer-facing reference, e.g. BK-3274. Derived from "
                    "the primary key and assigned on first save."
                ),
                max_length=16,
                null=True,
                unique=True,
            ),
        ),
        migrations.AddField(
            model_name="booking",
            name="user",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="bookings",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(
            backfill_booking_codes,
            reverse_code=clear_booking_codes,
        ),
        # Only safe now that every row holds a distinct code. `default`
        # is what the model's save() will use for anything created by a
        # bulk operation that bypasses it; the model assigns a real code.
        migrations.AlterField(
            model_name="booking",
            name="booking_code",
            field=models.CharField(
                default="",
                editable=False,
                help_text=(
                    "Customer-facing reference, e.g. BK-3274. Derived from "
                    "the primary key and assigned on first save."
                ),
                max_length=16,
                unique=True,
            ),
        ),
    ]