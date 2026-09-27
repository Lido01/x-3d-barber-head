# X 3D Barber — API Endpoints (superseded)

> **This file is out of date. The canonical API reference is
> [`../api_endpoint.md`](../api_endpoint.md) at the repository root.**
>
> Two copies of this document had drifted apart. Rather than keep
> updating both — and have the wrong one win — this one is left as a
> pointer. Anything you read below may contradict the current API.
>
> Specifically, the sections that changed most recently:
>
> * **§1 Authentication** — the document below still says testimonials
>   need no account. Submitting a review now requires a customer
>   account; reading the wall does not.
> * **§4 Bookings** — the document below has no `confirm` or `complete`
>   transition, so it reads as though `cancel` is the only thing staff
>   can do to a booking.
> * **§6 Testimonials** — the endpoints below are missing the
>   `testimonials/` path segment on some routes, and there is no
>   `/mine/` endpoint.
>
> For the design behind those changes see
> [`customer-accounts.md`](customer-accounts.md).

---

<!-- Everything below is the stale copy. Kept for reference only. -->

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

1. [Authentication](#1-authentication)
2. [Accounts](#2-accounts)
3. [Services](#3-services)
4. [Haircut Styles](#4-haircut-styles)
5. [Bookings](#5-bookings)
6. [Payments](#6-payments)
7. [Testimonials](#7-testimonials)
8. [Notifications](#8-notifications)
9. [Complete Customer Booking Flow](#9-complete-customer-booking-flow)
10. [Admin Flow](#10-admin-flow)
11. [Frontend Integration Order](#11-frontend-integration-order)
12. [AI Booking Agent Flow](#12-ai-booking-agent-flow)
13. [HTTP Status Codes](#13-http-status-codes)
14. [Testing Checklist](#14-testing-checklist)

---

# 1. Authentication

Authentication is primarily for the admin/staff side.

Customers do **not** need an account to:

* Browse services
* View haircut styles
* Check availability
* Create a booking
* Submit payment
* Upload a payment receipt
* Submit a testimonial

Admin/staff authentication is used for protected operations such as:

* Verifying payments
* Rejecting payments
* Managing backend data
* Managing services/styles where permissions require authentication

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
  "customer_name": "Adonay",
  "customer_phone": "0987654321",
  "service": 5,
  "service_name": "Classic Haircut",
  "barber": 2,
  "booking_date": "2027-08-27",
  "start_time": "10:00:00",
  "end_time": "10:30:00",
  "status": "pending",
  "notes": "I want a low fade.",
  "created_at": "2026-08-30T10:00:00Z",
  "updated_at": "2026-08-30T10:00:00Z"
}
```

---

# 4.3 Booking Status

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

# 4.4 Multiple Customers at the Same Time

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

# 4.5 Same Customer, Same Style, Different Time

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

# 4.6 Update Booking

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

# 4.7 Cancel Booking

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

# 4.8 Delete Booking

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
amount
method
transaction_reference
receipt
```

### Example

```text
booking=4
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

---

# 6.1 Create Testimonial

### Endpoint

```http
POST /api/testimonials/
```

### Authentication

```text
Public
```

### Content-Type

```text
multipart/form-data
```

### Example

```text
customer_name=Tesfaye
message=I really liked the haircut.
rating=5
photo=[optional image]
```

### Response

```json
{
  "id": 2,
  "customer_name": "Tesfaye",
  "message": "I really liked the haircut.",
  "rating": 5,
  "photo": "http://127.0.0.1:8000/media/testimonials/photo.jpg",
  "status": "pending",
  "created_at": "2026-08-30T12:00:00Z",
  "updated_at": "2026-08-30T12:00:00Z"
}
```

---

# 6.2 List Testimonials

### Endpoint

```http
GET /api/testimonials/
```

### Authentication

```text
Public
```

The frontend can use this endpoint for the testimonial section.

---

# 6.3 Get Testimonial

### Endpoint

```http
GET /api/testimonials/{testimonial_id}/
```

### Authentication

```text
Public
```

---

# 6.4 Delete Testimonial

### Endpoint

```http
DELETE /api/testimonials/{testimonial_id}/
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

## Step 9 — Customer Pays

```http
POST /api/payments/payments/
```

The customer can upload:

```text
Telebirr receipt
Bank transfer receipt
Other supported payment proof
```

---

## Step 10 — Admin Receives Payment

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

## Step 11 — Admin Verifies

```http
POST /api/payments/payments/{id}/verify/
```

---

## Step 12 — Notification

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
Testimonials
Notifications
```

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

## Testimonials

```text
[ ] Customer can submit testimonial
[ ] Photo upload works
[ ] GET testimonials works
[ ] GET testimonial by ID works
[ ] Delete works for authorized user
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
