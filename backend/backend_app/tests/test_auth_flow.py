import pytest
from unittest import mock
from django.db.utils import IntegrityError
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from backend_app import models
from backend_app.auth import issue_token_pair
from backend_app.security import hash_password

pytestmark = pytest.mark.django_db

class AuthFlowTests:
    @pytest.fixture(autouse=True)
    def _setup(self):
        self.client = APIClient()
        self.user = models.User.objects.create(
            username="auth_user",
            email="auth_user@example.com",
            password_hash=hash_password("secret1234"),
            is_admin=False,
        )
        self.other_user = models.User.objects.create(
            username="auth_user2",
            email="auth_user2@example.com",
            password_hash=hash_password("secret1234"),
            is_admin=False,
        )

    def _auth(self, token: str):
        return {"HTTP_AUTHORIZATION": f"Bearer {token}"}

    def test_login_refresh_logout_flow(self):
        res = self.client.post(
            "/api/v1/auth/login/",
            {"username_or_email": self.user.username, "password": "secret1234"},
            format="json",
        )
        assert res.status_code == 200
        access = res.data["access"]
        refresh = res.data["refresh"]

        res_refresh = self.client.post(
            "/api/v1/auth/refresh/",
            {"refresh": refresh},
            format="json",
        )
        assert res_refresh.status_code == 200
        assert "access" in res_refresh.data

        res_logout = self.client.post(
            "/api/v1/auth/logout/",
            {"refresh": refresh},
            format="json",
            **self._auth(access),
        )
        assert res_logout.status_code == 204
        rt = RefreshToken(refresh)
        assert models.BlacklistedToken.objects.filter(jti=rt["jti"]).exists()

    def test_register_and_login_errors(self):
        res = self.client.post(
            "/api/v1/auth/register/",
            {"username": "reg1", "email": "reg1@example.com", "password": "secret1234"},
            format="json",
        )
        assert res.status_code == 201
        res_dup = self.client.post(
            "/api/v1/auth/register/",
            {"username": "reg1", "email": "reg1@example.com", "password": "secret1234"},
            format="json",
        )
        assert res_dup.status_code == 400

        res_login_bad = self.client.post(
            "/api/v1/auth/login/",
            {"username_or_email": self.user.username, "password": "wrong"},
            format="json",
        )
        assert res_login_bad.status_code == 400

    def test_logout_invalid_token(self):
        access = issue_token_pair(user=self.user).access
        res = self.client.post(
            "/api/v1/auth/logout/",
            {"refresh": "bad"},
            format="json",
            **self._auth(access),
        )
        assert res.status_code == 400

    def test_change_password_short_new_password(self):
        access = issue_token_pair(user=self.user).access
        res = self.client.post(
            "/api/v1/auth/change-password/",
            {"current_password": "secret1234", "new_password": "short"},
            format="json",
            **self._auth(access),
        )
        assert res.status_code == 400

    def test_me_unique_integrityerror_returns_400(self):
        other = models.User.objects.create(
            username="other_user",
            email="other@example.com",
            password_hash=hash_password("secret1234"),
            is_admin=False,
        )
        access = issue_token_pair(user=self.user).access
        with mock.patch("backend_app.api.MeSerializer.save", side_effect=IntegrityError):
            res = self.client.patch(
                "/api/v1/me/",
                {"email": other.email},
                format="json",
                **self._auth(access),
            )
            assert res.status_code == 400
            assert "details" in res.data
