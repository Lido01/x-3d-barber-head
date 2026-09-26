from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Service


class ServiceApiTests(APITestCase):
    def setUp(self):
        self.active_service = Service.objects.create(
            name="Signature Cut",
            description="A premium haircut.",
            price=Decimal("350.00"),
            duration=45,
        )
        self.inactive_service = Service.objects.create(
            name="Retired Service",
            price=Decimal("100.00"),
            duration=20,
            is_active=False,
        )
        self.admin = get_user_model().objects.create_user(
            username="services-admin",
            password="test-password",
            is_staff=True,
        )
        self.client.force_authenticate(self.admin)

    def test_list_only_returns_active_services(self):
        self.client.force_authenticate(user=None)
        response = self.client.get("/api/services/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in response.data], [self.active_service.id])

    def test_staff_list_includes_inactive_services(self):
        response = self.client.get("/api/services/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn(self.inactive_service.id, [item["id"] for item in response.data])

    def test_inactive_service_is_hidden_but_can_be_reactivated(self):
        detail_response = self.client.get(f"/api/services/{self.inactive_service.id}/")
        self.assertEqual(detail_response.status_code, status.HTTP_404_NOT_FOUND)

        update_response = self.client.patch(
            f"/api/services/{self.inactive_service.id}/",
            {"is_active": True},
            format="json",
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertTrue(update_response.data["is_active"])

    def test_create_update_and_delete_service(self):
        create_response = self.client.post(
            "/api/services/",
            {"name": "Fade + Beard", "price": "500.00", "duration": 60},
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

        service_id = create_response.data["id"]
        update_response = self.client.patch(
            f"/api/services/{service_id}/",
            {"duration": 75},
            format="json",
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(update_response.data["duration"], 75)

        delete_response = self.client.delete(f"/api/services/{service_id}/")
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Service.objects.filter(pk=service_id).exists())

    def test_rejects_invalid_price_and_duration(self):
        response = self.client.post(
            "/api/services/",
            {"name": "Invalid", "price": "-1.00", "duration": 0},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("price", response.data)
        self.assertIn("duration", response.data)
