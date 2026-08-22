from rest_framework import status
from rest_framework.test import APITestCase

from .models import AccountProfile


class AccountApiTests(APITestCase):
    def test_registers_user_and_creates_profile(self):
        response = self.client.post(
            "/api/accounts/register/",
            {
                "username": "sam", "email": "sam@example.com", "first_name": "Sam",
                "phone": "+251900000000", "password": "secure-pass-123", "password_confirm": "secure-pass-123",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["username"], "sam")
        self.assertTrue(AccountProfile.objects.filter(user__username="sam").exists())

    def test_authenticated_user_can_read_account(self):
        registration = self.client.post(
            "/api/accounts/register/",
            {
                "username": "alex", "email": "alex@example.com",
                "password": "secure-pass-123", "password_confirm": "secure-pass-123",
            },
            format="json",
        )
        profile = AccountProfile.objects.get(user__username="alex")
        self.client.force_authenticate(user=profile.user)

        response = self.client.get("/api/accounts/me/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "alex")
