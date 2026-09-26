#  AI AGENT ROADMAP

## Week 1
│
├── LLM fundamentals
├── Prompting
├── Tokens
└── Context

## Week 2
│
├── LLM API
├── Chat
├── Structured JSON
└── Error handling

## Week 3
│
├── Function calling
├── Tools
├── Tool results
└── Agent loops

## Week 4
│
├── Django integration
├── PostgreSQL
├── Booking models
└── Availability

## Week 5
│
├── AI Booking Agent
├── Customer state
├── Booking workflow
└── Validation

## Week 6
│
├── Payments
├── Receipt upload
├── Webhooks
└── Payment verification

## Week 7
│
├── Email
├── SMS
├── Calendar
└── Notifications

## Week 8+
│
├── Memory
├── RAG
├── Vector databases
├── Evaluation
├── Security
└── Production deployment


You are a senior full-stack engineer.

I have an existing barber booking website with:

FRONTEND
- React
- Vite
- JavaScript (NOT TypeScript)
- Tailwind CSS
- React Router
- Axios

BACKEND
- Django
- Django REST Framework
- drf-spectacular / Swagger
- Existing REST API

IMPORTANT:
Do NOT rebuild my backend.
Do NOT replace working backend business logic.
Do NOT create unnecessary duplicate functionality.
First inspect the existing project and understand the current architecture.

My goal now is to completely integrate my existing React frontend with my existing Django backend.

The backend should remain the source of truth for:
- services
- availability
- bookings
- barber assignment
- payments
- payment receipt validation
- payment verification
- booking status
- notifications
- admin authentication

The customer should NOT need to register or log in to make a booking or submit payment.

Admin/staff authentication is separate and should remain protected.

==================================================
1. FIRST INSPECT THE PROJECT
==================================================

Before changing anything:

Inspect the entire frontend structure.

Look at:
- package.json
- src/
- components/
- pages/
- layouts/
- hooks/
- context/
- services/
- api/
- utils/
- assets/
- router files
- existing forms
- existing booking UI
- existing payment UI
- existing notification UI

Also inspect the Django API structure if available in the workspace.

Determine:
- which frontend files already exist
- which files are reusable
- which files are incomplete
- which files contain mock/static data
- which files need API integration
- which files should NOT be changed

DO NOT immediately generate code.

First understand the existing project.

==================================================
2. USE THE EXISTING BACKEND API
==================================================

The backend already provides these concepts:

SERVICES
GET /api/services/

BOOKINGS
GET /api/bookings/
POST /api/bookings/
GET /api/bookings/{id}/
PUT/PATCH /api/bookings/{id}/
POST /api/bookings/{id}/cancel/

AVAILABILITY
GET /api/bookings/availability/?service={serviceId}&booking_date={YYYY-MM-DD}

PAYMENTS
POST /api/payments/payments/

ADMIN PAYMENT ACTIONS
POST /api/payments/payments/{id}/verify/
POST /api/payments/payments/{id}/reject/

Use the actual API URLs discovered in the backend/project.
Do not assume a URL if the existing router says something different.

==================================================
3. CREATE A CENTRAL API CLIENT
==================================================

If one does not already exist, create something like:

src/services/api.js

Use Axios.

Example architecture:

src/
├── services/
│   ├── api.js
│   ├── servicesApi.js
│   ├── bookingApi.js
│   ├── paymentApi.js
│   └── notificationApi.js
│
├── hooks/
├── context/
├── components/
├── pages/
└── utils/

Do not create duplicate API clients.

Use a centralized Axios instance.

Configure:
- base URL from environment variables
- JSON requests
- multipart/form-data uploads when needed
- proper error handling
- authentication headers only where required

Create:

.env

with something like:

VITE_API_BASE_URL=http://127.0.0.1:8000

Use:

import.meta.env.VITE_API_BASE_URL

Do not hardcode localhost throughout the application.

==================================================
4. SERVICES FRONTEND INTEGRATION
==================================================

Connect the services page to:

GET /api/services/

The UI should:
- load services from Django
- show only active services returned by backend
- display service name
- display price
- display duration
- display image if backend provides one
- show loading state
- show error state
- handle empty services

Remove fake service data if it is currently being used.

Do not duplicate backend service filtering logic unnecessarily.

==================================================
5. BOOKING FLOW
==================================================

Build/integrate a clear multi-step booking flow.

Suggested flow:

STEP 1
Customer chooses service.

STEP 2
Customer chooses date.

STEP 3
Frontend requests availability:

GET /api/bookings/availability/

with:

service
booking_date

Example:

/api/bookings/availability/?service=4&booking_date=2026-08-28

STEP 4
Display available times returned by Django.

Do NOT calculate availability in React.

Django is the source of truth.

STEP 5
Customer chooses a barber OR chooses:

"No preference"

The backend supports both:

A.
Customer selects barber:

"barber": 2

B.
Customer doesn't select barber:

Do not send barber or send null depending on the backend serializer contract.

Do not invent a barber on the frontend.

STEP 6
Customer enters:

customer_name
customer_phone
service
barber (optional)
booking_date
start_time
notes

POST:

/api/bookings/

STEP 7
Display the created booking.

Show:
- customer name
- service
- assigned barber
- date
- time
- end time
- status

If the backend automatically assigned a barber, display the assigned barber returned by Django.

==================================================
6. BOOKING VALIDATION
==================================================

Frontend validation should improve user experience, but backend validation remains authoritative.

Handle backend errors such as:

- service unavailable
- invalid date
- invalid time
- barber unavailable
- fully booked
- invalid phone
- missing required fields

Display errors beside the relevant field where possible.

Do not simply display:

"Something went wrong."

Give the customer useful feedback.

==================================================
7. PAYMENT FLOW
==================================================

After booking is successfully created, show the payment step.

Payment form should support:

booking
amount
method
transaction_reference
receipt

The customer does NOT need an account.

Use FormData for payment submission.

Example:

const formData = new FormData();

formData.append("booking", booking.id);
formData.append("amount", amount);
formData.append("method", method);
formData.append(
  "transaction_reference",
  transactionReference
);

if (receiptFile) {
  formData.append("receipt", receiptFile);
}

POST:

/api/payments/payments/

Do not manually set:

Content-Type: multipart/form-data

when using Axios FormData unless necessary.

Allow the browser/Axios to set the multipart boundary.

==================================================
8. RECEIPT UPLOAD
==================================================

Create a proper receipt upload component if one doesn't already exist.

Requirements:
- JPG
- PNG
- WebP
- maximum 5MB
- preview selected image
- remove/replace selected image
- clear validation message

Do not upload the file before the customer submits the payment.

Show upload progress if practical.

==================================================
9. PAYMENT RESULT
==================================================

After successful payment submission:

Display:

"Payment submitted successfully."

Explain:

"Your payment is pending verification."

Do NOT tell the customer:

"Payment confirmed"

until the backend actually confirms it.

Show:
- booking ID
- payment ID
- payment status
- booking status

Expected initial state:

Payment:
pending

Booking:
pending

==================================================
10. CUSTOMER DOES NOT NEED LOGIN
==================================================

This is extremely important.

The public booking flow must NOT require:
- registration
- login
- JWT
- account creation

The customer should be able to:

browse services
→ choose service
→ choose date
→ choose time
→ optionally choose barber
→ enter name/phone
→ create booking
→ upload receipt
→ submit payment

without authentication.

Do not add login guards to customer booking pages.

==================================================
11. ADMIN AUTHENTICATION
==================================================

Keep admin functionality protected.

Do not expose these operations publicly:

POST /payments/{id}/verify/
POST /payments/{id}/reject/

If an admin frontend already exists, integrate its authentication.

If the admin frontend does not exist, do NOT build a large admin dashboard unless necessary.

Just prepare the API/service architecture so it can be added later.

==================================================
12. BOOKING CONFIRMATION
==================================================

The frontend should understand:

Booking:

pending
confirmed
cancelled
completed

Payment:

pending
verified
rejected

The important relationship is:

Payment pending
→ Booking pending

Payment verified
→ Booking confirmed

Payment rejected
→ Booking remains pending

Do not implement fake frontend status changes.

Always use the backend response as the source of truth.

==================================================
13. NOTIFICATIONS
==================================================

If the backend notification API is already available, integrate it where appropriate.

Do not send emails or SMS directly from React.

React should NEVER contain:
- SMTP credentials
- SMS API keys
- private API keys

Notifications should be handled by Django/backend.

The frontend only displays notification/status information if the backend exposes it.

==================================================
14. CUSTOMER BOOKING RESULT PAGE
==================================================

Create a clear confirmation/result page if it does not already exist.

For example:

/booking/success/:bookingId

Show:

Booking ID
Customer
Service
Barber
Date
Time
Booking status
Payment status

Example:

Booking #25

Fade Haircut
Barber: Dawit
August 28, 2026
10:00 - 10:45

Booking:
Pending

Payment:
Pending verification

Give the customer a clear explanation of what happens next.

==================================================
15. LOADING STATES
==================================================

Every API operation must have proper loading UI.

Examples:

Loading services...
Checking available times...
Creating booking...
Submitting payment...
Uploading receipt...

Disable submit buttons while requests are being processed.

Prevent accidental duplicate booking/payment submissions.

==================================================
16. ERROR HANDLING
==================================================

Create reusable API error handling.

Handle:

400
401
403
404
409
429
500
network errors

For Django DRF validation responses such as:

{
  "booking_date": [
    "Booking dates in the past are not allowed."
  ]
}

convert them into user-friendly messages.

Do not lose useful backend validation errors.

==================================================
17. RESPONSIVE DESIGN
==================================================

The entire booking and payment flow must work on:

mobile
tablet
desktop

Pay special attention to:
- date selection
- time slots
- barber selection
- payment form
- receipt upload
- confirmation page

Do not break the existing design.

Keep the existing visual identity.

==================================================
18. SECURITY
==================================================

Never put secrets in React.

Never expose:
- Django SECRET_KEY
- database credentials
- SMTP password
- SMS API keys
- payment provider private keys

Only use VITE_ variables for values that are safe to expose publicly.

Validate everything on Django as well.

Do not trust frontend:
- prices
- booking duration
- availability
- booking status
- payment status

The backend remains authoritative.

==================================================
19. DUPLICATE SUBMISSIONS
==================================================

Prevent users from accidentally submitting:

two identical bookings
or
two identical payments

because they clicked the button multiple times.

Use:
- loading state
- disabled submit button
- backend validation/idempotency where appropriate

Do not rely only on frontend protection.

==================================================
20. API RESPONSE COMPATIBILITY
==================================================

Before writing components, inspect the actual API responses from Swagger.

Do not assume fields.

For example, if Django returns:

service_name

use that.

If it returns:

barber_name

use that.

Do not invent:

service.title
barber.full_name

unless those fields actually exist.

==================================================
21. ROUTING
==================================================

Inspect the current React Router setup.

Add only the routes that are actually required.

Possible routes:

/
/services
/book
/book/success/:bookingId
/payment/:bookingId

Use the project's existing routing architecture.

Do not duplicate routers.

==================================================
22. STATE MANAGEMENT
==================================================

Do not introduce Redux unless the existing project already uses it or there is a real need.

Prefer:
- React state
- Context where appropriate
- custom hooks

For example:

useServices()
useAvailability()
useBooking()
usePayment()

Only create hooks where they simplify the architecture.

==================================================
23. FILE GENERATION RULE
==================================================

If a required file does not exist:

CREATE IT.

If an existing file already performs the job:

UPDATE IT instead of creating a duplicate.

Before creating:

api.js
bookingApi.js
paymentApi.js
hooks
contexts
components

check whether equivalent files already exist.

Do not create files with duplicate responsibilities.

==================================================
24. CODE QUALITY
==================================================

Use clean production-style JavaScript.

Use:
- reusable components
- meaningful names
- small functions
- clear error handling
- no unnecessary duplication
- no giant components where avoidable

Avoid:
- unnecessary abstractions
- fake APIs
- hardcoded booking data
- hardcoded services
- hardcoded barbers
- hardcoded availability
- mock payment success
- fake notification success

==================================================
25. ENVIRONMENT SETUP
==================================================

If needed, create:

.env.example

containing:

VITE_API_BASE_URL=http://127.0.0.1:8000

Do not commit actual secrets.

==================================================
26. IMPORTANT WORKFLOW
==================================================

Work in this order:

PHASE 1
Inspect existing frontend.

PHASE 2
Inspect backend API endpoints and serializers.

PHASE 3
Create/fix centralized API client.

PHASE 4
Integrate services.

PHASE 5
Integrate availability.

PHASE 6
Integrate booking creation.

PHASE 7
Integrate barber selection/automatic assignment.

PHASE 8
Integrate payment.

PHASE 9
Integrate receipt upload.

PHASE 10
Integrate booking/payment result page.

PHASE 11
Integrate notifications if API is available.

PHASE 12
Test complete customer flow.

==================================================
27. DO NOT START THE AI AGENT YET
==================================================

The AI booking agent is a separate future feature.

DO NOT create the AI agent now.

Do not add:
- OpenAI API
- Claude API
- LangChain
- agent tools
- function calling
- vector databases
- RAG

The current goal is ONLY:

React frontend
        ↓
Django REST API
        ↓
Database

The AI agent will be added AFTER this integration is completely working.

==================================================
28. FINAL END-TO-END TEST
==================================================

After implementation, test this exact flow:

1. Open website.

2. Load services from Django.

3. Select a service.

4. Select a future date.

5. Fetch availability.

6. Select an available time.

7. Select a barber OR "No preference".

8. Enter:

Name:
Adonay

Phone:
0987654321

Notes:
I want a Lidetu's fade style.

9. Create booking.

10. Confirm Django returns booking.

11. Display assigned barber.

12. Continue to payment.

13. Enter:

Amount:
5000

Method:
telebirr

Transaction reference:
TIN0987

14. Upload JPG/PNG/WebP receipt.

15. Submit payment.

16. Confirm:

Payment = pending
Booking = pending

17. Login as admin.

18. Verify payment.

19. Confirm:

Payment = verified
Booking = confirmed

20. Refresh frontend and make sure the application handles the returned state correctly.

==================================================
29. BEFORE FINISHING
==================================================

Run:

npm install

if dependencies are missing.

Then run:

npm run dev

Fix:
- import errors
- routing errors
- API errors
- CORS errors
- FormData errors
- file upload errors
- state bugs
- mobile layout issues

Do not hide errors.

If the backend API contract prevents a frontend feature from working, identify the exact backend endpoint/field causing the problem instead of inventing a workaround.

==================================================
30. FINAL RESPONSE
==================================================

After making changes, report:

1. Files inspected.
2. Files created.
3. Files modified.
4. API integrations completed.
5. Dependencies added, if any.
6. Environment variables required.
7. Exact commands to run.
8. Any backend changes that are genuinely required.
9. Remaining problems.
10. Exact end-to-end test steps.

Most importantly:

DO NOT rewrite working code just for stylistic reasons.
DO NOT create duplicate files.
DO NOT change Django business logic unless required for API compatibility.
DO NOT implement the AI agent yet.

Make the existing React application a clean, responsive, production-quality client of the existing Django API.