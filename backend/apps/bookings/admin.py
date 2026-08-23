from django.contrib import admin
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError as DRFValidationError

from .models import Booking
from .services import create_booking, calculate_end_time  # Import your calculator function

@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    fields = [
        "customer_name",
        "customer_phone",
        "service",
        "booking_date",
        "start_time",
        "notes",
    ]

    def save_model(self, request, obj, form, change):
        """Intercept the admin save action to guarantee end_time calculation."""
        if not change:  # Creating a new booking
            try:
                # 1. Reroute through your service layer to handle validation and capacity
                create_booking(
                    customer_name=obj.customer_name,
                    customer_phone=obj.customer_phone,
                    service=obj.service,
                    booking_date=obj.booking_date,
                    start_time=obj.start_time,
                    notes=obj.notes,
                )
            except (DRFValidationError, DjangoValidationError) as e:
                # 2. Safety Net: If validation passes but another error happens,
                # make sure end_time is filled so it doesn't crash the database with a raw IntegrityError.
                if obj.start_time and obj.service and not obj.end_time:
                    obj.end_time = calculate_end_time(obj.start_time, obj.service.duration)
                
                # Format error to look readable to the admin user
                message = e.detail if hasattr(e, "detail") else e.message_dict
                raise DjangoValidationError(message)
        else:
            # Handle standard updates/edits
            if obj.start_time and obj.service:
                obj.end_time = calculate_end_time(obj.start_time, obj.service.duration)
            super().save_model(request, obj, form, change)
