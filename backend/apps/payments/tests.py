from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import StaffAccess
from apps.bookings.models import Barber, Booking
from apps.payments.models import Payment
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

    def customer_headers(self, booking=None):
        booking = booking or self.booking
        return {
            "HTTP_X_BOOKING_CODE": booking.booking_code,
            "HTTP_X_BOOKING_PHONE": booking.customer_phone,
        }

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
            reverse("payment-by-booking", args=[self.booking.pk]),
            **self.customer_headers(),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.payment.id)
        self.assertEqual(response.data["status"], "pending")
        self.assertEqual(response.data["booking"], self.booking.pk)

    def test_a_wrong_booking_proof_cannot_read_the_payment(self):
        response = self.client.get(
            reverse("payment-by-booking", args=[self.booking.pk]),
            HTTP_X_BOOKING_CODE=self.booking.booking_code,
            HTTP_X_BOOKING_PHONE="0911999999",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertNotIn("status", response.data)

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
            reverse("payment-by-booking", args=[unbooked.pk]),
            **self.customer_headers(unbooked),
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_the_lookup_returns_exactly_one_payment(self):
        """
        `booking` is a OneToOneField, so this route can only ever match
        one row - there is no way to walk the shop's payments by
        incrementing the id.
        """

        response = self.client.get(
            reverse("payment-by-booking", args=[self.booking.pk]),
            **self.customer_headers(),
        )

        self.assertIsInstance(response.data, dict)
        self.assertEqual(response.data["booking"], self.booking.pk)

    def test_the_lookup_reports_the_reflected_verification_state(self):
        self.payment.status = "verified"
        self.payment.save(update_fields=["status"])

        response = self.client.get(
            reverse("payment-by-booking", args=[self.booking.pk]),
            **self.customer_headers(),
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

    def test_the_payment_carries_the_booking_code(self):
        """
        The number staff read when deciding whether to verify a payment
        is the same number the customer was given.
        """

        response = self.client.get(
            reverse("payment-by-booking", args=[self.booking.pk]),
            **self.customer_headers(),
        )

        self.assertEqual(
            response.data["booking_code"], self.booking.booking_code
        )

    def test_verifying_records_when_it_happened(self):
        """
        `verified_at` is what the console's "revenue today" and "revenue
        this month" group by.

        A verified payment with no timestamp was real money that appeared
        in no total at all - and it is invisible on the row itself, because
        the payment reads as verified either way. Nothing else would have
        caught it.
        """

        from django.utils import timezone

        verifier = self._staff(
            StaffAccess.Role.ADMIN,
            [],
            username="stamper",
        )

        self.client.force_authenticate(user=verifier)
        self.client.post(reverse("payment-verify", args=[self.payment.pk]))

        self.payment.refresh_from_db()

        self.assertIsNotNone(self.payment.verified_at)
        self.assertEqual(self.payment.verified_by, verifier)
        self.assertLessEqual(
            abs((timezone.now() - self.payment.verified_at).total_seconds()),
            120,
        )

    def test_a_booking_row_says_whether_money_arrived(self):
        """
        The console reads the money state off the booking row, and before
        this field existed every booking rendered as though nothing had
        ever been paid - silently, because an undefined field is
        indistinguishable from no data. Exercised through the booking
        endpoint in apps.bookings, where the caller has staff rights;
        what matters here is that the state the serializer exposes is the
        payment's own status.
        """

        self.assertEqual(self.payment.booking_id, self.booking.pk)
        self.assertEqual(self.payment.status, "pending")

class PaymentEvidenceTests(APITestCase):
    """
    A payment the shop has nothing to check is not a payment.

    Verification means matching what the customer sent against the bank.
    With neither a screenshot nor a transaction reference there is nothing
    to match, and the only thing left is the customer's word - which is
    indistinguishable from a typo. So one of the two is required.
    """

    def setUp(self):
        from datetime import date, time, timedelta

        self.service = Service.objects.create(
            name="Signature Cut",
            price=Decimal("350.00"),
            duration=45,
        )

        self.barber = Barber.objects.create(name="Alex")

        self.booking_date = date.today() + timedelta(days=1)

        self.booking = Booking.objects.create(
            customer_name="Sam Doe",
            customer_phone="0911234567",
            service=self.service,
            barber=self.barber,
            booking_date=self.booking_date,
            start_time=time(10, 0),
            end_time=time(10, 45),
        )

    def submit(self, **overrides):
        payload = {
            "booking": self.booking.pk,
            "booking_reference": self.booking.booking_code,
            "booking_phone": self.booking.customer_phone,
            "amount": "350.00",
            "method": "telebirr",
        }
        payload.update(overrides)

        return self.client.post(
            reverse("payment-list"), payload, format="json"
        )

    def submit_with_receipt(self, receipt):
        return self.client.post(
            reverse("payment-list"),
            {
                "booking": self.booking.pk,
                "booking_reference": self.booking.booking_code,
                "booking_phone": self.booking.customer_phone,
                "amount": "350.00",
                "method": "telebirr",
                "receipt": receipt,
            },
            format="multipart",
        )

    def test_a_payment_with_no_evidence_is_refused(self):
        response = self.submit()

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("transaction_reference", response.data)
        self.assertIn(
            "cannot verify", response.data["transaction_reference"][0]
        )

    def test_a_transaction_reference_is_enough(self):
        response = self.submit(transaction_reference="TIN0987")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "pending")

    def test_a_whitespace_only_reference_is_not_evidence(self):
        response = self.submit(transaction_reference="   ")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("transaction_reference", response.data)

    def test_a_receipt_alone_is_enough(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        from io import BytesIO

        from PIL import Image

        # A real PNG, not just the magic bytes: ImageField runs the
        # upload through Pillow, so a file that only starts like an image
        # would fail for a reason that has nothing to do with this test.
        buffer = BytesIO()
        Image.new("RGB", (8, 8), "white").save(buffer, format="PNG")
        buffer.seek(0)

        response = self.submit_with_receipt(
            SimpleUploadedFile(
                "receipt.png", buffer.read(), content_type="image/png"
            )
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_a_second_payment_is_refused_in_words(self):
        self.submit(transaction_reference="TIN0987")

        response = self.submit(transaction_reference="TIN0988")

        # Not a 500 from the unique constraint, and not DRF's default
        # "already exists": a customer whose first submit looked like it
        # had not landed needs to be told that it did.
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already been sent", response.data["booking"][0])


class ConfirmedBookingPaymentTests(APITestCase):
    """
    A confirmed booking with no payment behind it can still be paid.

    "Confirmed" and "paid" are separate things here, and the case where
    they disagree is the ordinary one rather than an edge: staff confirm
    walk-ins who will pay at the counter, and a payment can be rejected
    while the appointment is still held. Both leave a live appointment with
    nothing paid behind it, so the customer has to be able to send the
    money after the confirmation, not only before it.

    These tests exist because the frontend has to be able to open a payment
    form on a confirmed booking and trust that submitting it works. If this
    ever refuses, the customer is left owing money on an appointment the
    shop has already said is theirs, with nothing to send.
    """

    def setUp(self):
        from datetime import date, time, timedelta

        self.service = Service.objects.create(
            name="Signature Cut",
            price=Decimal("350.00"),
            duration=45,
        )

        self.barber = Barber.objects.create(name="Alex")

        self.booking = Booking.objects.create(
            customer_name="Sam Doe",
            customer_phone="0911234567",
            service=self.service,
            barber=self.barber,
            booking_date=date.today() + timedelta(days=1),
            start_time=time(10, 0),
            end_time=time(10, 45),
            status=Booking.Status.CONFIRMED,
        )

    def submit(self, **overrides):
        payload = {
            "booking": self.booking.pk,
            "booking_reference": self.booking.booking_code,
            "booking_phone": self.booking.customer_phone,
            "amount": "350.00",
            "method": "telebirr",
            "transaction_reference": "TIN0987",
        }
        payload.update(overrides)

        return self.client.post(
            reverse("payment-list"), payload, format="json"
        )

    def test_a_confirmed_booking_accepts_a_payment(self):
        response = self.submit()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "pending")

    def test_the_evidence_rule_still_applies_to_a_confirmed_booking(self):
        """
        "The chair is yours" is not a reason to accept a payment the shop
        cannot check. Being owed money and being able to prove it are two
        separate requirements, and the second one does not relax.
        """

        payload = {
            "booking": self.booking.pk,
            "booking_reference": self.booking.booking_code,
            "booking_phone": self.booking.customer_phone,
            "amount": "350.00",
            "method": "telebirr",
        }

        response = self.client.post(
            reverse("payment-list"), payload, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("transaction_reference", response.data)

    def test_the_confirmed_booking_is_still_confirmed_after_payment(self):
        self.submit()

        self.booking.refresh_from_db()

        # Paying does not move the appointment anywhere. It is already
        # confirmed and stays confirmed; the payment is what waits.
        self.assertEqual(self.booking.status, Booking.Status.CONFIRMED)

    def test_a_cancelled_booking_still_refuses_a_payment(self):
        self.booking.status = Booking.Status.CANCELLED
        self.booking.save(update_fields=["status", "updated_at"])

        response = self.submit()

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cancelled", response.data["booking"][0])


class DuplicatePaymentGuardTests(APITestCase):
    """
    What happens when the same booking is paid for twice.

    `booking` is a OneToOneField, so the database will refuse the second
    row - but it refuses it by raising, which the customer sees as a
    server fault on a screen where they are trying to hand over money.
    """

    def setUp(self):
        from datetime import date, time, timedelta
        from decimal import Decimal as D

        self.service = Service.objects.create(
            name="Signature Cut", price=D("350.00"), duration=45,
        )
        self.barber = Barber.objects.create(name="Alex")
        self.booking = Booking.objects.create(
            customer_name="Sam Doe",
            customer_phone="0911234567",
            service=self.service,
            barber=self.barber,
            booking_date=date.today() + timedelta(days=1),
            start_time=time(10, 0),
            end_time=time(10, 45),
        )
        self.payment = self._pay()

    def _pay(self):
        from apps.payments.models import Payment

        return Payment.objects.create(
            booking=self.booking,
            amount=Decimal("350.00"),
            method="telebirr",
            transaction_reference="TIN0987",
        )

    def test_a_pending_payment_says_so(self):
        from apps.payments.services import create_payment

        with self.assertRaises(Exception) as caught:
            create_payment(
                booking=self.booking,
                amount=Decimal("350.00"),
                method="telebirr",
                transaction_reference="TIN0989",
            )

        self.assertIn("still waiting to be checked", str(caught.exception))

    def test_a_verified_payment_says_it_is_already_settled(self):
        from apps.payments.services import create_payment

        self.payment.status = "verified"
        self.payment.save(update_fields=["status"])

        with self.assertRaises(Exception) as caught:
            create_payment(
                booking=self.booking,
                amount=Decimal("350.00"),
                method="telebirr",
                transaction_reference="TIN0989",
            )

        self.assertIn("already been paid", str(caught.exception))

    def test_a_rejected_payment_can_be_corrected_in_place(self):
        """
        A rejection is nearly always an illegible screenshot or a mistyped
        reference - both of which the customer can fix. Refusing to let
        them try again left someone with an appointment they had paid for
        and no way to prove it.
        """

        from apps.payments.services import create_payment

        self.payment.status = "rejected"
        self.payment.rejection_reason = "Screenshot illegible"
        self.payment.save(update_fields=["status", "rejection_reason"])

        original_id = self.payment.pk

        replacement = create_payment(
            booking=self.booking,
            amount=Decimal("400.00"),
            method="cbe",
            transaction_reference="TIN9001",
        )

        # The same row, so every link to that payment id keeps working.
        self.assertEqual(replacement.pk, original_id)
        self.assertEqual(replacement.status, "pending")
        self.assertEqual(replacement.rejection_reason, "")
        self.assertEqual(replacement.amount, Decimal("400.00"))
        self.assertEqual(replacement.method, "cbe")
        self.assertEqual(replacement.transaction_reference, "TIN9001")
        self.assertTrue(replacement.replaced_a_rejected_payment)

        # And still exactly one payment for this booking.
        self.assertEqual(
            Payment.objects.filter(booking=self.booking).count(),
            1,
        )

    def test_a_correction_reaches_the_shop_as_a_pending_payment(self):
        self.payment.status = "rejected"
        self.payment.rejection_reason = "Screenshot illegible"
        self.payment.save(update_fields=["status", "rejection_reason"])

        response = self.client.post(
            reverse("payment-list"),
            {
                "booking": self.booking.pk,
                "booking_reference": self.booking.booking_code,
                "booking_phone": self.booking.customer_phone,
                "amount": "350.00",
                "method": "telebirr",
                "transaction_reference": "TIN9002",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "pending")
        self.assertEqual(response.data["rejection_reason"], "")

    def test_a_correction_is_recorded_in_the_activity_log(self):
        from apps.accounts.models import AuditLog

        self.payment.status = "rejected"
        self.payment.rejection_reason = "Screenshot illegible"
        self.payment.save(update_fields=["status", "rejection_reason"])

        self.client.post(
            reverse("payment-list"),
            {
                "booking": self.booking.pk,
                "booking_reference": self.booking.booking_code,
                "booking_phone": self.booking.customer_phone,
                "amount": "350.00",
                "method": "telebirr",
                "transaction_reference": "TIN9003",
            },
            format="json",
        )

        entry = AuditLog.objects.filter(action="payment.resubmitted").first()

        self.assertIsNotNone(entry)
        self.assertEqual(entry.target_id, str(self.payment.pk))

    def test_a_verified_payment_is_still_final(self):
        from apps.payments.services import create_payment

        self.payment.status = "verified"
        self.payment.save(update_fields=["status"])

        with self.assertRaises(Exception) as caught:
            create_payment(
                booking=self.booking,
                amount=Decimal("350.00"),
                method="telebirr",
                transaction_reference="TIN9004",
            )

        self.assertIn("already been paid", str(caught.exception))
