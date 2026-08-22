# Backend API

Base URL: `/api/`. Dates use `YYYY-MM-DD`; times use 24-hour `HH:MM`.

## Services

`GET /api/services/` returns active services. `POST /api/services/` creates a service.

```json
POST /api/services/
{"name":"Fade + Beard","price":"500.00","duration":60,"is_active":true}

201 Created
{"id":1,"name":"Fade + Beard","description":"","price":"500.00","duration":60,"image":null,"is_active":true,"created_at":"2026-08-14T10:00:00Z","updated_at":"2026-08-14T10:00:00Z"}
```

## Bookings

The shop uses one schedule. Appointments start every 30 minutes between 09:00 and 18:00. Pending and confirmed bookings reserve their whole service duration. The server calculates `end_time`; clients must not provide it.

```json
POST /api/bookings/
{"customer_name":"Sam Doe","customer_phone":"+251900000000","service":1,"booking_date":"2026-08-20","start_time":"10:00","notes":""}

201 Created
{"id":1,"customer_name":"Sam Doe","customer_phone":"+251900000000","service":1,"service_name":"Fade + Beard","booking_date":"2026-08-20","start_time":"10:00:00","end_time":"11:00:00","status":"pending","notes":"","created_at":"2026-08-14T10:00:00Z","updated_at":"2026-08-14T10:00:00Z"}
```

`GET /api/bookings/` returns bookings ordered by date and start time. Inactive services are rejected with `400 Bad Request`; overlapping appointments return:

```json
{"start_time":["This time overlaps an existing booking."]}
```

Check slots before creating a booking:

```text
GET /api/bookings/availability/?service=1&booking_date=2026-08-20
```

```json
200 OK
{"service":"Fade + Beard","date":"2026-08-20","available_times":["09:00","09:30","11:00","11:30"]}
```

## Accounts

```json
POST /api/accounts/register/
{"username":"sam","email":"sam@example.com","first_name":"Sam","phone":"+251900000000","password":"secure-pass-123","password_confirm":"secure-pass-123"}

201 Created
{"id":1,"username":"sam","email":"sam@example.com","first_name":"Sam","last_name":"","phone":"+251900000000"}
```

`GET /api/accounts/me/` returns the authenticated user's account information. It uses standard Django session or HTTP Basic authentication.
