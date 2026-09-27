"""
Business rules and booking workflows.

HTTP/DRF code should not live here.

Future AI flow:

    AI Agent
        ↓
    booking tool
        ↓
    bookings.services
        ↓
    database
"""

from datetime import datetime, timedelta

from django.conf import settings
from django.db import transaction
from django.utils.timezone import localdate

from rest_framework.exceptions import ValidationError

from .models import Barber, Booking


SLOT_INTERVAL_MINUTES = 30

BLOCKING_STATUSES = [
    Booking.Status.PENDING,
    Booking.Status.CONFIRMED,
]


def calculate_end_time(start_time, duration_minutes):
    """
    Calculate the ending time from a starting time
    and service duration.
    """

    return (
        datetime.combine(
            datetime.today(),
            start_time,
        )
        + timedelta(minutes=duration_minutes)
    ).time()


def validate_booking_date(booking_date):
    """
    Prevent bookings in the past.
    """

    if booking_date < localdate():
        raise ValidationError(
            {
                "booking_date": [
                    "Booking dates in the past are not allowed."
                ]
            }
        )


def validate_slot(start_time, end_time):
    """
    Make sure the appointment starts on a valid
    30-minute interval.
    """

    if (
        start_time.minute % SLOT_INTERVAL_MINUTES
        or start_time.second
        or start_time.microsecond
    ):
        raise ValidationError(
            {
                "start_time": [
                    "Start time must be on a "
                    f"{SLOT_INTERVAL_MINUTES}-minute interval."
                ]
            }
        )

    if end_time <= start_time:
        raise ValidationError(
            {
                "end_time": [
                    "End time must be after start time."
                ]
            }
        )


def validate_business_hours(start_time, end_time):
    if (
        start_time < settings.BOOKING_OPENING_TIME
        or end_time > settings.BOOKING_CLOSING_TIME
    ):
        raise ValidationError(
            {
                "start_time": [
                    "Appointments must be between "
                    f"{settings.BOOKING_OPENING_TIME:%H:%M} and "
                    f"{settings.BOOKING_CLOSING_TIME:%H:%M}."
                ]
            }
        )


def check_booking_conflict(
    *,
    barber,
    booking_date,
    start_time,
    end_time,
    exclude_booking_id=None,
):
    """
    Check whether this particular barber has
    an overlapping active booking.

    IMPORTANT:

    Different barbers can have the same time.

    Example:

        Barber A → 10:00 → allowed
        Barber B → 10:00 → allowed

    But:

        Barber A → 10:00–10:30
        Barber A → 10:15–10:45
        → conflict
    """

    overlapping = Booking.objects.filter(
        barber=barber,
        booking_date=booking_date,
        status__in=BLOCKING_STATUSES,
        start_time__lt=end_time,
        end_time__gt=start_time,
    )

    if exclude_booking_id is not None:
        overlapping = overlapping.exclude(
            pk=exclude_booking_id
        )

    return overlapping.exists()

def find_available_barber(
    *,
    booking_date,
    start_time,
    end_time,
):
    """
    Find the first active barber who is available
    during the requested time.
    """

    barbers = (
        Barber.objects
        .filter(is_active=True)
        .order_by("id")
    )

    for barber in barbers:
        if not check_booking_conflict(
            barber=barber,
            booking_date=booking_date,
            start_time=start_time,
            end_time=end_time,
        ):
            return barber

    return None

@transaction.atomic
def create_booking(
    *,
    customer_name,
    customer_phone,
    service,
    barber=None,
    booking_date,
    start_time,
    notes="",
):
    """
    Create a booking.

    If barber is provided:
        use that barber.

    If barber is omitted:
        automatically find an available barber.
    """

    if service is None or not service.is_active:
        raise ValidationError(
            {
                "service": [
                    "This service is not available."
                ]
            }
        )

    validate_booking_date(
        booking_date
    )

    end_time = calculate_end_time(
        start_time,
        service.duration,
    )

    validate_slot(
        start_time,
        end_time,
    )

    validate_business_hours(
        start_time,
        end_time,
    )

    # ---------------------------------------------------------
    # CUSTOMER SELECTED A BARBER
    # ---------------------------------------------------------

    if barber is not None:

        if not barber.is_active:
            raise ValidationError(
                {
                    "barber": [
                        "This barber is not currently available."
                    ]
                }
            )

        barber = (
            Barber.objects
            .select_for_update()
            .get(pk=barber.pk)
        )

        if check_booking_conflict(
            barber=barber,
            booking_date=booking_date,
            start_time=start_time,
            end_time=end_time,
        ):
            raise ValidationError(
                {
                    "start_time": [
                        "This barber is already booked "
                        "during this time."
                    ]
                }
            )

    # ---------------------------------------------------------
    # AUTOMATIC BARBER ASSIGNMENT
    # ---------------------------------------------------------

    else:

        barber = find_available_barber(
            booking_date=booking_date,
            start_time=start_time,
            end_time=end_time,
        )

        if barber is None:
            raise ValidationError(
                {
                    "start_time": [
                        "No barber is available "
                        "during this time."
                    ]
                }
            )

        # Lock selected barber before creating booking.
        barber = (
            Barber.objects
            .select_for_update()
            .get(pk=barber.pk)
        )

        # Check again after locking.
        if check_booking_conflict(
            barber=barber,
            booking_date=booking_date,
            start_time=start_time,
            end_time=end_time,
        ):
            raise ValidationError(
                {
                    "start_time": [
                        "The selected time is no longer available."
                    ]
                }
            )

    return Booking.objects.create(
        customer_name=customer_name,
        customer_phone=customer_phone,
        service=service,
        barber=barber,
        booking_date=booking_date,
        start_time=start_time,
        end_time=end_time,
        notes=notes,
    )
@transaction.atomic
def update_booking(
    booking,
    *,
    customer_name=None,
    customer_phone=None,
    service=None,
    barber=None,
    booking_date=None,
    start_time=None,
    notes=None,
):
    """
    Update or reschedule a booking.

    The new barber/time is checked for conflicts.
    """

    if booking.status not in BLOCKING_STATUSES:
        raise ValidationError(
            {
                "status": [
                    f"A {booking.status} booking "
                    "cannot be modified."
                ]
            }
        )

    # ---------------------------------------------------------
    # NEW VALUES
    # ---------------------------------------------------------

    new_service = (
        service
        if service is not None
        else booking.service
    )

    new_barber = (
        barber
        if barber is not None
        else booking.barber
    )

    new_date = (
        booking_date
        if booking_date is not None
        else booking.booking_date
    )

    new_start = (
        start_time
        if start_time is not None
        else booking.start_time
    )

    # ---------------------------------------------------------
    # SERVICE
    # ---------------------------------------------------------

    if not new_service.is_active:
        raise ValidationError(
            {
                "service": [
                    "This service is not available."
                ]
            }
        )

    # ---------------------------------------------------------
    # BARBER
    # ---------------------------------------------------------

    if not new_barber.is_active:
        raise ValidationError(
            {
                "barber": [
                    "This barber is not currently available."
                ]
            }
        )

    # ---------------------------------------------------------
    # DATE
    # ---------------------------------------------------------

    validate_booking_date(
        new_date
    )

    # ---------------------------------------------------------
    # TIME
    # ---------------------------------------------------------

    new_end = calculate_end_time(
        new_start,
        new_service.duration,
    )

    validate_slot(
        new_start,
        new_end,
    )

    validate_business_hours(
        new_start,
        new_end,
    )

    # ---------------------------------------------------------
    # LOCK BARBER
    # ---------------------------------------------------------

    new_barber = (
        Barber.objects
        .select_for_update()
        .get(pk=new_barber.pk)
    )

    # ---------------------------------------------------------
    # CHECK CONFLICT
    # ---------------------------------------------------------

    if check_booking_conflict(
        barber=new_barber,
        booking_date=new_date,
        start_time=new_start,
        end_time=new_end,
        exclude_booking_id=booking.pk,
    ):
        raise ValidationError(
            {
                "start_time": [
                    "This barber is already booked "
                    "during this time."
                ]
            }
        )

    # ---------------------------------------------------------
    # UPDATE
    # ---------------------------------------------------------

    if customer_name is not None:
        booking.customer_name = customer_name

    if customer_phone is not None:
        booking.customer_phone = customer_phone

    booking.service = new_service
    booking.barber = new_barber
    booking.booking_date = new_date
    booking.start_time = new_start
    booking.end_time = new_end

    if notes is not None:
        booking.notes = notes

    booking.save()

    return booking

def cancel_booking(booking):
    """
    Cancel a booking.

    Once cancelled, its time becomes available again.
    """

    if booking.status == Booking.Status.COMPLETED:
        raise ValidationError(
            {
                "status": [
                    "A completed booking cannot be cancelled."
                ]
            }
        )

    if booking.status == Booking.Status.CANCELLED:
        return booking

    booking.status = Booking.Status.CANCELLED

    booking.save(
        update_fields=[
            "status",
            "updated_at",
        ]
    )

    return booking

def get_available_times(
    *,
    booking_date,
    service,
    barber=None,
):
    """
    Return available times.

    If a barber is supplied:
        return times available for that barber.

    If barber is not supplied:
        return times where at least ONE active barber
        can perform the service.
    """

    if service is None or not service.is_active:
        return []

    validate_booking_date(
        booking_date
    )

    # ---------------------------------------------------------
    # GET BARBERS
    # ---------------------------------------------------------

    if barber is not None:

        if not barber.is_active:
            return []

        barbers = [barber]

    else:
        barbers = list(
            Barber.objects.filter(
                is_active=True
            )
        )

    if not barbers:
        return []

    # ---------------------------------------------------------
    # CHECK TIMES
    # ---------------------------------------------------------

    available_times = []

    current = datetime.combine(
        booking_date,
        settings.BOOKING_OPENING_TIME,
    )

    day_end = datetime.combine(
        booking_date,
        settings.BOOKING_CLOSING_TIME,
    )

    while current < day_end:

        start_time = current.time()

        end_time = calculate_end_time(
            start_time,
            service.duration,
        )

        if (
            end_time <= start_time
            or end_time > settings.BOOKING_CLOSING_TIME
        ):
            break

        # -----------------------------------------------------
        # AT LEAST ONE BARBER AVAILABLE
        # -----------------------------------------------------

        barber_available = False

        for current_barber in barbers:

            conflict = check_booking_conflict(
                barber=current_barber,
                booking_date=booking_date,
                start_time=start_time,
                end_time=end_time,
            )

            if not conflict:
                barber_available = True
                break

        if barber_available:
            available_times.append(
                start_time.strftime("%H:%M")
            )

        current += timedelta(
            minutes=SLOT_INTERVAL_MINUTES
        )

    return available_times

@transaction.atomic
def confirm_booking(booking):
    """
    Confirm a booking after its payment has been verified.
    """

    if booking.status == Booking.Status.CANCELLED:
        raise ValidationError(
            {
                "status": [
                    "A cancelled booking cannot be confirmed."
                ]
            }
        )

    if booking.status == Booking.Status.COMPLETED:
        raise ValidationError(
            {
                "status": [
                    "A completed booking cannot be confirmed again."
                ]
            }
        )

    booking.status = Booking.Status.CONFIRMED

    booking.save(
        update_fields=[
            "status",
            "updated_at",
        ]
    )

    return booking


@transaction.atomic
def complete_booking(booking):
    """
    Mark a booking as done once the customer has been in the chair.

    Only a confirmed booking can be completed: a customer who never
    paid and never confirmed should be cancelled rather than silently
    counted as served.
    """

    if booking.status == Booking.Status.COMPLETED:
        return booking

    if booking.status != Booking.Status.CONFIRMED:
        raise ValidationError(
            {
                "status": [
                    "Only a confirmed booking can be completed. "
                    f"This one is {booking.status}."
                ]
            }
        )

    booking.status = Booking.Status.COMPLETED

    booking.save(
        update_fields=[
            "status",
            "updated_at",
        ]
    )

    return booking
