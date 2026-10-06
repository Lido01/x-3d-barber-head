from django.contrib import admin

from .models import ChatMessage, ChatSession, QuickAnswer


@admin.register(QuickAnswer)
class QuickAnswerAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "question",
        "is_active",
        "sort_order",
        "updated_at",
    )

    list_filter = ("is_active",)

    search_fields = ("question", "answer")


class ChatMessageInline(admin.TabularInline):
    model = ChatMessage
    extra = 0
    readonly_fields = ("role", "text", "created_at")
    can_delete = False


@admin.register(ChatSession)
class ChatSessionAdmin(admin.ModelAdmin):
    list_display = ("session_id", "created_at", "last_message_at")
    inlines = [ChatMessageInline]
