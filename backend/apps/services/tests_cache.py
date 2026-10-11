"""
Tests for the conditional-GET layer.

The frontend caches every list it reads, so these tests exist to pin the
two properties that make that safe: a repeat read is genuinely free, and
a read that must be fresh is never answered from a cache.
"""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from apps.accounts.models import StaffAccess
from apps.bookings.models import Barber, Booking
from apps.gallery.models import GalleryPost
from apps.payments.models import Payment
from apps.services.models import HaircutStyle, Service
from apps.testimonials.models import Testimonial


class ConditionalGetTests(APITestCase):
    """A second read of an unchanged list costs no body."""

    def setUp(self):
        self.client = APIClient()

        self.service = Service.objects.create(
            name="Signature Cut",
            price=Decimal("350.00"),
            duration=45,
        )

    def test_list_response_carries_an_etag(self):
        response = self.client.get("/api/services/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("ETag", response)
        self.assertIn("Cache-Control", response)

    def test_matching_etag_is_answered_304_with_no_body(self):
        first = self.client.get("/api/services/")
        second = self.client.get(
            "/api/services/",
            HTTP_IF_NONE_MATCH=first["ETag"],
        )

        self.assertEqual(second.status_code, status.HTTP_304_NOT_MODIFIED)
        self.assertEqual(second.content, b"")

        # The validator has to survive, or the client cannot make the
        # next comparison.
        self.assertEqual(second["ETag"], first["ETag"])

    def test_a_write_changes_the_etag_so_the_next_read_is_not_304(self):
        first = self.client.get("/api/services/")

        Service.objects.create(
            name="Fade + Beard",
            price=Decimal("500.00"),
            duration=60,
        )

        second = self.client.get(
            "/api/services/",
            HTTP_IF_NONE_MATCH=first["ETag"],
        )

        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertNotEqual(second["ETag"], first["ETag"])
        self.assertEqual(len(second.data), 2)

    def test_a_stale_etag_is_ignored_rather_than_trusted(self):
        self.client.get("/api/services/")

        response = self.client.get(
            "/api/services/",
            HTTP_IF_NONE_MATCH='"not-the-current-validator"',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_weak_validator_matches_as_weak(self):
        """RFC 9110: W/"x" and "x" are the same representation here."""
        first = self.client.get("/api/services/")

        response = self.client.get(
            "/api/services/",
            HTTP_IF_NONE_MATCH=f"W/{first['ETag']}",
        )

        self.assertEqual(response.status_code, status.HTTP_304_NOT_MODIFIED)

    def test_star_matches_any_current_representation(self):
        self.client.get("/api/services/")

        response = self.client.get("/api/services/", HTTP_IF_NONE_MATCH="*")

        self.assertEqual(response.status_code, status.HTTP_304_NOT_MODIFIED)

    def test_a_list_of_validators_matches_on_any_member(self):
        first = self.client.get("/api/services/")

        response = self.client.get(
            "/api/services/",
            HTTP_IF_NONE_MATCH='"other", ' + first["ETag"],
        )

        self.assertEqual(response.status_code, status.HTTP_304_NOT_MODIFIED)

    def test_response_varies_on_authorization(self):
        """
        The same URL returns different bytes to staff and to the public.

        Without Vary, a shared cache has no way to tell those apart and
        could hand a public answer to a request that was refused.
        """
        response = self.client.get("/api/services/")

        self.assertIn("Authorization", response.get("Vary", ""))

    def test_cached_answer_is_never_served_without_revalidating(self):
        """
        `no-cache`, not a max-age.

        A max-age would let the booking form show a slot that was taken
        a second ago. Every read has to at least ask.
        """
        response = self.client.get("/api/services/")

        self.assertIn("no-cache", response["Cache-Control"])


class NeverCachedTests(APITestCase):
    """Reads that must never be answered from a cache."""

    def setUp(self):
        self.client = APIClient()
        self.admin = get_user_model().objects.create_user(
            username="cache-admin",
            password="test-password",
            is_staff=True,
        )
        StaffAccess.objects.create(
            user=self.admin,
            role=StaffAccess.Role.ADMIN,
        )

        self.service = Service.objects.create(
            name="Signature Cut",
            price=Decimal("350.00"),
            duration=45,
        )
        self.booking = Booking.objects.create(
            customer_name="Adonay",
            customer_phone="0911000000",
            service=self.service,
            booking_date="2026-08-29",
            start_time="09:00",
            end_time="09:45",
        )

    def test_payment_status_is_never_cached(self):
        """
        A customer watches this screen while staff work.

        A cached answer here is a payment that looks unverified after it
        has just been verified, which is the kind of bug that costs a
        customer their money.
        """
        Payment.objects.create(
            booking=self.booking,
            amount=Decimal("350.00"),
            method="telebirr",
        )

        response = self.client.get(
            f"/api/payments/payments/by-booking/{self.booking.id}/"
        )

        self.assertNotIn("ETag", response)

    def test_authenticated_reads_are_never_cached(self):
        """
        Staff ask for authoritative data.

        Skipped outright rather than merely marked private: these are
        exactly the responses whose bytes differ per account.
        """
        self.client.force_authenticate(self.admin)

        response = self.client.get("/api/services/")

        self.assertNotIn("ETag", response)

    def test_accounts_endpoints_are_never_cached(self):
        response = self.client.get("/api/accounts/customers/")

        self.assertNotIn("ETag", response)

    def test_a_refused_read_is_not_given_a_validator(self):
        """A refusal is not a cacheable representation of anything."""
        response = self.client.get("/api/accounts/customers/")

        self.assertIn(
            response.status_code,
            [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN],
        )
        self.assertNotIn("ETag", response)

    def test_a_write_is_never_given_a_validator(self):
        self.client.force_authenticate(self.admin)

        response = self.client.post(
            "/api/services/",
            {"name": "Fade", "price": "500.00", "duration": 60},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotIn("ETag", response)


class ListQueryCountTests(APITestCase):
    """
    The public lists are read on every page view, so their query count is
    part of the API's cost, not an implementation detail.
    """

    def setUp(self):
        self.client = APIClient()

    def test_service_list_does_not_query_once_per_service(self):
        """
        Regression guard for the styles N+1.

        The serializer used to call `service.styles.filter(...)`, which
        discards the prefetch and re-queried per row. Ten services meant
        eleven queries for what is two.
        """
        for index in range(10):
            service = Service.objects.create(
                name=f"Cut {index}",
                price=Decimal("300.00"),
                duration=30,
            )
            for style in range(3):
                HaircutStyle.objects.create(
                    service=service,
                    name=f"Style {style}",
                )

        with self.assertNumQueries(2):
            # 1 for the services, 1 for every style of every service.
            self.client.get("/api/services/")

    def test_inactive_styles_stay_hidden_on_the_public_list(self):
        """
        The prefetch and the serializer must agree on the filter.

        If they drift, the public list silently starts publishing styles
        a moderator retired.
        """
        service = Service.objects.create(
            name="Signature Cut",
            price=Decimal("350.00"),
            duration=45,
        )
        HaircutStyle.objects.create(service=service, name="Visible")
        HaircutStyle.objects.create(service=service, name="Retired", is_active=False)

        response = self.client.get("/api/services/")

        self.assertEqual(
            [style["name"] for style in response.data[0]["styles"]],
            ["Visible"],
        )

    def test_gallery_and_testimonial_lists_stay_single_queries(self):
        for index in range(5):
            GalleryPost.objects.create(
                title=f"Cut {index}",
                image="gallery/placeholder.png",
            )
            Testimonial.objects.create(
                customer_name=f"Customer {index}",
                message="Sharp work.",
                rating=5,
                status=Testimonial.Status.APPROVED,
            )

        with self.assertNumQueries(1):
            self.client.get("/api/gallery/gallery/")

        with self.assertNumQueries(1):
            self.client.get("/api/testimonials/testimonials/")

    def test_barber_list_stays_single_query(self):
        for index in range(5):
            Barber.objects.create(name=f"Barber {index}")

        with self.assertNumQueries(1):
            self.client.get("/api/barbers/")

    def test_dashboard_counts_do_not_cost_a_query_each(self):
        """
        The dashboard is opened between customers, on a phone.

        It used to issue roughly twenty COUNT queries - one per figure
        on the screen. The figures barely move, but the round trips were
        paid on every open, and each one is a separate query for a
        single number.
        """
        admin = get_user_model().objects.create_user(
            username="query-admin",
            password="test-password",
            is_staff=True,
        )
        StaffAccess.objects.create(
            user=admin,
            role=StaffAccess.Role.ADMIN,
        )
        self.client.force_authenticate(admin)

        with self.assertNumQueries(10):
            # 2 for today's rows and the next few days, 2 for the
            # booking figures, 2 for the payment figures, and one each
            # for users, services, gallery and reviews. Before the
            # consolidation this was 22.
            #
            # The "awaiting payment" figure was added to this budget
            # without raising it: it rides along in the existing booking
            # aggregate as a correlated Exists subquery, so it costs a
            # COUNT in SQL rather than a round trip.
            self.client.get("/api/accounts/reports/dashboard/")
