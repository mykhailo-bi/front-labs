import pytest
from decimal import Decimal
from rest_framework.test import APIClient
from backend_app import models
from backend_app.auth import issue_token_pair
from backend_app.domain.order_status import OrderStatus
from backend_app.security import hash_password

pytestmark = pytest.mark.django_db


class EcommerceFlowTests:
    @pytest.fixture(autouse=True)
    def _setup(self):
        self.client = APIClient()

        self.product_active = models.Product.objects.create(
            name="T-Shirt",
            description="Basic",
            price=Decimal("5.00"),
            status="active",
            stock_qty=10,
            reserved_qty=0,
        )
        self.product_draft = models.Product.objects.create(
            name="Hidden",
            description="Not visible",
            price=Decimal("9.99"),
            status="draft",
            stock_qty=10,
            reserved_qty=0,
        )

        self.admin = models.User.objects.create(
            username="admin",
            email="admin@example.com",
            password_hash=hash_password("adminpass123"),
            is_admin=True,
        )
        self.admin_token = issue_token_pair(user=self.admin).access

    def _auth(self, token: str):
        return {"HTTP_AUTHORIZATION": f"Bearer {token}"}

    def test_product_visibility_public_vs_admin(self):
        # Public sees only active.
        res = self.client.get("/api/v1/products/")
        assert res.status_code == 200
        ids = {p["id"] for p in res.data["results"]}
        assert self.product_active.id in ids
        assert self.product_draft.id not in ids

        # Admin sees all.
        res = self.client.get("/api/v1/products/", **self._auth(self.admin_token))
        assert res.status_code == 200
        ids = {p["id"] for p in res.data["results"]}
        assert self.product_active.id in ids
        assert self.product_draft.id in ids

    def test_checkout_mark_paid_and_review_eligibility(self):
        # Register user
        res = self.client.post(
            "/api/v1/auth/register/",
            {"username": "john", "email": "john@example.com", "password": "secret1234"},
            format="json",
        )
        assert res.status_code == 201
        access = res.data["access"]
        user = models.User.objects.get(username="john")

        # Add to cart
        res = self.client.post(
            "/api/v1/cart/items/",
            {"product_id": self.product_active.id, "count": 2},
            format="json",
            **self._auth(access),
        )
        assert res.status_code == 201

        # Review before purchase should fail
        res = self.client.post(
            "/api/v1/reviews/",
            {"product_id": self.product_active.id, "rating": 5, "text": "Nice"},
            format="json",
            **self._auth(access),
        )
        assert res.status_code == 400

        # Checkout
        idem = {"HTTP_IDEMPOTENCY_KEY": "checkout-1"}
        assert models.Order.objects.filter(user=user).count() == 0
        res = self.client.post("/api/v1/checkout/", {}, format="json", **self._auth(access), **idem)
        assert res.status_code == 201
        order_id = res.data["id"]
        assert res.data["status"] == "placed"
        assert Decimal(res.data["total"]) == Decimal("10")
        assert models.Order.objects.filter(user=user).count() == 1

        # Checkout idempotency should return same order even though cart is now empty
        res2 = self.client.post(
            "/api/v1/checkout/", {}, format="json", **self._auth(access), **idem
        )
        assert res2.status_code == 201
        assert res2.data["id"] == order_id
        assert models.Order.objects.filter(user=user).count() == 1

        # Mark paid (admin)
        pay_idem = {"HTTP_IDEMPOTENCY_KEY": "pay-1"}
        res = self.client.post(
            "/api/v1/payments/mark-paid/",
            {"order_id": order_id, "reference_id": "stubref"},
            format="json",
            **self._auth(self.admin_token),
            **pay_idem,
        )
        assert res.status_code == 200
        payment_attempt_id = res.data["payment_attempt_id"]
        assert res.data["order"]["status"] == "paid"

        # Mark paid idempotency
        res2 = self.client.post(
            "/api/v1/payments/mark-paid/",
            {"order_id": order_id, "reference_id": "stubref2"},
            format="json",
            **self._auth(self.admin_token),
            **pay_idem,
        )
        assert res2.status_code == 200
        assert res2.data["payment_attempt_id"] == payment_attempt_id

        # Review after paid order should succeed
        res = self.client.post(
            "/api/v1/reviews/",
            {"product_id": self.product_active.id, "rating": 5, "text": "Nice"},
            format="json",
            **self._auth(access),
        )
        assert res.status_code == 201

        # Duplicate review should fail
        res = self.client.post(
            "/api/v1/reviews/",
            {"product_id": self.product_active.id, "rating": 4, "text": "Again"},
            format="json",
            **self._auth(access),
        )
        assert res.status_code == 400

    def test_product_reviews_route_lists_reviews(self):
        # Setup: a user with a paid order for the product and a review
        user = models.User.objects.create(
            username="u_reviews",
            email="u_reviews@example.com",
            password_hash=hash_password("secret1234"),
            is_admin=False,
        )
        token = issue_token_pair(user=user).access

        order = models.Order.objects.create(user=user, status=OrderStatus.PAID)
        models.OrderContent.objects.create(order=order, product=self.product_active, count=1)
        models.Review.objects.create(user=user, product=self.product_active, rating=5, text="ok")

        # Public access should work (no auth header)
        res = self.client.get(f"/api/v1/products/{self.product_active.id}/reviews/")
        assert res.status_code == 200
        # paginated response
        assert "results" in res.data
        assert len(res.data["results"]) >= 1
        assert res.data["results"][0]["product_id"] == self.product_active.id

        # Auth should also work
        res2 = self.client.get(
            f"/api/v1/products/{self.product_active.id}/reviews/",
            **self._auth(token),
        )
        assert res2.status_code == 200
