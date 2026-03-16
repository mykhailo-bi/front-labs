import pytest
from decimal import Decimal
from django.test import override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from backend_app import models
from backend_app.auth import issue_token_pair
from backend_app.security import hash_password

pytestmark = pytest.mark.django_db


class CsvImportLimitTests:
    @pytest.fixture(autouse=True)
    def _setup(self):
        self.client = APIClient()
        self.admin = models.User.objects.create(
            username="admin_csv",
            email="admin_csv@example.com",
            password_hash=hash_password("adminpass123"),
            is_admin=True,
        )
        self.admin_token = issue_token_pair(user=self.admin).access

    def _auth(self):
        return {"HTTP_AUTHORIZATION": f"Bearer {self.admin_token}"}

    @override_settings(CSV_IMPORT_MAX_BYTES=10)
    def test_user_import_rejects_large_file(self):
        content = "email\n" + ("a" * 20)
        upload = SimpleUploadedFile("users.csv", content.encode("utf-8"), content_type="text/csv")
        res = self.client.post(
            "/api/v1/users/import/", {"file": upload}, format="multipart", **self._auth()
        )
        assert res.status_code == 400
        assert "detail" in res.data

    @override_settings(CSV_IMPORT_MAX_ROWS=1)
    def test_product_import_rejects_row_limit(self):
        content = "name\nprod1\nprod2\n"
        upload = SimpleUploadedFile(
            "products.csv", content.encode("utf-8"), content_type="text/csv"
        )
        res = self.client.post(
            "/api/v1/products/import/", {"file": upload}, format="multipart", **self._auth()
        )
        assert res.status_code == 400
        assert "detail" in res.data

    def test_user_import_missing_file(self):
        res = self.client.post("/api/v1/users/import/", {}, format="multipart", **self._auth())
        assert res.status_code == 400
        assert "file" in res.data

    def test_user_import_success_with_defaults_and_integrity_errors(self):
        content = "email,username,password,is_admin,is_email_verified\nuser1@example.com,u1,,1,0\nuser1@example.com,u1,,0,0\n"
        upload = SimpleUploadedFile("users.csv", content.encode("utf-8"), content_type="text/csv")
        res = self.client.post(
            "/api/v1/users/import/", {"file": upload}, format="multipart", **self._auth()
        )
        # First row creates, second triggers integrity error path; API still 200 with counts.
        assert res.status_code == 200
        assert res.data["created"] == 1
        assert res.data["updated"] == 1

    def test_product_import_missing_file(self):
        res = self.client.post("/api/v1/products/import/", {}, format="multipart", **self._auth())
        assert res.status_code == 400
        assert "file" in res.data

    def test_product_import_success_creates_and_updates(self):
        content = (
            "sku,name,price,stock_qty,is_published\nSKU1,Prod1,10.00,5,1\nSKU1,Prod1b,11.00,6,1\n"
        )
        upload = SimpleUploadedFile(
            "products.csv", content.encode("utf-8"), content_type="text/csv"
        )
        res = self.client.post(
            "/api/v1/products/import/", {"file": upload}, format="multipart", **self._auth()
        )
        assert res.status_code == 200
        assert res.data["created"] == 1
        assert res.data["updated"] == 1

    def test_product_import_handles_blank_sku(self):
        content = "sku,name,price,stock_qty,is_published\n,ProdNoSku,5.00,1,1\n"
        upload = SimpleUploadedFile(
            "products.csv", content.encode("utf-8"), content_type="text/csv"
        )
        res = self.client.post(
            "/api/v1/products/import/", {"file": upload}, format="multipart", **self._auth()
        )
        assert res.status_code == 200
        assert res.data["created"] == 1

    def test_export_users_and_products_csv(self):
        models.User.objects.create(
            username="csv_user",
            email="csv_user@example.com",
            password_hash=hash_password("secret1234"),
            is_admin=False,
        )
        res_users = self.client.get("/api/v1/users/export/", **self._auth())
        assert res_users.status_code == 200
        assert "text/csv" in res_users["Content-Type"]
        assert "users.csv" in res_users["Content-Disposition"]

        models.Product.objects.create(
            name="CSVProd",
            description="",
            price=Decimal("3.00"),
            status="active",
            stock_qty=1,
            reserved_qty=0,
            is_published=True,
        )
        res_products = self.client.get("/api/v1/products/export/", **self._auth())
        assert res_products.status_code == 200
        assert "text/csv" in res_products["Content-Type"]
        assert "products.csv" in res_products["Content-Disposition"]
