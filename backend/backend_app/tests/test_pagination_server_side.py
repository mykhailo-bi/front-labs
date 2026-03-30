from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from backend_app import models
from backend_app.auth import issue_token_pair
from backend_app.security import hash_password

pytestmark = pytest.mark.django_db


class ServerSidePaginationTests:
    @pytest.fixture(autouse=True)
    def _setup(self):
        self.client = APIClient()
        self.admin = models.User.objects.create(
            username="admin_pagination",
            email="admin_pagination@example.com",
            password_hash=hash_password("adminpass123"),
            is_admin=True,
            role="admin",
        )
        self.admin_token = issue_token_pair(user=self.admin).access
        self.customer = models.User.objects.create(
            username="customer_pagination",
            email="customer_pagination@example.com",
            password_hash=hash_password("customerpass123"),
        )

    def _auth(self):
        return {"HTTP_AUTHORIZATION": f"Bearer {self.admin_token}"}

    def test_products_list_supports_page_size(self):
        for index in range(12):
            models.Product.objects.create(
                name=f"Product {index}",
                description="demo",
                price=Decimal("9.99"),
                status="active",
                stock_qty=10,
                reserved_qty=0,
                is_published=True,
            )

        response = self.client.get("/api/v1/products/?page=1&page_size=10", **self._auth())

        assert response.status_code == 200
        assert response.data["count"] == 12
        assert len(response.data["results"]) == 10
        assert response.data["next"] is not None

    def test_users_list_supports_page_size(self):
        for index in range(11):
            models.User.objects.create(
                username=f"user_{index}",
                email=f"user_{index}@example.com",
                password_hash=hash_password("secret1234"),
            )

        response = self.client.get("/api/v1/users/?page=1&page_size=10", **self._auth())

        assert response.status_code == 200
        assert response.data["count"] == 13
        assert len(response.data["results"]) == 10
        assert response.data["next"] is not None

    def test_orders_list_supports_page_size(self):
        for _ in range(12):
            models.Order.objects.create(user=self.customer, total=Decimal("19.99"))

        response = self.client.get("/api/v1/orders/?page=1&page_size=10", **self._auth())

        assert response.status_code == 200
        assert response.data["count"] == 12
        assert len(response.data["results"]) == 10
        assert response.data["next"] is not None
