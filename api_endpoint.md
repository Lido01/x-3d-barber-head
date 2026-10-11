# X 3D Barber — API Endpoints

Complete backend API reference for the X 3D Barber website.

**Backend:** Django + Django REST Framework
**API documentation:** Swagger / OpenAPI
**Base URL:**

```text
http://127.0.0.1:8000/api/
```

---

# Table of Contents

1. [Authentication](#1-authentication) — staff and customer audiences
2. [Accounts](#2-accounts)
3. [Services](#3-services)
4. [Haircut Styles](#4-haircut-styles)
5. [Bookings](#5-bookings)
6. [Payments](#6-payments)
7. [Testimonials](#7-testimonials) — **reading is public, writing needs an account**
8. [Notifications](#8-notifications)
9. [Complete Customer Booking Flow](#9-complete-customer-booking-flow)
10. [Admin Flow](#10-admin-flow)
11. [Frontend Integration Order](#11-frontend-integration-order)
12. [AI Booking Agent Flow](#12-ai-booking-agent-flow)
13. [HTTP Status Codes](#13-http-status-codes)
14. [Testing Checklist](#14-testing-checklist)

Related documents:

* [`docs/customer-accounts.md`](docs/customer-accounts.md) — why reviews are
  gated, and how the staff and customer sessions are kept apart
* [`docs/small-device-layout.md`](docs/small-device-layout.md) — the phone
  layout rules for the storefront and the staff console

---

# 1. Authentication

Authentication serves two separate audiences, and they are deliberately
kept apart:

| Audience | Why | Endpoints |
| --- | --- | --- |
| **Customer** | to leave a review, which is attributed to a real account | `/register/`, `/login/`, `/me/` |
| **Staff** | verifying payments and managing the shop | `/login/`, `/me/`, and every `IsAdminUser` route |

The same `/login/` and `/me/` endpoints serve both. What differs is which
token the caller holds and what the endpoint requires afterwards.

Customers do **not** need an account to:

* Browse services
* View haircut styles
* Check availability
* Create a booking
* Submit payment
* Upload a payment receipt

Customers **do** need an account to:

* Submit a testimonial (a review is attributed to a real customer)

Admin/staff authentication is used for protected operations such as:

* Verifying payments
* Rejecting payments
* Managing backend data
* Managing services/styles where permissions require authentication

See `docs/customer-accounts.md` for the design, including how the two
sessions are kept from overwriting each other.

---

## 1.0 Register

### Endpoint

```http
POST /api/accounts/register/
```

### Authentication

```text
Public
```

### Request

```json
{
  "username": "adonay",
  "email": "adonay@example.com",
  "first_name": "Adonay",
  "last_name": "Tesfaye",
  "phone": "0912345678",
  "password": "StrongPassword123!",
  "password_confirm": "StrongPassword123!"
}
```

`first_name`, `last_name` and `phone` are optional. `username`, `email`,
`password` and `password_confirm` are required.

### Response

**201** — the created account. No tokens are returned.

```json
{
  "id": 7,
  "username": "adonay",
  "email": "adonay@example.com",
  "first_name": "Adonay",
  "last_name": "Tesfaye",
  "phone": "0912345678"
}
```

Because no tokens come back, a client should follow this with
`POST /api/accounts/login/`.

### Validation

| Field | Rule |
| --- | --- |
| `username` | unique, case-insensitive |
| `email` | required, unique, case-insensitive, normalized to lowercase |
| `password` | min 8 chars, must satisfy `AUTH_PASSWORD_VALIDATORS` |
| `password_confirm` | must equal `password` |

---

## 1.1 Login

### Endpoint

```http
POST /api/accounts/login/
```

### Authentication

```text
Public
```

### Request

```json
{
  "username": "admin",
  "password": "StrongPassword123!"
}
```

### Successful Response

```json
{
  "access": "ACCESS_TOKEN",
  "refresh": "REFRESH_TOKEN",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "first_name": "Admin",
    "last_name": "User",
    "phone": "0912345678"
  }
}
```

### Failed Login

```json
{
  "detail": "No active account found with the given credentials"
}
```

### Note

This endpoint does not distinguish staff from customer accounts. A
non-staff account that signs in here is refused by the protected routes
below with **403**, not by this endpoint. Clients that need to know
whether an account has staff access must probe an `IsAdminUser` route —
the frontend staff console does this in `hasStaffAccess()`.

---

# 1.2 Refresh Token

### Endpoint

```http
POST /api/accounts/token/refresh/
```

### Authentication

```text
Public
```

### Request

```json
{
  "refresh": "REFRESH_TOKEN"
}
```

### Response

```json
{
  "access": "NEW_ACCESS_TOKEN"
}
```

---

# 1.3 Current Account

### Endpoint

```http
GET /api/accounts/me/
```

### Authentication

```text
Bearer Access Token
```

### Header

```http
Authorization: Bearer ACCESS_TOKEN
```

### Response

```json
{
  "id": 1,
  "username": "admin",
  "email": "admin@example.com",
  "first_name": "Admin",
  "last_name": "User",
  "phone": "0912345678"
}
```

---

# 2. Services

Services represent the main barber services.

Examples:

* Haircut
* Skin Fade
* Beard Trim
* Hair + Beard
* Kids Haircut

A service can contain multiple haircut styles.

---

# 2.1 List Active Services

### Endpoint

```http
GET /api/services/
```

### Authentication

```text
Public
```

### Response

```json
[
  {
    "id": 1,
    "name": "Classic Haircut",
    "description": "Clean traditional men's haircut.",
    "price": "500.00",
    "duration": 30,
    "image": "http://127.0.0.1:8000/media/services/classic.jpg",
    "styles": [
      {
        "id": 1,
        "service": 1,
        "name": "Classic Fade",
        "description": "A clean classic fade.",
        "image": "http://127.0.0.1:8000/media/styles/classic-fade.jpg",
        "is_active": true,
        "created_at": "2026-08-30T10:00:00Z",
        "updated_at": "2026-08-30T10:00:00Z"
      }
    ],
    "is_active": true,
    "created_at": "2026-08-30T10:00:00Z",
    "updated_at": "2026-08-30T10:00:00Z"
  }
]
```

Only active services should be returned to customers.

---

# 2.2 Get Service Details

### Endpoint

```http
GET /api/services/{service_id}/
```

### Example

```http
GET /api/services/1/
```

### Authentication

```text
Public
```

### Response

```json
{
  "id": 1,
  "name": "Classic Haircut",
  "description": "Clean traditional men's haircut.",
  "price": "500.00",
  "duration": 30,
  "image": "http://127.0.0.1:8000/media/services/classic.jpg",
  "styles": [
    {
      "id": 1,
      "service": 1,
      "name": "Classic Fade",
      "description": "A clean classic fade.",
      "image": "http://127.0.0.1:8000/media/styles/classic-fade.jpg",
      "is_active": true
    }
  ],
  "is_active": true
}
```

---

# 2.3 Create Service

### Endpoint

```http
POST /api/services/
```

### Authentication

```text
Admin/staff
```

### Content-Type

```text
multipart/form-data
```

### Form Data

```text
name=Classic Haircut
description=Clean traditional men's haircut.
price=500
duration=30
image=[image file]
is_active=true
```

### Response

```json
{
  "id": 5,
  "name": "Classic Haircut",
  "description": "Clean traditional men's haircut.",
  "price": "500.00",
  "duration": 30,
  "image": "http://127.0.0.1:8000/media/services/classic.jpg",
  "styles": [],
  "is_active": true,
  "created_at": "2026-08-30T10:00:00Z",
  "updated_at": "2026-08-30T10:00:00Z"
}
```

---

# 2.4 Update Service

### Endpoint

```http
PUT /api/services/{service_id}/
```

or:

```http
PATCH /api/services/{service_id}/
```

### Authentication

```text
Admin/staff
```

### Example PATCH

```http
PATCH /api/services/5/
```

```json
{
  "is_active": false
}
```

### Response

```json
{
  "id": 5,
  "name": "Classic Haircut",
  "description": "Clean traditional men's haircut.",
  "price": "500.00",
  "duration": 30,
  "image": "http://127.0.0.1:8000/media/services/classic.jpg",
  "styles": [],
  "is_active": false
}
```

When a service is inactive, customers should no longer see it in:

```http
GET /api/services/
```

---

# 2.5 Delete Service

### Endpoint

```http
DELETE /api/services/{service_id}/
```

### Authentication

```text
Admin/staff
```

### Response

```http
204 No Content
```

---

# 3. Haircut Styles

Haircut styles belong to a service.

For example:

```text
Classic Haircut
├── Classic Fade
├── Low Fade
├── Mid Fade
└── High Fade
```

This allows the frontend to show detailed styles when a customer opens a service.

---

# 3.1 List Styles for a Service

### Endpoint

```http
GET /api/services/{service_id}/styles/
```

### Authentication

```text
Public
```

### Example

```http
GET /api/services/5/styles/
```

### Response

```json
[
  {
    "id": 1,
    "service": 5,
    "name": "Low Fade",
    "description": "A clean low fade with a smooth transition.",
    "image": "http://127.0.0.1:8000/media/styles/low-fade.jpg",
    "is_active": true,
    "created_at": "2026-08-30T10:00:00Z",
    "updated_at": "2026-08-30T10:00:00Z"
  },
  {
    "id": 2,
    "service": 5,
    "name": "Mid Fade",
    "description": "A balanced mid fade style.",
    "image": "http://127.0.0.1:8000/media/styles/mid-fade.jpg",
    "is_active": true,
    "created_at": "2026-08-30T10:05:00Z",
    "updated_at": "2026-08-30T10:05:00Z"
  }
]
```

---

# 3.2 Create Haircut Style

### Endpoint

```http
POST /api/services/{service_id}/styles/create/
```

### Authentication

```text
Admin/staff
```

### Content-Type

```text
multipart/form-data
```

### Form Data

```text
name=Low Fade
description=A clean low fade with a smooth transition.
image=[image file]
is_active=true
```

The `service` is taken from the URL.

Do not send another `service` field if the backend already assigns the service from:

```text
/api/services/5/styles/create/
```

This avoids the previous:

```text
got multiple values for keyword argument 'service'
```

error.

---

# 3.3 Update Haircut Style

### Endpoint

```http
PATCH /api/services/{service_id}/styles/{style_id}/
```

### Authentication

```text
Admin/staff
```

### Example

```json
{
  "name": "Premium Low Fade",
  "description": "Updated haircut description.",
  "is_active": true
}
```

---

# 3.4 Delete Haircut Style

### Endpoint

```http
DELETE /api/services/{service_id}/styles/{style_id}/
```

### Authentication

```text
Admin/staff
```

### Response

```http
204 No Content
```

---

# 4. Bookings

Customers do not need an account to create bookings.

A booking contains:

* Customer name
* Customer phone
* Service
* Optional barber
* Booking date
* Start time
* End time
* Status
* Notes

The backend calculates `end_time` from the service duration.

---

# 4.1 Check Availability

### Endpoint

```http
GET /api/bookings/availability/
```

### Authentication

```text
Public
```

### Required Query Parameters

```text
service
booking_date
```

### Example

```http
GET /api/bookings/availability/?service=5&booking_date=2027-08-27
```

### Response

```json
{
  "service": "Classic Haircut",
  "date": "2027-08-27",
  "available_times": [
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "12:00"
  ]
}
```

---

# 4.2 Create Booking

### Endpoint

```http
POST /api/bookings/
```

### Authentication

```text
Public
```

### Content-Type

```text
application/json
```

### Request

```json
{
  "customer_name": "Adonay",
  "customer_phone": "0987654321",
  "service": 5,
  "barber": 2,
  "booking_date": "2027-08-27",
  "start_time": "10:00",
  "notes": "I want a low fade."
}
```

If the system automatically assigns a barber, the frontend does not need to send `barber`.

For example:

```json
{
  "customer_name": "Adonay",
  "customer_phone": "0987654321",
  "service": 5,
  "booking_date": "2027-08-27",
  "start_time": "10:00",
  "notes": "I want a low fade."
}
```

### Successful Response

```json
{
  "id": 10,
  "booking_code": "BK-0010",
  "customer_name": "Adonay",
  "customer_phone": "0987654321",
  "service": 5,
  "service_name": "Classic Haircut",
  "barber": 2,
  "booking_date": "2027-08-27",
  "start_time": "10:00:00",
  "end_time": "10:30:00",
  "status": "pending",
  "payment_status": null,
  "payment_due": true,
  "payment_open": false,
  "already_booked": false,
  "notes": "I want a low fade.",
  "created_at": "2026-08-30T10:00:00Z",
  "updated_at": "2026-08-30T10:00:00Z"
}
```

### `booking_code` - the customer's reference

Every booking gets its own code, assigned on creation and never changed.
It is derived from the primary key, so it cannot collide and the customer
reference and the shop's internal row id always agree.

**Show it prominently and give the customer something to copy it with.**
They need it together with the phone number they booked with to check
this booking again, from any device, at any time - and it is what staff
ask for on the phone.

Two bookings on the same phone number have two different codes. That is
the point: the code identifies the **booking**, not the customer.

---

# 4.3 Look Up One Booking

### Endpoint

```http
POST /api/bookings/lookup/
```

### Authentication

```text
Public, but proved by the booking's own code and phone number
```

### Content-Type

```json
```

### Request

```json
{
  "code": "BK-0010",
  "phone": "0987654321"
}
```

The booking ID identifies the booking; the phone number proves the person
asking owns it. Two, because the ID alone is short and guessable - it is
derived from a row id - and a booking carries a name, a phone number, an
appointment time and a payment receipt.

An unknown code and a wrong phone number are answered **identically**, so
this cannot be used to discover which codes exist.

POST rather than GET: the phone number belongs in a request body, not in a
URL that ends up in an access log, a browser history and a `Referer`
header.

### Response

```json
{
  "booking": {
    "id": 10,
    "booking_code": "BK-0010",
    "customer_name": "Adonay",
    "customer_phone": "0987654321",
    "service": 5,
    "service_name": "Classic Haircut",
    "barber": 2,
    "barber_name": "Lidetu Tesfaye",
    "booking_date": "2027-08-27",
    "start_time": "10:00:00",
    "end_time": "10:30:00",
    "status": "confirmed",
    "payment_status": null,
    "payment_due": true,
    "payment_open": true,
    "already_booked": false,
    "notes": "",
    "created_at": "2026-08-30T10:00:00Z",
    "updated_at": "2026-08-30T11:20:00Z"
  },
  "payment": null,
  "payment_due": true,
  "payment_open": true,
  "payment_rejected": false
}
```

### One code, one booking

`booking` is **the one appointment that booking ID names**. Not the
customer's history, not a row inside a list, and there is no index of their
other bookings beside it.

This is deliberate. Returning "everything on this phone number" made the
booking ID identify the *customer* rather than the *booking*, so the screen
opened on however many rows they happened to have and the appointment they
were asking about was no more likely to be the one they read than any other.
If someone checks one appointment's payment status and walks away
satisfied, the ID did not identify anything.

Someone who has booked three times holds three booking IDs, and each one
opens its own appointment. That is what makes them worth printing, copying
and keeping.

The response is therefore exactly five keys:

```text
booking            the appointment, in full
payment            its payment, or null
payment_due        money is still owed on it
payment_open       the customer may pay it this minute
payment_rejected   money arrived that could not be matched
```

### The money flags

| Field | Question | True when |
| --- | --- | --- |
| `payment_due` | Does the shop still want money for this appointment? | a live appointment (`pending` or `confirmed`) with no payment behind it |
| `payment_open` | May the customer send it right now? | the booking is `confirmed` and there is no payment, or the payment was `rejected` |
| `payment_rejected` | Did money arrive that could not be matched? | a payment exists with status `rejected` |

A booking awaiting confirmation owes money but cannot be paid yet. Showing a
pay form off `payment_due` offers money for a chair nobody has agreed to.

### Failed request

| Status | Reason |
| --- | --- |
| 400 | the code and phone number do not match a booking |
| 400 | either field missing |

---

# 4.4 Booking Status

Possible statuses:

```text
pending
confirmed
cancelled
completed
```

Typical flow:

```text
pending
   ↓
payment submitted
   ↓
admin verifies
   ↓
confirmed
   ↓
service completed
   ↓
completed
```

If payment is rejected:

```text
pending
   ↓
payment rejected
```

The exact booking-status update should follow the implemented backend business rules.

---

# 4.5 Multiple Customers at the Same Time

The booking system supports multiple customers during the same time period according to the configured shop capacity.

Example:

```text
10:00

Customer A → Barber 1
Customer B → Barber 2
Customer C → Barber 3
Customer D → Barber 4
```

The same time is therefore not automatically a conflict.

The conflict check is based on the configured simultaneous capacity.

Once capacity is reached, another booking for an overlapping time range should receive an error such as:

```json
{
  "start_time": [
    "The shop is fully booked for this time range."
  ]
}
```

---

# 4.6 Same Customer, Same Style, Different Time

A customer can make another booking for the same service/style at another time.

Example:

```text
August 27
10:00
Low Fade

August 30
15:00
Low Fade
```

These are separate bookings.

The booking system should identify them using their individual booking IDs.

---

# 4.7 Update Booking

### Endpoint

```http
PUT /api/bookings/{booking_id}/
```

or:

```http
PATCH /api/bookings/{booking_id}/
```

### Authentication

```text
According to current backend permission configuration.
```

### Example

```json
{
  "booking_date": "2027-08-30",
  "start_time": "15:00"
}
```

The backend recalculates:

```text
end_time
```

based on the selected service duration.

---

# 4.8 Confirm Booking

### Endpoint

```http
POST /api/bookings/{booking_id}/confirm/
```

### Authentication

```text
Authenticated admin/staff
```

### Request Body

```text
No body required
```

This is the step that **opens payment**.

The order is fixed:

```text
requested (pending) -> confirmed -> paid -> checked
```

A booking is `pending` the moment a customer makes it and `confirmed`
once reception has agreed the chair. A payment can only be submitted
against a `confirmed` booking, so the shop never takes money for a slot
it has not looked at.

Confirming by hand is still the right action for a walk-in or a cash
customer who will pay at the counter: the appointment is theirs, and the
money is settled in the room rather than through the API.

### Response

```json
{
  "id": 10,
  "status": "confirmed"
}
```

### Failed request

| Status | Reason |
| --- | --- |
| 400 | the booking is `cancelled` — a cancelled booking cannot be confirmed |
| 400 | the booking is already `completed` |
| 403 | not staff |

---

# 4.9 Complete Booking

### Endpoint

```http
POST /api/bookings/{booking_id}/complete/
```

### Authentication

```text
Authenticated admin/staff
```

### Request Body

```text
No body required
```

Marks a confirmed appointment as served. Idempotent.

### Response

```json
{
  "id": 10,
  "status": "completed"
}
```

### Failed request

| Status | Reason |
| --- | --- |
| 400 | the booking is not `confirmed` — an unpaid, unconfirmed booking has to be cancelled rather than counted as served |
| 403 | not staff |

---

# 4.10 Cancel Booking

### Endpoint

```http
POST /api/bookings/{booking_id}/cancel/
```

### Authentication

```text
According to current backend permission configuration.
```

### Response

```json
{
  "id": 10,
  "status": "cancelled"
}
```

The booking is not necessarily deleted.

It becomes:

```text
cancelled
```

and its time becomes available again.

---

# 4.11 Delete Booking

### Endpoint

```http
DELETE /api/bookings/{booking_id}/
```

### Authentication

```text
According to current backend permission configuration.
```

### Response

```http
204 No Content
```

---

# 4.12 Read One Booking's Live State (Customer)

### Endpoint

```http
GET /api/bookings/{booking_id}/status/
```

### Authentication

```text
Public, but proved by the booking's own code and phone number
```

### Headers

```http
X-Booking-Code: BK-0025
X-Booking-Phone: 0911234567
```

The customer's proof of ownership, carried in headers rather than the
query string: this is a GET, and a GET holding a credential must not end up
in an access log, a browser history or a `Referer` header.

An unknown code is answered exactly like a wrong phone number, so the
endpoint cannot be used to discover which codes exist.

### Response

```json
{
  "booking": {
    "id": 25,
    "booking_code": "BK-0025",
    "customer_name": "Adonay",
    "customer_phone": "0911234567",
    "service": 4,
    "service_name": "Classic Haircut",
    "barber": 1,
    "barber_name": "Lidetu Tesfaye",
    "booking_date": "2026-08-29",
    "start_time": "09:00:00",
    "end_time": "09:45:00",
    "status": "confirmed",
    "payment_status": null,
    "payment_due": true,
    "payment_open": true,
    "already_booked": false,
    "notes": "",
    "created_at": "2026-08-28T09:00:00Z",
    "updated_at": "2026-08-28T10:15:00Z"
  },
  "payment": null,
  "payment_due": true,
  "payment_open": true,
  "payment_rejected": false
}
```

Always a 200 once the proof passes, **including when nothing has been
paid**. "Not paid yet" is a state the interface has to render, not a
failure.

### The two money flags

They answer different questions and must not be collapsed:

| Field | Question | True when |
| --- | --- | --- |
| `payment_due` | Does the shop still want money for this appointment? | a live appointment (`pending` or `confirmed`) with no payment behind it |
| `payment_open` | May the customer send it right now? | the booking is `confirmed` and there is no payment, or the payment was `rejected` |
| `payment_rejected` | Did money arrive that could not be matched? | a payment exists with status `rejected` |

A booking awaiting confirmation owes money but cannot be paid yet. Showing a
pay form off `payment_due` offers money for a chair nobody has agreed to,
which is the mistake this split exists to prevent.

This is the endpoint a booking result page should poll: it answers "has
reception confirmed?" and "has the shop checked the payment?" in one
request, so the transition from waiting to payable happens without the
customer touching anything.

### Failed request

| Status | Reason |
| --- | --- |
| 400 | the code and phone number do not match this booking |
| 404 | no such booking |

---

# 4.13 Booking List Carries Its Payment (Staff)

### Endpoint

```http
GET /api/bookings/
GET /api/bookings/{booking_id}/
```

### Authentication

```text
Authenticated staff with the bookings.view capability
```

Every row carries one extra key on top of the booking:

```json
  "payment": {
    "id": 1,
    "booking": 25,
    "booking_code": "BK-0025",
    "booking_status": "confirmed",
    "booking_date": "2026-08-29",
    "booking_start_time": "09:00:00",
    "booking_barber": "Lidetu Tesfaye",
    "booking_customer": "Adonay",
    "booking_service": "Classic Haircut",
    "amount": "5000.00",
    "method": "telebirr",
    "transaction_reference": "TIN0987",
    "receipt": "http://127.0.0.1:8000/media/payment_receipts/receipt.png",
    "status": "pending",
    "verified_by": null,
    "verified_at": null,
    "rejection_reason": "",
    "created_at": "2026-08-29T08:40:00Z",
    "updated_at": "2026-08-29T08:40:00Z"
  }
```

`null` when no payment exists - always present, never missing, because an
absent field is indistinguishable from no data.

The point is that a booking and its money are read in one request and
cannot disagree on screen: deciding a payment no longer means leaving the
booking, finding the payment queue, and matching rows on a booking id
nobody had asked for. The payment is joined by the same query as the
booking, so the detail costs no extra round trip per row.

---

# 5. Payments

Customers do not need to register or log in to submit a payment.

The payment is connected to an existing booking.

Payment can include a receipt screenshot.

---

# 5.1 Submit Payment

### Endpoint

```http
POST /api/payments/payments/
```

### Authentication

```text
Public
```

### Content-Type

```text
multipart/form-data
```

Do not send the receipt as a JSON object.

Use an actual file upload.

---

## Form Fields

```text
booking
booking_reference   # the booking code, e.g. BK-0025
booking_phone       # the phone number the booking was made with
amount
method
transaction_reference
receipt
```

`booking_reference` and `booking_phone` are the customer's proof of
ownership. They must match that booking exactly, and an unknown code is
answered the same way as a wrong phone number, so the endpoint cannot be
used to find out which codes exist.

### The booking must already be confirmed

A booking that is still `pending` is refused with a 400 and no payment is
created. The message names reception and says payment opens once they have
confirmed, so a customer reads it as "not yet" rather than as a failure.

A `cancelled`, `completed` or `expired` booking is refused with its own
message.

`confirmed` and `paid` are still separate. Staff confirm walk-ins who pay
at the counter, so a confirmed booking with no payment behind it is an
ordinary state - it just means payment is *open*, not that money is
impossible.

### Example

```text
booking=4
booking_reference=BK-0025
booking_phone=0911234567
amount=5000
method=telebirr
transaction_reference=TIN0987
receipt=[actual image file]
```

Supported receipt image formats:

```text
JPG
PNG
WebP
```

Maximum receipt size:

```text
5 MB
```

---

# 5.2 Successful Payment Submission

### Response

```json
{
  "id": 1,
  "booking": 4,
  "booking_customer": "Adonay",
  "booking_service": "Classic Haircut",
  "amount": "5000.00",
  "method": "telebirr",
  "transaction_reference": "TIN0987",
  "receipt": "http://127.0.0.1:8000/media/payments/receipt.jpg",
  "status": "pending",
  "verified_by": null,
  "verified_at": null,
  "rejection_reason": "",
  "created_at": "2026-08-30T11:00:00Z",
  "updated_at": "2026-08-30T11:00:00Z"
}
```

---

# 5.3 Payment Status

Typical statuses:

```text
pending
verified
rejected
```

Customer submits:

```text
pending
```

Admin verifies:

```text
verified
```

Admin rejects:

```text
rejected
```

---

# 5.4 Verify Payment

### Endpoint

```http
POST /api/payments/payments/{payment_id}/verify/
```

### Authentication

```text
Authenticated admin/staff
```

### Request Body

```text
No body required
```

### Header

```http
Authorization: Bearer ADMIN_ACCESS_TOKEN
```

### Response

```json
{
  "id": 1,
  "booking": 4,
  "amount": "5000.00",
  "method": "telebirr",
  "status": "verified",
  "verified_by": 1,
  "verified_at": "2026-08-30T11:30:00Z"
}
```

---

# 5.5 Reject Payment

### Endpoint

```http
POST /api/payments/payments/{payment_id}/reject/
```

### Authentication

```text
Authenticated admin/staff
```

### Request

```json
{
  "reason": "The transaction reference could not be verified."
}
```

### Response

```json
{
  "id": 1,
  "booking": 4,
  "amount": "5000.00",
  "method": "telebirr",
  "status": "rejected",
  "rejection_reason": "The transaction reference could not be verified."
}
```

---

# 5.6 Payment Security

Never trust the frontend for:

```text
payment status
verified_by
verified_at
rejection_reason
```

These values must be controlled by the backend.

The customer should only submit:

```text
booking
amount
method
transaction_reference
receipt
```

---

# 6. Testimonials

Testimonials allow customers to submit feedback.

**Reading the wall is public. Writing a review needs an account.**

A review is attributed to a real customer: the reviewer is identified by a
token, and the name published on the wall is derived from that account
rather than taken from the request body.

See `docs/customer-accounts.md`.

---

## 6.1 Create Testimonial

### Endpoint

```http
POST /api/testimonials/testimonials/
```

### Authentication

```text
Bearer access token   (IsAuthenticated)
```

A customer account is required. An anonymous request is rejected with
**401** and no row is created.

### Content-Type

```text
multipart/form-data
```

### Form Data

```text
message=What a great cut.
rating=5
photo=[optional image]
```

**Do not send `customer_name` or `user`.** Both are read-only on the
serializer. The published name is resolved from the account:

1. the account's `first_name last_name`
2. otherwise the `username`

An account that resolves to neither is refused with **400**.

### Response

**201**

```json
{
  "id": 2,
  "user": 7,
  "customer_name": "Adonay Tesfaye",
  "customer_phone": "",
  "message": "What a great cut.",
  "rating": 5,
  "photo": "http://127.0.0.1:8000/media/testimonials/photo.jpg",
  "status": "pending",
  "created_at": "2026-08-30T12:00:00Z",
  "updated_at": "2026-08-30T12:00:00Z"
}
```

`status` is always `pending` on create. It is not client-settable.

### Photo rules

```text
Formats:  JPG, PNG, WebP
Max size: 5 MB
```

### Failed create

| Status | Meaning |
| --- | --- |
| 401 | no valid token |
| 400 | blank `message`, `rating` outside 1–5, bad photo type/size, or an account with no displayable name |

---

## 6.2 List Testimonials

### Endpoint

```http
GET /api/testimonials/testimonials/
```

### Authentication

```text
Public
```

### Who sees what

| Caller | Returns |
| --- | --- |
| anonymous | approved reviews only |
| signed-in customer | approved reviews only — the same wall a visitor sees |
| staff | every review, in every status |

### Response

```json
[
  {
    "id": 2,
    "user": 7,
    "customer_name": "Adonay Tesfaye",
    "customer_phone": "",
    "message": "What a great cut.",
    "rating": 5,
    "photo": null,
    "status": "approved",
    "created_at": "2026-08-30T12:00:00Z",
    "updated_at": "2026-08-30T12:00:00Z"
  }
]
```

Reviews created before accounts existed have `"user": null`. Their
`customer_name` came from a free-text field and is not verified.

---

## 6.3 My Testimonials

### Endpoint

```http
GET /api/testimonials/testimonials/mine/
```

### Authentication

```text
Bearer access token   (IsAuthenticated)
```

### Description

The caller's own reviews, in **every** status — so a customer can tell
"still pending" from "rejected" instead of waiting silently.

This deliberately does not apply the public approved-only filter, and it
only ever returns rows owned by the caller. Staff calling it get their own
reviews, not everyone's; the moderation screen uses §6.2, which is where
staff see all statuses.

### Response

```json
[
  {
    "id": 2,
    "user": 7,
    "customer_name": "Adonay Tesfaye",
    "message": "What a great cut.",
    "rating": 5,
    "photo": null,
    "status": "pending",
    "created_at": "2026-08-30T12:00:00Z",
    "updated_at": "2026-08-30T12:00:00Z"
  }
]
```

### Failed request

| Status | Meaning |
| --- | --- |
| 401 | no valid token |

---

## 6.4 Get Testimonial

### Endpoint

```http
GET /api/testimonials/testimonials/{testimonial_id}/
```

### Authentication

```text
Public
```

Follows the same visibility rule as §6.2.

---

## 6.5 Approve Testimonial

### Endpoint

```http
POST /api/testimonials/testimonials/{testimonial_id}/approve/
```

### Authentication

```text
Authenticated admin/staff   (IsAdminUser)
```

Publishes the review on the wall. Idempotent — approving an already
approved review is a no-op.

### Response

```http
200 OK
```

The updated testimonial.

---

## 6.6 Reject Testimonial

### Endpoint

```http
POST /api/testimonials/testimonials/{testimonial_id}/reject/
```

### Authentication

```text
Authenticated admin/staff   (IsAdminUser)
```

Removes the review from the wall without deleting it. Idempotent.

**No rejection reason is recorded** — the model has no field for one, and
a client must not display a cause it does not have.

---

## 6.7 Delete Testimonial

### Endpoint

```http
DELETE /api/testimonials/testimonials/{testimonial_id}/
```

### Authentication

```text
Admin/staff   (IsAdminUser)
```

### Response

```http
204 No Content
```

Permanent. Unlike §6.6 this cannot be undone.

If the review's account is later deleted, the review is kept with
`user: null` and keeps the name it was published under
(`on_delete=SET_NULL`).

---

# 7. Notifications

Notifications are used after important backend events.

Examples:

```text
Booking created
Payment submitted
Payment verified
Payment rejected
Booking confirmed
Booking cancelled
```

Possible notification channels:

```text
Email
SMS
```

---

# 7.1 Recommended Notification Flow

```text
Booking Created
      ↓
Payment Submitted
      ↓
Admin Verification
      ↓
Notification
   ↙       ↘
Email      SMS
```

The notification system should be triggered from backend business logic rather than from React.

---

# 8. Complete Customer Booking Flow

The frontend should follow this order.

---

## Step 1 — Load Services

```http
GET /api/services/
```

Frontend displays:

```text
Classic Haircut
Skin Fade
Beard Trim
Hair + Beard
```

---

## Step 2 — Customer Opens a Service

```http
GET /api/services/5/
```

Frontend displays:

```text
Service
Price
Duration
Description
Image
Haircut styles
```

---

## Step 3 — Customer Selects a Style

Example:

```text
Low Fade
```

The style is associated with the selected service.

---

## Step 4 — Customer Selects Date

Example:

```text
2027-08-27
```

---

## Step 5 — Check Availability

```http
GET /api/bookings/availability/?service=5&booking_date=2027-08-27
```

Frontend receives:

```json
{
  "service": "Classic Haircut",
  "date": "2027-08-27",
  "available_times": [
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00"
  ]
}
```

---

## Step 6 — Customer Selects Time

Example:

```text
10:00
```

---

## Step 7 — Customer Enters Information

```text
Name
Phone
Notes
```

No login required.

---

## Step 8 — Create Booking

```http
POST /api/bookings/
```

---

## Step 9 — Reception Confirms

```http
POST /api/bookings/{id}/confirm/
```

**The customer cannot pay before this happens.** A booking is created
`pending`, and a payment submitted against a `pending` booking is
refused. The booking is held for the customer in the meantime and the
result page polls until reception confirms it.

---

## Step 10 — Customer Pays

```http
POST /api/payments/payments/
```

Payment is now open for that booking. The customer can upload:

```text
Telebirr receipt
Bank transfer receipt
Other supported payment proof
```

---

## Step 11 — Admin Receives Payment

Admin sees:

```text
Customer
Service
Date
Time
Amount
Payment method
Transaction reference
Receipt screenshot
```

---

## Step 12 — Admin Verifies

```http
POST /api/payments/payments/{id}/verify/
```

---

## Step 13 — Notification

After successful verification:

```text
Email
+
SMS
```

can notify the customer/admin.

---

# 9. Admin Flow

Admin authentication:

```http
POST /api/accounts/login/
```

Admin receives:

```text
access token
refresh token
```

Frontend stores the authentication state securely according to your application's security strategy.

---

## Admin Dashboard

Admin can manage:

```text
Services
Haircut Styles
Bookings
Payments
Gallery
Testimonials
Notifications
```

### Booking status transitions

`status` is read-only on `BookingSerializer`, so a booking's status only
moves through these three endpoints:

```text
POST /api/bookings/{id}/cancel/      pending | confirmed  ->  cancelled
POST /api/bookings/{id}/confirm/     pending              ->  confirmed
POST /api/bookings/{id}/complete/    confirmed            ->  completed
```

Confirmation comes first and payment second, so the booking is already
`confirmed` by the time a payment exists. Verifying a payment still calls
`confirm_booking()` afterwards, but on a confirmed booking that is a no-op
- it is there only to cover payments created before this order was
enforced, which must not become un-acceptable.

`complete` refuses anything that is not `confirmed`: a booking that was
never paid for and never confirmed has to be cancelled, not quietly
counted as served.

### Reviews

A review is attributed to the staff-free customer account that wrote it.
`POST /api/testimonials/` is `IsAuthenticated`; the moderation actions
and the permanent delete stay `IsAdminUser`. Reading the approved wall is
public and unchanged. See §6 and `docs/customer-accounts.md`.

---

## Payment Review

Admin sees:

```text
Payment #1

Customer: Adonay
Service: Classic Haircut
Amount: 5000
Method: Telebirr
Reference: TIN0987

Receipt:
[image]

Status:
Pending
```

Admin chooses:

```text
VERIFY
```

or:

```text
REJECT
```

---

# 10. Frontend Integration Order

## Calendar and dates

The storefront books in the **Ethiopian calendar** and shows appointment
dates and times back in it, with the Amharic month, weekday and part of
day (`መስከረም`, `ሰኞ`, `ጠዋት`).

The wire format is unchanged and stays Gregorian: every date on this API
is `YYYY-MM-DD` and every time is `HH:MM:SS`. The conversion happens in the
interface only, at the edge of the date picker, so:

- the API, the availability endpoint and the admin console keep comparing
  Gregorian dates against Gregorian rows;
- staff reading a booking card still see a Gregorian date;
- there is exactly one place that can be wrong about which day was picked,
  and `npm run check:calendar` checks it - round trip, weekday agreement and
  grid layout across 18,000+ days.

Watch the leap year: Pagume is 5 days, or 6 in a leap year, and it exists
at all only in a leap year. After a leap year the new year falls on 12
September Gregorian rather than the 11th.

Do not connect everything at once.

Build React integration in this order:

```text
1. Services
       ↓
2. Service Details
       ↓
3. Haircut Styles
       ↓
4. Availability
       ↓
5. Booking Form
       ↓
6. Booking Confirmation
       ↓
7. Payment Form
       ↓
8. Receipt Upload
       ↓
9. Payment Status
       ↓
10. Testimonials
       ↓
11. Notifications
       ↓
12. Admin Dashboard
```

---

# 11. AI Booking Agent Flow

The AI agent should sit above your existing backend.

Do not allow the AI to directly access your Django database.

Instead:

```text
Customer
    ↓
AI Booking Agent
    ↓
AI Tools
    ↓
Django API / services.py
    ↓
Database
```

---

## AI Tool 1 — Get Services

```text
get_services()
```

The AI can answer:

```text
"What haircuts do you offer?"
```

---

## AI Tool 2 — Get Styles

```text
get_service_styles(service_id)
```

Example:

```text
Customer:
"I want a fade."

AI:
"We have Low Fade, Mid Fade and High Fade."
```

---

## AI Tool 3 — Check Availability

```text
check_availability(
    service_id,
    booking_date
)
```

---

## AI Tool 4 — Create Booking

```text
create_booking(
    customer_name,
    customer_phone,
    service_id,
    booking_date,
    start_time,
    notes
)
```

The backend remains responsible for:

```text
Validation
Capacity
Duration
Conflict checking
Database transaction
```

---

## AI Tool 5 — Create Payment

```text
create_payment(
    booking_id,
    amount,
    method,
    transaction_reference,
    receipt
)
```

---

# 12. AI Agent Example Conversation

Customer:

```text
I want a haircut tomorrow around 10.
```

AI:

```text
Sure. Which style would you like?
We have Low Fade, Mid Fade and Classic Cut.
```

Customer:

```text
Low Fade.
```

AI:

```text
Low Fade is available tomorrow at:

09:30
10:00
10:30
11:00

Which time would you like?
```

Customer:

```text
10:00.
```

AI:

```text
Great. What is your name and phone number?
```

Customer:

```text
Adonay
0987654321
```

AI creates:

```text
POST /api/bookings/
```

Then:

```text
Booking created.
```

AI:

```text
Your booking is pending payment.

Please submit your payment and receipt.
```

Customer uploads receipt.

Backend creates:

```text
Payment = pending
```

Admin verifies payment.

Then:

```text
Payment = verified
Booking = confirmed
```

Notification service sends:

```text
Email
+
SMS
```

---

# 13. HTTP Status Codes

Common responses:

| Status | Meaning                 |
| ------ | ----------------------- |
| 200    | Successful request      |
| 201    | Resource created        |
| 204    | Resource deleted        |
| 400    | Invalid request/data    |
| 401    | Authentication required |
| 403    | Permission denied       |
| 404    | Resource not found      |
| 405    | HTTP method not allowed |
| 500    | Server error            |

---

# 14. Testing Checklist

Before connecting the React frontend, test every endpoint using Swagger.

---

## Accounts

```text
[ ] Login works
[ ] Invalid login rejected
[ ] Refresh token works
[ ] /me/ requires authentication
[ ] Authenticated /me/ works
```

---

## Services

```text
[ ] GET services works
[ ] GET service by ID works
[ ] POST service works
[ ] PATCH service works
[ ] PATCH is_active works
[ ] DELETE service works
```

---

## Haircut Styles

```text
[ ] GET styles works
[ ] POST style works
[ ] Style image uploads
[ ] PATCH style works
[ ] PATCH is_active works
[ ] DELETE style works
[ ] Inactive styles are handled correctly
```

---

## Bookings

```text
[ ] Availability works
[ ] Required availability parameters appear in Swagger
[ ] Available times are returned
[ ] Booking creation works
[ ] end_time is calculated automatically
[ ] Multiple customers can use available capacity
[ ] Full capacity is rejected
[ ] Same customer can book another time
[ ] Booking update works
[ ] Booking cancellation works
[ ] Booking confirmation works
[ ] Cancelled booking cannot be confirmed
[ ] Booking completion works
[ ] Only a confirmed booking can be completed
[ ] Normal customer cannot confirm/complete/cancel
```

---

## Payments

```text
[ ] Customer can submit payment without login
[ ] Multipart form works
[ ] Receipt upload works
[ ] JPG accepted
[ ] PNG accepted
[ ] WebP accepted
[ ] Invalid image rejected
[ ] Image over 5MB rejected
[ ] Amount must be greater than zero
[ ] Payment starts as pending
[ ] Admin can verify
[ ] Admin can reject
[ ] Normal customer cannot verify/reject
```

---

## Accounts

```text
[ ] Register works
[ ] Duplicate username rejected
[ ] Duplicate email rejected
[ ] Mismatched passwords rejected
[ ] Weak password rejected
[ ] Register returns no tokens
[ ] Login works
[ ] Register then login works
[ ] Invalid login rejected
[ ] Refresh token works
[ ] /me/ requires authentication
[ ] Authenticated /me/ works
[ ] Staff session and customer session can be live at the same time
```

---

## Testimonials

```text
[ ] Anonymous testimonial submit is rejected with 401
[ ] Signed-in customer can submit testimonial
[ ] customer_name in the request body is ignored
[ ] Username is used when the account has no real name
[ ] Blank message rejected
[ ] rating outside 1-5 rejected
[ ] Photo upload works
[ ] Public GET returns approved only
[ ] Signed-in customer still sees approved only on the public list
[ ] GET /mine/ requires authentication
[ ] GET /mine/ returns every status
[ ] GET /mine/ returns only the caller's own reviews
[ ] Customer cannot approve or reject
[ ] Customer cannot delete
[ ] Staff can approve and it appears on the public wall
[ ] Staff can reject
[ ] Staff can delete
[ ] GET testimonial by ID works
```

---

## Final End-to-End Test

Run this complete scenario:

```text
1. GET services
       ↓
2. GET service details
       ↓
3. GET haircut styles
       ↓
4. Check availability
       ↓
5. Create booking
       ↓
6. Submit payment + receipt
       ↓
7. Login as admin
       ↓
8. Verify payment
       ↓
9. Booking becomes confirmed
       ↓
10. Notification is triggered
```

If this entire flow passes, the backend is ready for **React frontend integration** and later for the **AI booking agent**.
