from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import StaffAccess
from .models import Testimonial
from .services import resolve_reviewer_name


class TestimonialApiTests(APITestCase):
    """
    Reviews are tied to an account.

    The wall stays public (approved only), but writing a review needs a
    signed-in customer and the published name comes from that account,
    not from whatever the request body claims.
    """

    ENDPOINT = "/api/testimonials/testimonials/"

    def setUp(self):
        self.customer = get_user_model().objects.create_user(
            username="adonay",
            password="test-password",
            first_name="Adonay",
            last_name="Tesfaye",
        )

        self.other_customer = get_user_model().objects.create_user(
            username="saron",
            password="test-password",
            first_name="Saron",
        )

        self.staff = get_user_model().objects.create_user(
            username="testimonials-admin",
            password="test-password",
            is_staff=True,
        )
        StaffAccess.objects.create(
            user=self.staff,
            role=StaffAccess.Role.ADMIN,
        )

    def payload(self, **overrides):
        body = {
            "message": "Clean fade, exactly what I asked for.",
            "rating": 5,
        }

        body.update(overrides)

        return body

    # ------------------------------------------------------------------ read

    def test_public_wall_only_shows_approved(self):
        Testimonial.objects.create(
            user=self.customer,
            customer_name="Adonay Tesfaye",
            message="Approved one",
            status=Testimonial.Status.APPROVED,
        )
        Testimonial.objects.create(
            user=self.customer,
            customer_name="Adonay Tesfaye",
            message="Still pending",
            status=Testimonial.Status.PENDING,
        )

        response = self.client.get(self.ENDPOINT)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["message"], "Approved one")

    def test_signed_in_customer_still_only_sees_approved_on_the_wall(self):
        Testimonial.objects.create(
            user=self.customer,
            customer_name="Adonay Tesfaye",
            message="Still pending",
            status=Testimonial.Status.PENDING,
        )

        self.client.force_authenticate(self.customer)

        response = self.client.get(self.ENDPOINT)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)

    # ------------------------------------------------------------------ write

    def test_anonymous_cannot_submit_a_review(self):
        response = self.client.post(
            self.ENDPOINT,
            self.payload(customer_name="Anonymous"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(Testimonial.objects.exists())

    def test_customer_submit_is_attributed_to_the_account(self):
        self.client.force_authenticate(self.customer)

        response = self.client.post(
            self.ENDPOINT,
            # A forged name in the body must not win.
            self.payload(customer_name="Someone Else"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["user"], self.customer.id)
        self.assertEqual(response.data["customer_name"], "Adonay Tesfaye")
        self.assertEqual(response.data["status"], "pending")

        testimonial = Testimonial.objects.get()
        self.assertEqual(testimonial.user, self.customer)

    def test_submit_falls_back_to_username_when_the_account_has_no_name(self):
        nameless = get_user_model().objects.create_user(
            username="hiwot",
            password="test-password",
        )

        self.client.force_authenticate(nameless)

        response = self.client.post(
            self.ENDPOINT,
            self.payload(),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["customer_name"], "hiwot")

    def test_submit_rejects_a_blank_message(self):
        self.client.force_authenticate(self.customer)

        response = self.client.post(
            self.ENDPOINT,
            self.payload(message="   "),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("message", response.data)

    def test_submit_rejects_an_out_of_range_rating(self):
        self.client.force_authenticate(self.customer)

        response = self.client.post(
            self.ENDPOINT,
            self.payload(rating=6),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("rating", response.data)

    # ------------------------------------------------------------------ mine

    def test_mine_requires_a_token(self):
        response = self.client.get(f"{self.ENDPOINT}mine/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_mine_returns_every_state_but_only_the_callers_own(self):
        mine_pending = Testimonial.objects.create(
            user=self.customer,
            customer_name="Adonay Tesfaye",
            message="Mine, pending",
            status=Testimonial.Status.PENDING,
        )
        Testimonial.objects.create(
            user=self.customer,
            customer_name="Adonay Tesfaye",
            message="Mine, approved",
            status=Testimonial.Status.APPROVED,
        )
        Testimonial.objects.create(
            user=self.other_customer,
            customer_name="Saron",
            message="Someone else's",
            status=Testimonial.Status.APPROVED,
        )

        self.client.force_authenticate(self.customer)

        response = self.client.get(f"{self.ENDPOINT}mine/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        self.assertEqual(
            {row["id"] for row in response.data},
            {mine_pending.id, Testimonial.objects.filter(
                user=self.customer,
                status=Testimonial.Status.APPROVED,
            ).first().id},
        )

    # ------------------------------------------------------------------ moderate

    def test_customer_cannot_approve_or_delete(self):
        testimonial = Testimonial.objects.create(
            user=self.customer,
            customer_name="Adonay Tesfaye",
            message="Mine",
        )

        self.client.force_authenticate(self.customer)

        approve = self.client.post(f"{self.ENDPOINT}{testimonial.id}/approve/")
        destroy = self.client.delete(f"{self.ENDPOINT}{testimonial.id}/")

        self.assertEqual(approve.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(destroy.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Testimonial.objects.filter(pk=testimonial.pk).exists())

    def test_staff_can_approve_publish_and_delete(self):
        testimonial = Testimonial.objects.create(
            user=self.customer,
            customer_name="Adonay Tesfaye",
            message="Mine",
        )

        self.client.force_authenticate(self.staff)

        approve = self.client.post(f"{self.ENDPOINT}{testimonial.id}/approve/")
        self.assertEqual(approve.status_code, status.HTTP_200_OK)
        self.assertEqual(approve.data["status"], "approved")

        wall = self.client.get(self.ENDPOINT)
        self.assertEqual(len(wall.data), 1)

        destroy = self.client.delete(f"{self.ENDPOINT}{testimonial.id}/")
        self.assertEqual(destroy.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Testimonial.objects.filter(pk=testimonial.pk).exists())


class ResolveReviewerNameTests(APITestCase):
    def test_prefers_the_full_name_then_the_username(self):
        user_model = get_user_model()

        named = user_model.objects.create_user(
            username="liya",
            first_name="Liya",
            last_name="Bekele",
        )
        self.assertEqual(
            resolve_reviewer_name(named),
            "Liya Bekele",
        )

        first_only = user_model.objects.create_user(
            username="tsion",
            first_name="Tsion",
        )
        self.assertEqual(
            resolve_reviewer_name(first_only),
            "Tsion",
        )

        self.assertEqual(
            resolve_reviewer_name(None),
            "",
        )
