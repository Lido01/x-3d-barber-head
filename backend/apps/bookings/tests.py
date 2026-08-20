from datetime import date, time, timedelta

from rest_framework import status
from rest_framework.test import APITestCase

from apps.services.models import Service
from .models import Booking
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

    def payload(self, service, start_time="10:00"):
        return {
            "customer_name": "Sam Doe", "customer_phone": "+251900000000",
            "service": service.id, "booking_date": str(self.booking_date), "start_time": start_time,
        }

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

        listing = self.client.get("/api/bookings/")
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        self.assertEqual(len(listing.data), 1)

    def test_inactive_service_cannot_be_booked(self):
        response = self.client.post("/api/bookings/", self.payload(self.inactive_service), format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("service", response.data)

    def test_availability_hides_overlapping_slots_and_respects_duration(self):
        Booking.objects.create(
            customer_name="Existing", customer_phone="123", service=self.medium_service,
            booking_date=self.booking_date, start_time=time(10, 0), end_time=time(10, 45),
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
