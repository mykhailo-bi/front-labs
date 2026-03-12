import pytest
from unittest import mock
from django.utils import timezone
from rest_framework import exceptions as drf_exc
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from backend_app import models
from backend_app import auth as auth_module
from backend_app.auth import issue_token_pair
from backend_app.security import hash_password

pytestmark = pytest.mark.django_db

class SimpleJWTAuthenticationTests:
    @pytest.fixture(autouse=True)
    def _setup(self):
        self.user = models.User.objects.create(
            username="jwt_user",
            email="jwt_user@example.com",
            password_hash=hash_password("secret1234"),
            is_admin=False,
        )
        self.auth = auth_module.SimpleJWTAuthentication()

    def test_get_header_and_raw_token(self):
        request = type("R", (), {"META": {}})()
        assert self.auth.get_header(request) is None

        request = type("R", (), {"META": {"HTTP_AUTHORIZATION": "Bearer token"}})()
        header = self.auth.get_header(request)
        assert isinstance(header, bytes)

        assert self.auth.get_raw_token(header) == "token"

    def test_get_raw_token_invalid_header(self):
        with pytest.raises(drf_exc.AuthenticationFailed):
            self.auth.get_raw_token(b"Bearer too many parts")

    def test_get_raw_token_wrong_type(self):
        assert self.auth.get_raw_token(b"Basic token") is None

    def test_get_validated_token_invalid(self):
        with mock.patch("backend_app.auth.AccessToken", side_effect=TokenError("bad")):
            with pytest.raises(drf_exc.AuthenticationFailed):
                self.auth.get_validated_token("bad")

    def test_get_validated_token_blacklisted(self):
        pair = issue_token_pair(user=self.user)
        token = RefreshToken(pair.refresh).access_token
        jti = token["jti"]
        models.BlacklistedToken.objects.create(
            user=self.user,
            jti=jti,
            token_type="access",
            expires_at=timezone.now() + timezone.timedelta(hours=1),
        )
        with pytest.raises(drf_exc.AuthenticationFailed):
            self.auth.get_validated_token(str(token))

    def test_get_user_invalid_claims(self):
        pair = issue_token_pair(user=self.user)
        token = RefreshToken(pair.refresh).access_token

        with mock.patch("backend_app.auth.AccessToken.get", side_effect=[None]):
            with pytest.raises(drf_exc.AuthenticationFailed):
                self.auth.get_user(token)

        with mock.patch("backend_app.auth.AccessToken.get", side_effect=["bad"]):
            with pytest.raises(drf_exc.AuthenticationFailed):
                self.auth.get_user(token)

        with mock.patch("backend_app.auth.models.User.objects.get", side_effect=models.User.DoesNotExist):
            with pytest.raises(drf_exc.AuthenticationFailed):
                self.auth.get_user(token)

        with mock.patch("backend_app.auth.AccessToken.get", side_effect=[self.user.id, None]):
            with pytest.raises(drf_exc.AuthenticationFailed):
                self.auth.get_user(token)

    def test_get_user_tokens_invalidated(self):
        pair = issue_token_pair(user=self.user)
        token = RefreshToken(pair.refresh).access_token
        self.user.tokens_invalidated_at = timezone.now() + timezone.timedelta(hours=1)
        self.user.save(update_fields=["tokens_invalidated_at"])
        with pytest.raises(drf_exc.AuthenticationFailed):
            self.auth.get_user(token)
