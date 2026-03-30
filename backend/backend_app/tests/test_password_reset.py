import pytest
from datetime import timedelta
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from backend_app import models
from backend_app.security import hash_password

pytestmark = pytest.mark.django_db


class PasswordResetTests:
    @pytest.fixture(autouse=True)
    def _setup(self):
        self.client = APIClient()
        self.user = models.User.objects.create(
            username="pw_user",
            email="pw_user@example.com",
            password_hash=hash_password("secret1234"),
        )

    def test_password_reset_request_deletes_expired_and_creates_token(self):
        expired = models.PasswordResetToken.objects.create(
            user=self.user,
            token="expired",
            expires_at=timezone.now() - timedelta(seconds=1),
        )
        models.PasswordResetToken.objects.create(
            user=self.user,
            token="valid",
            expires_at=timezone.now() + timedelta(hours=1),
        )

        res = self.client.post(
            "/api/v1/auth/password-reset/",
            {"email": self.user.email},
            format="json",
        )
        assert res.status_code == 204
        # Expired tokens cleaned up; new token created
        assert not models.PasswordResetToken.objects.filter(id=expired.id).exists()
        active = models.PasswordResetToken.objects.filter(
            user=self.user, used_at__isnull=True, expires_at__gt=timezone.now()
        )
        assert active.count() == 1
        # Ensure newest token replaces older active ones
        newest = active.order_by("-created_at").first()
        assert newest is not None

    def test_password_reset_request_respects_max_tokens(self):
        with override_settings(PASSWORD_RESET_MAX_ACTIVE_TOKENS_PER_USER=2):
            models.PasswordResetToken.objects.create(
                user=self.user,
                token="old1",
                expires_at=timezone.now() + timedelta(hours=1),
            )
            models.PasswordResetToken.objects.create(
                user=self.user,
                token="old2",
                expires_at=timezone.now() + timedelta(hours=1),
            )
            res = self.client.post(
                "/api/v1/auth/password-reset/",
                {"email": self.user.email},
                format="json",
            )
            assert res.status_code == 204
            active = models.PasswordResetToken.objects.filter(
                user=self.user, used_at__isnull=True, expires_at__gt=timezone.now()
            )
            assert active.count() == 2

    @override_settings(PASSWORD_RESET_MAX_ACTIVE_TOKENS_PER_USER=0)
    def test_password_reset_request_cap_zero_deletes_all(self):
        models.PasswordResetToken.objects.create(
            user=self.user,
            token="t1",
            expires_at=timezone.now() + timedelta(hours=1),
        )
        res = self.client.post(
            "/api/v1/auth/password-reset/",
            {"email": self.user.email},
            format="json",
        )
        assert res.status_code == 204
        assert models.PasswordResetToken.objects.filter(user=self.user).count() == 1

    def test_password_reset_request_unknown_email_still_204(self):
        res = self.client.post(
            "/api/v1/auth/password-reset/",
            {"email": "missing@example.com"},
            format="json",
        )
        assert res.status_code == 204

    def test_password_reset_confirm_changes_password_and_marks_used(self):
        prt = models.PasswordResetToken.objects.create(
            user=self.user,
            token="reset-token",
            expires_at=timezone.now() + timedelta(hours=1),
        )
        old_hash = self.user.password_hash

        # Also create a second valid token to ensure per-user cap cleanup doesn't delete this one
        other = models.PasswordResetToken.objects.create(
            user=self.user,
            token="another-valid",
            expires_at=timezone.now() + timedelta(hours=1),
        )

        res = self.client.post(
            "/api/v1/auth/password-reset/confirm/",
            {"token": prt.token, "password": "newpass123"},
            format="json",
        )
        assert res.status_code == 200

        self.user.refresh_from_db()
        assert self.user.password_hash != old_hash

        # Tokens issued before reset should be invalidated
        assert self.user.tokens_invalidated_at > timezone.now() - timedelta(minutes=5)

        prt.refresh_from_db()
        assert prt.used_at is not None
        other.refresh_from_db()
        assert other.used_at is not None

        res_again = self.client.post(
            "/api/v1/auth/password-reset/confirm/",
            {"token": prt.token, "password": "anotherpass"},
            format="json",
        )
        assert res_again.status_code == 400

    def test_password_reset_confirm_invalid_token(self):
        res = self.client.post(
            "/api/v1/auth/password-reset/confirm/",
            {"token": "missing", "password": "newpass123"},
            format="json",
        )
        assert res.status_code == 400
