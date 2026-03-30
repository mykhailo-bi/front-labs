import pytest
from decimal import Decimal
from unittest import mock
from rest_framework.test import APIClient, APIRequestFactory
from backend_app import models
from backend_app.auth import issue_token_pair
from backend_app.domain.order_status import OrderStatus
from backend_app.security import hash_password
from backend_app import health as health_module

pytestmark = pytest.mark.django_db


class ReportsAndHealthTests:
    @pytest.fixture(autouse=True)
    def _setup(self):
        self.client = APIClient()
        self.admin = models.User.objects.create(
            username="admin_reports",
            email="admin_reports@example.com",
            password_hash=hash_password("adminpass123"),
            is_admin=True,
        )
        self.admin_token = issue_token_pair(user=self.admin).access
        self.admin2 = models.User.objects.create(
            username="admin_reports2",
            email="admin_reports2@example.com",
            password_hash=hash_password("adminpass123"),
            is_admin=True,
        )
        self.admin2_token = issue_token_pair(user=self.admin2).access

    def _auth_admin2(self):
        return {"HTTP_AUTHORIZATION": f"Bearer {self.admin2_token}"}

    def _auth_admin(self):
        return {"HTTP_AUTHORIZATION": f"Bearer {self.admin_token}"}

    def test_report_aggregate_counts_paid_only(self):
        user = models.User.objects.create(
            username="report_user",
            email="report_user@example.com",
            password_hash=hash_password("secret1234"),
            is_admin=False,
        )
        models.Product.objects.create(
            name="R1",
            description="",
            price=Decimal("10.00"),
            status="active",
            stock_qty=5,
            reserved_qty=0,
            is_published=True,
        )
        models.Product.objects.create(
            name="R2",
            description="",
            price=Decimal("20.00"),
            status="active",
            stock_qty=5,
            reserved_qty=0,
            is_published=True,
        )
        models.Order.objects.create(
            user=user,
            status=OrderStatus.PAID,
            total=Decimal("10.00"),
            subtotal=Decimal("10.00"),
        )
        models.Order.objects.create(
            user=user,
            status=OrderStatus.PLACED,
            total=Decimal("5.00"),
            subtotal=Decimal("5.00"),
        )

        res = self.client.get("/api/v1/reports/aggregate/", **self._auth_admin())
        assert res.status_code == 200
        assert res.data["products"] == 2
        assert res.data["orders"] == 2
        assert res.data["paid_orders"] == 1
        assert res.data["revenue"] == str(Decimal("10.00"))
        assert res.data["currency"] == "USD"

    def test_healthz_and_readyz(self):
        res_health = self.client.get("/healthz")
        assert res_health.status_code == 200
        assert res_health.data["status"] == "ok"

        res_ready = self.client.get("/readyz")
        assert res_ready.status_code == 200
        assert res_ready.data["status"] == "ready"

    def test_health_readyz_cache_and_pending_migrations(self):
        health_module._READYZ_LAST_OK_AT = None
        factory = APIRequestFactory()
        request = factory.get("/readyz")

        class DummyExecutor:
            def __init__(self, connection):
                self.loader = type(
                    "L", (), {"graph": type("G", (), {"leaf_nodes": lambda self: []})()}
                )()

            def migration_plan(self, leaf_nodes):
                return []

        class DummyCursor:
            def __init__(self):
                self.executed = []

            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                return False

            def execute(self, sql):
                self.executed.append(sql)

            def fetchone(self):
                return (1,)

        with (
            mock.patch("backend_app.health.MigrationExecutor", DummyExecutor),
            mock.patch(
                "backend_app.health.connection.cursor", return_value=DummyCursor()
            ),
        ):
            response = health_module.readyz(request)
            assert response.status_code == 200
            assert response.data["status"] == "ready"

            # Cached path
            response_cached = health_module.readyz(request)
            assert response_cached.status_code == 200
            assert response_cached.data["status"] == "ready"

        class DummyExecutorPending(DummyExecutor):
            def migration_plan(self, leaf_nodes):
                return [(type("M", (), {"app_label": "app", "name": "0001"})(), None)]

        health_module._READYZ_LAST_OK_AT = None
        with (
            mock.patch("backend_app.health.MigrationExecutor", DummyExecutorPending),
            mock.patch(
                "backend_app.health.connection.cursor", return_value=DummyCursor()
            ),
        ):
            response_pending = health_module.readyz(request)
            assert response_pending.status_code == 503
            assert response_pending.data["status"] == "not_ready"
            assert "app.0001" in response_pending.data["pending_migrations"]
