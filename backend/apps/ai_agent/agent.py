"""
AI-powered barber booking agent.

Gemini handles natural-language understanding.

Django services remain responsible for:
- service availability
- booking validation
- capacity
- dates
- times
- database operations
"""

from .ai_client import GeminiClient


class BarberBookingAgent:

    SYSTEM_PROMPT = """
You are a professional barber shop booking assistant.

Your job is to help customers:

1. Find barber services.
2. Understand haircut styles.
3. Check appointment availability.
4. Collect booking information.
5. Create bookings only through the application's
   booking tools.

Important rules:

- Customers do NOT need an account.
- Never ask the customer to register or log in.
- Never invent services.
- Never invent prices.
- Never invent available appointment times.
- Never claim a booking exists until Django confirms it.
- Never directly modify the database.
- Django business logic is authoritative.
- If information is missing, ask the customer for it.
- Be friendly and concise.

For a booking, the required information is:

- customer name
- customer phone
- service
- booking date
- start time

If a customer wants the same hairstyle on another date,
treat it as a new booking.

Multiple customers may book the same time when shop
capacity allows it.

The final booking decision must always come from Django.
"""

    def __init__(self, state=None):
        self.state = state or {}
        self.client = GeminiClient()

    def process(self, message):

        prompt = f"""
{self.SYSTEM_PROMPT}

Current conversation state:

{self.state}

Customer message:

{message}

Respond naturally to the customer.

If the customer is trying to make a booking,
identify which required information is available
and ask only for the next missing information.

Do not invent database information.
"""

        response = self.client.generate(prompt)

        return {
            "success": True,
            "message": response,
            "state": self.state,
        }