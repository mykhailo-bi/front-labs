from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from backend_app.domain.order_status import OrderStatus
from backend_app.models import Order, OrderContent, Product


class Command(BaseCommand):
    help = "Release reserved stock for expired, unpaid orders."

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            type=int,
            default=500,
            help="Max number of orders to process in one run (default: 500)",
        )

    def handle(self, *args, **options):
        limit: int = options["limit"]
        now = timezone.now()

        # Process in batches; each order is handled under a row lock to be safe.
        # Idempotency: once cancelled, we won't touch it again.
        order_ids = list(
            Order.objects.filter(
                status=OrderStatus.PLACED,
                reservation_expires_at__isnull=False,
                reservation_expires_at__lte=now,
            )
            .order_by("id")
            .values_list("id", flat=True)[:limit]
        )

        released_orders = 0
        released_lines = 0

        for order_id in order_ids:
            with transaction.atomic():
                order = Order.objects.select_for_update().get(id=order_id)

                # Re-check under lock.
                if order.status != OrderStatus.PLACED:
                    continue
                if (
                    not order.reservation_expires_at
                    or order.reservation_expires_at > now
                ):
                    continue

                lines = list(
                    OrderContent.objects.filter(order=order).values(
                        "product_id", "count"
                    )
                )

                # Defensive release: data drift (manual edits/bugs) can cause reserved_qty to be
                # lower than expected. Since the Product model has DB check constraints that
                # reserved_qty must be >= 0, clamp at 0 to keep the command operational.
                product_ids = [row["product_id"] for row in lines]
                products_by_id = {
                    p.id: p
                    for p in Product.objects.select_for_update().filter(
                        id__in=product_ids
                    )
                }

                for line in lines:
                    product = products_by_id.get(line["product_id"])
                    if product is None:
                        continue
                    decrement = int(line["count"])
                    new_reserved = int(product.reserved_qty) - decrement
                    if new_reserved < 0:
                        new_reserved = 0

                    Product.objects.filter(id=product.id).update(
                        reserved_qty=new_reserved,
                        updated_at=now,
                    )
                released_lines += len(lines)

                order.status = OrderStatus.CANCELLED
                order.cancelled_at = now
                order.save(update_fields=["status", "cancelled_at", "updated_at"])
                released_orders += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Released reservations for {released_orders} orders ({released_lines} line items)."
            )
        )
