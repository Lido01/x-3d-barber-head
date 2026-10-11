"""
Gemini AI client.

This module is responsible only for communicating
with the external AI provider.

Business rules remain inside Django services.py.
"""

from django.conf import settings

# Models tried in order when the configured one is unavailable.
#
# Google rate-limits individual models without warning ("503 high
# demand" on a model that answered a minute ago), and whole model
# families get retired without notice (gemini-2.5-flash now 404s for
# new users). Rather than let either take the chat down, the client
# walks this list on any provider error and only gives up when every
# option has failed.
FALLBACK_MODELS = [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite",
]

# Attempts per model before moving to the next one.
ATTEMPTS_PER_MODEL = 2


class GeminiClient:
    """
    Small wrapper around Google's Gemini API.
    """

    def __init__(self):
        try:
            from google import genai
        except ImportError as exc:
            raise RuntimeError(
                "The Gemini client is not installed. Run pip install -r requirements.txt."
            ) from exc

        if not settings.AI_API_KEY:
            raise RuntimeError(
                "AI_API_KEY is not configured."
            )

        self.client = genai.Client(
            api_key=settings.AI_API_KEY
        )

        self.model = settings.AI_MODEL

    def generate(self, prompt):
        """
        Send a prompt to Gemini and return text.

        Tries the configured model first, then each fallback in turn.
        Raises the last provider error only when every model has failed.
        """
        import time

        models = [self.model] + [m for m in FALLBACK_MODELS if m != self.model]

        last_error = None

        for model in models:
            for attempt in range(ATTEMPTS_PER_MODEL):
                try:
                    response = self.client.models.generate_content(
                        model=model,
                        contents=prompt,
                    )

                    return response.text

                except Exception as exc:
                    last_error = exc

                    if attempt < ATTEMPTS_PER_MODEL - 1:
                        time.sleep(2)

        raise last_error