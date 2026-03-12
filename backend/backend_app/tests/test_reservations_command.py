import pytest
from decimal import Decimal
from datetime import timedelta
from unittest import mock
from django.utils import timezone
from django.core.management import call_command
from backend_app import models
from backend_app.domain.order_status import OrderStatus
from backend_app.security import hash_password
from backend_app.management.commands import release_expired_reservations as release_cmd

pytestmark = pytest.mark.django_db

class ReservationExpiryCommandTests:
    @pytest.fixture(autouse=True)
    def _setup(self):
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
        assert order.status == OrderStatus.CANCELLED
        assert self.product.reserved_qty == 0

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
            assert stdout.write.called

        self.product.refresh_from_db()
        assert self.product.reserved_qty == 0

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
            assert stdout.write.called
