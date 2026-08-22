from django.contrib import admin

from .models import Booking


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ("customer_name", "service", "booking_date", "start_time", "end_time", "status")
    list_filter = ("status", "booking_date", "service")
    search_fields = ("customer_name", "customer_phone")
    readonly_fields = ("end_time", "created_at", "updated_at")
