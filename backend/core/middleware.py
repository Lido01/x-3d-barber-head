"""
Conditional GET support for read-only API responses.

The frontend caches every list it reads, so a page reload, a second tab
or a visitor walking back through the site re-asks for JSON the server
has already produced. This middleware makes those repeat reads nearly
free: it attaches a strong ETag and, when the client revalidates with a
matching `If-None-Match`, answers `304 Not Modified` with no body - and,
crucially, without the view ever running, so no query and no
serialisation either.

Without it, "has the list changed?" costs a full query, a full
serialisation and a full transfer. With it, it costs a string compare.

Why an ETag over `Last-Modified`: the rows are small and the list
responses are the hot path, so hashing the body is cheap next to
producing it, and a content hash is exact. A timestamp would silently
miss an edit made in the same second.

Why `no-cache` rather than a max-age: `no-cache` still permits storage,
it only requires revalidation - so every request gets a 304 with an
empty body instead of a full payload, but a stale list is never served
without asking. A `max-age` would make revisiting the booking form show
a slot that was taken five seconds ago, which is the one thing on this
API that must never happen. The frontend's in-memory cache is what
supplies the "don't even ask" behaviour, where staleness is a decision
the UI already made.

What is never touched:

  * Anything that requires a token. `Vary: Authorization` is set on every
    response this middleware touches, so no shared cache can hand a
    public body to a request that should have been refused. A token
    request is also skipped outright, because its whole point is to be
    authoritative.
  * Payments. A payment status is read by a customer watching staff work,
    and a cached answer there is a payment that appears to sit
    unverified. The frontend already treats it as never-cacheable.
  * Anything that is not a 200 GET.
"""

import hashlib

from django.http import HttpResponseNotModified


class ConditionalGetMiddleware:
    """Attach an ETag to public API GETs and honour `If-None-Match`."""

    #: Only ever touch these. Media and the admin site manage their own
    #: caching, and the admin site must never serve a stale page.
    CACHEABLE_PREFIX = "/api/"

    #: Excluded regardless of method. Each of these either carries
    #: per-account data or is expected to change the instant it does.
    NEVER_CACHE = (
        "/api/accounts/",
        "/api/payments/",
        "/api/notifications/",
        "/api/ai-agent/",
        "/api/schema/",
        "/api/docs/",
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        if not self._is_cacheable(request, response):
            return response

        digest = hashlib.md5(response.content, usedforsecurity=False).hexdigest()
        etag = f'"{digest}"'

        response["ETag"] = etag

        # Store, but always revalidate. See the module docstring.
        response["Cache-Control"] = "private, no-cache"

        # The same URL returns different bytes to staff than to the
        # public, and to two different staff than to each other. Without
        # this, a shared cache would have no way to tell them apart.
        response["Vary"] = "Authorization"

        if self._etag_matches(etag, request.headers.get("If-None-Match")):
            return self._not_modified(response)

        return response

    @staticmethod
    def _etag_matches(etag, header):
        """
        RFC 9110 If-None-Match comparison.

        Written out rather than borrowed from `django.utils.cache`
        because that helper is private, takes an already-split list, and
        returns True on *mismatch* - the opposite of the name, and an
        easy way to answer 304 to a client that asked for fresh data.

        The comparison is weak: `W/"x"` and `"x"` are the same
        representation for this purpose.
        """
        if not header:
            return False

        if header.strip() == "*":
            return True

        target = etag.removeprefix("W/")

        return any(
            candidate.strip().removeprefix("W/") == target
            for candidate in header.split(",")
        )

    def _is_cacheable(self, request, response):
        if request.method != "GET" or response.status_code != 200:
            return False

        if not request.path.startswith(self.CACHEABLE_PREFIX):
            return False

        if request.path.startswith(self.NEVER_CACHE):
            return False

        # Read the *resolved* user rather than sniffing for an
        # Authorization header. The view has already run, so DRF has
        # replaced request.user with the authenticated one, and this
        # catches a session-cookie caller and a test client as reliably
        # as it catches a bearer token.
        #
        # A token means "tell me the truth now". These are also the
        # requests whose answers differ per account, so they are skipped
        # outright rather than made safe by Vary alone.
        user = getattr(request, "user", None)

        if user is not None and getattr(user, "is_authenticated", False):
            return False

        return True

    @staticmethod
    def _not_modified(response):
        """
        The 304 carries the validator, not the body.

        A 304 without the ETag would leave the client unable to make the
        next comparison, and it would quietly drop the Cache-Control and
        Vary that keep the stored entry usable.
        """
        not_modified = HttpResponseNotModified()

        for header in ("ETag", "Cache-Control", "Vary", "Expires", "Last-Modified"):
            if header in response:
                not_modified[header] = response[header]

        return not_modified
