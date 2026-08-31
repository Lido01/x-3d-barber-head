"""
AI agent business logic.

The AI model will eventually use this service layer to interact
with the barber booking system.

The AI should never access Django models directly for booking
operations. It should use the tools defined in tools.py.
"""

from datetime import date, time

from rest_framework.exceptions import ValidationError

from .tools import (
    book_appointment,
    check_availability,
    get_service,
    list_services,
)


class AIAgentService:
    """
    Main service layer for the barber AI agent.
    """

    @staticmethod
    def services():
        """
        Return all available barber services.
        """
        return {
            "success": True,
            "services": list_services(),
        }

    @staticmethod
    def service_details(service_id):
        """
        Return details for one service.
        """
        return get_service(service_id)

    @staticmethod
    def availability(
        service_id,
        booking_date,
    ):
        """
        Check available times for a service.
        """
        if isinstance(booking_date, str):
            try:
                booking_date = date.fromisoformat(
                    booking_date
                )
            except ValueError:
                raise ValidationError(
                    {
                        "booking_date": (
                            "Use YYYY-MM-DD format."
                        )
                    }
                )

        return check_availability(
            service_id=service_id,
            booking_date=booking_date,
        )

    @staticmethod
    def create_booking(
        customer_name,
        customer_phone,
        service_id,
        booking_date,
        start_time,
        notes="",
    ):
        """
        Create a booking through the existing booking
        business logic.
        """

        if isinstance(booking_date, str):
            try:
                booking_date = date.fromisoformat(
                    booking_date
                )
            except ValueError:
                raise ValidationError(
                    {
                        "booking_date": (
                            "Use YYYY-MM-DD format."
                        )
                    }
                )

        if isinstance(start_time, str):
            try:
                start_time = time.fromisoformat(
                    start_time
                )
            except ValueError:
                raise ValidationError(
                    {
                        "start_time": (
                            "Use HH:MM or HH:MM:SS format."
                        )
                    }
                )

        return book_appointment(
            customer_name=customer_name,
            customer_phone=customer_phone,
            service_id=service_id,
            booking_date=booking_date,
            start_time=start_time,
            notes=notes,
        )