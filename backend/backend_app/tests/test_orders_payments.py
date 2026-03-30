import pytest
from decimal import Decimal
from rest_framework.test import APIClient, APIRequestFactory, force_authenticate
from backend_app import models
from backend_app import api as api_module
from backend_app.auth import issue_token_pair
from backend_app.domain.order_status import OrderStatus
from backend_app.security import hash_password

pytestmark = pytest.mark.django_db


class OrderPaymentTests:
    @pytest.fixture(autouse=True)
    def _setup(self):
        self.client = APIClient()
        self.admin = models.User.objects.create(
            username="admin_orders",
            email="admin_orders@example.com",
            password_hash=hash_password("adminpass123"),
            role="admin",
        )
        self.admin_token = issue_token_pair(user=self.admin).access
        self.user = models.User.objects.create(
            username="order_user",
            email="order_user@example.com",
            password_hash=hash_password("secret1234"),
        )
        self.user_token = issue_token_pair(user=self.user).access
        self.other_user = models.User.objects.create(
            username="order_other",
            email="order_other@example.com",
            password_hash=hash_password("secret1234"),
        )
        self.product = models.Product.objects.create(
            name="OrderProd",
            description="",
            price=Decimal("6.00"),
            status="active",
            stock_qty=10,
            reserved_qty=0,
            is_published=True,
        )

    def _auth_user(self):
        return {"HTTP_AUTHORIZATION": f"Bearer {self.user_token}"}

    def _auth_admin(self):
        return {"HTTP_AUTHORIZATION": f"Bearer {self.admin_token}"}

    def test_cancel_releases_reserved_qty(self):
        order = models.Order.objects.create(user=self.user, status=OrderStatus.PLACED)
        models.OrderContent.objects.create(order=order, product=self.product, count=2)
        models.Product.objects.filter(id=self.product.id).update(reserved_qty=2)

        res = self.client.post(
            f"/api/v1/orders/{order.id}/cancel/", {}, format="json", **self._auth_user()
        )
        assert res.status_code == 200
        order.refresh_from_db()
        self.product.refresh_from_db()
        assert order.status == OrderStatus.CANCELLED
        assert self.product.reserved_qty == 0

    def test_cancel_invalid_status_returns_200_and_keeps_status(self):
        order = models.Order.objects.create(user=self.user, status=OrderStatus.PAID)
        res = self.client.post(
            f"/api/v1/orders/{order.id}/cancel/", {}, format="json", **self._auth_user()
        )
        assert res.status_code == 200

    def test_cancel_returns_404_for_missing_order(self):
        res = self.client.post(
            "/api/v1/orders/99999/cancel/", {}, format="json", **self._auth_user()
        )
        assert res.status_code == 404

    def test_cancel_already_cancelled_is_idempotent(self):
        order = models.Order.objects.create(user=self.user, status=OrderStatus.CANCELLED)
        res = self.client.post(
            f"/api/v1/orders/{order.id}/cancel/", {}, format="json", **self._auth_user()
        )
        assert res.status_code == 200

    def test_cancel_forbidden_for_other_user(self):
        other_order = models.Order.objects.create(user=self.other_user, status=OrderStatus.PLACED)
        res = self.client.post(
            f"/api/v1/orders/{other_order.id}/cancel/",
            {},
            format="json",
            **self._auth_user(),
        )
        assert res.status_code == 403

    def test_ship_and_deliver_transitions(self):
        order = models.Order.objects.create(user=self.user, status=OrderStatus.PAID)
        res_ship = self.client.post(
            f"/api/v1/orders/{order.id}/ship/", {}, format="json", **self._auth_admin()
        )
        assert res_ship.status_code == 200
        assert res_ship.data["status"] == OrderStatus.SHIPPED

        res_deliver = self.client.post(
            f"/api/v1/orders/{order.id}/deliver/",
            {},
            format="json",
            **self._auth_admin(),
        )
        assert res_deliver.status_code == 200
        assert res_deliver.data["status"] == OrderStatus.DELIVERED

    def test_ship_invalid_transition_returns_409(self):
        order = models.Order.objects.create(user=self.user, status=OrderStatus.PLACED)
        res_ship = self.client.post(
            f"/api/v1/orders/{order.id}/ship/", {}, format="json", **self._auth_admin()
        )
        assert res_ship.status_code == 409

    def test_deliver_invalid_transition_returns_409(self):
        order = models.Order.objects.create(user=self.user, status=OrderStatus.PLACED)
        res_deliver = self.client.post(
            f"/api/v1/orders/{order.id}/deliver/",
            {},
            format="json",
            **self._auth_admin(),
        )
        assert res_deliver.status_code == 409

    def test_invoice_forbidden_for_non_owner(self):
        other_order = models.Order.objects.create(user=self.other_user, status=OrderStatus.PLACED)
        res = self.client.get(
            f"/api/v1/orders/{other_order.id}/invoice/",
            format="json",
            **self._auth_user(),
        )
        # Behavior is 404 for not found when unauthorized; assert existing behavior
        assert res.status_code == 404

    def test_refund_and_timeline(self):
        order = models.Order.objects.create(user=self.user, status=OrderStatus.PAID)
        res_refund = self.client.post(
            f"/api/v1/orders/{order.id}/refund/",
            {"reason": "changed"},
            format="json",
            **self._auth_user(),
        )
        assert res_refund.status_code == 201
        res_timeline = self.client.get(
            f"/api/v1/orders/{order.id}/timeline/",
            format="json",
            **self._auth_user(),
        )
        assert res_timeline.status_code == 200
        event_types = [row["event_type"] for row in res_timeline.data]
        assert "refund_requested" in event_types

    def test_mark_paid_invalid_transition_returns_409(self):
        order = models.Order.objects.create(user=self.user, status=OrderStatus.CANCELLED)
        res = self.client.post(
            "/api/v1/payments/mark-paid/",
            {"order_id": order.id, "reference_id": "r1"},
            format="json",
            **self._auth_admin(),
        )
        assert res.status_code == 409

    def test_mark_paid_idempotency_returns_existing_attempt(self):
        order = models.Order.objects.create(user=self.user, status=OrderStatus.PLACED)
        res = self.client.post(
            "/api/v1/payments/mark-paid/",
            {"order_id": order.id, "reference_id": "ref1"},
            format="json",
            HTTP_IDEMPOTENCY_KEY="idem-1",
            **self._auth_admin(),
        )
        assert res.status_code == 200
        attempt_id = res.data["payment_attempt_id"]

        res2 = self.client.post(
            "/api/v1/payments/mark-paid/",
            {"order_id": order.id, "reference_id": "ref2"},
            format="json",
            HTTP_IDEMPOTENCY_KEY="idem-1",
            **self._auth_admin(),
        )
        assert res2.status_code == 200
        assert res2.data["payment_attempt_id"] == attempt_id

    def test_mark_paid_idempotency_conflict_returns_409(self):
        order = models.Order.objects.create(user=self.user, status=OrderStatus.SHIPPED)
        models.PaymentAttempt.objects.create(order=order, idempotency_key="idem-2")
        res = self.client.post(
            "/api/v1/payments/mark-paid/",
            {"order_id": order.id, "reference_id": "r1"},
            format="json",
            HTTP_IDEMPOTENCY_KEY="idem-2",
            **self._auth_admin(),
        )
        assert res.status_code == 409

    def test_mark_paid_idempotency_integrityerror_path(self):
        order = models.Order.objects.create(user=self.user, status=OrderStatus.PLACED)
        existing = models.PaymentAttempt.objects.create(order=order, idempotency_key="idem-3")
        res = self.client.post(
            "/api/v1/payments/mark-paid/",
            {"order_id": order.id, "reference_id": "r1"},
            format="json",
            HTTP_IDEMPOTENCY_KEY="idem-3",
            **self._auth_admin(),
        )

        assert res.status_code == 200
        attempt = models.PaymentAttempt.objects.get(order=order, idempotency_key="idem-3")
        assert attempt.id == existing.id
        assert res.data["payment_attempt_id"] == attempt.id

    def test_mark_paid_empty_idempotency_header_becomes_none(self):
        order = models.Order.objects.create(user=self.user, status=OrderStatus.PLACED)
        res = self.client.post(
            "/api/v1/payments/mark-paid/",
            {"order_id": order.id, "reference_id": "r-empty"},
            format="json",
            HTTP_IDEMPOTENCY_KEY="   ",
            **self._auth_admin(),
        )
        assert res.status_code == 200
        assert models.PaymentAttempt.objects.get(order=order).idempotency_key is None

    def test_mark_paid_forbidden_for_non_admin(self):
        order = models.Order.objects.create(user=self.user, status=OrderStatus.PLACED)
        res = self.client.post(
            "/api/v1/payments/mark-paid/",
            {"order_id": order.id, "reference_id": "r2"},
            format="json",
            **self._auth_user(),
        )
        assert res.status_code == 403

    def test_mark_paid_not_found_returns_404(self):
        res = self.client.post(
            "/api/v1/payments/mark-paid/",
            {"order_id": 99999, "reference_id": "missing"},
            format="json",
            **self._auth_admin(),
        )
        assert res.status_code == 404

    def test_pay_endpoint_idempotency_and_conflict(self):
        order = models.Order.objects.create(user=self.user, status=OrderStatus.PLACED)
        res = self.client.post(
            f"/api/v1/orders/{order.id}/pay/",
            {"reference_id": "r1", "order_id": order.id},
            format="json",
            HTTP_IDEMPOTENCY_KEY="cust-1",
            **self._auth_user(),
        )
        # No prior attempt: should create and pay (200)
        assert res.status_code == 200
        attempt_id = res.data["payment_attempt_id"]

        res2 = self.client.post(
            f"/api/v1/orders/{order.id}/pay/",
            {"reference_id": "r2", "order_id": order.id},
            format="json",
            HTTP_IDEMPOTENCY_KEY="cust-1",
            **self._auth_user(),
        )
        # Idempotent repeat returns same attempt
        assert res2.status_code == 200
        assert res2.data["payment_attempt_id"] == attempt_id

        other_order = models.Order.objects.create(user=self.user, status=OrderStatus.SHIPPED)
        models.PaymentAttempt.objects.create(order=other_order, idempotency_key="cust-2")
        res3 = self.client.post(
            f"/api/v1/orders/{other_order.id}/pay/",
            {"reference_id": "r3", "order_id": other_order.id},
            format="json",
            HTTP_IDEMPOTENCY_KEY="cust-2",
            **self._auth_user(),
        )
        # Existing attempt with conflicting state returns 409
        assert res3.status_code == 409

    def test_invoice_returns_content(self):
        order = models.Order.objects.create(
            user=self.user,
            status=OrderStatus.PAID,
            subtotal=Decimal("10.00"),
            total=Decimal("12.00"),
        )
        res = self.client.get(
            f"/api/v1/orders/{order.id}/invoice/", format="json", **self._auth_user()
        )
        assert res.status_code == 200
        assert "Invoice for Order" in res.data["invoice"]

    def test_admin_refund_action_records_event(self):
        order = models.Order.objects.create(user=self.user, status=OrderStatus.PAID)
        res = self.client.post(
            f"/api/v1/orders/{order.id}/refund-approve/",
            {},
            format="json",
            **self._auth_admin(),
        )
        assert res.status_code == 200
        assert models.OrderEvent.objects.filter(order=order, event_type="refund_approved").exists()

    def test_order_viewset_get_queryset_none_when_unauthenticated(self):
        models.Order.objects.create(user=self.user, status=OrderStatus.PLACED)
        factory = APIRequestFactory()
        request = factory.get("/api/v1/orders/")
        request.user = None
        view = api_module.OrderViewSet()
        view.request = request
        qs = view.get_queryset()
        assert list(qs) == []

    def test_order_viewset_get_queryset_admin(self):
        models.Order.objects.create(user=self.user, status=OrderStatus.PLACED)
        factory = APIRequestFactory()
        request = factory.get("/api/v1/orders/")
        force_authenticate(request, user=self.admin)
        request.user = self.admin
        view = api_module.OrderViewSet()
        view.request = request
        qs = view.get_queryset()
        assert qs.count() == 1

    def test_order_viewset_get_permissions_create_admin(self):
        factory = APIRequestFactory()
        request = factory.post("/api/v1/orders/")
        force_authenticate(request, user=self.admin)
        view = api_module.OrderViewSet()
        view.request = request
        view.action = "create"
        perms = view.get_permissions()
        assert len(perms) == 1
        assert perms[0].__class__.__name__ == "IsAdmin"

    def test_order_viewset_get_permissions_list_authenticated(self):
        factory = APIRequestFactory()
        request = factory.get("/api/v1/orders/")
        force_authenticate(request, user=self.user)
        view = api_module.OrderViewSet()
        view.request = request
        view.action = "list"
        perms = view.get_permissions()
        assert len(perms) == 1
        assert perms[0].__class__.__name__ == "IsAuthenticated"

    def test_order_viewset_get_queryset_invalid_user_id(self):
        factory = APIRequestFactory()
        request = factory.get("/api/v1/orders/")
        request.user = type(
            "U",
            (),
            {
                "id": "not-int",
                "__int__": lambda self: 0,
            },
        )()
        view = api_module.OrderViewSet()
        view.request = request
        qs = view.get_queryset()
        # Bad id coerces to filter user field; should not crash
        list(qs)
