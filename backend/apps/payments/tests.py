from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import StaffAccess
from apps.bookings.models import Barber, Booking
from apps.services.models import Service


User = get_user_model()


class PaymentAccessTestCase(APITestCase):
    """
    Who may read and change payments.

    The split being pinned here is the one behind a confusing failure:
    the staff list 401s with "Authentication credentials were not
    provided" when the bearer token is missing, which reads like a
    permissions problem but is not one. These tests separate the three
    outcomes that look alike from the console:

        401  no credentials at all
        403  credentials present, capability absent
        200  allowed
    """

    def setUp(self):
        self.list_url = reverse("payment-list")
        self.by_booking_url = reverse("payment-by-booking", args=[1])

        self.service = Service.objects.create(
            name="Signature Cut",
            price=Decimal("350.00"),
            duration=45,
        )

        self.barber = Barber.objects.create(name="Alex")

        self.booking = Booking.objects.create(
            customer_name="Walk In",
            customer_phone="0900000000",
            service=self.service,
            barber=self.barber,
            booking_date="2026-08-29",
            start_time="10:00",
            end_time="10:45",
        )

        self.payment = self._create_payment(self.booking)

    def _create_payment(self, booking, amount="350.00"):
        from apps.payments.models import Payment

        return Payment.objects.create(
            booking=booking,
            amount=Decimal(amount),
            method="telebirr",
            transaction_reference="TX-001",
        )

    @staticmethod
    def _staff(role, permissions=(), username="staff", is_staff=True):
        user = User.objects.create_user(
            username=username,
            password="StrongPassword123!",
            is_staff=is_staff,
        )

        StaffAccess.objects.create(
            user=user,
            role=role,
            permissions=list(permissions),
        )

        return user

    # THE STAFF LIST

    def test_an_anonymous_caller_gets_401_not_403(self):
        """
        The list is staff-only, and a missing token is a 401.

        The distinction is the point: a 401 means the console forgot to
        send a token, a 403 means it sent one the account may not use.
        """
        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("credentials", str(response.data).lower())

    def test_a_customer_signed_in_gets_403(self):
        customer = User.objects.create_user(
            username="customer",
            password="StrongPassword123!",
        )

        self.client.force_authenticate(user=customer)
        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_a_receptionist_without_payments_view_gets_403(self):
        receptionist = self._staff(
            StaffAccess.Role.RECEPTION,
            ["bookings.view", "bookings.manage"],
            username="reception",
        )

        self.client.force_authenticate(user=receptionist)
        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_a_receptionist_with_payments_view_can_list(self):
        receptionist = self._staff(
            StaffAccess.Role.RECEPTION,
            ["payments.view"],
            username="reception",
        )

        self.client.force_authenticate(user=receptionist)
        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], self.payment.id)

    def test_an_administrator_can_list_without_anything_ticked(self):
        administrator = self._staff(
            StaffAccess.Role.ADMIN,
            [],
            username="administrator",
        )

        self.client.force_authenticate(user=administrator)
        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_a_disabled_team_member_gets_403(self):
        receptionist = self._staff(
            StaffAccess.Role.RECEPTION,
            ["payments.view"],
            username="reception",
        )

        StaffAccess.objects.filter(user=receptionist).update(is_active=False)

        # Re-read rather than reusing the object: passing a user
        # instance into a queryset caches the reverse one-to-one on it,
        # so `receptionist` would still be holding the row as it was
        # when it was enabled. A real request deserialises the user from
        # the token every time and never sees a stale relation.
        self.client.force_authenticate(
            user=User.objects.get(pk=receptionist.pk)
        )

        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_an_is_staff_flag_without_access_gets_403(self):
        """
        A bare `is_staff` is not a way in - the capability is what counts.
        """

        impostor = User.objects.create_user(
            username="impostor",
            password="StrongPassword123!",
            is_staff=True,
        )

        self.client.force_authenticate(user=impostor)
        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # THE CUSTOMER LOOKUP

    def test_a_customer_can_read_their_own_payment_by_booking(self):
        """
        The unauthenticated customer flow must keep working: someone who
        has just paid refreshes the result page in a new tab and needs to
        see whether their receipt was verified.
        """

        response = self.client.get(
            reverse("payment-by-booking", args=[self.booking.pk])
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.payment.id)
        self.assertEqual(response.data["status"], "pending")
        self.assertEqual(response.data["booking"], self.booking.pk)

    def test_a_booking_with_no_payment_returns_404(self):
        from datetime import date, time, timedelta

        unbooked = Booking.objects.create(
            customer_name="Not Paid",
            customer_phone="0911111111",
            service=self.service,
            barber=self.barber,
            booking_date=date.today() + timedelta(days=1),
            start_time=time(11, 0),
            end_time=time(11, 45),
        )

        response = self.client.get(
            reverse("payment-by-booking", args=[unbooked.pk])
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_the_lookup_returns_exactly_one_payment(self):
        """
        `booking` is a OneToOneField, so this route can only ever match
        one row - there is no way to walk the shop's payments by
        incrementing the id.
        """

        response = self.client.get(
            reverse("payment-by-booking", args=[self.booking.pk])
        )

        self.assertIsInstance(response.data, dict)
        self.assertEqual(response.data["booking"], self.booking.pk)

    def test_the_lookup_reports_the_reflected_verification_state(self):
        self.payment.status = "verified"
        self.payment.save(update_fields=["status"])

        response = self.client.get(
            reverse("payment-by-booking", args=[self.booking.pk])
        )

        self.assertEqual(response.data["status"], "verified")

    # VERIFY AND REJECT

    def test_verifying_requires_the_payments_verify_capability(self):
        viewer = self._staff(
            StaffAccess.Role.RECEPTION,
            ["payments.view"],
            username="viewer",
        )

        self.client.force_authenticate(user=viewer)
        response = self.client.post(
            reverse("payment-verify", args=[self.payment.pk])
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, "pending")

    def test_a_receptionist_with_payments_verify_can_verify(self):
        verifier = self._staff(
            StaffAccess.Role.RECEPTION,
            ["payments.verify"],
            username="verifier",
        )

        self.client.force_authenticate(user=verifier)
        response = self.client.post(
            reverse("payment-verify", args=[self.payment.pk])
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, "verified")
        self.assertEqual(self.payment.verified_by, verifier)

    def test_a_customer_cannot_verify(self):
        customer = User.objects.create_user(
            username="customer",
            password="StrongPassword123!",
        )

        self.client.force_authenticate(user=customer)
        response = self.client.post(
            reverse("payment-verify", args=[self.payment.pk])
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, "pending")

    def test_verifying_is_audited(self):
        from apps.accounts.models import AuditLog

        verifier = self._staff(
            StaffAccess.Role.RECEPTION,
            ["payments.verify"],
            username="verifier",
        )

        self.client.force_authenticate(user=verifier)
        self.client.post(reverse("payment-verify", args=[self.payment.pk]))

        entry = AuditLog.objects.filter(action="payment.verified").first()

        self.assertIsNotNone(entry)
        self.assertEqual(entry.actor, verifier)
        self.assertEqual(entry.target_id, str(self.payment.pk))

    def test_rejecting_records_the_reason(self):
        from apps.accounts.models import AuditLog

        administrator = self._staff(
            StaffAccess.Role.ADMIN,
            [],
            username="administrator",
        )

        self.client.force_authenticate(user=administrator)
        response = self.client.post(
            reverse("payment-reject", args=[self.payment.pk]),
            {"reason": "Receipt illegible"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["rejection_reason"], "Receipt illegible")

        entry = AuditLog.objects.filter(action="payment.rejected").first()

        self.assertIsNotNone(entry)
        self.assertEqual(entry.details["reason"], "Receipt illegible")
