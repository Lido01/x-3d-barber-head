# Customer accounts and the review gate

## Why a customer account exists

A review used to be a name and a paragraph typed into a public form and
published as-is. Any visitor could write under any name, and nothing on
the wall could be traced back to a real visit.

Writing a review now needs a customer account. The reviewer is
identified by a token, and the name published on the wall is derived from
that account server-side.

**This is the only thing an account is for.** Browsing, checking
availability, booking and paying all stay unauthenticated. `POST
/api/bookings/` is still `AllowAny`, and the booking and payment screens
never look at the session.

## Why the gate is enforced twice

The prompt in the UI is not the enforcement.

- **Frontend** — `sections/Testimonials.jsx` renders a sign-in /
  create-account prompt instead of the form when nobody is signed in.
- **Backend** — `POST /api/testimonials/testimonials/` is
  `IsAuthenticated` and answers **401** without a valid token.

A UI-only gate is a suggestion. Someone with `curl` would still be able
to post under a name they made up, which was the thing being fixed.

## The name is server-owned

`customer_name` and `user` are in `TestimonialSerializer.read_only_fields`,
so a create payload cannot set them. `resolve_reviewer_name()` in
`apps/testimonials/services.py` picks the published name:

1. the account's `first_name last_name`
2. otherwise the `username`
3. otherwise empty — and `create()` refuses, rather than publishing a
   review with a blank byline

A forged `customer_name` in the request body is ignored. There is a test
for exactly that (`test_customer_submit_is_attributed_to_the_account`).

## Reading is still public

`GET /api/testimonials/testimonials/` returns **approved** reviews to
everyone, signed in or not. The wall is the marketing surface; gating it
would hide it from the people it is for.

A signed-in customer sees exactly the same wall as an anonymous visitor.
The extra visibility is a separate endpoint, below.

## `/mine/`

```
GET /api/testimonials/testimonials/mine/
```

Returns the caller's own reviews in **every** state, so a customer can
tell "still pending" from "rejected" instead of waiting silently.

It does not use `get_queryset()`. That queryset applies the
approved-only public filter, which would hide the caller's own pending
and rejected rows — precisely the rows they are asking about.

Staff calling `/mine/` still get their own reviews, not everyone's; the
moderation screen uses the plain list endpoint, which is where staff see
all statuses.

A rejected review carries no reason: the API has no field for one, and
`pages/Account.jsx` says the shop declined it rather than inventing a
cause.

## Legacy reviews

Reviews created before this change have `user: NULL` and their name came
from a free-text field. The column is nullable and `on_delete=SET_NULL`,
so an approved review keeps the name it was published under even if the
account is later removed.

`pages/admin/AdminTestimonials.jsx` marks those rows **Legacy · name
unverified**. A moderator deciding whether to publish should not be
looking at a name that appears verified when it is not.

Backfilling them is a judgement call, not a migration: matching a
free-text name to a username and attaching it would assert a link that
may not hold. Leave them marked.

## Two sessions, not one

The staff console and the customer account area hold **separate** tokens
in `sessionStorage`:

| Audience | Keys | Context |
| --- | --- | --- |
| staff | `noir.admin.access` / `noir.admin.refresh` | `context/AdminAuthContext.jsx` |
| customer | `noir.customer.access` / `noir.customer.refresh` | `context/CustomerAuthContext.jsx` |

They can be alive in the same tab — a barber booking from their own
phone, or a shared tablet at the counter. One pair of keys meant signing
in as either clobbered the other.

A request says which audience it is acting for:

```js
// staff session (the default — every existing requiresAuth call)
api.get("/bookings/", { requiresAuth: true });

// customer session
api.get("/testimonials/testimonials/mine/", {
  requiresAuth: true,
  authScope: "customer",
});
```

`authScope` picks both the token to attach and the refresh token to
spend on a 401, and refresh collapsing is keyed by scope — a customer
401 is never retried with the staff refresh token.

## The staff check is still there

`AdminAuthContext` still probes `listBookings()` after sign-in to confirm
staff access, because `AccountSerializer` returns no `is_staff`. That is
unchanged, and it is why a non-staff account signing in at `/admin/login`
gets "This account does not have staff access" rather than a console
where every action 403s.

`CustomerAuthContext` has **no** such probe. Any registered account is a
valid customer, and `GET /api/accounts/me/` is what proves the token
still works.

## Registering does not return tokens

`POST /api/accounts/register/` returns the account, not a token pair. So
`signUp()` in `CustomerAuthContext` registers and *then* logs in — someone
creating an account to leave a review is not made to type their password
twice.

## Registering again with a fresh account

A customer who forgets their password has no recovery flow yet. They can
register a second account, but the review they already wrote stays
attached to the first one. Worth a follow-up, not worth blocking on.

## Translation

The storefront is translated (en / am / om); the booking flow, the
payment screens and the staff console are English. The account screens
and the review prompt sit on the storefront, so they are translated —
including the explanation of *why* a sign-in is being asked for, which is
the string that makes the prompt read as a reason rather than a wall.

`npm run check:i18n` fails the build if the catalogues drift apart.

## Related

- `api_endpoint.md` §1, §6 — the endpoints
- `docs/small-device-layout.md` — how the prompt is laid out on a phone
- `docs/language-support.md` — what is and is not translated
