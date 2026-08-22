from datetime import datetime, time, timedelta

from django.db import transaction
from rest_framework.exceptions import ValidationError

from .models import Booking

OPENING_TIME = time(9, 0)
CLOSING_TIME = time(18, 0)
SLOT_INTERVAL_MINUTES = 30
BLOCKING_STATUSES = [Booking.Status.PENDING, Booking.Status.CONFIRMED]


def calculate_end_time(start_time, duration_minutes):
    return (datetime.combine(datetime.today(), start_time) + timedelta(minutes=duration_minutes)).time()


def check_booking_conflict(booking_date, start_time, end_time, *, exclude_booking_id=None):
    bookings = Booking.objects.filter(
        booking_date=booking_date,
        status__in=BLOCKING_STATUSES,
        start_time__lt=end_time,
        end_time__gt=start_time,
    )
    if exclude_booking_id:
        bookings = bookings.exclude(pk=exclude_booking_id)
    return bookings.exists()


def validate_slot(booking_date, start_time, end_time):
    if start_time < OPENING_TIME or end_time > CLOSING_TIME:
        raise ValidationError({"start_time": "Bookings must fit within 09:00 and 18:00."})
    if start_time.minute % SLOT_INTERVAL_MINUTES or start_time.second or start_time.microsecond:
        raise ValidationError({"start_time": "Start time must be on a 30-minute interval."})


@transaction.atomic
def create_booking(*, customer_name, customer_phone, service, booking_date, start_time, notes=""):
    if not service.is_active:
        raise ValidationError({"service": "This service is not available for booking."})

    end_time = calculate_end_time(start_time, service.duration)
    validate_slot(booking_date, start_time, end_time)

    # Locks existing bookings for the date while a new slot is checked and saved.
    Booking.objects.select_for_update().filter(booking_date=booking_date)
    if check_booking_conflict(booking_date, start_time, end_time):
        raise ValidationError({"start_time": "This time overlaps an existing booking."})

    return Booking.objects.create(
        customer_name=customer_name,
        customer_phone=customer_phone,
        service=service,
        booking_date=booking_date,
        start_time=start_time,
        end_time=end_time,
        notes=notes,
    )


def get_available_times(*, booking_date, service):
    if not service.is_active:
        return []

    available_times = []
    current = datetime.combine(booking_date, OPENING_TIME)
    closing = datetime.combine(booking_date, CLOSING_TIME)
    while current < closing:
        start_time = current.time()
        end_time = calculate_end_time(start_time, service.duration)
        if end_time <= CLOSING_TIME and not check_booking_conflict(booking_date, start_time, end_time):
            available_times.append(start_time.strftime("%H:%M"))
        current += timedelta(minutes=SLOT_INTERVAL_MINUTES)
    return available_times
