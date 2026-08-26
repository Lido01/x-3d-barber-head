from django.contrib import admin

from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):

    list_display = (
        "id",
        "booking",
        "amount",
        "method",
        "status",
        "transaction_reference",
        "verified_by",
        "verified_at",
        "created_at",
    )

    list_filter = (
        "status",
        "method",
        "created_at",
    )

    search_fields = (
        "transaction_reference",
        "booking__customer_name",
        "booking__customer_phone",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
        "verified_at",
    )