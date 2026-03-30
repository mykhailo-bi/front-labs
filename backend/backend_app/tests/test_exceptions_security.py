import pytest
from decimal import Decimal
from unittest import mock
from backend_app import models
from backend_app import api as api_module
from backend_app import exceptions as exc_module
from backend_app import security
from backend_app.domain.order_status import OrderStatus
from backend_app.security import hash_password

pytestmark = pytest.mark.django_db


class ExceptionsAndSecurityTests:
    def test_drf_exception_handler_envelopes_validation(self):
        # Simulate DRF ValidationError response object
        from rest_framework import exceptions as drf_exc

        exc = drf_exc.ValidationError({"field": ["bad"]})
        context = {"request": type("R", (), {"request_id": "req-1"})()}

        wrapped = exc_module.drf_exception_handler(exc, context)
        assert wrapped.status_code == 400
        assert wrapped.data["code"] == "validation_error"
        assert wrapped.data["message"] == "Validation failed."
        assert wrapped.data["request_id"] == "req-1"
        assert "details" in wrapped.data
        assert "field" in wrapped.data["details"]

    def test_drf_exception_handler_envelopes_permission(self):
        from rest_framework import exceptions as drf_exc

        exc = drf_exc.PermissionDenied("nope")
        context = {"request": type("R", (), {"request_id": None})()}

        wrapped = exc_module.drf_exception_handler(exc, context)
        assert wrapped.status_code == 403
        assert wrapped.data["code"] == "permission_denied"
        assert wrapped.data["message"] == "Permission denied."
        assert wrapped.data["request_id"] is None
        assert wrapped.data["details"] == {"detail": "nope"}

    def test_drf_exception_handler_generic_preserves_detail(self):
        from rest_framework import exceptions as drf_exc

        exc = drf_exc.APIException("generic")
        exc.default_code = "custom"
        context = {"request": type("R", (), {"request_id": "req-2"})()}

        wrapped = exc_module.drf_exception_handler(exc, context)
        assert wrapped.data["code"] == "custom"
        assert wrapped.data["message"] == "generic"
        assert wrapped.data["request_id"] == "req-2"
        assert wrapped.data["details"] == {"detail": "generic"}

    def test_drf_exception_handler_auth_and_not_found(self):
        from rest_framework import exceptions as drf_exc

        exc = drf_exc.AuthenticationFailed("bad")
        context = {"request": type("R", (), {"request_id": "req-3"})()}
        wrapped = exc_module.drf_exception_handler(exc, context)
        assert wrapped.status_code == 401
        assert wrapped.data["code"] == "not_authenticated"

        exc_nf = drf_exc.NotFound("missing")
        wrapped_nf = exc_module.drf_exception_handler(exc_nf, context)
        assert wrapped_nf.status_code == 404
        assert wrapped_nf.data["code"] == "not_found"

    def test_drf_exception_handler_none_response(self):
        exc = Exception("boom")
        with mock.patch("backend_app.exceptions.exception_handler", return_value=None):
            wrapped = exc_module.drf_exception_handler(exc, {"request": None})
            assert wrapped is None

    def test_hash_password_rejects_invalid_input(self):
        with pytest.raises(ValueError):
            security.hash_password("")
        with pytest.raises(ValueError):
            security.hash_password(None)  # type: ignore[arg-type]

    def test_verify_password_handles_malformed_hash(self):
        assert not security.verify_password("pw", "not-a-hash")
        # Wrong algorithm
        bad_alg = "other$260000$salt$digest"
        assert not security.verify_password("pw", bad_alg)
        # Wrong iterations (non-int)
        bad_iter = "pbkdf2_sha256$abc$salt$digest"
        assert not security.verify_password("pw", bad_iter)
        # Wrong salt/digest base64
        bad_b64 = "pbkdf2_sha256$260000$***$***"
        assert not security.verify_password("pw", bad_b64)

    def test_verify_password_success(self):
        encoded = security.hash_password("pw123456")
        assert security.verify_password("pw123456", encoded)

    def test_passwordhash_encode_and_b64(self):
        raw = b"abc"
        b64 = security._b64(raw)
        assert security._b64d(b64) == raw

        ph = security.PasswordHash(
            algorithm="pbkdf2_sha256", iterations=1, salt_b64=b64, digest_b64=b64
        )
        assert "pbkdf2_sha256$1" in ph.encode()

    def test_order_status_can_transition_same_status(self):
        assert OrderStatus.PLACED in OrderStatus.ALL
        assert api_module.can_transition(
            from_status=OrderStatus.PLACED, to_status=OrderStatus.PLACED
        )
        assert not api_module.can_transition(
            from_status=OrderStatus.DELIVERED, to_status=OrderStatus.PAID
        )

    def test_models_user_properties_and_review_clean(self):
        user = models.User.objects.create(
            username="props_user",
            email="props_user@example.com",
            password_hash=hash_password("secret1234"),
        )
        assert user.is_authenticated
        assert not user.is_anonymous
        assert not user.is_staff
        assert not user.is_superuser
        assert user.is_active
        assert user.get_session_auth_hash() == user.password_hash

        review = models.Review(
            user=user,
            product=models.Product.objects.create(
                name="CleanProd",
                description="",
                price=Decimal("1.00"),
                status="active",
                stock_qty=1,
                reserved_qty=0,
                is_published=True,
            ),
            rating=6,
        )
        with pytest.raises(Exception):
            review.clean()
