import pytest
from django.db import transaction
from django.db.utils import IntegrityError
from backend_app import models
from backend_app.security import hash_password

pytestmark = pytest.mark.django_db

class DbConstraintTests:
    @pytest.fixture(autouse=True)
    def _setup(self):
        self.user = models.User.objects.create(
            username="u1",
            email="u1@example.com",
            password_hash=hash_password("secret1234"),
            is_admin=False,
        )

    def test_order_idempotency_key_unique_per_user_when_not_null(self):
        models.Order.objects.create(user=self.user, idempotency_key="idem-1")

        # With a DB constraint, the second insert must fail.
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                models.Order.objects.create(user=self.user, idempotency_key="idem-1")

    def test_payment_attempt_idempotency_key_unique_per_order_when_not_null(self):
        order = models.Order.objects.create(user=self.user, idempotency_key="order-idem-1")
        models.PaymentAttempt.objects.create(order=order, idempotency_key="pay-idem-1")

        with pytest.raises(IntegrityError):
            with transaction.atomic():
                models.PaymentAttempt.objects.create(order=order, idempotency_key="pay-idem-1")
