import pytest
from decimal import Decimal
from rest_framework.test import APIClient
from backend_app import models
from backend_app.auth import issue_token_pair
from backend_app.security import hash_password

pytestmark = pytest.mark.django_db

class ProductFiltersAndImagesTests:
    @pytest.fixture(autouse=True)
    def _setup(self):
        self.client = APIClient()
        self.admin = models.User.objects.create(
            username="admin_filters",
            email="admin_filters@example.com",
            password_hash=hash_password("adminpass123"),
            is_admin=True,
        )
        self.admin_token = issue_token_pair(user=self.admin).access
        self.cat1 = models.Category.objects.create(name="Cat1", slug="cat1")
        self.cat2 = models.Category.objects.create(name="Cat2", slug="cat2")

    def _admin_auth(self):
        return {"HTTP_AUTHORIZATION": f"Bearer {self.admin_token}"}

    def test_product_filters_min_max_and_category(self):
        models.Product.objects.create(
            name="Cheap",
            description="p1",
            price=Decimal("5.00"),
            status="active",
            stock_qty=10,
            reserved_qty=0,
            is_published=True,
            category=self.cat1,
        )
        p2 = models.Product.objects.create(
            name="Target",
            description="p2",
            price=Decimal("15.00"),
            status="active",
            stock_qty=10,
            reserved_qty=0,
            is_published=True,
            category=self.cat1,
        )
        models.Product.objects.create(
            name="OtherCat",
            description="p3",
            price=Decimal("12.00"),
            status="active",
            stock_qty=10,
            reserved_qty=0,
            is_published=True,
            category=self.cat2,
        )

        res = self.client.get("/api/v1/products/?min_price=10&max_price=20&category=cat1")
        assert res.status_code == 200
        ids = {row["id"] for row in res.data["results"]}
        assert ids == {p2.id}

    def test_product_filters_invalid_min_price_is_ignored(self):
        models.Product.objects.create(
            name="Cheap",
            description="p1",
            price=Decimal("5.00"),
            status="active",
            stock_qty=10,
            reserved_qty=0,
            is_published=True,
            category=self.cat1,
        )
        res = self.client.get("/api/v1/products/?min_price=bad")
        assert res.status_code == 200

    def test_product_list_admin_sees_draft_and_unpublished(self):
        draft = models.Product.objects.create(
            name="Drafty",
            description="d",
            price=Decimal("7.00"),
            status="draft",
            stock_qty=1,
            reserved_qty=0,
            is_published=True,
            category=self.cat1,
        )
        hidden = models.Product.objects.create(
            name="Hidden",
            description="h",
            price=Decimal("9.00"),
            status="active",
            stock_qty=1,
            reserved_qty=0,
            is_published=False,
            category=self.cat1,
        )

        res_admin = self.client.get("/api/v1/products/", **self._admin_auth())
        assert res_admin.status_code == 200
        ids_admin = {row["id"] for row in res_admin.data["results"]}
        assert draft.id in ids_admin
        assert hidden.id in ids_admin

        res_public = self.client.get("/api/v1/products/")
        assert res_public.status_code == 200
        ids_public = {row["id"] for row in res_public.data["results"]}
        assert draft.id not in ids_public
        assert hidden.id not in ids_public

    def test_set_images_validations_and_success(self):
        product = models.Product.objects.create(
            name="HasImages",
            description="p",
            price=Decimal("3.00"),
            status="active",
            stock_qty=5,
            reserved_qty=0,
            is_published=True,
            category=self.cat1,
        )
        img1 = models.Image.objects.create(url="/media/img1.png")
        img2 = models.Image.objects.create(url="/media/img2.png")

        res_dup = self.client.post(
            f"/api/v1/products/{product.id}/images/set/",
            {"image_ids": [img1.id, img1.id]},
            format="json",
            **self._admin_auth(),
        )
        assert res_dup.status_code == 400
        assert "image_ids" in res_dup.data
        assert models.ProductImage.objects.filter(product=product).count() == 0

        res_missing = self.client.post(
            f"/api/v1/products/{product.id}/images/set/",
            {"image_ids": [img1.id, 99999]},
            format="json",
            **self._admin_auth(),
        )
        assert res_missing.status_code == 400

        res_type = self.client.post(
            f"/api/v1/products/{product.id}/images/set/",
            {"image_ids": "not-a-list"},
            format="json",
            **self._admin_auth(),
        )
        assert res_type.status_code == 400

        res_nonint = self.client.post(
            f"/api/v1/products/{product.id}/images/set/",
            {"image_ids": ["abc"]},
            format="json",
            **self._admin_auth(),
        )
        assert res_nonint.status_code == 400

        res_ok = self.client.post(
            f"/api/v1/products/{product.id}/images/set/",
            {"image_ids": [img1.id, img2.id]},
            format="json",
            **self._admin_auth(),
        )
        assert res_ok.status_code == 200
        assert models.ProductImage.objects.filter(product=product).count() == 2

    def test_set_image_alt_text_and_not_found(self):
        product = models.Product.objects.create(
            name="AltText",
            description="p",
            price=Decimal("3.00"),
            status="active",
            stock_qty=5,
            reserved_qty=0,
            is_published=True,
            category=self.cat1,
        )
        img = models.Image.objects.create(url="/media/img3.png")

        res_missing = self.client.post(
            f"/api/v1/products/{product.id}/images/alt-text/",
            {"image_id": img.id, "alt_text": "alt"},
            format="json",
            **self._admin_auth(),
        )
        assert res_missing.status_code == 404

        models.ProductImage.objects.create(product=product, image=img)
        res_ok = self.client.post(
            f"/api/v1/products/{product.id}/images/alt-text/",
            {"image_id": img.id, "alt_text": "alt"},
            format="json",
            **self._admin_auth(),
        )
        assert res_ok.status_code == 200
