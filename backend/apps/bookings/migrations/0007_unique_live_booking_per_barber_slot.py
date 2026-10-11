from django.conf import settings
from django.db import migrations, models


#: Statuses that occupy a chair, and so are the ones that must not be
#: able to share a barber's slot. Must match the condition on the
#: constraint below and BLOCKING_STATUSES in bookings.services.
LIVE_STATUSES = ["pending", "confirmed"]


def assert_no_duplicates(apps, schema_editor):
    """
    Refuse to add the constraint onto data that already breaks it.

    Adding a unique constraint to a table with duplicates in it fails,
    and it fails with a bare "UNIQUE constraint failed" naming a table
    rather than a booking. That is an unhelpful thing to be handed while
    deploying, and it does not say what to do about it either.

    So the duplicates are looked for first and named. The operator then
    has a decision to make - two customers in one slot, or one customer
    in it twice - and that is a decision about a real appointment, not
    one a migration should quietly make by cancelling somebody's booking.

    Nothing here rewrites rows. Anyone deploying past this has to look.
    """

    Booking = apps.get_model("bookings", "Booking")

    seen = set()
    clashes = []

    for booking in (
        Booking.objects.filter(status__in=LIVE_STATUSES)
        .exclude(barber=None)
        .order_by("pk")
        .only("id", "booking_code", "barber_id", "booking_date", "start_time")
    ):
        key = (booking.barber_id, booking.booking_date, booking.start_time)

        if key in seen:
            clashes.append(f"  {booking.booking_code or booking.pk}: {key[1]} {key[2]}")

        seen.add(key)

    if clashes:
        raise RuntimeError(
            "Cannot add unique_live_booking_per_barber_slot: these live "
            "bookings share a barber and a start time.\n"
            + "\n".join(clashes)
            + "\n\nCancel or reschedule the later booking of each pair, "
            "then migrate again."
        )


class Migration(migrations.Migration):

    dependencies = [
        ("bookings", "0006_booking_phone_normalised"),
        (
            "services",
            "0003_haircutstyle_style_service_active_idx_and_more",
        ),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RunPython(
            assert_no_duplicates,
            reverse_code=migrations.RunPython.noop,
        ),
        migrations.AddConstraint(
            model_name="booking",
            constraint=models.UniqueConstraint(
                condition=models.Q(("status__in", LIVE_STATUSES)),
                fields=("barber", "booking_date", "start_time"),
                name="unique_live_booking_per_barber_slot",
            ),
        ),
    ]