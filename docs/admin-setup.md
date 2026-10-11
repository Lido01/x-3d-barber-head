# Owner admin setup

There are two levels of staff access, and the difference is the whole point.

## Owner

There are two levels of staff access, and the difference is the whole point.

## Owner

The first system owner is a Django superuser. A superuser is automatically treated as the **Owner** by the dashboard and has all permissions, including User Management, Team & permissions, payment history and activity logs.

From the `backend` directory, with the project virtual environment activated and dependencies installed, run:

```powershell
python manage.py migrate
python manage.py createsuperuser
```

Enter a username, email and strong password at the prompts. Then open the website and sign in at `/admin/login` using that username and password.

After the first owner signs in:

1. Go to **User management** to review every account and enable or disable access.
2. Go to **Team & permissions** to turn an existing user into Reception, Staff or Administrator and select their capabilities.
3. Go to **Activity** to review staff changes, payment verification/rejections and booking actions.

## Administrator

An **Administrator** is a staff account with no limits: it manages every user, service, payment, booking, gallery post and review, and can open User management, Team & permissions and the Activity log — the same screens the owner has. The difference is that an administrator cannot change the owner's account, and cannot promote anyone to Owner.

An administrator is granted in one of two equivalent ways, both writing to the same record:

- **User management** — open an account, change its role to Administrator, save.
- **Team & permissions** — add the account with the Administrator role.

The other roles are **Reception** and **Staff**, and they are exactly the capability boxes that are ticked. There is no preset: a receptionist with `bookings.manage` and `payments.verify` ticked can confirm bookings and verify payments and nothing else, and the console hides every screen they cannot use — including on a typed URL, which redirects to the overview.

## The three rules the server enforces

These are refused with a 400 and shown as a disabled control with the reason attached, rather than failing after the tap:

- **The owner account is not editable from the console.** Ownership is created only with `createsuperuser`; no API writes `is_superuser`, which is what stops an administrator promoting themselves to an account nothing can revoke.
- **Nobody can change their own role, capabilities or access.** You are always signed in as somebody, and that somebody stays able to undo anything they do to themselves.
- **The last administrator cannot be removed or demoted.** Promote someone else to administrator first.

Disabling an account also closes its console access, so the account switch and the console switch are one switch and the two screens can never disagree about who is enabled.

Do not make a normal customer an owner by setting `is_superuser` in application code. Create owners only through Django's `createsuperuser` command or Django's protected administration tools.

---

## Before this is reachable by anyone else

`manage.py check --deploy` currently reports the development defaults still in place, all of which matter more once the console is reachable from a network rather than a laptop:

- `SECRET_KEY` is the generated insecure placeholder. JWT access tokens are signed with it, so anyone who knows it can mint tokens for any user. Generate a real one and read it from the environment.
- `DEBUG = True` returns Django's tracebacks — including settings and local paths — on any error.
- `ALLOWED_HOSTS` and `CORS_ALLOW_ALL_ORIGINS` are wide open. Both are fine for local development on a LAN and wrong for a public deployment; pin the origins that are actually yours.
- `SECURE_SSL_REDIRECT`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE` and `SECURE_HSTS_SECONDS` are unset. Set them once the site is behind TLS.

## What the activity log records

Every privileged action, with the actor, the time, the record it touched and the fields that changed. Account and role changes are recorded field by field (`role: "customer" → "reception"`), which is what answers "why does this account have that role" later. Booking transitions, payment verification and rejection, testimonial decisions, and service, gallery and barber changes are all in the same trail, filterable by kind and searchable by person.

## The dashboard

The overview is one request, counted in the database, not six list endpoints tallied in the browser. It shows today's schedule with confirm and complete actions on each row, the next seven days, the work queues, and verified revenue. A limited account receives only the sections its capabilities cover — the reception dashboard has no revenue figure and no customer count on it.
