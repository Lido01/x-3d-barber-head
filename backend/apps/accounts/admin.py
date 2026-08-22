from django.contrib import admin

from .models import AccountProfile


@admin.register(AccountProfile)
class AccountProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "phone", "created_at")
    search_fields = ("user__username", "user__email", "phone")
