from decimal import Decimal

from django.db import transaction
from django.db.utils import IntegrityError
from django.test import TestCase
from django.test import override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from backend_app import models
from backend_app.auth import issue_token_pair
from backend_app.domain.order_status import OrderStatus
from backend_app.security import hash_password


class EcommerceFlowTests(TestCase):
    def setUp(self):
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
        self.assertEqual(res.status_code, 200)
        ids = {p["id"] for p in res.data["results"]}
        self.assertIn(self.product_active.id, ids)
        self.assertNotIn(self.product_draft.id, ids)

        # Admin sees all.
        res = self.client.get("/api/v1/products/", **self._auth(self.admin_token))
        self.assertEqual(res.status_code, 200)
        ids = {p["id"] for p in res.data["results"]}
        self.assertIn(self.product_active.id, ids)
        self.assertIn(self.product_draft.id, ids)

    def test_checkout_mark_paid_and_review_eligibility(self):
        # Register user
        res = self.client.post(
            "/api/v1/auth/register/",
            {"username": "john", "email": "john@example.com", "password": "secret1234"},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        access = res.data["access"]
        user = models.User.objects.get(username="john")

        # Add to cart
        res = self.client.post(
            "/api/v1/cart/items/",
            {"product_id": self.product_active.id, "count": 2},
            format="json",
            **self._auth(access),
        )
        self.assertEqual(res.status_code, 201)

        # Review before purchase should fail
        res = self.client.post(
            "/api/v1/reviews/",
            {"product_id": self.product_active.id, "rating": 5, "text": "Nice"},
            format="json",
            **self._auth(access),
        )
        self.assertEqual(res.status_code, 400)

        # Checkout
        idem = {"HTTP_IDEMPOTENCY_KEY": "checkout-1"}
        self.assertEqual(models.Order.objects.filter(user=user).count(), 0)
        res = self.client.post("/api/v1/checkout/", {}, format="json", **self._auth(access), **idem)
        self.assertEqual(res.status_code, 201)
        order_id = res.data["id"]
        self.assertEqual(res.data["status"], "placed")
        self.assertEqual(Decimal(res.data["total"]), Decimal("10"))
        self.assertEqual(models.Order.objects.filter(user=user).count(), 1)

        # Checkout idempotency should return same order even though cart is now empty
        res2 = self.client.post("/api/v1/checkout/", {}, format="json", **self._auth(access), **idem)
        self.assertEqual(res2.status_code, 201)
        self.assertEqual(res2.data["id"], order_id)
        self.assertEqual(models.Order.objects.filter(user=user).count(), 1)

        # Mark paid (admin)
        pay_idem = {"HTTP_IDEMPOTENCY_KEY": "pay-1"}
        res = self.client.post(
            "/api/v1/payments/mark-paid/",
            {"order_id": order_id, "reference_id": "stubref"},
            format="json",
            **self._auth(self.admin_token),
            **pay_idem,
        )
        self.assertEqual(res.status_code, 200)
        payment_attempt_id = res.data["payment_attempt_id"]
        self.assertEqual(res.data["order"]["status"], "paid")

        # Mark paid idempotency
        res2 = self.client.post(
            "/api/v1/payments/mark-paid/",
            {"order_id": order_id, "reference_id": "stubref2"},
            format="json",
            **self._auth(self.admin_token),
            **pay_idem,
        )
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.data["payment_attempt_id"], payment_attempt_id)

        # Review after paid order should succeed
        res = self.client.post(
            "/api/v1/reviews/",
            {"product_id": self.product_active.id, "rating": 5, "text": "Nice"},
            format="json",
            **self._auth(access),
        )
        self.assertEqual(res.status_code, 201)

        # Duplicate review should fail
        res = self.client.post(
            "/api/v1/reviews/",
            {"product_id": self.product_active.id, "rating": 4, "text": "Again"},
            format="json",
            **self._auth(access),
        )
        self.assertEqual(res.status_code, 400)

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
        self.assertEqual(res.status_code, 200)
        # paginated response
        self.assertIn("results", res.data)
        self.assertGreaterEqual(len(res.data["results"]), 1)
        self.assertEqual(res.data["results"][0]["product_id"], self.product_active.id)

        # Auth should also work
        res2 = self.client.get(
            f"/api/v1/products/{self.product_active.id}/reviews/",
            **self._auth(token),
        )
        self.assertEqual(res2.status_code, 200)


class UserOrdersRouteAuthTests(TestCase):
    def setUp(self):
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
        res = self.client.get(f"/api/v1/users/{self.user1.id}/orders/", **self._auth(self.user1_token))
        self.assertEqual(res.status_code, 200)
        self.assertIn("results", res.data)
        self.assertEqual(len(res.data["results"]), 1)
        self.assertEqual(res.data["results"][0]["user_id"], self.user1.id)

    def test_user_orders_other_forbidden_for_non_admin(self):
        res = self.client.get(f"/api/v1/users/{self.user2.id}/orders/", **self._auth(self.user1_token))
        self.assertEqual(res.status_code, 403)

    def test_user_orders_other_allowed_for_admin(self):
        res = self.client.get(f"/api/v1/users/{self.user2.id}/orders/", **self._auth(self.admin_token))
        self.assertEqual(res.status_code, 200)
        self.assertIn("results", res.data)
        self.assertEqual(len(res.data["results"]), 1)
        self.assertEqual(res.data["results"][0]["user_id"], self.user2.id)

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
        self.assertEqual(res.status_code, 201)
        self.assertIn("id", res.data)
        self.assertIn("url", res.data)
        self.assertTrue(res.data["url"].startswith("/media/"))

        img_id = res.data["id"]
        self.assertTrue(models.Image.objects.filter(id=img_id).exists())


class DbConstraintTests(TestCase):
    def setUp(self):
        self.user = models.User.objects.create(
            username="u1",
            email="u1@example.com",
            password_hash=hash_password("secret1234"),
            is_admin=False,
        )

    def test_order_idempotency_key_unique_per_user_when_not_null(self):
        models.Order.objects.create(user=self.user, idempotency_key="idem-1")

        # With a DB constraint, the second insert must fail.
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                models.Order.objects.create(user=self.user, idempotency_key="idem-1")

    def test_payment_attempt_idempotency_key_unique_per_order_when_not_null(self):
        order = models.Order.objects.create(user=self.user, idempotency_key="order-idem-1")
        models.PaymentAttempt.objects.create(order=order, idempotency_key="pay-idem-1")

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                models.PaymentAttempt.objects.create(order=order, idempotency_key="pay-idem-1")


class ApiEnvelopeAndOpsTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_healthz(self):
        res = self.client.get("/healthz")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["status"], "ok")

    def test_error_envelope_has_request_id(self):
        # Trigger a validation error.
        res = self.client.post(
            "/api/v1/auth/register/",
            {"username": "u", "email": "bad", "password": "x"},
            format="json",
            HTTP_X_REQUEST_ID="test-req-1",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("code", res.data)
        self.assertIn("message", res.data)
        self.assertIn("request_id", res.data)
        self.assertEqual(res.data["request_id"], "test-req-1")


class ReservationExpiryCommandTests(TestCase):
    def setUp(self):
        self.user = models.User.objects.create(
            username="u1",
            email="u1@example.com",
            password_hash=hash_password("secret1234"),
            is_admin=False,
        )
        self.product = models.Product.objects.create(
            name="P",
            description=None,
            price=Decimal("1.00"),
            status="active",
            stock_qty=10,
            reserved_qty=0,
        )

    def test_release_expired_reservations_cancels_and_releases(self):
        from django.utils import timezone
        from django.core.management import call_command

        order = models.Order.objects.create(
            user=self.user,
            status=OrderStatus.PLACED,
            reservation_expires_at=timezone.now() - timezone.timedelta(seconds=1),
        )
        models.OrderContent.objects.create(order=order, product=self.product, count=2)
        # Pretend we reserved stock during checkout.
        models.Product.objects.filter(id=self.product.id).update(reserved_qty=2)

        call_command("release_expired_reservations")

        order.refresh_from_db()
        self.product.refresh_from_db()
        self.assertEqual(order.status, OrderStatus.CANCELLED)
        self.assertEqual(self.product.reserved_qty, 0)


class MePatchUniquenessTests(TestCase):
    def setUp(self):
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
        self.assertEqual(res.status_code, 400)
        self.assertIn("details", res.data)
        self.assertIn("email", res.data["details"])

    def test_me_patch_username_unique_conflict_returns_400(self):
        res = self.client.patch(
            "/api/v1/me/",
            {"username": self.user2.username},
            format="json",
            **self._auth(self.user1_token),
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("details", res.data)
        self.assertIn("username", res.data["details"])

    def test_me_patch_phone_unique_conflict_returns_400(self):
        res = self.client.patch(
            "/api/v1/me/",
            {"phone": self.user2.phone},
            format="json",
            **self._auth(self.user1_token),
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("details", res.data)
        self.assertIn("phone", res.data["details"])
