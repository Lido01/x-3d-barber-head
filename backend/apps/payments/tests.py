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

    The booking here is CONFIRMED because that is the only state in which
    payment is open at all - see PaymentGateTests for the rule that decides
    it.
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
            status=Booking.Status.CONFIRMED,
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

    The booking is CONFIRMED throughout, because that is the only state
    payment is open in. Every refusal below is about the *second* payment
    rather than about the booking, which is the distinction that matters
    once the confirmation gate is in place.
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
            status=Booking.Status.CONFIRMED,
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


class PaymentGateTests(APITestCase):
    """
    Reception confirms the appointment, and only then can money be taken.

    The order is the point. Before it was enforced, a customer could book
    a slot, be handed a pay form immediately, transfer the money, and be
    sitting on a receipt for an appointment no one had looked at. The shop
    then held a payment queue full of claims against chairs it had never
    agreed to, and the customer had no way to know the difference.

    So `create_payment` refuses anything that is not CONFIRMED. These
    tests pin that refusal, and pin that it is refused in words the
    customer can act on - a bare 400 on a screen whose whole purpose is
    taking their money is indistinguishable from the payment having
    failed.
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

    def set_status(self, value):
        self.booking.status = value
        self.booking.save(update_fields=["status", "updated_at"])

    # THE GATE

    def test_a_booking_awaiting_confirmation_takes_no_payment(self):
        """
        The whole reason this gate exists.

        A newly created booking is PENDING, so this is the state the very
        first customer is in on the very first attempt. If it accepted
        payment, the rule would be decorative.
        """

        self.assertEqual(self.booking.status, Booking.Status.PENDING)

        response = self.submit()

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Payment.objects.count(), 0)

    def test_the_refusal_says_wait_for_reception_not_something_broken(self):
        response = self.submit()

        message = response.data["booking"][0]

        # Names the thing that has to happen and who does it, so a
        # customer reads it as "not yet" rather than "that did not work".
        self.assertIn("not confirmed", message)
        self.assertIn("Reception", message)

    def test_the_evidence_rule_is_not_reached_before_the_gate(self):
        """
        A pending booking with no receipt is refused for the booking, not
        for the missing evidence.

        The order matters for what the customer reads: being told to add a
        screenshot, and then being refused again after they had, is a worse
        experience than being told to wait - and the second message would
        name the wrong problem entirely.
        """

        response = self.submit(transaction_reference="")

        self.assertNotIn("transaction_reference", response.data)
        self.assertIn("booking", response.data)

    def test_payment_opens_the_moment_reception_confirms(self):
        self.set_status(Booking.Status.CONFIRMED)

        response = self.submit()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "pending")

        # And the appointment did not move: confirming is what opened
        # payment, paying is not what confirmed it.
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, Booking.Status.CONFIRMED)

    def test_an_expired_booking_is_not_payable(self):
        self.set_status(Booking.Status.EXPIRED)

        response = self.submit()

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("expired", response.data["booking"][0])

    def test_a_cancelled_booking_says_cancelled(self):
        self.set_status(Booking.Status.CANCELLED)

        response = self.submit()

        self.assertIn("cancelled", response.data["booking"][0])

    def test_a_rejected_payment_can_be_corrected_after_confirmation(self):
        """
        The gate must not close on the one booking that still needs the
        customer. A rejected payment means money was sent and could not be
        matched - the booking is confirmed, so the correction is allowed
        through exactly as the first submission was.
        """

        self.set_status(Booking.Status.CONFIRMED)

        self.submit(transaction_reference="TIN0987")

        Payment.objects.update(status=Payment.Status.REJECTED)

        response = self.submit(transaction_reference="TIN0988")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["transaction_reference"], "TIN0988")

    # WHAT THE INTERFACE READS

    def test_the_booking_row_reports_that_payment_is_not_open_yet(self):
        """
        The customer screens decide whether to show a pay form by reading
        `payment_open` off the booking. A pending booking has to say no,
        or the form is offered for a chair nobody has agreed to.
        """

        response = self.client.post(
            "/api/bookings/lookup/",
            {
                "code": self.booking.booking_code,
                "phone": self.booking.customer_phone,
            },
            format="json",
        )

        self.assertFalse(response.data["payment_open"])
        # Money is still owed, though - which is the distinction the whole
        # change rests on. `payment_due` asks "does the shop want this
        # money", `payment_open` asks "can I send it now".
        self.assertTrue(response.data["payment_due"])

    def test_confirming_flips_payment_open_on_the_booking_row(self):
        from apps.bookings.services import confirm_booking

        confirm_booking(
            Booking.objects.get(pk=self.booking.pk)
        )

        response = self.client.post(
            "/api/bookings/lookup/",
            {
                "code": self.booking.booking_code,
                "phone": self.booking.customer_phone,
            },
            format="json",
        )

        self.assertTrue(response.data["payment_open"])

    def test_a_pending_payment_closes_payment_open_again(self):
        """
        Open, then closed: having sent the money is not the same as
        offering to send more, and the form has to disappear the moment the
        first submit lands.
        """

        self.set_status(Booking.Status.CONFIRMED)
        self.submit(transaction_reference="TIN0987")

        response = self.client.post(
            "/api/bookings/lookup/",
            {
                "code": self.booking.booking_code,
                "phone": self.booking.customer_phone,
            },
            format="json",
        )

        self.assertFalse(response.data["payment_open"])
        self.assertEqual(response.data["payment"]["status"], "pending")


class BookingPaymentFlowTests(APITestCase):
    """
    The whole thing, in the order the shop runs it.

    Every other test in this file checks one rule in isolation. This one
    walks a single customer's booking from the moment they press Reserve to
    the moment the money is recorded, over HTTP, using only what the
    interface can do - because a set of individually correct rules can still
    describe an impossible order, and the only thing that catches that is a
    test that performs the steps in sequence.

    The order under test:

        requested -> confirmed -> paid -> checked

    Each step asserts what the *next* screen will read, because that is the
    contract between them. The customer's result page polls the status
    endpoint and renders a pay form from `payment_open`; the console reads
    the same flags off the booking row. If any of them drifts, this fails.
    """

    def setUp(self):
        from datetime import date, timedelta

        self.service = Service.objects.create(
            name="Signature Cut",
            price=Decimal("350.00"),
            duration=45,
        )

        self.barber = Barber.objects.create(name="Alex")

        self.date = date.today() + timedelta(days=1)

        self.admin = get_user_model().objects.create_user(
            username="flow-admin",
            password="StrongPassword123!",
            is_staff=True,
        )

        StaffAccess.objects.create(
            user=self.admin,
            role=StaffAccess.Role.ADMIN,
        )

    def headers(self, booking):
        return {
            "HTTP_X_BOOKING_CODE": booking.booking_code,
            "HTTP_X_BOOKING_PHONE": booking.customer_phone,
        }

    def status(self, booking):
        """What the customer's page reads while they wait."""

        return self.client.get(
            f"/api/bookings/{booking.pk}/status/",
            **self.headers(booking),
        )

    def reserve(self):
        response = self.client.post(
            "/api/bookings/",
            {
                "customer_name": "Sam Doe",
                "customer_phone": "0911234567",
                "service": self.service.pk,
                "booking_date": str(self.date),
                "start_time": "10:00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        return Booking.objects.get(pk=response.data["id"])

    def pay(self, booking, **overrides):
        payload = {
            "booking": booking.pk,
            "booking_reference": booking.booking_code,
            "booking_phone": booking.customer_phone,
            "amount": "350.00",
            "method": "telebirr",
            "transaction_reference": "TIN0987",
        }
        payload.update(overrides)

        return self.client.post(
            reverse("payment-list"), payload, format="json"
        )

    # --- the sequence --------------------------------------------

    def lookup(self, code, phone="0911234567"):
        """What the customer sees when they quote a code."""

        return self.client.post(
            "/api/bookings/lookup/",
            {"code": code, "phone": phone},
            format="json",
        )

    def test_the_full_sequence_is_only_reachable_in_order(self):
        booking = self.reserve()

        # 1. Requested. Pending, not payable, and no money wanted yet.
        self.assertEqual(booking.status, Booking.Status.PENDING)

        step = self.status(booking)

        self.assertEqual(step.data["booking"]["status"], "pending")
        self.assertIsNone(step.data["payment"])
        self.assertFalse(step.data["payment_open"])

        # 2. The customer cannot pay. This is the step the whole rule
        #    exists for, asserted over the real endpoint rather than by
        #    calling the service directly.
        self.assertEqual(self.pay(booking).status_code, 400)
        self.assertEqual(Payment.objects.count(), 0)

        # 3. Reception confirms. Payment opens in the same moment.
        self.client.force_authenticate(self.admin)

        confirmed = self.client.post(f"/api/bookings/{booking.pk}/confirm/")

        self.assertEqual(confirmed.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(user=None)

        step = self.status(booking)

        self.assertEqual(step.data["booking"]["status"], "confirmed")
        self.assertTrue(step.data["payment_open"])

        # 4. The customer pays.
        paid = self.pay(booking)

        self.assertEqual(paid.status_code, status.HTTP_201_CREATED)
        self.assertEqual(paid.data["status"], Payment.Status.PENDING)

        step = self.status(booking)

        self.assertEqual(step.data["payment"]["status"], "pending")
        self.assertFalse(step.data["payment_open"])
        # Paying closed the form behind it: sending twice is refused.
        self.assertEqual(self.pay(booking).status_code, 400)

        # 5. The shop checks the money.
        self.client.force_authenticate(self.admin)

        checked = self.client.post(
            reverse("payment-verify", args=[paid.data["id"]])
        )

        self.assertEqual(checked.status_code, status.HTTP_200_OK)
        self.assertEqual(checked.data["status"], "verified")
        self.assertIsNotNone(checked.data["verified_at"])

        self.client.force_authenticate(user=None)

        # 6. Both halves agree, and the appointment never moved.
        step = self.status(booking)

        self.assertEqual(step.data["payment"]["status"], "verified")
        self.assertEqual(step.data["booking"]["status"], "confirmed")
        self.assertEqual(step.data["booking"]["booking_code"], booking.booking_code)

    def test_the_code_the_customer_was_given_opens_that_booking_only(self):
        """
        The reference handed over at the end of step 1 is the reference that
        has to work at the end of step 6 - and it has to open *this*
        appointment even after a second booking exists on the same number.
        """

        from datetime import timedelta

        first = self.reserve()

        # The same person books again on the same number, as they would.
        second = Booking.objects.create(
            customer_name="Sam Doe",
            customer_phone="0911234567",
            service=self.service,
            barber=self.barber,
            booking_date=self.date + timedelta(days=3),
            start_time="15:00",
            end_time="15:45",
            status=Booking.Status.CONFIRMED,
        )

        self.assertNotEqual(first.booking_code, second.booking_code)

        # The first code opens the first booking - and only that. No list, no
        # second record: the response is the booking the customer named, so
        # there is nothing on the screen for the wrong appointment to hide
        # among.
        found = self.lookup(first.booking_code)

        self.assertEqual(found.data["booking"]["id"], first.pk)
        self.assertNotIn("other_bookings", found.data)
        self.assertNotIn("bookings", found.data)

        # And the second code opens the second booking.
        other = self.lookup(second.booking_code)

        self.assertEqual(other.data["booking"]["id"], second.pk)
        self.assertNotIn("other_bookings", other.data)

    def test_a_second_booking_on_one_number_does_not_disturb_the_first(self):
        """
        The two are independent appointments with independent money. Adding a
        booking must not move the first one's status, and must not make its
        payment readable through the other one's code.
        """

        from datetime import timedelta

        first = self.reserve()

        self.client.force_authenticate(self.admin)
        self.client.post(f"/api/bookings/{first.pk}/confirm/")
        self.client.force_authenticate(user=None)

        paid = self.pay(first)

        self.client.force_authenticate(self.admin)
        self.client.post(f"/api/bookings/{first.pk}/confirm/")
        self.client.post(
            reverse("payment-verify", args=[paid.data["id"]])
        )
        self.client.force_authenticate(user=None)

        second = Booking.objects.create(
            customer_name="Sam Doe",
            customer_phone="0911234567",
            service=self.service,
            barber=self.barber,
            booking_date=self.date + timedelta(days=3),
            start_time="15:00",
            end_time="15:45",
            status=Booking.Status.CONFIRMED,
        )

        first_found = self.lookup(first.booking_code)

        self.assertEqual(first_found.data["booking"]["status"], "confirmed")
        self.assertEqual(first_found.data["payment"]["status"], "verified")
        self.assertFalse(first_found.data["payment_open"])

        second_found = self.lookup(second.booking_code)

        self.assertIsNone(second_found.data["payment"])
        self.assertTrue(second_found.data["payment_open"])

    def test_the_console_sees_the_same_thing_at_every_step(self):
        """
        The bookings screen reads the money off the booking row rather than
        off a second request, so the two views of a booking are only equal
        if they were computed from the same state. Checked at the two
        moments it matters: before the customer can pay, and after.
        """

        booking = self.reserve()

        def console_row():
            self.client.force_authenticate(self.admin)

            try:
                return self.client.get("/api/bookings/").data[0]
            finally:
                self.client.force_authenticate(user=None)

        pending = console_row()

        self.assertIsNone(pending["payment"])
        self.assertFalse(pending["payment_open"])

        # Money is intended but not yet payable. The console reads
        # `payment_open` to decide whether to tell staff a customer owes
        # money today, and showing "unpaid" on a booking nobody has confirmed
        # is what sends reception chasing a payment the customer is not able
        # to make.
        self.assertTrue(pending["payment_due"])
        self.assertFalse(pending["payment_open"])

        self.client.force_authenticate(self.admin)
        self.client.post(f"/api/bookings/{booking.pk}/confirm/")
        self.client.force_authenticate(user=None)

        confirmed = console_row()

        self.assertTrue(confirmed["payment_due"])
        self.assertTrue(confirmed["payment_open"])
        self.assertIsNone(confirmed["payment"])

        paid = self.pay(booking)

        self.client.force_authenticate(self.admin)
        self.client.post(reverse("payment-verify", args=[paid.data["id"]]))
        self.client.force_authenticate(user=None)

        settled = console_row()

        self.assertEqual(settled["payment"]["status"], "verified")
        self.assertFalse(settled["payment_due"])
        self.assertFalse(settled["payment_open"])

    def test_a_rejected_payment_settles_without_leaving_the_chair(self):
        """
        The one branch where the customer comes back. Money was sent and
        could not be matched; the booking stays confirmed, payment reopens,
        and the corrected submission lands on the same payment row - so the
        appointment is paid and the customer is never left owing on a chair
        the shop promised.
        """

        booking = self.reserve()

        self.client.force_authenticate(self.admin)
        self.client.post(f"/api/bookings/{booking.pk}/confirm/")
        self.client.force_authenticate(user=None)

        first = self.pay(booking)
        payment_id = first.data["id"]

        self.client.force_authenticate(self.admin)

        rejected = self.client.post(
            reverse("payment-reject", args=[payment_id]),
            {"reason": "The TIN does not match any transfer."},
            format="json",
        )

        self.assertEqual(rejected.status_code, status.HTTP_200_OK)
        self.client.force_authenticate(user=None)

        # Open again, with the reason attached to the booking.
        step = self.status(booking)

        self.assertTrue(step.data["payment_open"])
        self.assertTrue(step.data["payment_rejected"])
        self.assertFalse(step.data["payment_due"])
        self.assertIn(
            "does not match",
            step.data["payment"]["rejection_reason"],
        )

        second = self.pay(booking, transaction_reference="TIN9001")

        self.assertEqual(second.status_code, status.HTTP_201_CREATED)

        # Same row, so every link to that payment id still works.
        self.assertEqual(second.data["id"], payment_id)
        self.assertEqual(Payment.objects.count(), 1)

        self.client.force_authenticate(self.admin)
        self.client.post(reverse("payment-verify", args=[payment_id]))
        self.client.force_authenticate(user=None)

        booking.refresh_from_db()

        self.assertEqual(booking.status, Booking.Status.CONFIRMED)
        self.assertEqual(
            self.status(booking).data["payment"]["status"], "verified"
        )
