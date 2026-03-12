import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from backend_app import models
from backend_app.auth import issue_token_pair
from backend_app.security import hash_password

pytestmark = pytest.mark.django_db

class ChangePasswordTests:
    @pytest.fixture(autouse=True)
    def _setup(self):
        self.client = APIClient()
        self.user = models.User.objects.create(
            username="cp_user",
            email="cp@example.com",
            password_hash=hash_password("secret1234"),
            is_admin=False,
        )
        self.access = issue_token_pair(user=self.user).access

    def _auth(self):
        return {"HTTP_AUTHORIZATION": f"Bearer {self.access}"}

    def test_change_password_requires_current_and_invalidates_tokens(self):
        res_wrong = self.client.post(
            "/api/v1/auth/change-password/",
            {"current_password": "wrong", "new_password": "newpass123"},
            format="json",
            **self._auth(),
        )
        assert res_wrong.status_code == 400

        old_hash = self.user.password_hash
        res_ok = self.client.post(
            "/api/v1/auth/change-password/",
            {"current_password": "secret1234", "new_password": "newpass123"},
            format="json",
            **self._auth(),
        )
        assert res_ok.status_code == 200
        self.user.refresh_from_db()
        assert self.user.password_hash != old_hash
        assert self.user.tokens_invalidated_at > timezone.now() - timezone.timedelta(minutes=5)
