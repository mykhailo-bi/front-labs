import pytest
from rest_framework.test import APIClient
from backend_app import models
from backend_app.auth import issue_token_pair
from backend_app.security import hash_password

pytestmark = pytest.mark.django_db


class MePatchUniquenessTests:
    @pytest.fixture(autouse=True)
    def _setup(self):
        self.client = APIClient()

        self.user1 = models.User.objects.create(
            username="u1",
            email="u1@example.com",
            phone="+10000000001",
            password_hash=hash_password("secret1234"),
            is_admin=False,
        )
        self.user2 = models.User.objects.create(
            username="u2",
            email="u2@example.com",
            phone="+10000000002",
            password_hash=hash_password("secret1234"),
            is_admin=False,
        )
        self.user1_token = issue_token_pair(user=self.user1).access

    def _auth(self, token: str):
        return {"HTTP_AUTHORIZATION": f"Bearer {token}"}

    def test_me_patch_email_unique_conflict_returns_400(self):
        res = self.client.patch(
            "/api/v1/me/",
            {"email": self.user2.email},
            format="json",
            **self._auth(self.user1_token),
        )
        assert res.status_code == 400
        assert "details" in res.data
        assert "email" in res.data["details"]

    def test_me_patch_username_unique_conflict_returns_400(self):
        res = self.client.patch(
            "/api/v1/me/",
            {"username": self.user2.username},
            format="json",
            **self._auth(self.user1_token),
        )
        assert res.status_code == 400
        assert "details" in res.data
        assert "username" in res.data["details"]

    def test_me_patch_phone_unique_conflict_returns_400(self):
        res = self.client.patch(
            "/api/v1/me/",
            {"phone": self.user2.phone},
            format="json",
            **self._auth(self.user1_token),
        )
        assert res.status_code == 400
        assert "details" in res.data
        assert "phone" in res.data["details"]
