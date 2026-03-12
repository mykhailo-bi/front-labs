import pytest
from unittest import mock
from rest_framework import exceptions as drf_exc
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from django.utils import timezone
from backend_app import models
from backend_app import auth as auth_module
from backend_app.auth import issue_token_pair
from backend_app.security import hash_password

pytestmark = pytest.mark.django_db

class AuthHelperTests:
    @pytest.fixture(autouse=True)
    def _setup(self):
        self.user = models.User.objects.create(
            username="authh_user",
            email="authh@example.com",
            password_hash=hash_password("secret1234"),
            is_admin=False,
        )

    def test_refresh_access_token_token_error_raises_auth_failed(self):
        with mock.patch("backend_app.auth.RefreshToken", side_effect=TokenError("bad")):
            with pytest.raises(drf_exc.AuthenticationFailed):
                auth_module.refresh_access_token(refresh_token="invalid")

    def test_refresh_access_token_revoked_by_tokens_invalidated_at(self):
        pair = issue_token_pair(user=self.user)
        self.user.tokens_invalidated_at = timezone.now() + timezone.timedelta(hours=1)
        self.user.save(update_fields=["tokens_invalidated_at"])
        with pytest.raises(drf_exc.AuthenticationFailed):
            auth_module.refresh_access_token(refresh_token=pair.refresh)

    def test_refresh_access_token_invalid_user_and_claims(self):
        pair = issue_token_pair(user=self.user)
        with mock.patch("backend_app.auth.RefreshToken.get", side_effect=[None]):
            with pytest.raises(drf_exc.AuthenticationFailed):
                auth_module.refresh_access_token(refresh_token=pair.refresh)

        with mock.patch("backend_app.auth.RefreshToken.get", side_effect=["bad", "bad", "jti", "iat"]):
            with pytest.raises(drf_exc.AuthenticationFailed):
                auth_module.refresh_access_token(refresh_token=pair.refresh)

        with mock.patch("backend_app.auth.models.User.objects.get", side_effect=models.User.DoesNotExist):
            with pytest.raises(drf_exc.AuthenticationFailed):
                auth_module.refresh_access_token(refresh_token=pair.refresh)

    def test_refresh_access_token_blacklisted_and_missing_iat(self):
        pair = issue_token_pair(user=self.user)
        jti = RefreshToken(pair.refresh)["jti"]
        models.BlacklistedToken.objects.create(
            user=self.user,
            jti=jti,
            token_type="refresh",
            expires_at=timezone.now() + timezone.timedelta(hours=1),
        )
        with pytest.raises(drf_exc.AuthenticationFailed):
            auth_module.refresh_access_token(refresh_token=pair.refresh)

        with mock.patch(
            "backend_app.auth.RefreshToken.get",
            side_effect=[self.user.id, "jti", None, None],
        ):
            with pytest.raises(drf_exc.AuthenticationFailed):
                auth_module.refresh_access_token(refresh_token=pair.refresh)

    def test_refresh_access_token_user_not_found_branch(self):
        pair = issue_token_pair(user=self.user)
        with mock.patch("backend_app.auth.models.User.objects.get", side_effect=models.User.DoesNotExist):
            with pytest.raises(drf_exc.AuthenticationFailed):
                auth_module.refresh_access_token(refresh_token=pair.refresh)
