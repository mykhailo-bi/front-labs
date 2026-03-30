import pytest
from decimal import Decimal
from rest_framework.test import APIClient
from backend_app import models
from backend_app.auth import issue_token_pair
from backend_app.security import hash_password

pytestmark = pytest.mark.django_db


class CartWishlistSavedAddressTests:
    @pytest.fixture(autouse=True)
    def _setup(self):
        self.client = APIClient()
        self.user = models.User.objects.create(
            username="cart_user",
            email="cart_user@example.com",
            password_hash=hash_password("secret1234"),
        )
        self.user_token = issue_token_pair(user=self.user).access
        self.other_user = models.User.objects.create(
            username="cart_other",
            email="cart_other@example.com",
            password_hash=hash_password("secret1234"),
        )

        self.product_active = models.Product.objects.create(
            name="Active",
            description="",
            price=Decimal("5.00"),
            status="active",
            stock_qty=10,
            reserved_qty=0,
            is_published=True,
        )
        self.product_other = models.Product.objects.create(
            name="Other",
            description="",
            price=Decimal("2.00"),
            status="active",
            stock_qty=10,
            reserved_qty=0,
            is_published=True,
        )
        self.product_draft = models.Product.objects.create(
            name="Draft",
            description="",
            price=Decimal("3.00"),
            status="draft",
            stock_qty=5,
            reserved_qty=0,
            is_published=True,
        )
        self.product_low_stock = models.Product.objects.create(
            name="LowStock",
            description="",
            price=Decimal("4.00"),
            status="active",
            stock_qty=1,
            reserved_qty=0,
            is_published=True,
        )

    def _auth(self):
        return {"HTTP_AUTHORIZATION": f"Bearer {self.user_token}"}

    def test_cart_rejects_draft_product(self):
        res = self.client.post(
            "/api/v1/cart/items/",
            {"product_id": self.product_draft.id, "count": 1},
            format="json",
            **self._auth(),
        )
        assert res.status_code == 400
        assert "details" in res.data
        assert "product_id" in res.data.get("details", {})

    def test_cart_rejects_insufficient_stock(self):
        res = self.client.post(
            "/api/v1/cart/items/",
            {"product_id": self.product_low_stock.id, "count": 3},
            format="json",
            **self._auth(),
        )
        assert res.status_code == 400
        assert "details" in res.data
        assert "count" in res.data.get("details", {})

    def test_cart_rejects_zero_count(self):
        res = self.client.post(
            "/api/v1/cart/items/",
            {"product_id": self.product_active.id, "count": 0},
            format="json",
            **self._auth(),
        )
        assert res.status_code == 400
        assert "count" in res.data.get("details", {})

    def test_cart_upsert_updates_existing(self):
        res1 = self.client.post(
            "/api/v1/cart/items/",
            {"product_id": self.product_active.id, "count": 1},
            format="json",
            **self._auth(),
        )
        assert res1.status_code == 201

        res2 = self.client.post(
            "/api/v1/cart/items/",
            {"product_id": self.product_active.id, "count": 3},
            format="json",
            **self._auth(),
        )
        assert res2.status_code == 201
        assert res2.data["count"] == 3

    def test_cart_summary_returns_totals(self):
        self.client.post(
            "/api/v1/cart/items/",
            {"product_id": self.product_active.id, "count": 2},
            format="json",
            **self._auth(),
        )
        self.client.post(
            "/api/v1/cart/items/",
            {"product_id": self.product_other.id, "count": 1},
            format="json",
            **self._auth(),
        )

        res = self.client.get("/api/v1/cart/items/summary/", **self._auth())
        assert res.status_code == 200
        assert res.data["subtotal"] == "12.00"
        assert res.data["total"] == "12.00"
        assert len(res.data["items"]) == 2

    def test_wishlist_duplicate_returns_400(self):
        res1 = self.client.post(
            "/api/v1/wishlist/",
            {"product_id": self.product_active.id},
            format="json",
            **self._auth(),
        )
        assert res1.status_code == 201

        res2 = self.client.post(
            "/api/v1/wishlist/",
            {"product_id": self.product_active.id},
            format="json",
            **self._auth(),
        )
        assert res2.status_code == 400
        assert "details" in res2.data
        assert "product_id" in res2.data.get("details", {})

    def test_saved_items_duplicate_returns_400(self):
        res1 = self.client.post(
            "/api/v1/saved/",
            {"product_id": self.product_other.id},
            format="json",
            **self._auth(),
        )
        assert res1.status_code == 201

        res2 = self.client.post(
            "/api/v1/saved/",
            {"product_id": self.product_other.id},
            format="json",
            **self._auth(),
        )
        assert res2.status_code == 400
        assert "details" in res2.data
        assert "product_id" in res2.data.get("details", {})

    def test_wishlist_and_saved_user_auto_assignment(self):
        res1 = self.client.post(
            "/api/v1/wishlist/",
            {"user_id": self.other_user.id, "product_id": self.product_other.id},
            format="json",
            **self._auth(),
        )
        assert res1.status_code == 201
        assert res1.data["user_id"] == self.user.id

        res2 = self.client.post(
            "/api/v1/saved/",
            {"user_id": self.other_user.id, "product_id": self.product_active.id},
            format="json",
            **self._auth(),
        )
        assert res2.status_code == 201
        assert res2.data["user_id"] == self.user.id

    def test_address_default_uniqueness(self):
        payload = {
            "full_name": "User",
            "phone": "+1000000000",
            "line1": "123 St",
            "city": "C",
            "postal_code": "00000",
            "country": "X",
            "is_default": True,
        }
        res1 = self.client.post("/api/v1/addresses/", payload, format="json", **self._auth())
        assert res1.status_code == 201

        res2 = self.client.post("/api/v1/addresses/", payload, format="json", **self._auth())
        assert res2.status_code == 400
        assert "details" in res2.data
        assert "is_default" in res2.data.get("details", {})

    def test_address_user_is_forced_to_request_user(self):
        res = self.client.post(
            "/api/v1/addresses/",
            {
                "user_id": self.other_user.id,
                "full_name": "Other",
                "phone": "+1000000000",
                "line1": "123 St",
                "city": "C",
                "postal_code": "00000",
                "country": "X",
            },
            format="json",
            **self._auth(),
        )
        assert res.status_code == 201
        assert res.data["user_id"] == self.user.id

    def test_address_default_uniqueness_self_update(self):
        models.Address.objects.create(
            user=self.user,
            full_name="User",
            phone="+100",
            line1="L1",
            city="C",
            postal_code="000",
            country="X",
            is_default=True,
        )
        addr2 = models.Address.objects.create(
            user=self.user,
            full_name="User2",
            phone="+101",
            line1="L2",
            city="C",
            postal_code="001",
            country="X",
            is_default=False,
        )
        res = self.client.patch(
            f"/api/v1/addresses/{addr2.id}/",
            {"is_default": True},
            format="json",
            **self._auth(),
        )
        assert res.status_code == 400
