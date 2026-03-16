import pytest
from django.test import override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from backend_app import models
from backend_app.auth import issue_token_pair
from backend_app.domain.order_status import OrderStatus
from backend_app.security import hash_password

pytestmark = pytest.mark.django_db


class UserOrdersRouteAuthTests:
    @pytest.fixture(autouse=True)
    def _setup(self):
        self.client = APIClient()

        self.admin = models.User.objects.create(
            username="admin2",
            email="admin2@example.com",
            password_hash=hash_password("adminpass123"),
            is_admin=True,
        )
        self.admin_token = issue_token_pair(user=self.admin).access

        self.user1 = models.User.objects.create(
            username="u1_orders",
            email="u1_orders@example.com",
            password_hash=hash_password("secret1234"),
            is_admin=False,
        )
        self.user2 = models.User.objects.create(
            username="u2_orders",
            email="u2_orders@example.com",
            password_hash=hash_password("secret1234"),
            is_admin=False,
        )
        self.user1_token = issue_token_pair(user=self.user1).access
        self.user2_token = issue_token_pair(user=self.user2).access

        # Create orders for both users
        models.Order.objects.create(user=self.user1, status=OrderStatus.PLACED)
        models.Order.objects.create(user=self.user2, status=OrderStatus.PLACED)

    def _auth(self, token: str):
        return {"HTTP_AUTHORIZATION": f"Bearer {token}"}

    def test_user_orders_self_allowed(self):
        res = self.client.get(
            f"/api/v1/users/{self.user1.id}/orders/", **self._auth(self.user1_token)
        )
        assert res.status_code == 200
        assert "results" in res.data
        assert len(res.data["results"]) == 1
        assert res.data["results"][0]["user_id"] == self.user1.id

    def test_user_orders_other_forbidden_for_non_admin(self):
        res = self.client.get(
            f"/api/v1/users/{self.user2.id}/orders/", **self._auth(self.user1_token)
        )
        assert res.status_code == 403

    def test_user_orders_other_allowed_for_admin(self):
        res = self.client.get(
            f"/api/v1/users/{self.user2.id}/orders/", **self._auth(self.admin_token)
        )
        assert res.status_code == 200
        assert "results" in res.data
        assert len(res.data["results"]) == 1
        assert res.data["results"][0]["user_id"] == self.user2.id

    @override_settings(MEDIA_ROOT="/tmp/front-labs-test-media")
    def test_image_upload_admin_creates_image_record(self):
        # Minimal PNG-ish bytes; we validate only content-type in the API.
        upload = SimpleUploadedFile(
            name="test.png",
            content=b"\x89PNG\r\n\x1a\n" + b"0" * 10,
            content_type="image/png",
        )

        res = self.client.post(
            "/api/v1/images/upload/",
            {"file": upload},
            format="multipart",
            **self._auth(self.admin_token),
        )
        assert res.status_code == 201
        assert "id" in res.data
        assert "url" in res.data
        assert res.data["url"].startswith("/media/")

        img_id = res.data["id"]
        assert models.Image.objects.filter(id=img_id).exists()
