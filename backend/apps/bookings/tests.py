from datetime import date, time, timedelta

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import StaffAccess
from apps.services.models import Service
from .models import Barber, Booking
from .services import get_available_times


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
        self.assertEqual(overlap.data["start_time"][0], "No barber is available during this time.")

        listing = self.client.get("/api/bookings/")
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        self.assertEqual(len(listing.data), 1)

    def test_inactive_service_cannot_be_booked(self):
        response = self.client.post("/api/bookings/", self.payload(self.inactive_service), format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("service", response.data)
        self.assertEqual(response.data["service"][0], "This service is not available.")

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
        self.assertEqual(response.data["start_time"][0], "This barber is already booked during this time.")
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
