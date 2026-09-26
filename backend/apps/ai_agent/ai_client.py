"""
Gemini AI client.

This module is responsible only for communicating
with the external AI provider.

Business rules remain inside Django services.py.
"""

from django.conf import settings


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
        """

        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
        )

        return response.text