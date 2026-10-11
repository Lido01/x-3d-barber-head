import uuid

from django.db import models


class QuickAnswer(models.Model):
    """
    A question and answer saved for the AI assistant's quick replies.

    When a customer's message matches a saved question, the assistant
    answers with this text instead of calling the AI provider - faster
    and consistent with what staff decided.
    """

    question = models.CharField(max_length=255)

    answer = models.TextField()

    # Inactive rows stay available to staff but are never shown to
    # customers, so retiring a saved answer is a toggle, not a delete.
    is_active = models.BooleanField(default=True)

    # Smaller values surface first in the quick answers list.
    sort_order = models.PositiveSmallIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self):
        return self.question


class ChatSession(models.Model):
    """One customer's running conversation with the assistant."""

    session_id = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False,
    )

    created_at = models.DateTimeField(auto_now_add=True)

    last_message_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-last_message_at"]

    def __str__(self):
        return str(self.session_id)


class ChatMessage(models.Model):
    """A single message inside a ChatSession."""

    class Role(models.TextChoices):
        CUSTOMER = "customer", "Customer"
        ASSISTANT = "assistant", "Assistant"

    session = models.ForeignKey(
        ChatSession,
        on_delete=models.CASCADE,
        related_name="messages",
    )

    role = models.CharField(max_length=10, choices=Role.choices)

    text = models.TextField()

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"{self.role}: {self.text[:40]}"
