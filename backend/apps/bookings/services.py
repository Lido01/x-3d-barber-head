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

from datetime import datetime, time, timedelta
import re

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils.timezone import localdate

from rest_framework.exceptions import ValidationError

from .models import (
    BOOKING_CODE_PREFIX,
    Barber,
    Booking,
    phone_signature,
    reduce_phone,
)


SLOT_INTERVAL_MINUTES = 30

BLOCKING_STATUSES = [
    Booking.Status.PENDING,
    Booking.Status.CONFIRMED,
]

#: How far ahead an availability answer will go looking for "the next
#: day with something free", so the customer is offered a way forward
#: instead of only a dead end.
AVAILABILITY_LOOKAHEAD_DAYS = 14

#: How many alternative slots to list in that suggestion. Enough to be a
#: choice, few enough not to be a second time picker.
AVAILABILITY_SUGGESTION_LIMIT = 6


class Availability:
    """
    Why a date does or does not have bookable times.

    "No times available" is not an explanation. It is the same sentence
    whether the shop is shut, every barber is already in the chair, the
    service was withdrawn, the date is in the past, or the service is
    simply longer than the day the shop is open.

    Each of those needs a different thing from the customer - pick another
    day, pick another barber, pick another service, pick a future date,
    or wait - so the API reports which one it is. `AVAILABLE` is the only
    one that means "go ahead".
    """

    AVAILABLE = "available"
    FULLY_BOOKED = "fully_booked"
    NO_BARBER_ON_DUTY = "no_barber_on_duty"
    SERVICE_TOO_LONG = "service_too_long"
    SERVICE_UNAVAILABLE = "service_unavailable"
    PAST_DATE = "past_date"
    BARBER_UNAVAILABLE = "barber_unavailable"
    OUTSIDE_HOURS = "outside_hours"

    #: A slot that existed when the page loaded and is gone now. Only
    #: ever produced by a booking attempt, never by a fresh availability
    #: read - nothing has changed between the two.
    SLOT_TAKEN = "slot_taken"


def _minutes(value):
    """A time.TimeField as minutes from midnight, for plain arithmetic."""

    return value.hour * 60 + value.minute


def _at(minutes):
    """Minutes from midnight back to a time."""

    return time(minutes // 60, minutes % 60)


OPENING_MINUTES = _minutes(settings.BOOKING_OPENING_TIME)
CLOSING_MINUTES = _minutes(settings.BOOKING_CLOSING_TIME)


def describe_window():
    """The shop's bookable hours, formatted for a person to read."""

    return (
        f"{settings.BOOKING_OPENING_TIME:%H:%M}-"
        f"{settings.BOOKING_CLOSING_TIME:%H:%M}"
    )


def normalise_booking_code(value):
    """
    Accept what a human would type and return the stored form.

        "bk 3274"  -> "BK-3274"
        "3274"     -> "BK-3274"
        "#BK-3274" -> "BK-3274"

    Returns "" when there is nothing usable, so a caller can tell "no code
    was typed" apart from "a code that does not exist".
    """

    if not value:
        return ""

    raw = re.sub(r"[^0-9A-Za-z]", "", str(value)).upper()

    if not raw:
        return ""

    if raw.startswith(BOOKING_CODE_PREFIX):
        raw = raw[len(BOOKING_CODE_PREFIX):]

    if not raw.isdigit():
        return ""

    return f"{BOOKING_CODE_PREFIX}-{int(raw):04d}"


def normalise_phone(value):
    """
    Reduce a phone number to its significant digits.

    Delegates to bookings.models.reduce_phone, which is the same function
    that fills `Booking.phone_normalised`. There is deliberately only one
    implementation: two copies of "what identifies this subscriber" would
    disagree at some point, and the field and the comparison have to agree
    for a customer's history to be findable at all.
    """

    return reduce_phone(value)


def phone_matches(stored, offered):
    """
    Whether two phone numbers plausibly identify the same person.

    Exact after reduction, or agreeing on the trailing nine digits. The
    second rule is what makes a number written from an old receipt -
    911234567 against 0911234567 - still work, which is the case that
    actually comes up when someone rings the shop.
    """

    left = reduce_phone(stored)
    right = reduce_phone(offered)

    if not left or not right:
        return False

    if left == right:
        return True

    return phone_signature(left) == phone_signature(right)


#: The one refusal every customer-proof check gives.
#:
#: Deliberately identical whatever went wrong. "No such booking code" and
#: "that is not your phone number" are told the same way, because a
#: booking code is derived from a row id and therefore guessable: an
#: endpoint that said which half was wrong would be confirming which codes
#: exist, and the phone number would stop being a second factor.
CUSTOMER_PROOF_ERROR = {
    "booking": [
        "We could not match that booking code and phone"
    ]
}


def require_customer_booking(booking, *, code, phone):
    """
    Prove this booking belongs to whoever is asking, or refuse.

    The customer's whole flow is unauthenticated - no account, no session
    - so a booking code plus the phone number it was made with is the only
    thing standing between a stranger and someone's name, phone number,
    appointment time and payment receipt.

    Two shapes of the same check reach here:

      - the lookup, in the request body, because the phone number
        belongs in a body rather than a URL that lands in an access log;
      - the live status read, in headers, because a GET that carries a
        credential must never be cached.

    One implementation for both, so the two can never disagree about who
    is allowed to see what - which is the failure that turns "code plus
    phone" into "code".

    :returns: the booking, so a caller can write `require_customer_booking(
        booking, ...)` and carry on.
    :raises ValidationError: with `CUSTOMER_PROOF_ERROR`.
    """

    if (
        booking is None
        or not code
        or booking.booking_code != code
        or not phone_matches(booking.customer_phone, phone)
    ):
        raise ValidationError(CUSTOMER_PROOF_ERROR)

    return booking


def raise_time_unavailable(message, *, status, **extra):
    """
    Refuse a booking over time, and say precisely why.

    The field key is still `start_time`, so the booking form can put the
    sentence next to the time picker where the customer is looking. The
    `availability` object alongside it is the machine-readable half: it
    names the situation and, where there is a way forward, carries the
    times that would work instead.
    """

    raise ValidationError(
        {
            "start_time": [message],
            "availability": {
                "status": status,
                "message": message,
                **extra,
            },
        }
    )


def _candidate_starts(duration_minutes):
    """
    Every start time at which `duration_minutes` still fits before close.

    Mirrors the walk the old implementation did in Python - from opening,
    in 30-minute steps, stopping as soon as the service would run past
    closing - expressed as a range so it costs nothing.

    Empty means the service is longer than the shop's bookable day, which
    is a different problem from a full diary and needs a different
    message.
    """

    if duration_minutes > CLOSING_MINUTES - OPENING_MINUTES:
        return []

    return range(
        OPENING_MINUTES,
        CLOSING_MINUTES - duration_minutes + 1,
        SLOT_INTERVAL_MINUTES,
    )


def _format_slot(minutes):
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def _busy_intervals(*, barbers, start_date, end_date):
    """
    One query for every blocking booking in a date range.

    The previous implementation asked the database the same overlapping
    question once per slot per barber - twenty-four slots times six
    barbers is a hundred and forty-four round trips to draw one list of
    buttons.

    The rows are small and the range is two weeks, so they are pulled once
    and the overlap arithmetic - which is four integer comparisons - is
    done in Python.

    :returns: {barber_id: {date: [(start_minutes, end_minutes), ...]}}
    """

    rows = (
        Booking.objects.filter(
            barber_id__in=[item.pk for item in barbers],
            booking_date__gte=start_date,
            booking_date__lte=end_date,
            status__in=BLOCKING_STATUSES,
        )
        .values_list(
            "barber_id",
            "booking_date",
            "start_time",
            "end_time",
        )
    )

    busy = {}

    for barber_id, day, start_time, end_time in rows:
        busy.setdefault(barber_id, {}).setdefault(
            day,
            [],
        ).append(
            (_minutes(start_time), _minutes(end_time))
        )

    return busy


def _is_free(start, end, intervals):
    """Whether [start, end) overlaps nothing in `intervals`.

    The comparison is the same one the database was asked for: two
    appointments clash only when each starts before the other ends.
    """

    return not any(
        existing_start < end and existing_end > start
        for existing_start, existing_end in intervals
    )


def free_slots(
    *,
    booking_date,
    service,
    barbers,
    busy,
):
    """
    Bookable start times on one date, given an already-loaded diary.

    When the shop has several barbers, a start time is offered if *any*
    of them is free: that is what makes the default "no barber
    preference" flow work at all, and it is why a day can be genuinely
    full while a named barber still has gaps.
    """

    duration = service.duration
    available = []

    for start in _candidate_starts(duration):
        end = start + duration

        for current in barbers:
            if _is_free(
                start,
                end,
                busy.get(current.pk, {}).get(booking_date, []),
            ):
                available.append(start)
                break

    return [_format_slot(item) for item in available]


def _next_available(
    *,
    booking_date,
    service,
    barbers,
    busy,
):
    """
    The soonest later date with something bookable, or None.

    Only looked for when the requested date itself has nothing, and only
    within AVAILABILITY_LOOKAHEAD_DAYS - far enough that "try Thursday" is
    nearly always possible, close enough that the suggestion is real.
    """

    for offset in range(1, AVAILABILITY_LOOKAHEAD_DAYS + 1):
        day = booking_date + timedelta(days=offset)

        times = free_slots(
            booking_date=day,
            service=service,
            barbers=barbers,
            busy=busy,
        )

        if times:
            return {
                "date": day.isoformat(),
                "times": times[:AVAILABILITY_SUGGESTION_LIMIT],
            }

    return None


def get_availability_report(
    *,
    booking_date,
    service,
    barber=None,
):
    """
    The full answer about one date: the times, and the reason.

    This is what the booking form renders. Every branch produces a
    sentence written for the person booking, and the machine-readable
    `status` beside it so the interface can choose the right follow-up -
    offer the next free day, offer a different barber, or send them back
    to the service list.

    A date with no bookable times is not an error. It is a normal answer
    that happens to be negative, so this returns 200 with an explanation
    rather than a 400 that reads like a fault.
    """

    today = localdate()

    report = {
        "available_times": [],
        "availability": {
            "status": Availability.AVAILABLE,
            "message": "",
            "window": describe_window(),
            "next_available": None,
        },
    }

    def finish(status, message, **extra):
        report["availability"] = {
            "status": status,
            "message": message,
            "window": describe_window(),
            **extra,
        }

        return report

    # -- the service is not on the books --------------------------

    if service is None or not service.is_active:
        return finish(
            Availability.SERVICE_UNAVAILABLE,
            "This service is not being offered right now. "
            "Please choose another service from the list.",
        )

    report["duration_minutes"] = service.duration

    # -- the date has already gone --------------------------------

    if booking_date < today:
        return finish(
            Availability.PAST_DATE,
            "That date has already passed. "
            "Please choose today or a later date.",
        )

    # -- nobody to cut with ---------------------------------------

    if barber is not None:
        if not barber.is_active:
            return finish(
                Availability.BARBER_UNAVAILABLE,
                "This barber is not taking bookings right now. "
                "Please choose another barber, or leave it to the shop "
                "to pick whoever is free.",
            )

        barbers = [barber]
    else:
        barbers = list(
            Barber.objects.filter(is_active=True)
        )

        if not barbers:
            return finish(
                Availability.NO_BARBER_ON_DUTY,
                "No barber is on duty to take bookings right now. "
                "Please check back later, or call the shop.",
            )

    report["barber_count"] = len(barbers)

    # -- the service cannot fit in a day -------------------------

    if not _candidate_starts(service.duration):
        return finish(
            Availability.SERVICE_TOO_LONG,
            f"This service takes {service.duration} minutes, which is "
            f"longer than the {describe_window()} booking window. "
            "Please choose a shorter service, or ask the shop about a "
            "split appointment.",
        )

    # -- the diary ------------------------------------------------

    # One query covering this date and the lookahead window, so the
    # alternatives offered with a "full" answer cost no extra requests.
    busy = _busy_intervals(
        barbers=barbers,
        start_date=booking_date,
        end_date=booking_date + timedelta(days=AVAILABILITY_LOOKAHEAD_DAYS),
    )

    available_times = free_slots(
        booking_date=booking_date,
        service=service,
        barbers=barbers,
        busy=busy,
    )

    report["available_times"] = available_times

    if available_times:
        return finish(
            Availability.AVAILABLE,
            f"{len(available_times)} times available on this date.",
        )

    # Nothing today. Say so, and say when there is something instead.
    suggestion = _next_available(
        booking_date=booking_date,
        service=service,
        barbers=barbers,
        busy=busy,
    )

    who = (
        f"with {barber.name}" if barber is not None else ""
    )

    if suggestion is None:
        message = (
            f"Every slot on this date{who} is already taken, and there is "
            f"nothing free in the next {AVAILABILITY_LOOKAHEAD_DAYS} days "
            "either. Please try a further ahead date, or call the shop."
        )
    else:
        message = (
            f"Every slot on this date{who} is already taken. "
            "The next free times are listed below - pick one to carry the "
            "whole booking over."
        )

    return finish(
        Availability.FULLY_BOOKED,
        message,
        next_available=suggestion,
    )


def _next_free_slots(
    *,
    booking_date,
    start_minutes,
    service,
    candidates,
):
    """
    The next few bookable times after a slot that has just been lost.

    Used when a booking is refused: the customer already chose a time and
    has just been told it is gone, so a bare "pick another" is a dead end
    and the useful answer is the specific alternatives.

    A time counts as an alternative when *any* of `candidates` is free,
    matching how availability itself decides - otherwise suggesting a
    slot no barber could actually take would be worse than suggesting
    nothing.
    """

    if not candidates:
        return []

    busy = _busy_intervals(
        barbers=candidates,
        start_date=booking_date,
        end_date=booking_date,
    )

    duration = service.duration

    following = [
        _format_slot(item)
        for item in _candidate_starts(duration)
        if item > start_minutes
        and any(
            _is_free(
                item,
                item + duration,
                busy.get(candidate.pk, {}).get(booking_date, []),
            )
            for candidate in candidates
        )
    ]

    return following[:AVAILABILITY_SUGGESTION_LIMIT]


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

    Named with the date that was actually rejected, because "booking
    dates in the past are not allowed" tells someone who picked tomorrow
    nothing at all about what went wrong.
    """

    if booking_date < localdate():
        raise ValidationError(
            {
                "booking_date": [
                    f"{booking_date:%d %B %Y} has already passed. "
                    "Please choose today or a later date."
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
    """
    Refuse a time the shop is not open for.

    Three different mistakes pass through this one check, so each is
    named separately: too early, too late, and a service long enough to
    still be running at closing.
    """

    opens = settings.BOOKING_OPENING_TIME
    closes = settings.BOOKING_CLOSING_TIME
    window = describe_window()

    if start_time < opens:
        raise_time_unavailable(
            f"The shop opens at {opens:%H:%M}, so {start_time:%H:%M} is "
            f"too early. The first bookable time of the day is {opens:%H:%M}.",
            status=Availability.OUTSIDE_HOURS,
            window=window,
        )

    if end_time > closes:
        latest_start = _at(
            CLOSING_MINUTES - (_minutes(end_time) - _minutes(start_time))
        )

        raise_time_unavailable(
            f"This appointment would still be running at {end_time:%H:%M}, "
            f"after the {closes:%H:%M} close. Please start by "
            f"{latest_start:%H:%M} or earlier.",
            status=Availability.OUTSIDE_HOURS,
            window=window,
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


def _slot_refusal(
    *,
    booking_date,
    start_time,
    service,
    candidates,
    prefix,
    status,
):
    """
    Build the error for a slot that cannot be booked.

    `prefix` names who the slot was blocked for, because that is the
    whole difference between "Dawit is already booked then - here is
    who is free" and "every barber is booked then". `candidates` is the
    set of barbers whose diary is worth checking for an alternative, so
    the alternatives that come back are always reachable, never another
    dead end.
    """

    alternatives = _next_free_slots(
        booking_date=booking_date,
        start_minutes=_minutes(start_time),
        service=service,
        candidates=candidates,
    )

    if alternatives:
        message = (
            f"{prefix} already booked at {start_time:%H:%M}. "
            f"Still free later that day: {', '.join(alternatives)}."
        )
    else:
        message = (
            f"{prefix} already booked at {start_time:%H:%M}, and there "
            "is nothing else free for the rest of that day. Please try "
            "another date, or leave the barber unselected and let the "
            "shop assign whoever is free."
        )

    return {
        "start_time": [message],
        "availability": {
            "status": status,
            "message": message,
            "date": booking_date.isoformat(),
            "suggested_times": alternatives,
        },
    }


def _active_barbers():
    return list(
        Barber.objects.filter(is_active=True).order_by("id")
    )


def find_duplicate_booking(
    *,
    customer_phone,
    booking_date,
    start_time,
    service=None,
):
    """
    A booking this same phone number already holds for this same slot.

    Distinct from `check_booking_conflict`, which asks whether *the slot*
    is free. This asks whether *this customer* is already in it, and the
    two answers have opposite consequences:

      slot taken by someone else  refuse, and offer another time
      slot already held by them   hand back the booking they already have

    The second case is a customer who submitted twice - a double tap, a
    retry after the connection dropped, a second tab, or simply someone
    who pressed the button again because the page looked like it had not
    worked. Refusing that the way a genuine clash is refused sends someone
    who has just booked an appointment to a "this time is taken" screen
    that is not true, and it is the reason a booking could look
    impossible to make.

    So it is answered by returning the existing row. Same phone, same
    start time, same date: whatever else they typed, they are asking for
    the appointment they already hold.

    Only live bookings count. A cancelled one is not something they are
    holding, and `service` is deliberately not part of the match - two
    people on one phone number booking the same fifteen minutes is one
    person booking twice, and the second attempt should land on the first
    booking rather than beside it.

    @returns {Booking | None}
    """

    signature = phone_signature(customer_phone)

    if not signature:
        return None

    candidates = (
        Booking.objects
        .filter(
            phone_normalised__endswith=signature,
            booking_date=booking_date,
            start_time=start_time,
            status__in=BLOCKING_STATUSES,
        )
        .order_by("-created_at")
    )

    if service is not None:
        # Prefer the identical service. Only when there is no such row do
        # we fall back to "any booking at this time", because a repeat of
        # the same slot is a repeat booking, not a second different
        # service booked back to back on one number.
        exact = candidates.filter(service=service).first()

        if exact is not None:
            return exact

    return candidates.first()


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
    user=None,
):
    """
    Create a booking.

    If barber is provided:
        use that barber.

    If barber is omitted:
        automatically find an available barber.

    A signed-in customer is attached to the row so "my bookings" can list
    it without asking for a code. `user` stays None for the guest flow,
    which is how most bookings are still made.

    The booking is unique for the slot it chooses. Two requests for the
    same barber and the same start time cannot both become rows - see
    `unique_live_booking_per_barber_slot` on the model - and a repeat
    submit from the same phone number returns the booking that already
    exists rather than creating a second one or refusing the customer
    outright.

    A booking that already exists is flagged with `already_booked=True`
    so the view can answer 200 rather than 201 and the customer can be
    told they did not just make a second appointment.
    """

    if service is None or not service.is_active:
        raise ValidationError(
            {
                "service": [
                    "This service is not available. "
                    "Please choose another service from the list."
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

    # Before the diary is consulted, and before anything is written: has
    # this customer already booked this slot? A repeat submit is answered
    # with the booking that exists rather than with a refusal.
    duplicate = find_duplicate_booking(
        customer_phone=customer_phone,
        booking_date=booking_date,
        start_time=start_time,
        service=service,
    )

    if duplicate is not None:
        duplicate.already_booked = True

        return duplicate

    # ---------------------------------------------------------
    # CUSTOMER SELECTED A BARBER
    # ---------------------------------------------------------

    if barber is not None:

        if not barber.is_active:
            raise ValidationError(
                {
                    "barber": [
                        f"{barber.name} is not taking bookings right now. "
                        "Please choose another barber, or leave it to "
                        "the shop to pick whoever is free."
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
                _slot_refusal(
                    booking_date=booking_date,
                    start_time=start_time,
                    service=service,
                    candidates=[barber],
                    status=Availability.SLOT_TAKEN,
                    prefix=f"{barber.name} is",
                )
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
                _slot_refusal(
                    booking_date=booking_date,
                    start_time=start_time,
                    service=service,
                    candidates=_active_barbers(),
                    status=Availability.FULLY_BOOKED,
                    prefix="Every barber is",
                )
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
                _slot_refusal(
                    booking_date=booking_date,
                    start_time=start_time,
                    service=service,
                    candidates=_active_barbers(),
                    status=Availability.SLOT_TAKEN,
                    prefix="Every barber is",
                )
            )

    # The last write, and the only one the database itself refuses.
    #
    # Everything above this line is a read: it checks the diary and then
    # writes, with the check's own query and this insert separated by
    # whatever the two requests happened to be doing to each other. The
    # unique constraint is what turns a lost race into an error rather
    # than a double booking, so it has to be caught and turned back into
    # something a customer can act on.
    #
    # The inner atomic() is not decoration: catching IntegrityError
    # inside a broken transaction leaves the connection unusable, and
    # every following query on it would fail with "database is locked"
    # instead. The savepoint is what makes this catchable.
    try:
        with transaction.atomic():
            booking = Booking.objects.create(
                customer_name=customer_name,
                customer_phone=customer_phone,
                service=service,
                barber=barber,
                booking_date=booking_date,
                start_time=start_time,
                end_time=end_time,
                notes=notes,
                user=user,
            )
    except IntegrityError:
        # Someone else took this exact slot between the check and the
        # insert. If it was this same phone number, they have just booked
        # twice and want the booking, not an apology for a slot that is
        # really theirs.
        raced = find_duplicate_booking(
            customer_phone=customer_phone,
            booking_date=booking_date,
            start_time=start_time,
            service=service,
        )

        if raced is not None:
            raced.already_booked = True

            return raced

        name = barber.name if barber is not None else "That barber"

        raise ValidationError(
            _slot_refusal(
                booking_date=booking_date,
                start_time=start_time,
                service=service,
                candidates=[barber] if barber is not None else _active_barbers(),
                status=Availability.SLOT_TAKEN,
                prefix=f"{name} is",
            )
        )

    return booking


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
                    "This service is not available. "
                    "Please choose another service from the list."
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
                    f"{new_barber.name} is not taking bookings "
                    "right now. Please choose another barber."
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
            _slot_refusal(
                booking_date=new_date,
                start_time=new_start,
                service=new_service,
                candidates=[new_barber],
                status=Availability.SLOT_TAKEN,
                prefix=f"{new_barber.name} is",
            )
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
    Available times for one date, as a list of "HH:MM" strings.

    Kept as the narrow version of get_availability_report for callers
    that only need the list - the tests, and anything that wants to check
    a single slot. Note what it no longer does: it does not raise for a
    past date. Asking what is free on a date in the past is a reasonable
    question with a real answer, so the answer is "nothing, and here is
    why" rather than an exception. The full report carries the reason.
    """

    return get_availability_report(
        booking_date=booking_date,
        service=service,
        barber=barber,
    )["available_times"]


def find_booking_by_code(*, code, phone):
    """
    One booking, named by its own code and proved by its own phone number.

    A booking code alone is not a credential. It is short, it is printed
    on the confirmation, and it is derived from a row id, so anyone could
    guess their way through the range. Reading a booking discloses a name,
    a phone number, a service, an appointment time and a payment receipt,
    so the phone number the booking was made with is required as well.

    Exactly one booking comes back, and that is the point. Every booking
    carries its own code, so a customer who books twice on the same number
    has two different references and either one leads to its own
    appointment. Handing back "everything on this number" instead made the
    code almost decorative - it identified the customer rather than the
    booking, so the screen opened on a list in which the appointment they
    were asking about was one row among however many, and the wrong row was
    as plausible as the right one.

    Both failures are answered identically - one message naming both
    fields, never "code not found" on its own. Distinguishing them would
    turn this endpoint into a way to confirm which codes exist, which is
    the only thing the second factor is there to prevent.

    :returns: the one booking the code names.
    """

    normalised = normalise_booking_code(code)

    anchor = None

    if normalised:
        # `service`, `barber` and `payment` are joined in rather than left
        # lazy. The caller serialises all three immediately - the response is
        # this one booking in full - so leaving them lazy would spend three
        # more round trips on every lookup, from a page the customer
        # triggers by typing two fields.
        anchor = (
            Booking.objects
            .filter(booking_code=normalised)
            .select_related("service", "barber", "payment")
            .first()
        )

    if anchor is None or not phone_matches(anchor.customer_phone, phone):
        raise ValidationError(
            {
                "code": [
                    "We could not match that booking code and phone you booked"

                ]
            }
        )

    return anchor


def list_bookings_for_user(user):
    """
    Every booking attached to a signed-in customer, newest first.

    The guest flow - which is most of it - has no account, so this is a
    convenience for the bookings a customer made while signed in, not a
    replacement for looking a booking up by code.
    """

    return list(
        Booking.objects
        .filter(user=user)
        .select_related("service", "barber")
        .order_by("-booking_date", "-start_time")
    )

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
