"""
Tools used by the AI booking agent.

The AI agent should never manipulate Booking objects directly.
All booking operations go through the existing bookings.services
business logic so the same validation and capacity rules are used
whether the booking comes from React, Swagger, or the AI agent.
"""

from apps.bookings.services import (
    create_booking,
    get_available_times,
)
from apps.services.models import Service


def list_services():
    """
    Return all active barber services.

    Used when a customer asks:
    - What services do you have?
    - What haircuts are available?
    - Show me your haircut styles.
    """

    services = Service.objects.filter(
        is_active=True
    ).prefetch_related("styles")

    return [
        {
            "id": service.id,
            "name": service.name,
            "description": service.description,
            "price": str(service.price),
            "duration": service.duration,
            "image": (
                service.image.url
                if service.image
                else None
            ),
            "styles": [
                {
                    "id": style.id,
                    "name": style.name,
                    "description": style.description,
                    "image": (
                        style.image.url
                        if style.image
                        else None
                    ),
                }
                for style in service.styles.filter(
                    is_active=True
                )
            ],
        }
        for service in services
    ]


def get_service(service_id):
    """
    Get one active service and its active haircut styles.
    """

    service = Service.objects.filter(
        id=service_id,
        is_active=True,
    ).prefetch_related("styles").first()

    if service is None:
        return {
            "success": False,
            "error": "Service not found or unavailable.",
        }

    return {
        "success": True,
        "service": {
            "id": service.id,
            "name": service.name,
            "description": service.description,
            "price": str(service.price),
            "duration": service.duration,
            "image": (
                service.image.url
                if service.image
                else None
            ),
            "styles": [
                {
                    "id": style.id,
                    "name": style.name,
                    "description": style.description,
                    "image": (
                        style.image.url
                        if style.image
                        else None
                    ),
                }
                for style in service.styles.filter(
                    is_active=True
                )
            ],
        },
    }


def check_availability(
    service_id,
    booking_date,
):
    """
    Check available booking times for an active service.

    booking_date must be a Python date object.
    """

    service = Service.objects.filter(
        id=service_id,
        is_active=True,
    ).first()

    if service is None:
        return {
            "success": False,
            "error": "Service not found or unavailable.",
            "available_times": [],
        }

    available_times = get_available_times(
        booking_date=booking_date,
        service=service,
    )

    return {
        "success": True,
        "service": service.name,
        "service_id": service.id,
        "date": booking_date.isoformat(),
        "available_times": available_times,
    }


def book_appointment(
    customer_name,
    customer_phone,
    service_id,
    booking_date,
    start_time,
    notes="",
):
    """
    Create a customer booking.

    The actual booking rules remain inside bookings.services.
    """

    service = Service.objects.filter(
        id=service_id,
        is_active=True,
    ).first()

    if service is None:
        return {
            "success": False,
            "error": "Service not found or unavailable.",
        }

    booking = create_booking(
        customer_name=customer_name,
        customer_phone=customer_phone,
        service=service,
        booking_date=booking_date,
        start_time=start_time,
        notes=notes,
    )

    return {
        "success": True,
        "message": "Booking created successfully.",
        "booking": {
            "id": booking.id,
            "customer_name": booking.customer_name,
            "customer_phone": booking.customer_phone,
            "service": booking.service.name,
            "service_id": booking.service.id,
            "booking_date": booking.booking_date.isoformat(),
            "start_time": booking.start_time.strftime("%H:%M"),
            "end_time": booking.end_time.strftime("%H:%M"),
            "status": booking.status,
            "notes": booking.notes,
        },
    }