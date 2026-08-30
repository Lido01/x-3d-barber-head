from django.contrib.auth import get_user_model
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APITestCase

from .models import AccountProfile


User = get_user_model()


class AccountsAPITestCase(APITestCase):
    """
    Tests for the accounts API.
    These tests verify:
        - User registration
        - Password hashing
        - Password confirmation
        - Profile creation
        - Account retrieval
        - Authentication requirements
        - Invalid registration handling
    """

    def setUp(self):
        """
        Runs before every test.
        """

        self.register_url = reverse("register")
        self.account_url = reverse("account-me")

        self.user_data = {
            "username": "testuser",
            "email": "test@example.com",
            "first_name": "Test",
            "last_name": "User",
            "phone": "0912345678",
            "password": "StrongPassword123!",
            "password_confirm": "StrongPassword123!",
        }

  
    # REGISTRATION
  

    def test_user_can_register(self):
        """
        A customer should be able to create an account.
        """

        response = self.client.post(
            self.register_url,
            self.user_data,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

        self.assertTrue(
            User.objects.filter(
                username="testuser"
            ).exists()
        )

        user = User.objects.get(
            username="testuser"
        )

        self.assertEqual(
            user.email,
            "test@example.com",
        )

        self.assertEqual(
            user.first_name,
            "Test",
        )

        self.assertEqual(
            user.last_name,
            "User",
        )

  
    # PASSWORD
  

    def test_password_is_hashed(self):
        """
        Password must never be stored as plain text.
        """

        self.client.post(
            self.register_url,
            self.user_data,
            format="json",
        )

        user = User.objects.get(
            username="testuser"
        )

        self.assertNotEqual(
            user.password,
            self.user_data["password"],
        )

        self.assertTrue(
            user.check_password(
                self.user_data["password"]
            )
        )

  
    # PROFILE
  

    def test_account_profile_is_created(self):
        """
        Registration should create the user's AccountProfile
        and store the phone number there.
        """

        self.client.post(
            self.register_url,
            self.user_data,
            format="json",
        )

        user = User.objects.get(
            username="testuser"
        )

        profile = AccountProfile.objects.get(
            user=user
        )

        self.assertEqual(
            profile.phone,
            "0912345678",
        )

    
    # # PASSWORD CONFIRMATION
    

    def test_registration_fails_when_passwords_do_not_match(self):
        """
        Registration must fail when password confirmation
        does not match the password.
        """

        data = self.user_data.copy()

        data["password_confirm"] = (
            "DifferentPassword123!"
        )

        response = self.client.post(
            self.register_url,
            data,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertIn(
            "password_confirm",
            response.data,
        )

        self.assertFalse(
            User.objects.filter(
                username="testuser"
            ).exists()
        )
        
    # REQUIRED EMAIL
    
    def test_registration_requires_email(self):
        """
        Email is required during registration.
        """

        data = self.user_data.copy()

        data.pop("email")

        response = self.client.post(
            self.register_url,
            data,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertIn(
            "email",
            response.data,
        )

    #  DUPLICATE USERNAME

    def test_duplicate_username_is_rejected(self):
        """
        A username should not be registered twice.
        """

        first_response = self.client.post(
            self.register_url,
            self.user_data,
            format="json",
        )

        self.assertEqual(
            first_response.status_code,
            status.HTTP_201_CREATED,
        )

        second_data = self.user_data.copy()

        second_data["email"] = (
            "another@example.com"
        )

        second_response = self.client.post(
            self.register_url,
            second_data,
            format="json",
        )

        self.assertEqual(
            second_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    #  OPTIONAL PHONE

    def test_registration_can_work_without_phone(self):
        """
        Phone is optional according to RegistrationSerializer.
        """

        data = self.user_data.copy()

        data.pop("phone")

        response = self.client.post(
            self.register_url,
            data,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

        user = User.objects.get(
            username="testuser"
        )

        profile = AccountProfile.objects.get(
            user=user
        )

        self.assertEqual(
            profile.phone,
            "",
        )

    # ACCOUNT ENDPOINT AUTHENTICATION

    def test_account_endpoint_requires_authentication(self):
        """
        An unauthenticated user should not be able to access
        the protected account endpoint.
        """

        response = self.client.get(
            self.account_url
        )

        self.assertIn(
            response.status_code,
            [
                status.HTTP_401_UNAUTHORIZED,
                status.HTTP_403_FORBIDDEN,
            ],
        )

    # ACCOUNT ENDPOINT

    # def test_authenticated_user_can_access_account(self):
    #     """
    #     An authenticated user should be able to access
    #     their account information.
    #     """

    #     user = User.objects.create_user(
    #         username="existinguser",
    #         email="existing@example.com",
    #         password="StrongPassword123!",
    #         first_name="Existing",
    #         last_name="User",
    #     )

    #     AccountProfile.objects.create(
    #         user=user,
    #         phone="0911111111",
    #     )

    #     self.client.force_authenticate(
    #         user=user
    #     )

    #     response = self.client.get(
    #         self.account_url
    #     )

    #     self.assertEqual(
    #         response.status_code,
    #         status.HTTP_200_OK,
    #     )

    #     self.assertEqual(
    #         response.data["username"],
    #         "existinguser",
    #     )

    #     self.assertEqual(
    #         response.data["email"],
    #         "existing@example.com",
    #     )

    #     self.assertEqual(
    #         response.data["phone"],
    #         "0911111111",
    #     )

    # ACCOUNT PHONE WITHOUT PROFILE

    def test_account_returns_empty_phone_without_profile(self):
        """
        AccountSerializer should safely return an empty phone
        if the user has no profile.
        """

        user = User.objects.create_user(
            username="noprofile",
            email="noprofile@example.com",
            password="StrongPassword123!",
        )

        self.client.force_authenticate(
            user=user
        )

        response = self.client.get(
            self.account_url
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data["phone"],
            "",
        )