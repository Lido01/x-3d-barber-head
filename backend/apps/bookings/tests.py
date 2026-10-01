from datetime import date, datetime, time, timedelta

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import StaffAccess
from apps.services.models import Service
from .models import Barber, Booking, build_booking_code
from .services import (
    Availability,
    get_availability_report,
    get_available_times,
    normalise_booking_code,
    normalise_phone,
    phone_matches,
)


class BookingApiTests(APITestCase):
    def setUp(self):
        self.booking_date = date.today() + timedelta(days=1)
        self.short_service = Service.objects.create(name="Trim", price="200.00", duration=30)
        self.medium_service = Service.objects.create(name="Cut", price="350.00", duration=45)
        self.long_service = Service.objects.create(name="Full Grooming", price="750.00", duration=90)
        self.inactive_service = Service.objects.create(
            name="Unavailable", price="100.00", duration=30, is_active=False
        )
        self.barber = Barber.objects.create(name="Test Barber")
        self.admin = get_user_model().objects.create_user(
            username="bookings-admin",
            password="test-password",
            is_staff=True,
        )
        # Staff access is granted through StaffAccess; `is_staff` alone
        # is not a way into the console. An administrator holds every
        # capability implicitly, which is what these tests need.
        StaffAccess.objects.create(
            user=self.admin,
            role=StaffAccess.Role.ADMIN,
        )
        self.client.force_authenticate(self.admin)

    def payload(self, service, start_time="10:00", booking_date=None, notes=""):
        return {
            "customer_name": "Sam Doe", "customer_phone": "+251900000000",
            "service": service.id, "booking_date": str(booking_date or self.booking_date),
            "start_time": start_time, "notes": notes,
        }

    # ------------------------------------------------------------------ create

    def test_post_calculates_end_times_for_different_service_durations(self):
        for service, start_time, expected_end in [
            (self.short_service, "09:00", "09:30:00"),
            (self.medium_service, "10:00", "10:45:00"),
            (self.long_service, "12:00", "13:30:00"),
        ]:
            response = self.client.post("/api/bookings/", self.payload(service, start_time), format="json")
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)
            self.assertEqual(response.data["end_time"], expected_end)

    def test_get_bookings_and_rejects_overlaps(self):
        created = self.client.post("/api/bookings/", self.payload(self.long_service, "10:00"), format="json")
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)

        overlap = self.client.post("/api/bookings/", self.payload(self.short_service, "10:30"), format="json")
        self.assertEqual(overlap.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("start_time", overlap.data)
        self.assertIn("Every barber is", overlap.data["start_time"][0])

        listing = self.client.get("/api/bookings/")
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        self.assertEqual(len(listing.data), 1)

    def test_inactive_service_cannot_be_booked(self):
        response = self.client.post("/api/bookings/", self.payload(self.inactive_service), format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("service", response.data)
        self.assertIn("Please choose another service", response.data["service"][0])

    def test_past_date_is_rejected(self):
        yesterday = date.today() - timedelta(days=1)
        response = self.client.post(
            "/api/bookings/",
            self.payload(self.medium_service, booking_date=yesterday),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("booking_date", response.data)

    def test_nonexistent_service_id_is_rejected(self):
        payload = self.payload(self.medium_service)
        payload["service"] = 99999
        response = self.client.post("/api/bookings/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("service", response.data)

    def test_invalid_time_format_is_rejected(self):
        payload = self.payload(self.medium_service, start_time="25:99")
        response = self.client.post("/api/bookings/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("start_time", response.data)

    def test_booking_after_closing_time_is_rejected(self):
        # 20:30 + 45 min = 21:15 > 21:00 closing.
        response = self.client.post(
            "/api/bookings/", self.payload(self.medium_service, start_time="20:30"), format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("start_time", response.data)

    # ------------------------------------------------------- retrieve / update

    def test_retrieve_booking(self):
        created = self.client.post(
            "/api/bookings/", self.payload(self.medium_service, notes="First booking"), format="json"
        )
        response = self.client.get(f"/api/bookings/{created.data['id']}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["service_name"], "Cut")
        self.assertIn("status", response.data)
        self.assertEqual(response.data["status"], "pending")

    def test_patch_reschedules_and_keeps_end_time_computed(self):
        created = self.client.post(
            "/api/bookings/", self.payload(self.medium_service, "10:00"), format="json"
        )
        booking_id = created.data["id"]

        response = self.client.patch(
            f"/api/bookings/{booking_id}/", {"start_time": "14:00"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["start_time"], "14:00:00")
        self.assertEqual(response.data["end_time"], "14:45:00")

    def test_put_reschedule_into_conflict_is_rejected(self):
        first = self.client.post("/api/bookings/", self.payload(self.medium_service, "10:00"), format="json")
        second = self.client.post("/api/bookings/", self.payload(self.short_service, "11:00"), format="json")

        # Try to move the second booking on top of the first (11:30 overlaps 10:00-10:45? no:
        # 11:30 does not overlap; use 10:30 which overlaps the 10:00-10:45 booking).
        payload = self.payload(self.short_service, "10:30")
        response = self.client.put(f"/api/bookings/{second.data['id']}/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already booked at 10:30", response.data["start_time"][0])
        self.assertTrue(Booking.objects.filter(pk=first.data["id"]).exists())

    def test_cancelled_booking_frees_its_slot(self):
        created = self.client.post("/api/bookings/", self.payload(self.medium_service, "10:00"), format="json")
        booking_id = created.data["id"]

        # While active, the slot is taken.
        times_before = get_available_times(booking_date=self.booking_date, service=self.medium_service)
        self.assertNotIn("10:00", times_before)

        cancelled = self.client.post(f"/api/bookings/{booking_id}/cancel/")
        self.assertEqual(cancelled.status_code, status.HTTP_200_OK)
        self.assertEqual(cancelled.data["status"], "cancelled")

        # After cancellation the slot is free again.
        times_after = get_available_times(booking_date=self.booking_date, service=self.medium_service)
        self.assertIn("10:00", times_after)

        response = self.client.get(
            f"/api/bookings/availability/?service={self.medium_service.id}&booking_date={self.booking_date}"
        )
        self.assertIn("10:00", response.data["available_times"])

        rebook = self.client.post("/api/bookings/", self.payload(self.short_service, "10:00"), format="json")
        self.assertEqual(rebook.status_code, status.HTTP_201_CREATED)

    def test_cancelled_bookings_do_not_block_new_bookings_at_same_slot(self):
        booking = Booking.objects.create(
            customer_name="Old", customer_phone="123", service=self.medium_service,
            booking_date=self.booking_date, start_time=time(9, 0), end_time=time(9, 45),
            status=Booking.Status.CANCELLED,
        )
        response = self.client.post("/api/bookings/", self.payload(self.long_service, "09:00"), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        booking.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.CANCELLED)

    def test_delete_removes_booking(self):
        created = self.client.post("/api/bookings/", self.payload(self.medium_service), format="json")
        response = self.client.delete(f"/api/bookings/{created.data['id']}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Booking.objects.filter(pk=created.data["id"]).exists())

    # ------------------------------------------------------------- availability

    def test_availability_hides_overlapping_slots_and_respects_duration(self):
        Booking.objects.create(
            customer_name="Existing", customer_phone="123", service=self.medium_service,
            barber=self.barber, booking_date=self.booking_date, start_time=time(10, 0), end_time=time(10, 45),
        )
        times = get_available_times(booking_date=self.booking_date, service=self.long_service)
        self.assertNotIn("09:30", times)
        self.assertNotIn("10:00", times)
        self.assertNotIn("10:30", times)
        self.assertIn("11:00", times)

        response = self.client.get(
            f"/api/bookings/availability/?service={self.long_service.id}&booking_date={self.booking_date}"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["available_times"], times)
        self.assertEqual(response.data["availability"]["status"], Availability.AVAILABLE)


class BookingCodeTests(APITestCase):
    """
    The customer-facing reference, BK-nnnn.

    The customer quotes this back to the shop, so the two interesting
    properties are that it is assigned on every booking - including ones
    created outside the API, by a management command or a test - and that
    it never changes afterwards.
    """

    def setUp(self):
        self.booking_date = date.today() + timedelta(days=1)
        self.service = Service.objects.create(name="Cut", price="350.00", duration=30)
        self.barber = Barber.objects.create(name="Dawit")

    def make(self, **overrides):
        defaults = {
            "customer_name": "Sam Doe",
            "customer_phone": "0911234567",
            "service": self.service,
            "barber": self.barber,
            "booking_date": self.booking_date,
            "start_time": time(10, 0),
            "end_time": time(10, 30),
        }
        defaults.update(overrides)

        return Booking.objects.create(**defaults)

    def test_a_booking_gets_a_code_on_insert(self):
        booking = self.make()

        self.assertEqual(booking.booking_code, build_booking_code(booking.pk))
        self.assertRegex(booking.booking_code, r"^BK-\d{4,}$")

        # And it is really in the row, not just on the instance.
        booking.refresh_from_db()
        self.assertTrue(booking.booking_code)

    def test_codes_are_unique(self):
        codes = {self.make().booking_code for _ in range(5)}

        self.assertEqual(len(codes), 5)

    def test_the_code_survives_a_reschedule_and_a_status_change(self):
        booking = self.make()
        code = booking.booking_code

        booking.booking_date = self.booking_date + timedelta(days=1)
        booking.start_time = time(15, 0)
        booking.end_time = time(15, 30)
        booking.save()

        booking.refresh_from_db()
        self.assertEqual(booking.booking_code, code)

        booking.status = Booking.Status.CONFIRMED
        booking.save(update_fields=["status", "updated_at"])
        booking.refresh_from_db()
        self.assertEqual(booking.booking_code, code)

    def test_the_code_is_read_only_over_the_api(self):
        booking = self.make()
        admin = get_user_model().objects.create_user(
            username="code-admin", password="test-password", is_staff=True,
        )
        StaffAccess.objects.create(user=admin, role=StaffAccess.Role.ADMIN)
        self.client.force_authenticate(admin)

        response = self.client.patch(
            f"/api/bookings/{booking.pk}/",
            {"booking_code": "BK-9999"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        booking.refresh_from_db()
        self.assertEqual(booking.booking_code, build_booking_code(booking.pk))

    def test_code_normalisation_accepts_what_a_person_types(self):
        for typed in ["BK-3274", "bk 3274", "bk3274", "#BK-3274", "3274", " BK-03274 "]:
            with self.subTest(typed=typed):
                self.assertEqual(normalise_booking_code(typed), "BK-3274")

        self.assertEqual(normalise_booking_code(""), "")
        self.assertEqual(normalise_booking_code("not a code"), "")

    def test_phone_normalisation_ignores_formatting_and_country_code(self):
        self.assertEqual(normalise_phone("0911234567"), "911234567")
        self.assertEqual(normalise_phone("+251 911 234 567"), "911234567")
        self.assertEqual(normalise_phone("0911-234-567"), "911234567")

        self.assertTrue(phone_matches("0911234567", "+251911234567"))
        self.assertTrue(phone_matches("0911234567", "911234567"))
        self.assertFalse(phone_matches("0911234567", "0911999999"))
        self.assertFalse(phone_matches("", "0911234567"))


class BookingLookupTests(APITestCase):
    """
    A customer checking on the bookings they made without an account.

    The booking flow is deliberately unauthenticated, so the booking code
    is the only reference they carry. It is short and guessable, so the
    phone number is the second half of the proof - and the two failures
    are answered identically so the endpoint cannot be used to confirm
    which codes exist.

    One code plus one phone number returns the whole history, not one row:
    a customer who wants to look over their bookings should not have to
    dig out a separate code for each one.
    """

    def setUp(self):
        self.booking_date = date.today() + timedelta(days=1)
        self.service = Service.objects.create(name="Cut", price="350.00", duration=30)
        self.barber = Barber.objects.create(name="Dawit")

        self.booking = Booking.objects.create(
            customer_name="Sam Doe",
            customer_phone="0911234567",
            service=self.service,
            barber=self.barber,
            booking_date=self.booking_date,
            start_time=time(10, 0),
            end_time=time(10, 30),
        )

    def lookup(self, code=None, phone=None):
        return self.client.post(
            "/api/bookings/lookup/",
            {
                "code": code if code is not None else self.booking.booking_code,
                "phone": phone if phone is not None else "0911234567",
            },
            format="json",
        )

    def rows(self, response):
        return [row["booking"] for row in response.data["bookings"]]

    def test_the_right_code_and_phone_returns_the_booking(self):
        response = self.lookup()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            self.rows(response)[0]["booking_code"], self.booking.booking_code,
        )
        self.assertEqual(self.rows(response)[0]["status"], "pending")
        self.assertIsNone(response.data["bookings"][0]["payment"])

    def test_the_code_that_was_used_is_echoed_back(self):
        # So the interface can say "you are looking at BK-0013" even when
        # the history is longer than one row.
        response = self.lookup()

        self.assertEqual(
            response.data["matched_code"], self.booking.booking_code,
        )

    def test_an_unpaid_booking_is_flagged_as_due(self):
        response = self.lookup()

        self.assertTrue(response.data["bookings"][0]["payment_due"])
        self.assertFalse(response.data["bookings"][0]["payment_rejected"])

    def test_a_wrong_phone_is_refused(self):
        response = self.lookup(phone="0911999999")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertNotIn("bookings", response.data)

    def test_an_unknown_code_is_answered_exactly_like_a_wrong_phone(self):
        unknown = self.lookup(code="BK-9999")
        wrong_phone = self.lookup(phone="0911999999")

        # Identical answers: the endpoint must not confirm which codes
        # exist, or the phone number stops being a second factor.
        self.assertEqual(unknown.status_code, wrong_phone.status_code)
        self.assertEqual(unknown.data["code"], wrong_phone.data["code"])

    def test_the_code_may_be_typed_in_any_format(self):
        response = self.lookup(code=str(self.booking.pk))

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_a_missing_field_says_which_one_is_needed(self):
        response = self.client.post(
            "/api/bookings/lookup/", {"code": self.booking.booking_code}, format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("phone", response.data)
        self.assertIn("booked with", response.data["phone"][0])

    def test_lookup_does_not_need_credentials(self):
        # No token is set on the client at all.
        self.assertEqual(self.lookup().status_code, status.HTTP_200_OK)

    def test_the_whole_history_comes_back_newest_first(self):
        later = Booking.objects.create(
            customer_name="Sam Doe", customer_phone="0911234567",
            service=self.service, barber=self.barber,
            booking_date=self.booking_date + timedelta(days=3),
            start_time=time(14, 0), end_time=time(14, 30),
        )

        response = self.lookup()

        codes = [row["booking_code"] for row in self.rows(response)]

        self.assertEqual(len(codes), 2)
        self.assertEqual(
            codes,
            [later.booking_code, self.booking.booking_code],
        )

    def test_another_customers_bookings_are_not_returned(self):
        Booking.objects.create(
            customer_name="Someone Else", customer_phone="0911999999",
            service=self.service, barber=self.barber,
            booking_date=self.booking_date, start_time=time(16, 0),
            end_time=time(16, 30),
        )

        response = self.lookup()

        names = {row["customer_name"] for row in self.rows(response)}

        self.assertEqual(names, {"Sam Doe"})

    def test_history_is_matched_across_phone_formats(self):
        """
        The number is typed today; the booking was written months ago in
        whatever format the person at the desk used. Those have to meet.
        """

        for spelling in ["+251911234567", "0911 234 567", "0911-234-567"]:
            with self.subTest(spelling=spelling):
                self.booking.customer_phone = spelling
                self.booking.save()

                response = self.lookup(phone="0911234567")

                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(len(self.rows(response)), 1)

                self.booking.customer_phone = "0911234567"
                self.booking.save()

    def test_the_totals_summarise_the_history(self):
        # A second booking with a payment attached, so all four figures
        # are exercised at once.
        paid = Booking.objects.create(
            customer_name="Sam Doe", customer_phone="0911234567",
            service=self.service, barber=self.barber,
            booking_date=self.booking_date - timedelta(days=7),
            start_time=time(11, 0), end_time=time(11, 30),
        )

        from apps.payments.models import Payment

        Payment.objects.create(
            booking=paid, amount="350.00", method="telebirr",
            transaction_reference="TIN0001", status="verified",
        )

        response = self.lookup()

        self.assertEqual(
            response.data["totals"],
            {
                "all": 2,
                "upcoming": 1,
                "awaiting_payment": 1,
                "awaiting_response": 0,
            },
        )

    def test_a_rejected_payment_is_marked_as_needing_a_call(self):
        from apps.payments.models import Payment

        payment = Payment.objects.create(
            booking=self.booking, amount="350.00", method="telebirr",
            transaction_reference="TIN0002", status="rejected",
            rejection_reason="No such transfer",
        )

        response = self.lookup()
        row = response.data["bookings"][0]

        # Not "nothing sent" - money arrived and could not be matched.
        # A fresh upload is not what this needs; a phone call is.
        self.assertFalse(row["payment_due"])
        self.assertTrue(row["payment_rejected"])
        self.assertEqual(row["payment"]["id"], payment.id)

    def test_a_payment_still_waiting_is_counted_as_awaiting_response(self):
        from apps.payments.models import Payment

        Payment.objects.create(
            booking=self.booking, amount="350.00", method="telebirr",
            transaction_reference="TIN0003", status="pending",
        )

        response = self.lookup()

        self.assertEqual(response.data["totals"]["awaiting_response"], 1)
        self.assertEqual(response.data["totals"]["awaiting_payment"], 0)

    def test_history_lookup_costs_a_fixed_number_of_queries(self):
        """
        One for the code, one for the history, one for the joined
        payments. Not one per booking, and not a scan in Python to
        compare phone numbers - which is what this replaced.
        """

        for index in range(6):
            Booking.objects.create(
                customer_name="Sam Doe", customer_phone="0911234567",
                service=self.service, barber=self.barber,
                booking_date=self.booking_date + timedelta(days=index + 1),
                start_time=time(9, 0), end_time=time(9, 30),
            )

        with self.assertNumQueries(2):
            self.lookup()

    def test_mine_requires_a_token(self):
        self.assertEqual(
            self.client.get("/api/bookings/mine/").status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_mine_returns_only_the_callers_own_bookings(self):
        customer = get_user_model().objects.create_user(
            username="lookup-customer", password="test-password",
        )
        other = get_user_model().objects.create_user(
            username="other-customer", password="test-password",
        )

        Booking.objects.create(
            customer_name="Sam Doe", customer_phone="0911234567", service=self.service,
            barber=self.barber, booking_date=self.booking_date,
            start_time=time(14, 0), end_time=time(14, 30), user=customer,
        )
        Booking.objects.create(
            customer_name="Someone Else", customer_phone="0911000000", service=self.service,
            barber=self.barber, booking_date=self.booking_date,
            start_time=time(16, 0), end_time=time(16, 30), user=other,
        )

        self.client.force_authenticate(customer)

        response = self.client.get("/api/bookings/mine/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["customer_name"], "Sam Doe")

    def test_a_signed_in_customers_booking_is_attached_to_them(self):
        customer = get_user_model().objects.create_user(
            username="attached-customer", password="test-password",
        )

        response = self.client.post(
            "/api/bookings/",
            {
                "customer_name": "Sam Doe",
                "customer_phone": "0911234567",
                "service": self.service.id,
                "booking_date": str(self.booking_date),
                "start_time": "12:00",
            },
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(customer).access_token}",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            Booking.objects.get(pk=response.data["id"]).user_id,
            customer.pk,
        )



class BookingMoneyStateTests(APITestCase):
    """
    What the console can tell about the money behind a booking.

    Staff confirm a walk-in who will pay at the counter, and a payment can
    be rejected while the appointment is held. Both leave a live
    appointment with nothing paid behind it, and a confirmation badge on
    its own makes that look finished. So the booking row carries the money
    state with it - and these tests exist because when it did not, the
    console asked for a field that was never sent and drew every booking as
    though nothing had been paid, with no error anywhere to say so.
    """

    def setUp(self):
        self.booking_date = date.today() + timedelta(days=1)
        self.service = Service.objects.create(name="Cut", price="350.00", duration=30)
        self.barber = Barber.objects.create(name="Dawit")

        self.admin = get_user_model().objects.create_user(
            username="money-admin", password="test-password", is_staff=True,
        )
        StaffAccess.objects.create(user=self.admin, role=StaffAccess.Role.ADMIN)
        self.client.force_authenticate(self.admin)

        self.booking = Booking.objects.create(
            customer_name="Sam Doe", customer_phone="0911234567",
            service=self.service, barber=self.barber,
            booking_date=self.booking_date,
            start_time=time(10, 0), end_time=time(10, 30),
        )

    def pay(self, booking, reference="TIN0001"):
        from apps.payments.models import Payment

        return Payment.objects.create(
            booking=booking, amount="350.00", method="telebirr",
            transaction_reference=reference,
        )

    def test_a_booking_row_says_whether_money_arrived(self):
        """
        The console's bookings screen reads the money state off the
        booking row.

        Before this field existed the console asked for `payment_status`,
        found it undefined, and drew every booking as though nothing had
        been paid - with no error anywhere, because an absent field looks
        exactly like no data.
        """

        from apps.payments.models import Payment

        response = self.client.get("/api/bookings/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data[0]["payment_status"])
        self.assertTrue(response.data[0]["payment_due"])

        Payment.objects.create(
            booking=self.booking,
            amount="350.00",
            method="telebirr",
            transaction_reference="TIN0001",
        )

        response = self.client.get("/api/bookings/")

        self.assertEqual(response.data[0]["payment_status"], "pending")
        # Money exists, so nothing is outstanding - the "unpaid" badge must
        # not claim otherwise.
        self.assertFalse(response.data[0]["payment_due"])

    def test_a_confirmed_booking_with_no_payment_is_still_due(self):
        """
        The case a confirmation badge would otherwise hide: staff confirm a
        walk-in who will pay at the counter, leaving a live appointment with
        nothing paid behind it.
        """

        self.client.post(f"/api/bookings/{self.booking.pk}/confirm/")

        response = self.client.get(f"/api/bookings/{self.booking.pk}/")

        self.assertEqual(response.data["status"], "confirmed")
        self.assertIsNone(response.data["payment_status"])
        self.assertTrue(response.data["payment_due"])

    def test_a_cancelled_booking_is_not_flagged_as_due(self):
        self.client.post(f"/api/bookings/{self.booking.pk}/cancel/")

        response = self.client.get(f"/api/bookings/{self.booking.pk}/")

        # Nothing to pay for, so nothing outstanding.
        self.assertFalse(response.data["payment_due"])

    def test_the_booking_list_joins_payments_rather_than_querying_per_row(self):
        """
        The money state is a join. A per-row lookup would be one extra
        query for every booking on the console's screen, and the console's
        screen is the whole shop.
        """

        from apps.payments.models import Payment

        for index in range(6):
            start = datetime.combine(self.booking_date, time(9, 0)) + timedelta(
                minutes=30 * index
            )

            booking = Booking.objects.create(
                customer_name=f"Customer {index}", customer_phone="0911111111",
                service=self.service, barber=self.barber,
                booking_date=self.booking_date,
                start_time=start.time(),
                end_time=(start + timedelta(minutes=30)).time(),
            )

            Payment.objects.create(
                booking=booking, amount="350.00", method="telebirr",
                transaction_reference=f"TIN{index}",
            )

        with self.assertNumQueries(1):
            self.client.get("/api/bookings/")


class AvailabilityReportTests(APITestCase):
    """
    "No times available" is not an answer.

    Each of these dates has nothing bookable for a different reason, and
    the customer is told which one - along with what to do about it.
    """

    def setUp(self):
        self.today = date.today()
        self.booking_date = self.today + timedelta(days=1)
        self.service = Service.objects.create(name="Cut", price="350.00", duration=30)
        self.barber = Barber.objects.create(name="Dawit")

    def report(self, **overrides):
        defaults = {
            "booking_date": self.booking_date,
            "service": self.service,
        }
        defaults.update(overrides)

        return get_availability_report(**defaults)

    def fill_the_day(self, barber=None):
        """Book every slot the day offers, so nothing is left."""

        return Booking.objects.create(
            customer_name="Existing", customer_phone="123",
            service=self.service,
            barber=barber or self.barber,
            booking_date=self.booking_date,
            start_time=time(9, 0),
            end_time=time(21, 0),
        )

    def test_a_full_day_is_reported_as_full_with_alternatives(self):
        self.fill_the_day()

        report = self.report()

        self.assertEqual(report["available_times"], [])
        self.assertEqual(
            report["availability"]["status"], Availability.FULLY_BOOKED,
        )
        self.assertIn("already taken", report["availability"]["message"])

        # And it says when there is something free instead.
        self.assertIsNotNone(report["availability"]["next_available"])
        self.assertEqual(
            report["availability"]["next_available"]["date"],
            str(self.booking_date + timedelta(days=1)),
        )

    def test_a_past_date_is_reported_as_a_past_date(self):
        report = self.report(booking_date=self.today - timedelta(days=1))

        self.assertEqual(report["available_times"], [])
        self.assertEqual(
            report["availability"]["status"], Availability.PAST_DATE,
        )
        self.assertIn("already passed", report["availability"]["message"])

    def test_no_barber_on_duty_is_its_own_case(self):
        Barber.objects.filter(pk=self.barber.pk).update(is_active=False)

        report = self.report()

        self.assertEqual(
            report["availability"]["status"], Availability.NO_BARBER_ON_DUTY,
        )
        self.assertIn("No barber is on duty", report["availability"]["message"])

    def test_a_service_longer_than_the_opening_hours_is_its_own_case(self):
        long_service = Service.objects.create(
            name="Day-long", price="900.00", duration=60 * 24,
        )

        report = self.report(service=long_service)

        self.assertEqual(
            report["availability"]["status"], Availability.SERVICE_TOO_LONG,
        )
        self.assertIn("longer than", report["availability"]["message"])

    def test_a_withdrawn_service_is_its_own_case(self):
        self.service.is_active = False

        report = self.report()

        self.assertEqual(
            report["availability"]["status"], Availability.SERVICE_UNAVAILABLE,
        )

    def test_an_inactive_named_barber_is_its_own_case(self):
        self.barber.is_active = False
        self.barber.save()

        report = self.report(barber=self.barber)

        self.assertEqual(
            report["availability"]["status"], Availability.BARBER_UNAVAILABLE,
        )

    def test_the_endpoint_answers_200_with_the_reason(self):
        self.fill_the_day()

        response = self.client.get(
            "/api/bookings/availability/"
            f"?service={self.service.id}&booking_date={self.booking_date}"
        )

        # Not a 400: a date with nothing on it is a real answer, and the
        # customer is told what to do about it.
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["available_times"], [])
        self.assertEqual(
            response.data["availability"]["status"],
            Availability.FULLY_BOOKED,
        )
        self.assertTrue(response.data["availability"]["message"])
        self.assertIsNotNone(response.data["availability"]["next_available"])

    def test_the_endpoint_names_the_service_and_the_date(self):
        response = self.client.get(
            "/api/bookings/availability/"
            f"?service={self.service.id}&booking_date={self.booking_date}"
            f"&barber={self.barber.pk}"
        )

        self.assertEqual(response.data["service"], "Cut")
        self.assertEqual(response.data["barber"], "Dawit")
        self.assertEqual(str(response.data["date"]), str(self.booking_date))

    def test_an_unknown_service_says_so_in_words(self):
        response = self.client.get(
            "/api/bookings/availability/?service=99999"
            f"&booking_date={self.booking_date}"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("not being offered", response.data["service"][0])

    def test_block_a_window_and_assert_what_the_refusal_says(self):
        """
        The refusal names the blocked barber and lists what is still
        open, so it arrives with somewhere to go.
        """

        Booking.objects.create(
            customer_name="Existing", customer_phone="123",
            service=self.service, barber=self.barber,
            booking_date=self.booking_date,
            start_time=time(10, 0), end_time=time(11, 30),
        )

        def refuse(payload):
            return self.client.post(
                "/api/bookings/",
                {
                    "customer_name": "Sam Doe", "customer_phone": "0911234567",
                    "service": self.service.id,
                    "booking_date": str(self.booking_date),
                    **payload,
                },
                format="json",
            )

        # Asking for Dawit by name: the refusal is about Dawit.
        named = refuse({"start_time": "10:30", "barber": self.barber.pk})

        self.assertEqual(named.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            named.data["availability"]["status"], Availability.SLOT_TAKEN,
        )
        self.assertIn("Dawit is", named.data["start_time"][0])

        suggested = named.data["availability"]["suggested_times"]
        self.assertTrue(suggested)
        self.assertNotIn("10:30", suggested)
        self.assertIn(suggested[0], named.data["start_time"][0])

        # Asking for whoever is free: the refusal is about the whole shop.
        anonymous = refuse({"start_time": "10:30"})

        self.assertEqual(
            anonymous.data["availability"]["status"], Availability.FULLY_BOOKED,
        )
        self.assertIn("Every barber is", anonymous.data["start_time"][0])
        self.assertTrue(anonymous.data["availability"]["suggested_times"])

    def test_availability_costs_a_fixed_number_of_queries(self):
        """
        The old implementation asked the database once per slot per
        barber. This pins the replacement to a constant, so a busy shop
        with a fortnight-long lookahead cannot turn one dropdown into
        hundreds of queries.
        """

        for index in range(2, 8):
            Barber.objects.create(name=f"Barber {index}")

        with self.assertNumQueries(2):
            # One for the barbers, one for the whole two-week window.
            get_availability_report(
                booking_date=self.booking_date,
                service=self.service,
            )


class BookingStatusTransitionTests(APITestCase):
    """
    The staff-only transitions behind the admin booking screen.

    Payment verification already confirms a booking, so these exist for
    the walk-in and cash cases where staff drive the status by hand.
    """

    def setUp(self):
        self.booking_date = date.today() + timedelta(days=1)
        self.service = Service.objects.create(name="Cut", price="350.00", duration=30)
        self.barber = Barber.objects.create(name="Test Barber")
        self.admin = get_user_model().objects.create_user(
            username="status-admin",
            password="test-password",
            is_staff=True,
        )
        StaffAccess.objects.create(
            user=self.admin,
            role=StaffAccess.Role.ADMIN,
        )
        self.customer = get_user_model().objects.create_user(
            username="status-customer",
            password="test-password",
        )
        self.client.force_authenticate(self.admin)

    def make_booking(self, status=Booking.Status.PENDING):
        return Booking.objects.create(
            customer_name="Sam Doe",
            customer_phone="123",
            service=self.service,
            barber=self.barber,
            booking_date=self.booking_date,
            start_time=time(10, 0),
            end_time=time(10, 30),
            status=status,
        )

    def test_confirm_moves_pending_to_confirmed(self):
        booking = self.make_booking()

        response = self.client.post(f"/api/bookings/{booking.id}/confirm/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "confirmed")
        booking.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.CONFIRMED)

    def test_confirm_refuses_a_cancelled_booking(self):
        booking = self.make_booking(status=Booking.Status.CANCELLED)

        response = self.client.post(f"/api/bookings/{booking.id}/confirm/")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("status", response.data)

    def test_complete_moves_confirmed_to_completed(self):
        booking = self.make_booking(status=Booking.Status.CONFIRMED)

        response = self.client.post(f"/api/bookings/{booking.id}/complete/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "completed")

    def test_complete_refuses_a_booking_that_was_never_confirmed(self):
        booking = self.make_booking(status=Booking.Status.PENDING)

        response = self.client.post(f"/api/bookings/{booking.id}/complete/")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("status", response.data)
        booking.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.PENDING)

    def test_complete_is_idempotent(self):
        booking = self.make_booking(status=Booking.Status.COMPLETED)

        response = self.client.post(f"/api/bookings/{booking.id}/complete/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "completed")

    def test_transitions_are_admin_only(self):
        booking = self.make_booking()

        self.client.force_authenticate(self.customer)

        for action in ("confirm", "complete", "cancel"):
            response = self.client.post(f"/api/bookings/{booking.id}/{action}/")
            self.assertEqual(
                response.status_code,
                status.HTTP_403_FORBIDDEN,
                msg=f"{action} should be admin only",
            )
