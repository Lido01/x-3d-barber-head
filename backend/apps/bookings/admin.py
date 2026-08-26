from django.contrib import admin

from .models import Barber, Booking


@admin.register(Barber)
class BarberAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "phone",
        "is_active",
        "created_at",
    )

    list_filter = (
        "is_active",
    )

    search_fields = (
        "name",
        "phone",
    )


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "customer_name",
        "service",
        "barber",
        "booking_date",
        "start_time",
        "end_time",
        "status",
    )

    list_filter = (
        "status",
        "booking_date",
        "barber",
        "service",
    )

    search_fields = (
        "customer_name",
        "customer_phone",
        "barber__name",
    )