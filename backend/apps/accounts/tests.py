from django.contrib.auth import authenticate, get_user_model
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APITestCase

from .models import AccountProfile, AuditLog, ShopSettings, StaffAccess
from apps.bookings.models import Booking
from apps.testimonials.models import Testimonial


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

    def test_staff_can_list_registered_customers(self):
        """
        A staff account holding `customers.view` sees the directory.

        Staff access is granted through StaffAccess, so `is_staff` on
        its own is not enough - a bare flag must not open the console.
        """

        from .models import StaffAccess

        staff = User.objects.create_user(
            username="staff",
            email="staff@example.com",
            password="StrongPassword123!",
            is_staff=True,
        )

        StaffAccess.objects.create(
            user=staff,
            role=StaffAccess.Role.RECEPTION,
            permissions=["customers.view"],
        )

        customer = User.objects.create_user(
            username="customer",
            email="customer@example.com",
            password="StrongPassword123!",
            first_name="Customer",
            last_name="One",
        )
        customer.profile.phone = "0900000000"
        customer.profile.save(update_fields=["phone"])

        self.client.force_authenticate(user=staff)
        response = self.client.get(reverse("admin-customer-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["username"], "customer")
        self.assertEqual(response.data[0]["phone"], "0900000000")

    def test_a_staff_flag_alone_does_not_open_the_console(self):
        """
        The counterpart to the test above: `is_staff` without granted
        capabilities is not a way in.
        """

        staff = User.objects.create_user(
            username="staff",
            email="staff@example.com",
            password="StrongPassword123!",
            is_staff=True,
        )

        self.client.force_authenticate(user=staff)
        response = self.client.get(reverse("admin-customer-list"))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_customer_cannot_list_registered_customers(self):
        customer = User.objects.create_user(
            username="customer",
            email="customer@example.com",
            password="StrongPassword123!",
        )

        self.client.force_authenticate(user=customer)
        response = self.client.get(reverse("admin-customer-list"))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class UserManagementTestCase(APITestCase):
    """
    User management for an owner and for an administrator.

    The rules under test are the ones that stop the console locking
    itself out, and the ones that let an administrator do the job
    without an owner present:

      - a role written on a user creates the matching staff access
      - writing the customer role removes it again
      - phone, name and email are editable by an administrator
      - the owner account is untouchable from the console
      - nobody can revoke their own access, or the last one
    """

    def setUp(self):
        self.list_url = reverse("user-management-list")

        self.owner = User.objects.create_superuser(
            username="owner",
            email="owner@example.com",
            password="StrongPassword123!",
        )

        self.administrator = User.objects.create_user(
            username="administrator",
            email="administrator@example.com",
            password="StrongPassword123!",
        )

        StaffAccess.objects.create(
            user=self.administrator,
            role=StaffAccess.Role.ADMIN,
            permissions=[],
        )

        self.administrator.is_staff = True
        self.administrator.save(update_fields=["is_staff"])

        self.customer = User.objects.create_user(
            username="customer",
            email="customer@example.com",
            password="StrongPassword123!",
            first_name="Customer",
        )

    def detail_url(self, user):
        return reverse("user-management-detail", args=[user.pk])

    # ACCESS

    def test_administrator_can_list_users(self):
        self.client.force_authenticate(user=self.administrator)
        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            sorted(row["username"] for row in response.data),
            ["administrator", "customer", "owner"],
        )

    def test_customer_cannot_list_users(self):
        self.client.force_authenticate(user=self.customer)
        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_reception_cannot_list_users(self):
        receptionist = User.objects.create_user(
            username="reception",
            email="reception@example.com",
            password="StrongPassword123!",
            is_staff=True,
        )

        StaffAccess.objects.create(
            user=receptionist,
            role=StaffAccess.Role.RECEPTION,
            permissions=["bookings.view", "bookings.manage"],
        )

        self.client.force_authenticate(user=receptionist)
        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # ROLE ASSIGNMENT

    def test_promoting_a_customer_creates_staff_access(self):
        self.client.force_authenticate(user=self.administrator)
        response = self.client.patch(
            self.detail_url(self.customer),
            {
                "role": StaffAccess.Role.STAFF,
                "permissions": ["bookings.view", "bookings.manage"],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["role"], "staff")

        access = StaffAccess.objects.get(user=self.customer)

        self.assertEqual(access.role, StaffAccess.Role.STAFF)
        self.assertEqual(
            sorted(access.permissions),
            ["bookings.manage", "bookings.view"],
        )

        self.customer.refresh_from_db()
        self.assertTrue(self.customer.is_staff)

    def test_demoting_to_customer_removes_staff_access(self):
        self.client.force_authenticate(user=self.administrator)
        response = self.client.patch(
            self.detail_url(self.customer),
            {
                "role": StaffAccess.Role.RECEPTION,
                "permissions": ["bookings.view"],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self.client.patch(
            self.detail_url(self.customer),
            {"role": "customer"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["role"], "customer")
        self.assertFalse(StaffAccess.objects.filter(user=self.customer).exists())

        self.customer.refresh_from_db()
        self.assertFalse(self.customer.is_staff)

    def test_permissions_alone_do_not_reset_the_role(self):
        """
        Tightening one receptionist's access must not quietly turn them
        back into a plain staff member.
        """

        receptionist = User.objects.create_user(
            username="reception",
            email="reception@example.com",
            password="StrongPassword123!",
        )

        StaffAccess.objects.create(
            user=receptionist,
            role=StaffAccess.Role.RECEPTION,
            permissions=["bookings.view", "payments.view"],
        )

        self.client.force_authenticate(user=self.administrator)
        response = self.client.patch(
            self.detail_url(receptionist),
            {"permissions": ["bookings.view"]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["role"], "reception")
        self.assertEqual(response.data["permissions"], ["bookings.view"])

    def test_unknown_permission_is_rejected(self):
        self.client.force_authenticate(user=self.administrator)
        response = self.client.patch(
            self.detail_url(self.customer),
            {"role": "staff", "permissions": ["launch.missiles"]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("permissions", response.data)

    def test_owner_cannot_be_assigned_through_the_api(self):
        """
        `owner` reads back for a superuser but is not a value that can
        be written, so no account can be promoted to an unrevocable
        one from the console.
        """

        self.client.force_authenticate(user=self.administrator)
        response = self.client.patch(
            self.detail_url(self.customer),
            {"role": "owner"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("role", response.data)

    # PROFILE EDITING

    def test_administrator_can_edit_phone_and_name(self):
        self.client.force_authenticate(user=self.administrator)
        response = self.client.patch(
            self.detail_url(self.customer),
            {
                "phone": "0911223344",
                "first_name": "Updated",
                "last_name": "Name",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["phone"], "0911223344")

        self.customer.refresh_from_db()
        self.assertEqual(self.customer.first_name, "Updated")
        self.assertEqual(self.customer.profile.phone, "0911223344")

    def test_deactivating_a_user_also_closes_their_console_access(self):
        """
        The account switch and the console switch are one switch, so
        the two screens can never disagree about who is enabled.
        """

        self.client.force_authenticate(user=self.administrator)

        self.client.patch(
            self.detail_url(self.customer),
            {"role": "staff", "permissions": ["bookings.view"]},
            format="json",
        )

        response = self.client.patch(
            self.detail_url(self.customer),
            {"is_active": False},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(StaffAccess.objects.get(user=self.customer).is_active)

        self.client.patch(
            self.detail_url(self.customer),
            {"is_active": True},
            format="json",
        )

        self.assertTrue(StaffAccess.objects.get(user=self.customer).is_active)

    # LOCKOUT GUARDS

    def test_administrator_cannot_edit_the_owner(self):
        self.client.force_authenticate(user=self.administrator)
        response = self.client.patch(
            self.detail_url(self.owner),
            {"first_name": "Not"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_nobody_can_deactivate_their_own_account(self):
        self.client.force_authenticate(user=self.administrator)
        response = self.client.patch(
            self.detail_url(self.administrator),
            {"is_active": False},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("is_active", response.data)

    def test_nobody_can_change_their_own_role(self):
        self.client.force_authenticate(user=self.administrator)
        response = self.client.patch(
            self.detail_url(self.administrator),
            {"role": "reception", "permissions": []},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("role", response.data)

    def test_the_last_administrator_cannot_be_demoted(self):
        self.client.force_authenticate(user=self.administrator)
        response = self.client.patch(
            self.detail_url(self.administrator),
            {"role": "customer"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("role", response.data)

    def test_an_administrator_can_be_demoted_once_another_exists(self):
        second = User.objects.create_user(
            username="administrator-two",
            email="administrator2@example.com",
            password="StrongPassword123!",
        )

        StaffAccess.objects.create(
            user=second,
            role=StaffAccess.Role.ADMIN,
            permissions=[],
        )

        self.client.force_authenticate(user=self.administrator)
        response = self.client.patch(
            self.detail_url(self.customer),
            {"role": "admin"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Now that a second administrator exists, the first may step down.
        second.refresh_from_db()
        second.is_staff = True
        second.save(update_fields=["is_staff"])

        self.client.force_authenticate(user=second)
        response = self.client.patch(
            self.detail_url(self.administrator),
            {"role": "reception", "permissions": ["bookings.view"]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(StaffAccess.objects.get(user=self.administrator).role, "reception")

    def test_a_receptionist_cannot_demote_an_administrator(self):
        receptionist = User.objects.create_user(
            username="reception",
            email="reception@example.com",
            password="StrongPassword123!",
        )

        StaffAccess.objects.create(
            user=receptionist,
            role=StaffAccess.Role.RECEPTION,
            permissions=["bookings.manage"],
        )

        receptionist.is_staff = True
        receptionist.save(update_fields=["is_staff"])

        self.client.force_authenticate(user=receptionist)
        response = self.client.patch(
            self.detail_url(self.administrator),
            {"role": "reception"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # FILTERING

    def test_users_can_be_filtered_by_role(self):
        self.client.force_authenticate(user=self.administrator)
        response = self.client.get(self.list_url, {"role": "admin"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([row["username"] for row in response.data], ["administrator"])

    def test_users_can_be_searched_by_phone(self):
        self.customer.profile.phone = "0900000000"
        self.customer.profile.save(update_fields=["phone"])

        self.client.force_authenticate(user=self.administrator)
        response = self.client.get(self.list_url, {"q": "0900000000"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([row["username"] for row in response.data], ["customer"])

    # AUDIT

    def test_a_role_change_is_recorded_field_by_field(self):
        self.client.force_authenticate(user=self.administrator)
        self.client.patch(
            self.detail_url(self.customer),
            {"role": "reception", "permissions": ["bookings.view"]},
            format="json",
        )

        entry = AuditLog.objects.filter(action="user.updated").first()

        self.assertIsNotNone(entry)
        self.assertEqual(entry.actor, self.administrator)
        self.assertEqual(entry.target_id, str(self.customer.pk))

        changes = entry.details["changes"]

        self.assertEqual(changes["role"], {"from": "customer", "to": "reception"})
        self.assertEqual(changes["permissions"], {"from": [], "to": ["bookings.view"]})


class UserManagementCreateTestCase(APITestCase):
    """
    Creating an account from the console.

    Onboarding someone is registering them and then promoting them, and
    on a phone that was two screens and a good chance of stopping
    halfway. These cover the one-call path, and the two things that make
    it safe to hand a stranger console access: only the owner and
    administrators may do it, and the password comes back exactly once.
    """

    def setUp(self):
        self.create_url = reverse("user-management-create")

        self.owner = User.objects.create_superuser(
            username="owner",
            email="owner@example.com",
            password="StrongPassword123!",
        )

        self.administrator = User.objects.create_user(
            username="administrator",
            email="administrator@example.com",
            password="StrongPassword123!",
        )
        StaffAccess.objects.create(
            user=self.administrator,
            role=StaffAccess.Role.ADMIN,
            permissions=[],
        )
        self.administrator.is_staff = True
        self.administrator.save(update_fields=["is_staff"])

        self.receptionist = User.objects.create_user(
            username="receptionist",
            email="receptionist@example.com",
            password="StrongPassword123!",
        )
        StaffAccess.objects.create(
            user=self.receptionist,
            role=StaffAccess.Role.RECEPTION,
            permissions=["bookings.view"],
        )
        self.receptionist.is_staff = True
        self.receptionist.save(update_fields=["is_staff"])

    def payload(self, **overrides):
        body = {
            "username": "newbarber",
            "email": "newbarber@example.com",
            "first_name": "New",
            "last_name": "Barber",
            "phone": "0911222333",
            "role": "reception",
            "permissions": ["bookings.view", "bookings.manage"],
        }

        body.update(overrides)

        return body

    def test_creates_the_account_and_its_staff_access_in_one_call(self):
        self.client.force_authenticate(user=self.administrator)
        response = self.client.post(self.create_url, self.payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        user = User.objects.get(username="newbarber")

        self.assertTrue(user.is_active)
        self.assertEqual(user.first_name, "New")
        self.assertEqual(AccountProfile.objects.get(user=user).phone, "0911222333")

        access = StaffAccess.objects.get(user=user)

        self.assertEqual(access.role, StaffAccess.Role.RECEPTION)
        self.assertEqual(
            sorted(access.permissions),
            ["bookings.manage", "bookings.view"],
        )

        # The role is not just a record: it is what lets them in.
        self.assertTrue(user.is_staff)

    def test_returns_a_temporary_password_exactly_once(self):
        self.client.force_authenticate(user=self.administrator)
        response = self.client.post(self.create_url, self.payload(), format="json")

        password = response.data["temporary_password"]

        self.assertTrue(password)
        self.assertGreaterEqual(len(password), 12)

        # Reading the account back must not disclose it again.
        listed = self.client.get(reverse("user-management-list"))
        detail = self.client.get(
            reverse("user-management-detail", args=[response.data["id"]])
        )

        self.assertNotIn("temporary_password", listed.data[0])
        self.assertNotIn("temporary_password", detail.data)

    def test_a_generated_password_cannot_sign_in_until_it_is_changed(self):
        """
        The console hands the string over in person; nobody has typed it
        into the account yet. Marking it unusable means an account cannot
        be left reachable by a password the shop has forgotten about.
        """
        self.client.force_authenticate(user=self.administrator)
        response = self.client.post(self.create_url, self.payload(), format="json")

        user = User.objects.get(pk=response.data["id"])

        self.assertFalse(user.has_usable_password())
        self.assertFalse(
            authenticate(username="newbarber", password=response.data["temporary_password"])
        )

    def test_a_chosen_password_is_honoured(self):
        self.client.force_authenticate(user=self.administrator)
        response = self.client.post(
            self.create_url,
            self.payload(password="ChosenPassword123!"),
            format="json",
        )

        user = User.objects.get(pk=response.data["id"])

        self.assertEqual(response.data["temporary_password"], "ChosenPassword123!")
        self.assertTrue(user.check_password("ChosenPassword123!"))

    def test_a_weak_password_is_refused(self):
        self.client.force_authenticate(user=self.administrator)
        response = self.client.post(
            self.create_url,
            self.payload(password="123"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)
        self.assertFalse(User.objects.filter(username="newbarber").exists())

    def test_a_customer_role_creates_no_staff_access(self):
        self.client.force_authenticate(user=self.administrator)
        response = self.client.post(
            self.create_url,
            self.payload(role="customer", permissions=[]),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["role"], "customer")

        user = User.objects.get(pk=response.data["id"])

        self.assertFalse(StaffAccess.objects.filter(user=user).exists())
        self.assertFalse(user.is_staff)

    def test_ownership_cannot_be_handed_out(self):
        """
        Ownership is created with `createsuperuser`, not from the UI.

        A console that could mint an owner could be used to make an
        account no administrator could take away again.
        """
        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            self.create_url,
            self.payload(role="owner"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("role", response.data)

    def test_a_duplicate_username_is_refused(self):
        self.client.force_authenticate(user=self.administrator)
        response = self.client.post(
            self.create_url,
            self.payload(username="receptionist"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("username", response.data)

    def test_a_duplicate_email_is_refused(self):
        self.client.force_authenticate(user=self.administrator)
        response = self.client.post(
            self.create_url,
            self.payload(email="receptionist@example.com"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)

    def test_an_unknown_capability_is_refused(self):
        self.client.force_authenticate(user=self.administrator)
        response = self.client.post(
            self.create_url,
            self.payload(permissions=["bookings.view", "launch.rockets"]),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("permissions", response.data)

    def test_only_the_owner_and_administrators_may_create(self):
        self.client.force_authenticate(user=self.receptionist)
        response = self.client.post(self.create_url, self.payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(User.objects.filter(username="newbarber").exists())

    def test_the_list_endpoint_still_refuses_writes(self):
        """
        Reading the directory and creating in it are different powers.

        Keeping them on separate views means a read-only screen can never
        quietly grow a write.
        """
        self.client.force_authenticate(user=self.administrator)
        response = self.client.post(
            reverse("user-management-list"),
            self.payload(),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_creation_is_recorded_in_the_activity_trail(self):
        """
        Who gave whom console access, and what they were given, has to be
        answerable afterwards.
        """
        self.client.force_authenticate(user=self.administrator)
        response = self.client.post(self.create_url, self.payload(), format="json")

        entry = AuditLog.objects.filter(action="user.created").first()

        self.assertIsNotNone(entry)
        self.assertEqual(entry.actor, self.administrator)
        self.assertEqual(entry.target_id, str(response.data["id"]))
        self.assertEqual(entry.details["role"], "reception")
        self.assertEqual(
            sorted(entry.details["permissions"]),
            ["bookings.manage", "bookings.view"],
        )

        # The password is a handoff, not a log entry.
        self.assertNotIn("temporary_password", entry.details)

    def test_a_rejected_role_leaves_nothing_behind(self):
        """
        Creating an account touches three tables. A failure part-way
        through must not leave a user with no profile, or staff access
        pointing at nobody.
        """
        self.client.force_authenticate(user=self.administrator)

        # Rejected during validation, before any row is written.
        response = self.client.post(
            self.create_url,
            self.payload(role="wizard"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("role", response.data)
        self.assertFalse(User.objects.filter(username="newbarber").exists())
        self.assertFalse(StaffAccess.objects.filter(role="wizard").exists())


class ShopSettingsTestCase(APITestCase):
    """
    The shop's own details, in one editable row.

    A settings screen that does not change anything is worse than no
    settings screen, because it teaches staff that the numbers they can
    change are not the numbers the shop uses. These cover that the write
    actually lands, that it is the right people writing, and that it is
    recorded.
    """

    def setUp(self):
        self.url = reverse("shop-settings")

        self.owner = User.objects.create_superuser(
            username="owner",
            email="owner@example.com",
            password="StrongPassword123!",
        )

        self.receptionist = User.objects.create_user(
            username="receptionist",
            email="receptionist@example.com",
            password="StrongPassword123!",
        )
        StaffAccess.objects.create(
            user=self.receptionist,
            role=StaffAccess.Role.RECEPTION,
            permissions=["bookings.view", "customers.view"],
        )
        self.receptionist.is_staff = True
        self.receptionist.save(update_fields=["is_staff"])

    def payload(self, **overrides):
        body = {
            "business_name": "NOIR Barbers",
            "tagline": "Sharp work, no rush.",
            "phone": "+251911000000",
            "email": "hello@noir.test",
            "address": "Bole, Addis Ababa",
            "currency": "ETB",
            "opening_time": "09:00",
            "closing_time": "21:00",
            "booking_horizon_days": 60,
        }

        body.update(overrides)

        return body

    def test_reading_creates_the_row_rather_than_failing(self):
        """
        The storefront reads this on every load.

        A 500 because nobody has opened the settings screen yet would
        take the booking form down with it, so the row is created on
        first read.
        """
        self.assertFalse(ShopSettings.objects.exists())

        self.client.force_authenticate(self.receptionist)
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(ShopSettings.objects.exists())
        self.assertEqual(response.data["business_name"], "NOIR Barbers")

    def test_every_staff_account_may_read_it(self):
        """
        Reading is not editing.

        A receptionist reading the address out over the phone needs the
        same record an owner edits.
        """
        self.client.force_authenticate(self.receptionist)

        self.assertEqual(
            self.client.get(self.url).status_code,
            status.HTTP_200_OK,
        )

    def test_writing_requires_the_settings_capability(self):
        self.client.force_authenticate(self.receptionist)
        response = self.client.patch(
            self.url, self.payload(business_name="Hijacked"), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(ShopSettings.load().business_name, "NOIR Barbers")

    def test_a_partial_write_leaves_the_rest_alone(self):
        self.client.force_authenticate(self.owner)

        self.client.patch(self.url, self.payload(), format="json")
        response = self.client.patch(
            self.url, {"phone": "+251900000000"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["phone"], "+251900000000")
        self.assertEqual(response.data["address"], "Bole, Addis Ababa")

    def test_closing_before_opening_is_refused(self):
        """
        The failure this prevents is silent: the booking form computes an
        empty range and offers nobody any slots, with no error anywhere.
        """
        self.client.force_authenticate(self.owner)
        response = self.client.patch(
            self.url,
            self.payload(opening_time="18:00", closing_time="09:00"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("closing_time", response.data)

    def test_a_write_is_recorded_field_by_field(self):
        self.client.force_authenticate(self.owner)

        self.client.patch(self.url, self.payload(), format="json")
        self.client.patch(self.url, {"phone": "+251900000000"}, format="json")

        entry = AuditLog.objects.filter(action="settings.updated").first()

        self.assertIsNotNone(entry)
        self.assertEqual(entry.actor, self.owner)
        self.assertEqual(
            entry.details["changes"]["phone"],
            {"from": "+251911000000", "to": "+251900000000"},
        )

    def test_a_write_with_no_actual_change_is_not_logged(self):
        """
        Otherwise the activity log fills with "changed" entries that
        changed nothing, which is exactly what makes an audit trail
        unreadable.
        """
        self.client.force_authenticate(self.owner)

        self.client.patch(self.url, self.payload(), format="json")
        AuditLog.objects.filter(action="settings.updated").delete()

        self.client.patch(self.url, self.payload(), format="json")

        self.assertFalse(AuditLog.objects.filter(action="settings.updated").exists())

    def test_the_row_records_who_changed_it(self):
        self.client.force_authenticate(self.owner)
        self.client.patch(self.url, self.payload(), format="json")

        self.assertEqual(ShopSettings.load().updated_by, self.owner)

    def test_anonymous_is_refused(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class CustomerManagementTestCase(APITestCase):
    """
    Adding, editing and removing a customer from the console.

    The screen is read-only today, which means a walk-in who wants a
    review account has to be sent to the public sign-up form. These
    cover the write path and, more importantly, the boundaries: this
    screen manages customers, and must not quietly become a way to make
    staff.
    """

    def setUp(self):
        self.list_url = reverse("admin-customer-list")

        self.owner = User.objects.create_superuser(
            username="owner",
            email="owner@example.com",
            password="StrongPassword123!",
        )

        self.manager = User.objects.create_user(
            username="manager",
            email="manager@example.com",
            password="StrongPassword123!",
        )
        StaffAccess.objects.create(
            user=self.manager,
            role=StaffAccess.Role.RECEPTION,
            permissions=[
                "customers.view",
                "customers.manage",
                "customers.delete",
            ],
        )
        self.manager.is_staff = True
        self.manager.save(update_fields=["is_staff"])

        self.viewer = User.objects.create_user(
            username="viewer",
            email="viewer@example.com",
            password="StrongPassword123!",
        )
        StaffAccess.objects.create(
            user=self.viewer,
            role=StaffAccess.Role.RECEPTION,
            permissions=["customers.view"],
        )
        self.viewer.is_staff = True
        self.viewer.save(update_fields=["is_staff"])

        self.customer = User.objects.create_user(
            username="customer",
            email="customer@example.com",
            password="StrongPassword123!",
            first_name="Customer",
        )
        # The post_save signal already made the profile; set the number.
        AccountProfile.objects.update_or_create(
            user=self.customer,
            defaults={"phone": "0911000000"},
        )

    def detail_url(self, user):
        return reverse("admin-customer-detail", args=[user.pk])

    def delete_url(self, user):
        return reverse("admin-customer-delete", args=[user.pk])

    def payload(self, **overrides):
        body = {
            "username": "walkin",
            "email": "walkin@example.com",
            "first_name": "Walk",
            "last_name": "In",
            "phone": "0922000000",
        }

        body.update(overrides)

        return body

    # CREATE

    def test_creates_a_customer_and_returns_a_one_time_password(self):
        self.client.force_authenticate(self.manager)
        response = self.client.post(self.list_url, self.payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        user = User.objects.get(username="walkin")

        self.assertTrue(user.is_active)
        self.assertFalse(user.is_staff)
        self.assertEqual(AccountProfile.objects.get(user=user).phone, "0922000000")

        password = response.data["temporary_password"]

        self.assertTrue(password)
        self.assertGreaterEqual(len(password), 12)
        self.assertFalse(user.has_usable_password())

    def test_a_customer_cannot_be_made_staff_from_here(self):
        """
        The one boundary that matters most on this screen.

        It only requires `customers.manage`, which a receptionist may
        hold. If it could also hand out console access, then the one
        capability that means "look after customers" would silently mean
        "create staff", and the team screen's role gate would be
        decorative.
        """
        self.client.force_authenticate(self.manager)
        response = self.client.post(
            self.list_url,
            self.payload(is_staff=True, role="admin"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        user = User.objects.get(username="walkin")

        self.assertFalse(user.is_staff)
        self.assertFalse(StaffAccess.objects.filter(user=user).exists())

    def test_creating_needs_the_manage_capability_not_just_view(self):
        self.client.force_authenticate(self.viewer)
        response = self.client.post(self.list_url, self.payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(User.objects.filter(username="walkin").exists())

    def test_a_duplicate_username_is_refused(self):
        self.client.force_authenticate(self.manager)
        response = self.client.post(
            self.list_url, self.payload(username="customer"), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("username", response.data)

    def test_a_duplicate_email_is_refused(self):
        self.client.force_authenticate(self.manager)
        response = self.client.post(
            self.list_url,
            self.payload(email="customer@example.com"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)

    def test_creation_is_recorded(self):
        self.client.force_authenticate(self.manager)
        self.client.post(self.list_url, self.payload(), format="json")

        entry = AuditLog.objects.filter(action="customer.created").first()

        self.assertIsNotNone(entry)
        self.assertEqual(entry.details["username"], "walkin")

    # UPDATE

    def test_edits_contact_details(self):
        self.client.force_authenticate(self.manager)
        response = self.client.patch(
            self.detail_url(self.customer),
            {"phone": "0933333333", "first_name": "Renamed"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.customer.refresh_from_db()

        self.assertEqual(self.customer.first_name, "Renamed")
        self.assertEqual(
            AccountProfile.objects.get(user=self.customer).phone,
            "0933333333",
        )

    def test_can_disable_and_re_enable_a_customer(self):
        self.client.force_authenticate(self.manager)

        self.client.patch(
            self.detail_url(self.customer),
            {"is_active": False},
            format="json",
        )
        self.customer.refresh_from_db()
        self.assertFalse(self.customer.is_active)

        self.client.patch(
            self.detail_url(self.customer),
            {"is_active": True},
            format="json",
        )
        self.customer.refresh_from_db()
        self.assertTrue(self.customer.is_active)

    def test_the_response_confirms_the_change_it_just_made(self):
        """
        The console writes then re-renders from the response.

        Returning the read-only serializer here would omit `is_active`
        and the UI would have to refetch to discover whether the disable
        it just asked for had happened.
        """
        self.client.force_authenticate(self.manager)
        response = self.client.patch(
            self.detail_url(self.customer),
            {"is_active": False, "phone": "0933333333"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("is_active", response.data)
        self.assertFalse(response.data["is_active"])
        self.assertEqual(response.data["phone"], "0933333333")

    def test_a_staff_account_is_not_reachable_here(self):
        """
        A typed id for a staff account gets a 404, not a surprising
        edit. Staff are managed on the user and team screens.
        """
        self.client.force_authenticate(self.manager)
        response = self.client.patch(
            self.detail_url(self.manager),
            {"first_name": "Hijack"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_an_edit_is_recorded_field_by_field(self):
        self.client.force_authenticate(self.manager)
        self.client.patch(
            self.detail_url(self.customer),
            {"phone": "0933333333"},
            format="json",
        )

        entry = AuditLog.objects.filter(action="customer.updated").first()

        self.assertIsNotNone(entry)
        self.assertEqual(
            entry.details["changes"]["phone"],
            {"from": "0911000000", "to": "0933333333"},
        )

    # DELETE

    def test_deleting_removes_the_account(self):
        self.client.force_authenticate(self.manager)
        response = self.client.delete(self.delete_url(self.customer))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(User.objects.filter(pk=self.customer.pk).exists())

    def test_deleting_needs_its_own_capability(self):
        """
        Why `customers.delete` is separate from `customers.manage`.

        Someone who may correct a phone number should not also be able to
        destroy an account and everything hanging off it.
        """
        editor = User.objects.create_user(
            username="editor",
            email="editor@example.com",
            password="StrongPassword123!",
        )
        StaffAccess.objects.create(
            user=editor,
            role=StaffAccess.Role.RECEPTION,
            permissions=["customers.view", "customers.manage"],
        )
        editor.is_staff = True
        editor.save(update_fields=["is_staff"])

        self.client.force_authenticate(editor)
        response = self.client.delete(self.delete_url(self.customer))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(User.objects.filter(pk=self.customer.pk).exists())

    def test_a_customer_with_reviews_cannot_be_deleted(self):
        Testimonial.objects.create(
            user=self.customer,
            customer_name="Customer",
            message="Sharp work.",
            rating=5,
            status=Testimonial.Status.APPROVED,
        )

        self.client.force_authenticate(self.manager)
        response = self.client.delete(self.delete_url(self.customer))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", response.data)
        self.assertTrue(User.objects.filter(pk=self.customer.pk).exists())

    def test_deleting_a_staff_account_is_not_reachable_here(self):
        self.client.force_authenticate(self.manager)
        response = self.client.delete(self.delete_url(self.manager))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_deletion_is_recorded(self):
        self.client.force_authenticate(self.manager)
        self.client.delete(self.delete_url(self.customer))

        entry = AuditLog.objects.filter(action="customer.deleted").first()

        self.assertIsNotNone(entry)
        self.assertEqual(entry.details["username"], "customer")


class DashboardTestCase(APITestCase):
    """
    The dashboard reports the shop as it is.

    Two things matter beyond the numbers: a limited account gets the
    cards it is allowed to see rather than a 403 for the whole screen,
    and today's schedule is real rows from the bookings table.
    """

    def setUp(self):
        from datetime import timedelta

        from django.utils import timezone

        from apps.bookings.models import Barber, Booking
        from apps.services.models import Service

        self.url = reverse("dashboard")
        self.today = timezone.localdate()

        self.service = Service.objects.create(
            name="Signature Cut",
            price=350,
            duration=45,
        )

        self.barber = Barber.objects.create(name="Alex")

        Booking.objects.create(
            customer_name="Walk In",
            customer_phone="0900000000",
            service=self.service,
            barber=self.barber,
            booking_date=self.today,
            start_time="10:00",
            end_time="10:45",
            status="confirmed",
        )

        Booking.objects.create(
            customer_name="Later Today",
            customer_phone="0911111111",
            service=self.service,
            barber=self.barber,
            booking_date=self.today,
            start_time="16:00",
            end_time="16:45",
            status="pending",
        )

        Booking.objects.create(
            customer_name="Next Week",
            customer_phone="0922222222",
            service=self.service,
            barber=self.barber,
            booking_date=self.today + timedelta(days=3),
            start_time="11:00",
            end_time="11:45",
            status="confirmed",
        )

        self.receptionist = User.objects.create_user(
            username="reception",
            email="reception@example.com",
            password="StrongPassword123!",
        )

        StaffAccess.objects.create(
            user=self.receptionist,
            role=StaffAccess.Role.RECEPTION,
            permissions=["bookings.view", "bookings.manage"],
        )

        self.receptionist.is_staff = True
        self.receptionist.save(update_fields=["is_staff"])

    def test_todays_schedule_is_returned(self):
        self.client.force_authenticate(user=self.receptionist)
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        names = [row["customer_name"] for row in response.data["schedule"]["today"]]

        self.assertEqual(names, ["Walk In", "Later Today"])
        self.assertEqual(response.data["schedule"]["today"][0]["service_name"], "Signature Cut")
        self.assertEqual(response.data["schedule"]["today"][0]["barber_name"], "Alex")

    def test_a_limited_account_sees_only_its_own_sections(self):
        self.client.force_authenticate(user=self.receptionist)
        response = self.client.get(self.url)

        self.assertIn("bookings", response.data["sections"])
        self.assertNotIn("payments", response.data["sections"])
        self.assertNotIn("services", response.data["sections"])

        # The omitted sections are absent from the payload entirely,
        # not present and zeroed - the console must not be able to
        # render a number it has no capability to fetch.
        self.assertNotIn("users", response.data["counts"])
        self.assertNotIn("payments", response.data["counts"])
        self.assertEqual(response.data["revenue"], {})

        # Both booking queues are in scope for this account: both are
        # counts over bookings, not over payments.
        #
        # `payments_outstanding` counts the two CONFIRMED bookings with
        # nothing paid behind them. The pending one is not in it: payment
        # opens when reception confirms, so a booking nobody has confirmed
        # yet is not money the shop is waiting for - it belongs in the
        # queue beside it, and counting it here would send reception after
        # a payment the customer is not able to make.
        self.assertEqual(
            response.data["queues"],
            {
                "bookings_to_confirm": 1,
                "payments_outstanding": 2,
            },
        )

    def test_each_schedule_row_carries_the_code_and_the_payment_state(self):
        self.client.force_authenticate(user=self.receptionist)
        response = self.client.get(self.url)

        row = response.data["schedule"]["today"][0]

        # The number the customer was given is the number staff read.
        self.assertEqual(
            row["booking_code"], Booking.objects.get(
                customer_name="Walk In",
            ).booking_code,
        )

        # No money against either of these appointments yet.
        self.assertIsNone(row["payment_status"])
        self.assertTrue(row["payment_due"])

    def test_an_administrator_sees_everything(self):
        administrator = User.objects.create_user(
            username="administrator",
            email="administrator@example.com",
            password="StrongPassword123!",
        )

        StaffAccess.objects.create(
            user=administrator,
            role=StaffAccess.Role.ADMIN,
            permissions=[],
        )

        administrator.is_staff = True
        administrator.save(update_fields=["is_staff"])

        self.client.force_authenticate(user=administrator)
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            sorted(response.data["sections"]),
            ["bookings", "customers", "gallery", "payments", "reviews", "services"],
        )
        self.assertIn("users", response.data["counts"])
        self.assertIn("revenue", response.data)

    def test_cancelled_bookings_are_left_off_the_schedule(self):
        from apps.bookings.models import Booking

        Booking.objects.filter(customer_name="Walk In").update(status="cancelled")

        self.client.force_authenticate(user=self.receptionist)
        response = self.client.get(self.url)

        names = [row["customer_name"] for row in response.data["schedule"]["today"]]

        self.assertEqual(names, ["Later Today"])

    def test_a_customer_cannot_read_the_dashboard(self):
        customer = User.objects.create_user(
            username="customer",
            email="customer@example.com",
            password="StrongPassword123!",
        )

        self.client.force_authenticate(user=customer)
        response = self.client.get(self.url)

        self.assertIn(
            response.status_code,
            [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN],
        )


class AuditLogTestCase(APITestCase):
    """The activity trail is filterable and paged, not one long list."""

    def setUp(self):
        self.url = reverse("audit-log-list")

        self.owner = User.objects.create_superuser(
            username="owner",
            email="owner@example.com",
            password="StrongPassword123!",
        )

        self.administrator = User.objects.create_user(
            username="administrator",
            email="administrator@example.com",
            password="StrongPassword123!",
        )

        StaffAccess.objects.create(
            user=self.administrator,
            role=StaffAccess.Role.ADMIN,
            permissions=[],
        )

        self.administrator.is_staff = True
        self.administrator.save(update_fields=["is_staff"])

        AuditLog.objects.create(actor=self.owner, action="user.updated", target_id="1")
        AuditLog.objects.create(actor=self.administrator, action="payment.verified", target_id="2")
        AuditLog.objects.create(actor=self.administrator, action="payment.rejected", target_id="3")

    def test_the_trail_is_paged(self):
        self.client.force_authenticate(user=self.administrator)
        response = self.client.get(self.url, {"limit": 2})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 3)
        self.assertEqual(len(response.data["results"]), 2)
        self.assertTrue(response.data["has_more"])

    def test_the_trail_can_be_filtered_by_action_prefix(self):
        self.client.force_authenticate(user=self.administrator)
        response = self.client.get(self.url, {"action": "payment"})

        self.assertEqual(response.data["count"], 2)
        self.assertTrue(
            all(row["action"].startswith("payment") for row in response.data["results"])
        )

    def test_the_trail_can_be_filtered_by_actor(self):
        self.client.force_authenticate(user=self.administrator)
        response = self.client.get(self.url, {"actor": str(self.owner.pk)})

        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["actor"], self.owner.pk)

    def test_the_page_size_is_capped(self):
        self.client.force_authenticate(user=self.administrator)
        response = self.client.get(self.url, {"limit": 100000})

        self.assertEqual(response.data["limit"], 200)

    def test_a_nonsense_page_size_falls_back_to_the_default(self):
        self.client.force_authenticate(user=self.administrator)
        response = self.client.get(self.url, {"limit": "everything"})

        self.assertEqual(response.data["limit"], 50)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_a_customer_cannot_read_the_trail(self):
        customer = User.objects.create_user(
            username="customer",
            email="customer@example.com",
            password="StrongPassword123!",
        )

        self.client.force_authenticate(user=customer)
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class SessionPayloadTestCase(APITestCase):
    """
    The session tells the console what the account may do.

    The important case is the administrator: their capabilities are
    not on the record, so the payload has to carry the full set or the
    console would hide screens the API will happily serve.
    """

    def setUp(self):
        self.url = reverse("account-me")

    def test_a_customer_has_no_staff_role(self):
        customer = User.objects.create_user(
            username="customer",
            email="customer@example.com",
            password="StrongPassword123!",
        )

        self.client.force_authenticate(user=customer)
        response = self.client.get(self.url)

        self.assertIsNone(response.data["staff_role"])
        self.assertEqual(response.data["permissions"], [])
        self.assertFalse(response.data["is_unlimited"])

    def test_an_administrator_reports_every_capability(self):
        administrator = User.objects.create_user(
            username="administrator",
            email="administrator@example.com",
            password="StrongPassword123!",
        )

        StaffAccess.objects.create(
            user=administrator,
            role=StaffAccess.Role.ADMIN,
            permissions=[],
        )

        administrator.is_staff = True
        administrator.save(update_fields=["is_staff"])

        self.client.force_authenticate(user=administrator)
        response = self.client.get(self.url)

        self.assertEqual(response.data["staff_role"], "admin")
        self.assertTrue(response.data["is_unlimited"])
        self.assertIn("bookings.manage", response.data["permissions"])
        self.assertIn("reviews.moderate", response.data["permissions"])

    def test_a_receptionist_reports_only_their_capabilities(self):
        receptionist = User.objects.create_user(
            username="reception",
            email="reception@example.com",
            password="StrongPassword123!",
        )

        StaffAccess.objects.create(
            user=receptionist,
            role=StaffAccess.Role.RECEPTION,
            permissions=["bookings.view", "bookings.manage"],
        )

        receptionist.is_staff = True
        receptionist.save(update_fields=["is_staff"])

        self.client.force_authenticate(user=receptionist)
        response = self.client.get(self.url)

        self.assertEqual(response.data["staff_role"], "reception")
        self.assertEqual(
            sorted(response.data["permissions"]),
            ["bookings.manage", "bookings.view"],
        )
        self.assertFalse(response.data["is_unlimited"])

    def test_a_disabled_team_member_reports_no_access(self):
        receptionist = User.objects.create_user(
            username="reception",
            email="reception@example.com",
            password="StrongPassword123!",
        )

        StaffAccess.objects.create(
            user=receptionist,
            role=StaffAccess.Role.RECEPTION,
            permissions=["bookings.view"],
            is_active=False,
        )

        receptionist.is_staff = True
        receptionist.save(update_fields=["is_staff"])

        self.client.force_authenticate(user=receptionist)
        response = self.client.get(self.url)

        self.assertIsNone(response.data["staff_role"])
        self.assertEqual(response.data["permissions"], [])
