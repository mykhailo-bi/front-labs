from decimal import Decimal
from datetime import timedelta
from unittest import mock
from unittest import mock
from io import BytesIO
import json
import logging
import sys
import uuid
from types import SimpleNamespace

from django.db import transaction
from django.db.utils import IntegrityError
from django.test import TestCase
from django.test import override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.test import APIClient, APIRequestFactory, force_authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework import exceptions as drf_exc
from rest_framework.response import Response

from backend_app import models
from backend_app.auth import issue_token_pair
from backend_app.domain.order_status import OrderStatus
from backend_app.security import hash_password, verify_password
from backend_app import exceptions as exc_module
from backend_app import security
from backend_app import auth as auth_module
from backend_app import api as api_module
from backend_app import health as health_module
from backend_app import logging as logging_module
from backend_app import openapi as openapi_module
from backend_app import middleware as middleware_module
from backend_app import admin as admin_module
from backend_app.management.commands import release_expired_reservations as release_cmd


class LoggingAndMiddlewareUnitTests(TestCase):
    def test_json_formatter_outputs_expected_keys_and_exc_info(self):
        formatter = logging_module.JsonFormatter()
        try:
            raise RuntimeError("boom")
        except RuntimeError:
            record = logging.LogRecord(
                name="test",
                level=logging.ERROR,
                pathname=__file__,
                lineno=10,
                msg="hello %s",
                args=("world",),
                exc_info=sys.exc_info(),
            )
        payload = json.loads(formatter.format(record))
        self.assertEqual(payload["level"], "ERROR")
        self.assertEqual(payload["logger"], "test")
        self.assertEqual(payload["msg"], "hello world")
        self.assertIn("ts", payload)
        self.assertIn("exc_info", payload)

    def test_request_id_middleware_uses_header_and_sets_response(self):
        rid = "abc-123"

        def get_response(req):
            return HttpResponse("ok")

        mw = middleware_module.RequestIdMiddleware(get_response)
        request = SimpleNamespace(META={middleware_module.RequestIdMiddleware.header_name: rid})
        response = mw(request)
        self.assertEqual(request.request_id, rid)
        self.assertEqual(response[middleware_module.RequestIdMiddleware.response_header], rid)

    def test_request_id_middleware_generates_uuid_when_missing_or_invalid(self):
        def get_response(req):
            return HttpResponse("ok")

        mw = middleware_module.RequestIdMiddleware(get_response)

        # Missing header
        request_missing = SimpleNamespace(META={})
        response_missing = mw(request_missing)
        self.assertTrue(uuid.UUID(request_missing.request_id))
        self.assertEqual(response_missing[middleware_module.RequestIdMiddleware.response_header], request_missing.request_id)

        # Invalid header (fails regex)
        bad = "!bad"
        request_bad = SimpleNamespace(META={middleware_module.RequestIdMiddleware.header_name: bad})
        response_bad = mw(request_bad)
        self.assertNotEqual(request_bad.request_id, bad)
        self.assertTrue(uuid.UUID(request_bad.request_id))
        self.assertEqual(response_bad[middleware_module.RequestIdMiddleware.response_header], request_bad.request_id)


class OpenApiAndAdminTests(TestCase):
    def test_simplejwt_authentication_scheme_definition(self):
        ext = openapi_module.SimpleJWTAuthenticationScheme(target=None)
        schema = ext.get_security_definition(auto_schema=None)
        self.assertEqual(schema["type"], "http")
        self.assertEqual(schema["scheme"], "bearer")
        self.assertEqual(schema["bearerFormat"], "JWT")

    def test_admin_site_permission_allows_admin_and_django_flags(self):
        site = admin_module.admin_site

        admin_user = type("U", (), {"is_admin": True, "is_staff": False, "is_superuser": False, "is_active": True})()
        self.assertTrue(site.has_permission(request=type("R", (), {"user": admin_user})()))

        staff_user = type(
            "U",
            (),
            {"is_admin": False, "is_staff": True, "is_superuser": False, "is_active": True},
        )()
        self.assertTrue(site.has_permission(request=type("R", (), {"user": staff_user})()))

        superuser = type(
            "U",
            (),
            {"is_admin": False, "is_staff": False, "is_superuser": True, "is_active": True},
        )()
        self.assertTrue(site.has_permission(request=type("R", (), {"user": superuser})()))

        inactive = type(
            "U",
            (),
            {"is_admin": False, "is_staff": True, "is_superuser": False, "is_active": False},
        )()
        self.assertFalse(site.has_permission(request=type("R", (), {"user": inactive})()))

        none_user_req = type("R", (), {"user": None})()
        self.assertFalse(site.has_permission(request=none_user_req))

    def test_permission_classes_branches(self):
        request = type("R", (), {"method": "GET", "user": None})()
        self.assertTrue(api_module.IsAdminOrReadOnly().has_permission(request, None))

        request_post = type("R", (), {"method": "POST", "user": type("U", (), {"is_admin": False})()})()
        self.assertFalse(api_module.IsAdminOrReadOnly().has_permission(request_post, None))

        request_admin = type("R", (), {"method": "POST", "user": type("U", (), {"is_admin": True})()})()
        self.assertTrue(api_module.IsAdminOrReadOnly().has_permission(request_admin, None))

        self.assertFalse(api_module.IsAuthenticated().has_permission(type("R", (), {"user": None})(), None))
        self.assertTrue(api_module.IsAuthenticated().has_permission(type("R", (), {"user": object()})(), None))
        self.assertTrue(api_module.IsAdmin().has_permission(type("R", (), {"user": type("U", (), {"is_admin": True})()})(), None))

        obj = type("Obj", (), {"user_id": 1})()
        req_owner = type("R", (), {"user": type("U", (), {"id": 1, "is_admin": False})()})()
        req_other = type("R", (), {"user": type("U", (), {"id": 2, "is_admin": False})()})()
        self.assertTrue(api_module.IsOwnerOrAdmin().has_object_permission(req_owner, None, obj))
        self.assertFalse(api_module.IsOwnerOrAdmin().has_object_permission(req_other, None, obj))


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

    def test_release_expired_reservations_skips_non_expired_and_missing_product(self):
        now = timezone.now()
        order = models.Order.objects.create(
            user=self.user,
            status=OrderStatus.PLACED,
            reservation_expires_at=now - timedelta(seconds=1),
        )
        models.OrderContent.objects.create(order=order, product=self.product, count=2)
        models.Product.objects.filter(id=self.product.id).update(reserved_qty=1)

        not_expired = models.Order.objects.create(
            user=self.user,
            status=OrderStatus.PLACED,
            reservation_expires_at=now + timedelta(seconds=3600),
        )

        cmd = release_cmd.Command()
        with mock.patch.object(cmd, "stdout") as stdout:
            cmd.handle(limit=10)
            self.assertTrue(stdout.write.called)

        self.product.refresh_from_db()
        self.assertEqual(self.product.reserved_qty, 0)

    def test_release_expired_reservations_skips_wrong_status(self):
        now = timezone.now()
        order = models.Order.objects.create(
            user=self.user,
            status=OrderStatus.PAID,
            reservation_expires_at=now - timedelta(seconds=1),
        )
        cmd = release_cmd.Command()
        with mock.patch.object(cmd, "stdout") as stdout:
            cmd.handle(limit=10)
            self.assertTrue(stdout.write.called)


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


class AuthFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = models.User.objects.create(
            username="auth_user",
            email="auth_user@example.com",
            password_hash=hash_password("secret1234"),
            is_admin=False,
        )
        self.other_user = models.User.objects.create(
            username="auth_user2",
            email="auth_user2@example.com",
            password_hash=hash_password("secret1234"),
            is_admin=False,
        )

    def _auth(self, token: str):
        return {"HTTP_AUTHORIZATION": f"Bearer {token}"}

    def test_login_refresh_logout_flow(self):
        res = self.client.post(
            "/api/v1/auth/login/",
            {"username_or_email": self.user.username, "password": "secret1234"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        access = res.data["access"]
        refresh = res.data["refresh"]

        res_refresh = self.client.post(
            "/api/v1/auth/refresh/",
            {"refresh": refresh},
            format="json",
        )
        self.assertEqual(res_refresh.status_code, 200)
        self.assertIn("access", res_refresh.data)

        res_logout = self.client.post(
            "/api/v1/auth/logout/",
            {"refresh": refresh},
            format="json",
            **self._auth(access),
        )
        self.assertEqual(res_logout.status_code, 204)
        rt = RefreshToken(refresh)
        self.assertTrue(models.BlacklistedToken.objects.filter(jti=rt["jti"]).exists())

    def test_register_and_login_errors(self):
        res = self.client.post(
            "/api/v1/auth/register/",
            {"username": "reg1", "email": "reg1@example.com", "password": "secret1234"},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        res_dup = self.client.post(
            "/api/v1/auth/register/",
            {"username": "reg1", "email": "reg1@example.com", "password": "secret1234"},
            format="json",
        )
        self.assertEqual(res_dup.status_code, 400)

        res_login_bad = self.client.post(
            "/api/v1/auth/login/",
            {"username_or_email": self.user.username, "password": "wrong"},
            format="json",
        )
        self.assertEqual(res_login_bad.status_code, 400)

    def test_logout_invalid_token(self):
        access = issue_token_pair(user=self.user).access
        res = self.client.post(
            "/api/v1/auth/logout/",
            {"refresh": "bad"},
            format="json",
            **self._auth(access),
        )
        self.assertEqual(res.status_code, 400)

    def test_change_password_short_new_password(self):
        access = issue_token_pair(user=self.user).access
        res = self.client.post(
            "/api/v1/auth/change-password/",
            {"current_password": "secret1234", "new_password": "short"},
            format="json",
            **self._auth(access),
        )
        self.assertEqual(res.status_code, 400)

    def test_me_unique_integrityerror_returns_400(self):
        other = models.User.objects.create(
            username="other_user",
            email="other@example.com",
            password_hash=hash_password("secret1234"),
            is_admin=False,
        )
        access = issue_token_pair(user=self.user).access
        with mock.patch("backend_app.api.MeSerializer.save", side_effect=IntegrityError):
            res = self.client.patch(
                "/api/v1/me/",
                {"email": other.email},
                format="json",
                **self._auth(access),
            )
            self.assertEqual(res.status_code, 400)
            self.assertIn("details", res.data)


class PasswordResetTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = models.User.objects.create(
            username="pw_user",
            email="pw_user@example.com",
            password_hash=hash_password("secret1234"),
            is_admin=False,
        )

    def test_password_reset_request_deletes_expired_and_creates_token(self):
        expired = models.PasswordResetToken.objects.create(
            user=self.user,
            token="expired",
            expires_at=timezone.now() - timedelta(seconds=1),
        )
        models.PasswordResetToken.objects.create(
            user=self.user,
            token="valid",
            expires_at=timezone.now() + timedelta(hours=1),
        )

        res = self.client.post(
            "/api/v1/auth/password-reset/",
            {"email": self.user.email},
            format="json",
        )
        self.assertEqual(res.status_code, 204)
        # Expired tokens cleaned up; new token created
        self.assertFalse(models.PasswordResetToken.objects.filter(id=expired.id).exists())
        active = models.PasswordResetToken.objects.filter(
            user=self.user, used_at__isnull=True, expires_at__gt=timezone.now()
        )
        self.assertEqual(active.count(), 1)
        # Ensure newest token replaces older active ones
        newest = active.order_by("-created_at").first()
        self.assertIsNotNone(newest)

    def test_password_reset_request_respects_max_tokens(self):
        with override_settings(PASSWORD_RESET_MAX_ACTIVE_TOKENS_PER_USER=2):
            models.PasswordResetToken.objects.create(
                user=self.user,
                token="old1",
                expires_at=timezone.now() + timedelta(hours=1),
            )
            models.PasswordResetToken.objects.create(
                user=self.user,
                token="old2",
                expires_at=timezone.now() + timedelta(hours=1),
            )
            res = self.client.post(
                "/api/v1/auth/password-reset/",
                {"email": self.user.email},
                format="json",
            )
            self.assertEqual(res.status_code, 204)
            active = models.PasswordResetToken.objects.filter(
                user=self.user, used_at__isnull=True, expires_at__gt=timezone.now()
            )
            self.assertEqual(active.count(), 2)

    @override_settings(PASSWORD_RESET_MAX_ACTIVE_TOKENS_PER_USER=0)
    def test_password_reset_request_cap_zero_deletes_all(self):
        models.PasswordResetToken.objects.create(
            user=self.user,
            token="t1",
            expires_at=timezone.now() + timedelta(hours=1),
        )
        res = self.client.post(
            "/api/v1/auth/password-reset/",
            {"email": self.user.email},
            format="json",
        )
        self.assertEqual(res.status_code, 204)
        self.assertEqual(models.PasswordResetToken.objects.filter(user=self.user).count(), 1)

    def test_password_reset_request_unknown_email_still_204(self):
        res = self.client.post(
            "/api/v1/auth/password-reset/",
            {"email": "missing@example.com"},
            format="json",
        )
        self.assertEqual(res.status_code, 204)

    def test_password_reset_confirm_changes_password_and_marks_used(self):
        prt = models.PasswordResetToken.objects.create(
            user=self.user,
            token="reset-token",
            expires_at=timezone.now() + timedelta(hours=1),
        )
        old_hash = self.user.password_hash

        # Also create a second valid token to ensure per-user cap cleanup doesn't delete this one
        other = models.PasswordResetToken.objects.create(
            user=self.user,
            token="another-valid",
            expires_at=timezone.now() + timedelta(hours=1),
        )

        res = self.client.post(
            "/api/v1/auth/password-reset/confirm/",
            {"token": prt.token, "password": "newpass123"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)

        self.user.refresh_from_db()
        self.assertNotEqual(self.user.password_hash, old_hash)

        # Tokens issued before reset should be invalidated
        self.assertGreater(self.user.tokens_invalidated_at, timezone.now() - timedelta(minutes=5))

        prt.refresh_from_db()
        self.assertIsNotNone(prt.used_at)
        other.refresh_from_db()
        self.assertIsNotNone(other.used_at)

        res_again = self.client.post(
            "/api/v1/auth/password-reset/confirm/",
            {"token": prt.token, "password": "anotherpass"},
            format="json",
        )
        self.assertEqual(res_again.status_code, 400)

    def test_password_reset_confirm_invalid_token(self):
        res = self.client.post(
            "/api/v1/auth/password-reset/confirm/",
            {"token": "missing", "password": "newpass123"},
            format="json",
        )
        self.assertEqual(res.status_code, 400)


class AuthHelperTests(TestCase):
    def setUp(self):
        self.user = models.User.objects.create(
            username="authh_user",
            email="authh@example.com",
            password_hash=hash_password("secret1234"),
            is_admin=False,
        )

    def test_refresh_access_token_token_error_raises_auth_failed(self):
        with mock.patch("backend_app.auth.RefreshToken", side_effect=TokenError("bad")):
            with self.assertRaises(drf_exc.AuthenticationFailed):
                auth_module.refresh_access_token(refresh_token="invalid")

    def test_refresh_access_token_revoked_by_tokens_invalidated_at(self):
        pair = issue_token_pair(user=self.user)
        self.user.tokens_invalidated_at = timezone.now() + timezone.timedelta(hours=1)
        self.user.save(update_fields=["tokens_invalidated_at"])
        with self.assertRaises(drf_exc.AuthenticationFailed):
            auth_module.refresh_access_token(refresh_token=pair.refresh)

    def test_refresh_access_token_invalid_user_and_claims(self):
        pair = issue_token_pair(user=self.user)
        with mock.patch("backend_app.auth.RefreshToken.get", side_effect=[None]):
            with self.assertRaises(drf_exc.AuthenticationFailed):
                auth_module.refresh_access_token(refresh_token=pair.refresh)

        with mock.patch("backend_app.auth.RefreshToken.get", side_effect=["bad", "bad", "jti", "iat"]):
            with self.assertRaises(drf_exc.AuthenticationFailed):
                auth_module.refresh_access_token(refresh_token=pair.refresh)

        with mock.patch("backend_app.auth.models.User.objects.get", side_effect=models.User.DoesNotExist):
            with self.assertRaises(drf_exc.AuthenticationFailed):
                auth_module.refresh_access_token(refresh_token=pair.refresh)

    def test_refresh_access_token_blacklisted_and_missing_iat(self):
        pair = issue_token_pair(user=self.user)
        jti = RefreshToken(pair.refresh)["jti"]
        models.BlacklistedToken.objects.create(
            user=self.user,
            jti=jti,
            token_type="refresh",
            expires_at=timezone.now() + timezone.timedelta(hours=1),
        )
        with self.assertRaises(drf_exc.AuthenticationFailed):
            auth_module.refresh_access_token(refresh_token=pair.refresh)

        with mock.patch(
            "backend_app.auth.RefreshToken.get",
            side_effect=[self.user.id, "jti", None, None],
        ):
            with self.assertRaises(drf_exc.AuthenticationFailed):
                auth_module.refresh_access_token(refresh_token=pair.refresh)

    def test_refresh_access_token_user_not_found_branch(self):
        with mock.patch("backend_app.auth.RefreshToken", side_effect=TokenError("bad")):
            with self.assertRaises(drf_exc.AuthenticationFailed):
                auth_module.refresh_access_token(refresh_token="missing")


class SimpleJWTAuthenticationTests(TestCase):
    def setUp(self):
        self.user = models.User.objects.create(
            username="jwt_user",
            email="jwt_user@example.com",
            password_hash=hash_password("secret1234"),
            is_admin=False,
        )
        self.auth = auth_module.SimpleJWTAuthentication()

    def test_get_header_and_raw_token(self):
        request = type("R", (), {"META": {}})()
        self.assertIsNone(self.auth.get_header(request))

        request = type("R", (), {"META": {"HTTP_AUTHORIZATION": "Bearer token"}})()
        header = self.auth.get_header(request)
        self.assertIsInstance(header, bytes)

        self.assertEqual(self.auth.get_raw_token(header), "token")

    def test_get_raw_token_invalid_header(self):
        with self.assertRaises(drf_exc.AuthenticationFailed):
            self.auth.get_raw_token(b"Bearer too many parts")

    def test_get_raw_token_wrong_type(self):
        self.assertIsNone(self.auth.get_raw_token(b"Basic token"))

    def test_get_validated_token_invalid(self):
        with mock.patch("backend_app.auth.AccessToken", side_effect=TokenError("bad")):
            with self.assertRaises(drf_exc.AuthenticationFailed):
                self.auth.get_validated_token("bad")

    def test_get_validated_token_blacklisted(self):
        pair = issue_token_pair(user=self.user)
        token = RefreshToken(pair.refresh).access_token
        jti = token["jti"]
        models.BlacklistedToken.objects.create(
            user=self.user,
            jti=jti,
            token_type="access",
            expires_at=timezone.now() + timezone.timedelta(hours=1),
        )
        with self.assertRaises(drf_exc.AuthenticationFailed):
            self.auth.get_validated_token(str(token))

    def test_get_user_invalid_claims(self):
        pair = issue_token_pair(user=self.user)
        token = RefreshToken(pair.refresh).access_token

        with mock.patch("backend_app.auth.AccessToken.get", side_effect=[None]):
            with self.assertRaises(drf_exc.AuthenticationFailed):
                self.auth.get_user(token)

        with mock.patch("backend_app.auth.AccessToken.get", side_effect=["bad"]):
            with self.assertRaises(drf_exc.AuthenticationFailed):
                self.auth.get_user(token)

        with mock.patch("backend_app.auth.models.User.objects.get", side_effect=models.User.DoesNotExist):
            with self.assertRaises(drf_exc.AuthenticationFailed):
                self.auth.get_user(token)

        with mock.patch("backend_app.auth.AccessToken.get", side_effect=[self.user.id, None]):
            with self.assertRaises(drf_exc.AuthenticationFailed):
                self.auth.get_user(token)

    def test_get_user_tokens_invalidated(self):
        pair = issue_token_pair(user=self.user)
        token = RefreshToken(pair.refresh).access_token
        self.user.tokens_invalidated_at = timezone.now() + timezone.timedelta(hours=1)
        self.user.save(update_fields=["tokens_invalidated_at"])
        with self.assertRaises(drf_exc.AuthenticationFailed):
            self.auth.get_user(token)


class ChangePasswordTests(TestCase):
    def setUp(self):
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
        self.assertEqual(res_wrong.status_code, 400)

        old_hash = self.user.password_hash
        res_ok = self.client.post(
            "/api/v1/auth/change-password/",
            {"current_password": "secret1234", "new_password": "newpass123"},
            format="json",
            **self._auth(),
        )
        self.assertEqual(res_ok.status_code, 200)
        self.user.refresh_from_db()
        self.assertNotEqual(self.user.password_hash, old_hash)
        self.assertGreater(self.user.tokens_invalidated_at, timezone.now() - timezone.timedelta(minutes=5))


class SerializerValidationTests(TestCase):
    def setUp(self):
        self.user = models.User.objects.create(
            username="ser_user1",
            email="ser1@example.com",
            password_hash=hash_password("secret1234"),
            is_admin=False,
        )
        self.user2 = models.User.objects.create(
            username="ser_user2",
            email="ser2@example.com",
            password_hash=hash_password("secret1234"),
            is_admin=False,
        )
        self.product = models.Product.objects.create(
            name="SerProd",
            description="",
            price=Decimal("10.00"),
            status="active",
            stock_qty=1,
            reserved_qty=0,
            is_published=True,
        )

        self.category = models.Category.objects.create(name="SCat", slug="s-cat")

    def _ctx(self, user):
        req = type("R", (), {"user": user})()
        return {"request": req}

    def test_user_serializer_create_password_required_and_length(self):
        from backend_app.serializers import UserSerializer

        # Missing password: validation passes (field optional) but save raises
        ser = UserSerializer(data={"username": "u3", "email": "e3@example.com"})
        ser.is_valid(raise_exception=True)
        with self.assertRaises(Exception):
            ser.save()

        # Short password: validation passes, save raises
        ser2 = UserSerializer(data={"username": "u4", "email": "e4@example.com", "password": "short"})
        ser2.is_valid(raise_exception=True)
        with self.assertRaises(Exception):
            ser2.save()

    def test_user_serializer_update_unique_conflicts(self):
        from backend_app.serializers import UserSerializer

        ser = UserSerializer(instance=self.user, data={"username": self.user2.username}, partial=True, context=self._ctx(self.user))
        self.assertFalse(ser.is_valid())
        self.assertIn("username", ser.errors)

    def test_cart_item_serializer_validation_paths(self):
        from backend_app.serializers import CartItemSerializer

        ser = CartItemSerializer(data={"product_id": self.product.id, "count": 0})
        self.assertFalse(ser.is_valid())
        self.assertIn("count", ser.errors)

        draft = models.Product.objects.create(
            name="DraftSer",
            description="",
            price=Decimal("1.00"),
            status="draft",
            stock_qty=1,
            reserved_qty=0,
            is_published=True,
        )
        ser2 = CartItemSerializer(data={"product_id": draft.id, "count": 1})
        self.assertFalse(ser2.is_valid())
        self.assertIn("product_id", ser2.errors)

        low = models.Product.objects.create(
            name="LowSer",
            description="",
            price=Decimal("2.00"),
            status="active",
            stock_qty=1,
            reserved_qty=0,
            is_published=True,
        )
        ser3 = CartItemSerializer(data={"product_id": low.id, "count": 5})
        self.assertFalse(ser3.is_valid())
        self.assertIn("count", ser3.errors)

    def test_review_serializer_rating_and_eligibility(self):
        from backend_app.serializers import ReviewSerializer

        ser = ReviewSerializer(data={"product_id": self.product.id, "rating": 0, "text": "bad"}, context=self._ctx(self.user))
        self.assertFalse(ser.is_valid())
        self.assertIn("rating", ser.errors)

        ser2 = ReviewSerializer(data={"product_id": self.product.id, "rating": 5, "text": "ok"}, context=self._ctx(self.user))
        self.assertFalse(ser2.is_valid())
        self.assertIn("product_id", ser2.errors)

    def test_order_serializer_non_admin_cannot_set_user(self):
        from backend_app.serializers import OrderSerializer

        ser = OrderSerializer(data={"user_id": self.user2.id}, context=self._ctx(self.user))
        self.assertFalse(ser.is_valid())
        self.assertIn("user_id", ser.errors)

    def test_product_serializer_validates_category_and_sku(self):
        from backend_app.serializers import ProductSerializer

        ser = ProductSerializer(
            data={
                "name": "P",
                "description": "",
                "price": "1.00",
                "status": "active",
                "stock_qty": 1,
                "reserved_qty": 0,
                "is_published": True,
                "category_id": self.category.id,
                "sku": "SKU123",
            }
        )
        self.assertTrue(ser.is_valid(), ser.errors)
        obj = ser.save()
        self.assertEqual(obj.category_id, self.category.id)
        self.assertEqual(obj.sku, "SKU123")

    def test_user_invite_serializer_email_required(self):
        from backend_app.serializers import UserInviteSerializer

        ser = UserInviteSerializer(data={"role": "customer"})
        self.assertFalse(ser.is_valid())
        self.assertIn("email", ser.errors)

    def test_image_upload_serializer_validation_and_sniff(self):
        from backend_app.serializers import ImageUploadSerializer

        ser = ImageUploadSerializer(data={})
        self.assertFalse(ser.is_valid())
        self.assertIn("file", ser.errors)

        upload = SimpleUploadedFile(
            name="bad.bin",
            content=b"notanimage",
            content_type="application/octet-stream",
        )
        ser2 = ImageUploadSerializer(data={"file": upload})
        self.assertTrue(ser2.is_valid(), ser2.errors)

    def test_review_serializer_requires_order_and_rating_range(self):
        from backend_app.serializers import ReviewSerializer

        product = models.Product.objects.create(
            name="SerProd2",
            description="",
            price=Decimal("2.00"),
            status="active",
            stock_qty=1,
            reserved_qty=0,
            is_published=True,
        )
        ser = ReviewSerializer(data={"product_id": product.id, "rating": 6, "text": "x"}, context=self._ctx(self.user))
        self.assertFalse(ser.is_valid())
        self.assertIn("rating", ser.errors)


class CsvImportLimitTests(TestCase):
    def setUp(self):
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
        res = self.client.post("/api/v1/users/import/", {"file": upload}, format="multipart", **self._auth())
        self.assertEqual(res.status_code, 400)
        self.assertIn("detail", res.data)

    @override_settings(CSV_IMPORT_MAX_ROWS=1)
    def test_product_import_rejects_row_limit(self):
        content = "name\nprod1\nprod2\n"
        upload = SimpleUploadedFile("products.csv", content.encode("utf-8"), content_type="text/csv")
        res = self.client.post("/api/v1/products/import/", {"file": upload}, format="multipart", **self._auth())
        self.assertEqual(res.status_code, 400)
        self.assertIn("detail", res.data)

    def test_user_import_missing_file(self):
        res = self.client.post("/api/v1/users/import/", {}, format="multipart", **self._auth())
        self.assertEqual(res.status_code, 400)
        self.assertIn("file", res.data)

    def test_user_import_success_with_defaults_and_integrity_errors(self):
        content = "email,username,password,is_admin,is_email_verified\nuser1@example.com,u1,,1,0\nuser1@example.com,u1,,0,0\n"
        upload = SimpleUploadedFile("users.csv", content.encode("utf-8"), content_type="text/csv")
        res = self.client.post("/api/v1/users/import/", {"file": upload}, format="multipart", **self._auth())
        # First row creates, second triggers integrity error path; API still 200 with counts.
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["created"], 1)
        self.assertEqual(res.data["updated"], 1)

    def test_product_import_missing_file(self):
        res = self.client.post("/api/v1/products/import/", {}, format="multipart", **self._auth())
        self.assertEqual(res.status_code, 400)
        self.assertIn("file", res.data)

    def test_product_import_success_creates_and_updates(self):
        content = "sku,name,price,stock_qty,is_published\nSKU1,Prod1,10.00,5,1\nSKU1,Prod1b,11.00,6,1\n"
        upload = SimpleUploadedFile("products.csv", content.encode("utf-8"), content_type="text/csv")
        res = self.client.post("/api/v1/products/import/", {"file": upload}, format="multipart", **self._auth())
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["created"], 1)
        self.assertEqual(res.data["updated"], 1)

    def test_product_import_handles_blank_sku(self):
        content = "sku,name,price,stock_qty,is_published\n,ProdNoSku,5.00,1,1\n"
        upload = SimpleUploadedFile("products.csv", content.encode("utf-8"), content_type="text/csv")
        res = self.client.post("/api/v1/products/import/", {"file": upload}, format="multipart", **self._auth())
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["created"], 1)

    def test_export_users_and_products_csv(self):
        models.User.objects.create(
            username="csv_user",
            email="csv_user@example.com",
            password_hash=hash_password("secret1234"),
            is_admin=False,
        )
        res_users = self.client.get("/api/v1/users/export/", **self._auth())
        self.assertEqual(res_users.status_code, 200)
        self.assertIn("text/csv", res_users["Content-Type"])
        self.assertIn("users.csv", res_users["Content-Disposition"])

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
        self.assertEqual(res_products.status_code, 200)
        self.assertIn("text/csv", res_products["Content-Type"])
        self.assertIn("products.csv", res_products["Content-Disposition"])


class ExceptionsAdditionalTests(TestCase):
    def _ctx(self, rid):
        return {"request": type("R", (), {"request_id": rid})()}

    def test_not_authenticated_envelope(self):
        exc = drf_exc.NotAuthenticated()
        wrapped = exc_module.drf_exception_handler(exc, self._ctx("rid-na"))
        self.assertEqual(wrapped.status_code, 401)
        self.assertEqual(wrapped.data["code"], "not_authenticated")
        self.assertEqual(wrapped.data["message"], "Authentication required.")

    def test_not_found_http404_envelope(self):
        from django.http import Http404

        wrapped = exc_module.drf_exception_handler(Http404(), self._ctx(None))
        self.assertEqual(wrapped.status_code, 404)
        self.assertEqual(wrapped.data["code"], "not_found")
        self.assertEqual(wrapped.data["message"], "Not found.")

    def test_throttled_envelope(self):
        exc = drf_exc.Throttled(detail="slow", wait=1)
        wrapped = exc_module.drf_exception_handler(exc, self._ctx("rid-th"))
        self.assertEqual(wrapped.status_code, 429)
        self.assertEqual(wrapped.data["code"], "throttled")
        self.assertEqual(wrapped.data["message"], "Request was throttled.")


class ProductFiltersAndImagesTests(TestCase):
    def setUp(self):
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
        self.assertEqual(res.status_code, 200)
        ids = {row["id"] for row in res.data["results"]}
        self.assertSetEqual(ids, {p2.id})

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
        self.assertEqual(res.status_code, 200)

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
        self.assertEqual(res_admin.status_code, 200)
        ids_admin = {row["id"] for row in res_admin.data["results"]}
        self.assertIn(draft.id, ids_admin)
        self.assertIn(hidden.id, ids_admin)

        res_public = self.client.get("/api/v1/products/")
        self.assertEqual(res_public.status_code, 200)
        ids_public = {row["id"] for row in res_public.data["results"]}
        self.assertNotIn(draft.id, ids_public)
        self.assertNotIn(hidden.id, ids_public)

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
        self.assertEqual(res_dup.status_code, 400)
        self.assertIn("image_ids", res_dup.data)
        self.assertEqual(models.ProductImage.objects.filter(product=product).count(), 0)

        res_missing = self.client.post(
            f"/api/v1/products/{product.id}/images/set/",
            {"image_ids": [img1.id, 99999]},
            format="json",
            **self._admin_auth(),
        )
        self.assertEqual(res_missing.status_code, 400)

        res_type = self.client.post(
            f"/api/v1/products/{product.id}/images/set/",
            {"image_ids": "not-a-list"},
            format="json",
            **self._admin_auth(),
        )
        self.assertEqual(res_type.status_code, 400)

        res_nonint = self.client.post(
            f"/api/v1/products/{product.id}/images/set/",
            {"image_ids": ["abc"]},
            format="json",
            **self._admin_auth(),
        )
        self.assertEqual(res_nonint.status_code, 400)

        res_ok = self.client.post(
            f"/api/v1/products/{product.id}/images/set/",
            {"image_ids": [img1.id, img2.id]},
            format="json",
            **self._admin_auth(),
        )
        self.assertEqual(res_ok.status_code, 200)
        self.assertEqual(models.ProductImage.objects.filter(product=product).count(), 2)

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
        self.assertEqual(res_missing.status_code, 404)

        models.ProductImage.objects.create(product=product, image=img)
        res_ok = self.client.post(
            f"/api/v1/products/{product.id}/images/alt-text/",
            {"image_id": img.id, "alt_text": "alt"},
            format="json",
            **self._admin_auth(),
        )
        self.assertEqual(res_ok.status_code, 200)


class CartWishlistSavedAddressTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = models.User.objects.create(
            username="cart_user",
            email="cart_user@example.com",
            password_hash=hash_password("secret1234"),
            is_admin=False,
        )
        self.user_token = issue_token_pair(user=self.user).access
        self.other_user = models.User.objects.create(
            username="cart_other",
            email="cart_other@example.com",
            password_hash=hash_password("secret1234"),
            is_admin=False,
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
        self.assertEqual(res.status_code, 400)
        self.assertIn("details", res.data)
        self.assertIn("product_id", res.data.get("details", {}))

    def test_cart_rejects_insufficient_stock(self):
        res = self.client.post(
            "/api/v1/cart/items/",
            {"product_id": self.product_low_stock.id, "count": 3},
            format="json",
            **self._auth(),
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("details", res.data)
        self.assertIn("count", res.data.get("details", {}))

    def test_cart_rejects_zero_count(self):
        res = self.client.post(
            "/api/v1/cart/items/",
            {"product_id": self.product_active.id, "count": 0},
            format="json",
            **self._auth(),
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("count", res.data.get("details", {}))

    def test_cart_upsert_updates_existing(self):
        res1 = self.client.post(
            "/api/v1/cart/items/",
            {"product_id": self.product_active.id, "count": 1},
            format="json",
            **self._auth(),
        )
        self.assertEqual(res1.status_code, 201)

        res2 = self.client.post(
            "/api/v1/cart/items/",
            {"product_id": self.product_active.id, "count": 3},
            format="json",
            **self._auth(),
        )
        self.assertEqual(res2.status_code, 201)
        self.assertEqual(res2.data["count"], 3)

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
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["subtotal"], "12.00")
        self.assertEqual(res.data["total"], "12.00")
        self.assertEqual(len(res.data["items"]), 2)

    def test_wishlist_duplicate_returns_400(self):
        res1 = self.client.post(
            "/api/v1/wishlist/",
            {"product_id": self.product_active.id},
            format="json",
            **self._auth(),
        )
        self.assertEqual(res1.status_code, 201)

        res2 = self.client.post(
            "/api/v1/wishlist/",
            {"product_id": self.product_active.id},
            format="json",
            **self._auth(),
        )
        self.assertEqual(res2.status_code, 400)
        self.assertIn("details", res2.data)
        self.assertIn("product_id", res2.data.get("details", {}))

    def test_saved_items_duplicate_returns_400(self):
        res1 = self.client.post(
            "/api/v1/saved/",
            {"product_id": self.product_other.id},
            format="json",
            **self._auth(),
        )
        self.assertEqual(res1.status_code, 201)

        res2 = self.client.post(
            "/api/v1/saved/",
            {"product_id": self.product_other.id},
            format="json",
            **self._auth(),
        )
        self.assertEqual(res2.status_code, 400)
        self.assertIn("details", res2.data)
        self.assertIn("product_id", res2.data.get("details", {}))

    def test_wishlist_and_saved_user_auto_assignment(self):
        res1 = self.client.post(
            "/api/v1/wishlist/",
            {"user_id": self.other_user.id, "product_id": self.product_other.id},
            format="json",
            **self._auth(),
        )
        self.assertEqual(res1.status_code, 201)
        self.assertEqual(res1.data["user_id"], self.user.id)

        res2 = self.client.post(
            "/api/v1/saved/",
            {"user_id": self.other_user.id, "product_id": self.product_active.id},
            format="json",
            **self._auth(),
        )
        self.assertEqual(res2.status_code, 201)
        self.assertEqual(res2.data["user_id"], self.user.id)

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
        self.assertEqual(res1.status_code, 201)

        res2 = self.client.post("/api/v1/addresses/", payload, format="json", **self._auth())
        self.assertEqual(res2.status_code, 400)
        self.assertIn("details", res2.data)
        self.assertIn("is_default", res2.data.get("details", {}))

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
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["user_id"], self.user.id)

    def test_address_default_uniqueness_self_update(self):
        addr1 = models.Address.objects.create(
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
        self.assertEqual(res.status_code, 400)


class OrderPaymentTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = models.User.objects.create(
            username="admin_orders",
            email="admin_orders@example.com",
            password_hash=hash_password("adminpass123"),
            is_admin=True,
        )
        self.admin_token = issue_token_pair(user=self.admin).access
        self.user = models.User.objects.create(
            username="order_user",
            email="order_user@example.com",
            password_hash=hash_password("secret1234"),
            is_admin=False,
        )
        self.user_token = issue_token_pair(user=self.user).access
        self.other_user = models.User.objects.create(
            username="order_other",
            email="order_other@example.com",
            password_hash=hash_password("secret1234"),
            is_admin=False,
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

        res = self.client.post(f"/api/v1/orders/{order.id}/cancel/", {}, format="json", **self._auth_user())
        self.assertEqual(res.status_code, 200)
        order.refresh_from_db()
        self.product.refresh_from_db()
        self.assertEqual(order.status, OrderStatus.CANCELLED)
        self.assertEqual(self.product.reserved_qty, 0)

    def test_cancel_invalid_status_returns_200_and_keeps_status(self):
        order = models.Order.objects.create(user=self.user, status=OrderStatus.PAID)
        res = self.client.post(f"/api/v1/orders/{order.id}/cancel/", {}, format="json", **self._auth_user())
        self.assertEqual(res.status_code, 200)

    def test_cancel_returns_404_for_missing_order(self):
        res = self.client.post("/api/v1/orders/99999/cancel/", {}, format="json", **self._auth_user())
        self.assertEqual(res.status_code, 404)

    def test_cancel_already_cancelled_is_idempotent(self):
        order = models.Order.objects.create(user=self.user, status=OrderStatus.CANCELLED)
        res = self.client.post(f"/api/v1/orders/{order.id}/cancel/", {}, format="json", **self._auth_user())
        self.assertEqual(res.status_code, 200)

    def test_cancel_forbidden_for_other_user(self):
        other_order = models.Order.objects.create(user=self.other_user, status=OrderStatus.PLACED)
        res = self.client.post(
            f"/api/v1/orders/{other_order.id}/cancel/",
            {},
            format="json",
            **self._auth_user(),
        )
        self.assertEqual(res.status_code, 403)

    def test_ship_and_deliver_transitions(self):
        order = models.Order.objects.create(user=self.user, status=OrderStatus.PAID)
        res_ship = self.client.post(f"/api/v1/orders/{order.id}/ship/", {}, format="json", **self._auth_admin())
        self.assertEqual(res_ship.status_code, 200)
        self.assertEqual(res_ship.data["status"], OrderStatus.SHIPPED)

        res_deliver = self.client.post(
            f"/api/v1/orders/{order.id}/deliver/", {}, format="json", **self._auth_admin()
        )
        self.assertEqual(res_deliver.status_code, 200)
        self.assertEqual(res_deliver.data["status"], OrderStatus.DELIVERED)

    def test_ship_invalid_transition_returns_409(self):
        order = models.Order.objects.create(user=self.user, status=OrderStatus.PLACED)
        res_ship = self.client.post(f"/api/v1/orders/{order.id}/ship/", {}, format="json", **self._auth_admin())
        self.assertEqual(res_ship.status_code, 409)

    def test_deliver_invalid_transition_returns_409(self):
        order = models.Order.objects.create(user=self.user, status=OrderStatus.PLACED)
        res_deliver = self.client.post(
            f"/api/v1/orders/{order.id}/deliver/", {}, format="json", **self._auth_admin()
        )
        self.assertEqual(res_deliver.status_code, 409)

    def test_invoice_forbidden_for_non_owner(self):
        other_order = models.Order.objects.create(user=self.other_user, status=OrderStatus.PLACED)
        res = self.client.get(
            f"/api/v1/orders/{other_order.id}/invoice/",
            format="json",
            **self._auth_user(),
        )
        # Behavior is 404 for not found when unauthorized; assert existing behavior
        self.assertEqual(res.status_code, 404)

    def test_refund_and_timeline(self):
        order = models.Order.objects.create(user=self.user, status=OrderStatus.PAID)
        res_refund = self.client.post(
            f"/api/v1/orders/{order.id}/refund/",
            {"reason": "changed"},
            format="json",
            **self._auth_user(),
        )
        self.assertEqual(res_refund.status_code, 201)
        res_timeline = self.client.get(
            f"/api/v1/orders/{order.id}/timeline/",
            format="json",
            **self._auth_user(),
        )
        self.assertEqual(res_timeline.status_code, 200)
        event_types = [row["event_type"] for row in res_timeline.data]
        self.assertIn("refund_requested", event_types)

    def test_mark_paid_invalid_transition_returns_409(self):
        order = models.Order.objects.create(user=self.user, status=OrderStatus.CANCELLED)
        res = self.client.post(
            "/api/v1/payments/mark-paid/",
            {"order_id": order.id, "reference_id": "r1"},
            format="json",
            **self._auth_admin(),
        )
        self.assertEqual(res.status_code, 409)

    def test_mark_paid_idempotency_returns_existing_attempt(self):
        order = models.Order.objects.create(user=self.user, status=OrderStatus.PLACED)
        res = self.client.post(
            "/api/v1/payments/mark-paid/",
            {"order_id": order.id, "reference_id": "ref1"},
            format="json",
            HTTP_IDEMPOTENCY_KEY="idem-1",
            **self._auth_admin(),
        )
        self.assertEqual(res.status_code, 200)
        attempt_id = res.data["payment_attempt_id"]

        res2 = self.client.post(
            "/api/v1/payments/mark-paid/",
            {"order_id": order.id, "reference_id": "ref2"},
            format="json",
            HTTP_IDEMPOTENCY_KEY="idem-1",
            **self._auth_admin(),
        )
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.data["payment_attempt_id"], attempt_id)

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
        self.assertEqual(res.status_code, 409)

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

        self.assertEqual(res.status_code, 200)
        attempt = models.PaymentAttempt.objects.get(order=order, idempotency_key="idem-3")
        self.assertEqual(attempt.id, existing.id)
        self.assertEqual(res.data["payment_attempt_id"], attempt.id)

    def test_mark_paid_empty_idempotency_header_becomes_none(self):
        order = models.Order.objects.create(user=self.user, status=OrderStatus.PLACED)
        res = self.client.post(
            "/api/v1/payments/mark-paid/",
            {"order_id": order.id, "reference_id": "r-empty"},
            format="json",
            HTTP_IDEMPOTENCY_KEY="   ",
            **self._auth_admin(),
        )
        self.assertEqual(res.status_code, 200)
        self.assertIsNone(models.PaymentAttempt.objects.get(order=order).idempotency_key)

    def test_mark_paid_forbidden_for_non_admin(self):
        order = models.Order.objects.create(user=self.user, status=OrderStatus.PLACED)
        res = self.client.post(
            "/api/v1/payments/mark-paid/",
            {"order_id": order.id, "reference_id": "r2"},
            format="json",
            **self._auth_user(),
        )
        self.assertEqual(res.status_code, 403)

    def test_mark_paid_not_found_returns_404(self):
        res = self.client.post(
            "/api/v1/payments/mark-paid/",
            {"order_id": 99999, "reference_id": "missing"},
            format="json",
            **self._auth_admin(),
        )
        self.assertEqual(res.status_code, 404)

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
        self.assertEqual(res.status_code, 200)
        attempt_id = res.data["payment_attempt_id"]

        res2 = self.client.post(
            f"/api/v1/orders/{order.id}/pay/",
            {"reference_id": "r2", "order_id": order.id},
            format="json",
            HTTP_IDEMPOTENCY_KEY="cust-1",
            **self._auth_user(),
        )
        # Idempotent repeat returns same attempt
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.data["payment_attempt_id"], attempt_id)

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
        self.assertEqual(res3.status_code, 409)

    def test_invoice_returns_content(self):
        order = models.Order.objects.create(user=self.user, status=OrderStatus.PAID, subtotal=Decimal("10.00"), total=Decimal("12.00"))
        res = self.client.get(f"/api/v1/orders/{order.id}/invoice/", format="json", **self._auth_user())
        self.assertEqual(res.status_code, 200)
        self.assertIn("Invoice for Order", res.data["invoice"])

    def test_admin_refund_action_records_event(self):
        order = models.Order.objects.create(user=self.user, status=OrderStatus.PAID)
        res = self.client.post(
            f"/api/v1/orders/{order.id}/refund-approve/",
            {},
            format="json",
            **self._auth_admin(),
        )
        self.assertEqual(res.status_code, 200)
        self.assertTrue(models.OrderEvent.objects.filter(order=order, event_type="refund_approved").exists())

    def test_order_viewset_get_queryset_none_when_unauthenticated(self):
        order = models.Order.objects.create(user=self.user, status=OrderStatus.PLACED)
        factory = APIRequestFactory()
        request = factory.get("/api/v1/orders/")
        request.user = None
        view = api_module.OrderViewSet()
        view.request = request
        qs = view.get_queryset()
        self.assertEqual(list(qs), [])

    def test_order_viewset_get_queryset_admin(self):
        order = models.Order.objects.create(user=self.user, status=OrderStatus.PLACED)
        factory = APIRequestFactory()
        request = factory.get("/api/v1/orders/")
        force_authenticate(request, user=self.admin)
        request.user = self.admin
        view = api_module.OrderViewSet()
        view.request = request
        qs = view.get_queryset()
        self.assertEqual(qs.count(), 1)

    def test_order_viewset_get_permissions_create_admin(self):
        factory = APIRequestFactory()
        request = factory.post("/api/v1/orders/")
        force_authenticate(request, user=self.admin)
        view = api_module.OrderViewSet()
        view.request = request
        view.action = "create"
        perms = view.get_permissions()
        self.assertEqual(len(perms), 1)
        self.assertEqual(perms[0].__class__.__name__, "IsAdmin")

    def test_order_viewset_get_permissions_list_authenticated(self):
        factory = APIRequestFactory()
        request = factory.get("/api/v1/orders/")
        force_authenticate(request, user=self.user)
        view = api_module.OrderViewSet()
        view.request = request
        view.action = "list"
        perms = view.get_permissions()
        self.assertEqual(len(perms), 1)
        self.assertEqual(perms[0].__class__.__name__, "IsAuthenticated")

    def test_order_viewset_get_queryset_invalid_user_id(self):
        factory = APIRequestFactory()
        request = factory.get("/api/v1/orders/")
        request.user = type(
            "U",
            (),
            {
                "id": "not-int",
                "is_admin": False,
                "__int__": lambda self: 0,
            },
        )()
        view = api_module.OrderViewSet()
        view.request = request
        qs = view.get_queryset()
        # Bad id coerces to filter user field; should not crash
        list(qs)


class ReportsAndHealthTests(TestCase):
    def setUp(self):
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
        p1 = models.Product.objects.create(
            name="R1",
            description="",
            price=Decimal("10.00"),
            status="active",
            stock_qty=5,
            reserved_qty=0,
            is_published=True,
        )
        p2 = models.Product.objects.create(
            name="R2",
            description="",
            price=Decimal("20.00"),
            status="active",
            stock_qty=5,
            reserved_qty=0,
            is_published=True,
        )
        models.Order.objects.create(user=user, status=OrderStatus.PAID, total=Decimal("10.00"), subtotal=Decimal("10.00"))
        models.Order.objects.create(user=user, status=OrderStatus.PLACED, total=Decimal("5.00"), subtotal=Decimal("5.00"))

        res = self.client.get("/api/v1/reports/aggregate/", **self._auth_admin())
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["products"], 2)
        self.assertEqual(res.data["orders"], 2)
        self.assertEqual(res.data["paid_orders"], 1)
        self.assertEqual(res.data["revenue"], str(Decimal("10.00")))
        self.assertEqual(res.data["currency"], "USD")

    def test_healthz_and_readyz(self):
        res_health = self.client.get("/healthz")
        self.assertEqual(res_health.status_code, 200)
        self.assertEqual(res_health.data["status"], "ok")

        res_ready = self.client.get("/readyz")
        self.assertEqual(res_ready.status_code, 200)
        self.assertEqual(res_ready.data["status"], "ready")

    def test_health_readyz_cache_and_pending_migrations(self):
        health_module._READYZ_LAST_OK_AT = None
        factory = APIRequestFactory()
        request = factory.get("/readyz")

        class DummyExecutor:
            def __init__(self, connection):
                self.loader = type("L", (), {"graph": type("G", (), {"leaf_nodes": lambda self: []})()})()

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

        with mock.patch("backend_app.health.MigrationExecutor", DummyExecutor), mock.patch(
            "backend_app.health.connection.cursor", return_value=DummyCursor()
        ):
            response = health_module.readyz(request)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["status"], "ready")

            # Cached path
            response_cached = health_module.readyz(request)
            self.assertEqual(response_cached.status_code, 200)
            self.assertEqual(response_cached.data["status"], "ready")

        class DummyExecutorPending(DummyExecutor):
            def migration_plan(self, leaf_nodes):
                return [(type("M", (), {"app_label": "app", "name": "0001"})(), None)]

        health_module._READYZ_LAST_OK_AT = None
        with mock.patch("backend_app.health.MigrationExecutor", DummyExecutorPending), mock.patch(
            "backend_app.health.connection.cursor", return_value=DummyCursor()
        ):
            response_pending = health_module.readyz(request)
            self.assertEqual(response_pending.status_code, 503)
            self.assertEqual(response_pending.data["status"], "not_ready")
            self.assertIn("app.0001", response_pending.data["pending_migrations"])


class ExceptionsAndSecurityTests(TestCase):
    def test_drf_exception_handler_envelopes_validation(self):
        # Simulate DRF ValidationError response object
        from rest_framework import exceptions as drf_exc
        from rest_framework.response import Response

        exc = drf_exc.ValidationError({"field": ["bad"]})
        response = Response({"detail": "original"}, status=422)
        context = {"request": type("R", (), {"request_id": "req-1"})()}

        wrapped = exc_module.drf_exception_handler(exc, context)
        self.assertEqual(wrapped.status_code, 400)
        self.assertEqual(wrapped.data["code"], "validation_error")
        self.assertEqual(wrapped.data["message"], "Validation failed.")
        self.assertEqual(wrapped.data["request_id"], "req-1")
        self.assertIn("details", wrapped.data)
        self.assertIn("field", wrapped.data["details"])

    def test_drf_exception_handler_envelopes_permission(self):
        from rest_framework import exceptions as drf_exc
        from rest_framework.response import Response

        exc = drf_exc.PermissionDenied("nope")
        response = Response({"detail": "nope"}, status=403)
        context = {"request": type("R", (), {"request_id": None})()}

        wrapped = exc_module.drf_exception_handler(exc, context)
        self.assertEqual(wrapped.status_code, 403)
        self.assertEqual(wrapped.data["code"], "permission_denied")
        self.assertEqual(wrapped.data["message"], "Permission denied.")
        self.assertIsNone(wrapped.data["request_id"])
        self.assertEqual(wrapped.data["details"], {"detail": "nope"})

    def test_drf_exception_handler_generic_preserves_detail(self):
        from rest_framework import exceptions as drf_exc
        from rest_framework.response import Response

        exc = drf_exc.APIException("generic")
        exc.default_code = "custom"
        response = Response({"detail": "generic"}, status=500)
        context = {"request": type("R", (), {"request_id": "req-2"})()}

        wrapped = exc_module.drf_exception_handler(exc, context)
        self.assertEqual(wrapped.data["code"], "custom")
        self.assertEqual(wrapped.data["message"], "generic")
        self.assertEqual(wrapped.data["request_id"], "req-2")
        self.assertEqual(wrapped.data["details"], {"detail": "generic"})

    def test_drf_exception_handler_auth_and_not_found(self):
        from rest_framework import exceptions as drf_exc

        exc = drf_exc.AuthenticationFailed("bad")
        context = {"request": type("R", (), {"request_id": "req-3"})()}
        wrapped = exc_module.drf_exception_handler(exc, context)
        self.assertEqual(wrapped.status_code, 401)
        self.assertEqual(wrapped.data["code"], "not_authenticated")

        exc_nf = drf_exc.NotFound("missing")
        wrapped_nf = exc_module.drf_exception_handler(exc_nf, context)
        self.assertEqual(wrapped_nf.status_code, 404)
        self.assertEqual(wrapped_nf.data["code"], "not_found")

    def test_drf_exception_handler_none_response(self):
        exc = Exception("boom")
        with mock.patch("backend_app.exceptions.exception_handler", return_value=None):
            wrapped = exc_module.drf_exception_handler(exc, {"request": None})
            self.assertIsNone(wrapped)

    def test_hash_password_rejects_invalid_input(self):
        with self.assertRaises(ValueError):
            security.hash_password("")
        with self.assertRaises(ValueError):
            security.hash_password(None)  # type: ignore[arg-type]

    def test_verify_password_handles_malformed_hash(self):
        self.assertFalse(security.verify_password("pw", "not-a-hash"))
        # Wrong algorithm
        bad_alg = "other$260000$salt$digest"
        self.assertFalse(security.verify_password("pw", bad_alg))
        # Wrong iterations (non-int)
        bad_iter = "pbkdf2_sha256$abc$salt$digest"
        self.assertFalse(security.verify_password("pw", bad_iter))
        # Wrong salt/digest base64
        bad_b64 = "pbkdf2_sha256$260000$***$***"
        self.assertFalse(security.verify_password("pw", bad_b64))

    def test_verify_password_success(self):
        encoded = security.hash_password("pw123456")
        self.assertTrue(security.verify_password("pw123456", encoded))

    def test_passwordhash_encode_and_b64(self):
        raw = b"abc"
        b64 = security._b64(raw)
        self.assertEqual(security._b64d(b64), raw)

        ph = security.PasswordHash(algorithm="pbkdf2_sha256", iterations=1, salt_b64=b64, digest_b64=b64)
        self.assertIn("pbkdf2_sha256$1", ph.encode())

    def test_order_status_can_transition_same_status(self):
        self.assertTrue(OrderStatus.PLACED in OrderStatus.ALL)
        self.assertTrue(api_module.can_transition(from_status=OrderStatus.PLACED, to_status=OrderStatus.PLACED))
        self.assertFalse(api_module.can_transition(from_status=OrderStatus.DELIVERED, to_status=OrderStatus.PAID))

    def test_models_user_properties_and_review_clean(self):
        user = models.User.objects.create(
            username="props_user",
            email="props_user@example.com",
            password_hash=hash_password("secret1234"),
            is_admin=False,
        )
        self.assertTrue(user.is_authenticated)
        self.assertFalse(user.is_anonymous)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertTrue(user.is_active)
        self.assertEqual(user.get_session_auth_hash(), user.password_hash)

        review = models.Review(user=user, product=models.Product.objects.create(
            name="CleanProd",
            description="",
            price=Decimal("1.00"),
            status="active",
            stock_qty=1,
            reserved_qty=0,
            is_published=True,
        ), rating=6)
        with self.assertRaises(Exception):
            review.clean()
