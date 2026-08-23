"""Business rules and booking workflows.

This module is intentionally independent from HTTP/DRF concerns so it can be
reused later by the AI agent tooling:

    AI Agent -> booking tool -> bookings.services -> database
"""

from datetime import datetime, time, timedelta
from django.db import transaction
from django.utils.timezone import localdate
from rest_framework.exceptions import ValidationError
from .models import Booking

SLOT_INTERVAL_MINUTES = 30
BLOCKING_STATUSES = [Booking.Status.PENDING, Booking.Status.CONFIRMED]

# Define how many clients your shop can handle at the exact same time
MAX_SIMULTANEOUS_CHAIRS = 4  


def calculate_end_time(start_time, duration_minutes):
    """Return the time reached after adding ``duration_minutes`` to ``start_time``."""
    return (
        datetime.combine(datetime.today(), start_time)
        + timedelta(minutes=duration_minutes)
    ).time()


def validate_booking_date(booking_date):
    """Reject booking dates in the past."""
    if booking_date < localdate():
        raise ValidationError(
            {"booking_date": ["Booking dates in the past are not allowed."]}
        )


def validate_slot(start_time, end_time):
    """Ensure a slot starts on a valid interval. 
    Business hours checks have been removed for 24-hour operation.
    """
    if start_time.minute % SLOT_INTERVAL_MINUTES or start_time.second or start_time.microsecond:
        raise ValidationError(
            {
                "start_time": [
                    "Start time must be on a "
                    f"{SLOT_INTERVAL_MINUTES}-minute interval."
                ]
            }
        )


def check_booking_conflict(booking_date, start_time, end_time, *, exclude_booking_id=None):
    """Return True only if the shop has reached maximum booking capacity during this window."""
    overlapping = Booking.objects.filter(
        booking_date=booking_date,
        status__in=BLOCKING_STATUSES,
        start_time__lt=end_time,
        end_time__gt=start_time,
    )
    if exclude_booking_id:
        overlapping = overlapping.exclude(pk=exclude_booking_id)
        
    # Block the slot only if it matches or exceeds total shop capacity (4)
    return overlapping.count() >= MAX_SIMULTANEOUS_CHAIRS


@transaction.atomic
def create_booking(
    *, customer_name, customer_phone, service, booking_date, start_time, notes=""
):
    """Validate and create a booking, deriving ``end_time`` from the service duration."""
    if service is None or not service.is_active:
        raise ValidationError({"service": ["This service is not available."]})

    validate_booking_date(booking_date)

    end_time = calculate_end_time(start_time, service.duration)
    validate_slot(start_time, end_time)

    # Locks existing bookings for the date while the slot is checked and saved.
    Booking.objects.select_for_update().filter(booking_date=booking_date)
    if check_booking_conflict(booking_date, start_time, end_time):
        raise ValidationError({"start_time": ["The shop is fully booked for this time range."]})

    return Booking.objects.create(
        customer_name=customer_name,
        customer_phone=customer_phone,
        service=service,
        booking_date=booking_date,
        start_time=start_time,
        end_time=end_time,
        notes=notes,
    )


@transaction.atomic
def update_booking(booking, *, customer_name=None, customer_phone=None, service=None,
                   booking_date=None, start_time=None, notes=None):
    """Reschedule/update a pending or confirmed booking, re-validating everything.

    Fields left as ``None`` keep their current value.
    """
    if booking.status not in BLOCKING_STATUSES:
        raise ValidationError(
            {"status": [f"A {booking.status} booking cannot be modified."]}
        )

    new_service = service if service is not None else booking.service
    if not new_service.is_active:
        raise ValidationError({"service": ["This service is not available."]})

    new_date = booking_date if booking_date is not None else booking.booking_date
    new_start = start_time if start_time is not None else booking.start_time

    validate_booking_date(new_date)

    new_end = calculate_end_time(new_start, new_service.duration)
    validate_slot(new_start, new_end)

    Booking.objects.select_for_update().filter(booking_date=new_date)
    if check_booking_conflict(
        new_date, new_start, new_end, exclude_booking_id=booking.pk
    ):
        raise ValidationError({"start_time": ["The shop is fully booked for this time range."]})

    booking.customer_name = customer_name if customer_name is not None else booking.customer_name
    booking.customer_phone = (
        customer_phone if customer_phone is not None else booking.customer_phone
    )
    booking.service = new_service
    booking.booking_date = new_date
    booking.start_time = new_start
    booking.end_time = new_end
    if notes is not None:
        booking.notes = notes
    booking.save()
    return booking


def cancel_booking(booking):
    """Cancel a booking so its slot becomes available again."""
    if booking.status == Booking.Status.COMPLETED:
        raise ValidationError({"status": ["A completed booking cannot be cancelled."]}
    )
    if booking.status == Booking.Status.CANCELLED:
        return booking

    booking.status = Booking.Status.CANCELLED
    booking.save(update_fields=["status", "updated_at"])
    return booking


def get_available_times(*, booking_date, service):
    """Return free start times for ``service`` across a 24-hour day."""
    if service is None or not service.is_active:
        return []

    available_times = []
    # Loop from midnight to midnight
    current = datetime.combine(booking_date, time(0, 0))
    closing = datetime.combine(booking_date, time(23, 59))
    
    while current < closing:
        start_time = current.time()
        end_time = calculate_end_time(start_time, service.duration)
        
        if not check_booking_conflict(booking_date, start_time, end_time):
            available_times.append(start_time.strftime("%H:%M"))
        current += timedelta(minutes=SLOT_INTERVAL_MINUTES)
    return available_times
