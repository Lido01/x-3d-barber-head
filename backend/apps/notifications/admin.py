# from django.contrib import admin

# from .models import Notification


# @admin.register(Notification)
# class NotificationAdmin(admin.ModelAdmin):

#     list_display = (
#         "id",
#         "booking",
#         "notification_type",
#         "channel",
#         "recipient",
#         "status",
#         "sent_at",
#         "created_at",
#     )

#     list_filter = (
#         "notification_type",
#         "channel",
#         "status",
#     )

#     search_fields = (
#         "recipient",
#         "booking__customer_name",
#         "booking__customer_phone",
#     )

#     readonly_fields = (
#         "created_at",
#         "updated_at",
#         "sent_at",
#     )