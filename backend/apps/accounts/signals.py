from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import AccountProfile


User = get_user_model()


@receiver(
    post_save,
    sender=User,
    dispatch_uid="accounts.ensure_account_profile",
)
def ensure_account_profile(sender, instance, created, **kwargs):
    """
    Guarantee every user has an AccountProfile, including
    users created by `createsuperuser` or the admin, which
    never go through RegistrationSerializer.
    """

    if created:
        AccountProfile.objects.get_or_create(
            user=instance
        )
