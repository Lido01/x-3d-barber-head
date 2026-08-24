from django.contrib.auth import get_user_model

from rest_framework import status
from rest_framework.test import APITestCase

from .models import AccountProfile


User = get_user_model()


REGISTER_URL = "/api/accounts/register/"
LOGIN_URL = "/api/accounts/login/"
REFRESH_URL = "/api/accounts/token/refresh/"
ME_URL = "/api/accounts/me/"
PASSWORD_CHANGE_URL = "/api/accounts/password/change/"

PASSWORD = "secure-pass-123"


def registration_payload(**overrides):
    payload = {
        "username": "sam",
        "email": "sam@example.com",
        "first_name": "Sam",
        "last_name": "Doe",
        "phone": "+251900000000",
        "password": PASSWORD,
        "password_confirm": PASSWORD,
    }
    payload.update(overrides)
    return payload


class RegistrationTests(APITestCase):
    def test_registers_user_and_creates_profile(self):
        response = self.client.post(
            REGISTER_URL, registration_payload(), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["username"], "sam")
        self.assertEqual(response.data["phone"], "+251900000000")
        self.assertTrue(
            AccountProfile.objects.filter(user__username="sam").exists()
        )

    def test_response_never_contains_password(self):
        response = self.client.post(
            REGISTER_URL, registration_payload(), format="json"
        )

        self.assertNotIn("password", response.data)
        self.assertNotIn("password_confirm", response.data)

    def test_phone_is_optional(self):
        payload = registration_payload()
        payload.pop("phone")

        response = self.client.post(REGISTER_URL, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["phone"], "")

    def test_rejects_mismatched_passwords(self):
        response = self.client.post(
            REGISTER_URL,
            registration_payload(password_confirm="different-pass-123"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password_confirm", response.data)

    def test_rejects_password_failing_django_validators(self):
        response = self.client.post(
            REGISTER_URL,
            registration_payload(password="12345678", password_confirm="12345678"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)

    def test_rejects_short_password(self):
        response = self.client.post(
            REGISTER_URL,
            registration_payload(password="short", password_confirm="short"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)

    def test_rejects_duplicate_username(self):
        self.client.post(REGISTER_URL, registration_payload(), format="json")

        response = self.client.post(
            REGISTER_URL,
            registration_payload(email="other@example.com"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("username", response.data)

    def test_rejects_duplicate_email_case_insensitively(self):
        self.client.post(REGISTER_URL, registration_payload(), format="json")

        response = self.client.post(
            REGISTER_URL,
            registration_payload(username="other", email="SAM@EXAMPLE.COM"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)

    def test_requires_username_email_and_password(self):
        response = self.client.post(REGISTER_URL, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        for field in ("username", "email", "password", "password_confirm"):
            self.assertIn(field, response.data)


class LoginTests(APITestCase):
    def setUp(self):
        self.client.post(REGISTER_URL, registration_payload(), format="json")

    def test_returns_tokens_and_account(self):
        response = self.client.post(
            LOGIN_URL, {"username": "sam", "password": PASSWORD}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["user"]["username"], "sam")
        self.assertEqual(response.data["user"]["phone"], "+251900000000")

    def test_rejects_wrong_password(self):
        response = self.client.post(
            LOGIN_URL, {"username": "sam", "password": "wrong-pass-123"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_rejects_unknown_user(self):
        response = self.client.post(
            LOGIN_URL, {"username": "ghost", "password": PASSWORD}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_requires_username_and_password(self):
        response = self.client.post(LOGIN_URL, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("username", response.data)
        self.assertIn("password", response.data)

    def test_access_token_authenticates_me_endpoint(self):
        login = self.client.post(
            LOGIN_URL, {"username": "sam", "password": PASSWORD}, format="json"
        )

        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {login.data['access']}"
        )
        response = self.client.get(ME_URL)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "sam")

    def test_refresh_token_returns_new_access_token(self):
        login = self.client.post(
            LOGIN_URL, {"username": "sam", "password": PASSWORD}, format="json"
        )

        response = self.client.post(
            REFRESH_URL, {"refresh": login.data["refresh"]}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)


class CurrentAccountTests(APITestCase):
    def setUp(self):
        self.client.post(REGISTER_URL, registration_payload(), format="json")
        self.user = User.objects.get(username="sam")

    def test_requires_authentication(self):
        response = self.client.get(ME_URL)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_user_can_read_account(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(ME_URL)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "sam")
        self.assertEqual(response.data["email"], "sam@example.com")
        self.assertEqual(response.data["phone"], "+251900000000")

    def test_can_update_name_and_phone(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(
            ME_URL,
            {"first_name": "Samuel", "phone": "+251911111111"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["first_name"], "Samuel")
        self.assertEqual(response.data["phone"], "+251911111111")

        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Samuel")
        self.assertEqual(self.user.profile.phone, "+251911111111")

    def test_username_is_read_only(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(
            ME_URL, {"username": "hacker"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "sam")

    def test_cannot_take_another_users_email(self):
        User.objects.create_user(
            username="alex", email="alex@example.com", password=PASSWORD
        )
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(
            ME_URL, {"email": "alex@example.com"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)

    def test_keeping_own_email_is_allowed(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(
            ME_URL, {"email": "sam@example.com"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_put_is_not_allowed(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.put(ME_URL, registration_payload(), format="json")

        self.assertEqual(
            response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED
        )


class ProfileSignalTests(APITestCase):
    def test_profile_is_created_for_users_made_outside_registration(self):
        user = User.objects.create_user(
            username="admin", email="admin@example.com", password=PASSWORD
        )

        self.assertTrue(
            AccountProfile.objects.filter(user=user).exists()
        )

    def test_me_endpoint_works_for_user_without_phone(self):
        user = User.objects.create_user(
            username="admin", email="admin@example.com", password=PASSWORD
        )
        self.client.force_authenticate(user=user)

        response = self.client.get(ME_URL)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["phone"], "")


class PasswordChangeTests(APITestCase):
    def setUp(self):
        self.client.post(REGISTER_URL, registration_payload(), format="json")
        self.user = User.objects.get(username="sam")

    def test_requires_authentication(self):
        response = self.client.post(PASSWORD_CHANGE_URL, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_changes_password(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            PASSWORD_CHANGE_URL,
            {
                "current_password": PASSWORD,
                "new_password": "another-pass-456",
                "new_password_confirm": "another-pass-456",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("another-pass-456"))

    def test_rejects_wrong_current_password(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            PASSWORD_CHANGE_URL,
            {
                "current_password": "wrong-pass-123",
                "new_password": "another-pass-456",
                "new_password_confirm": "another-pass-456",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("current_password", response.data)

    def test_rejects_mismatched_confirmation(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            PASSWORD_CHANGE_URL,
            {
                "current_password": PASSWORD,
                "new_password": "another-pass-456",
                "new_password_confirm": "different-pass-789",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("new_password_confirm", response.data)
